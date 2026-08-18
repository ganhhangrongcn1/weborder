-- Loyalty rolling expiry: every new positive point event becomes an independent lot.
-- A lot expires exactly 60 days after its ledger timestamp. Debits consume the
-- earliest-expiring usable lots first.
-- Transition policy: the balance available before cutover is grandfathered
-- under its existing account expiry and is not shortened to 60 days.

create schema if not exists loyalty_private;

create table if not exists loyalty_private.point_lots (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  source_ledger_id text not null references public.loyalty_ledger(id) on delete cascade,
  earned_points integer not null check (earned_points > 0),
  remaining_points integer not null check (remaining_points between 0 and earned_points),
  earned_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint point_lots_source_ledger_unique unique (source_ledger_id),
  constraint point_lots_expiry_check check (expires_at > earned_at)
);

create index if not exists point_lots_phone_expiry_idx
on loyalty_private.point_lots (customer_phone, expires_at, earned_at, id)
where remaining_points > 0;

create table if not exists loyalty_private.point_lot_allocations (
  id uuid primary key default gen_random_uuid(),
  debit_ledger_id text not null references public.loyalty_ledger(id) on delete cascade,
  lot_id uuid not null references loyalty_private.point_lots(id) on delete cascade,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  constraint point_lot_allocations_debit_lot_unique unique (debit_ledger_id, lot_id)
);

create index if not exists point_lot_allocations_lot_idx
on loyalty_private.point_lot_allocations (lot_id);

revoke all on loyalty_private.point_lots from public, anon, authenticated;
revoke all on loyalty_private.point_lot_allocations from public, anon, authenticated;

create or replace function loyalty_private.refresh_loyalty_point_expiry(p_phone text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_next_expiry timestamptz;
begin
  select min(l.expires_at)
  into v_next_expiry
  from loyalty_private.point_lots l
  where l.customer_phone = v_phone
    and l.remaining_points > 0
    and l.expires_at > now()
    and l.expires_at <> 'infinity'::timestamptz;

  update public.loyalty_accounts
  set points_expires_at = v_next_expiry,
      updated_at = now()
  where customer_phone = v_phone;
end;
$$;

create or replace function loyalty_private.allocate_loyalty_debit(
  p_debit_ledger_id text,
  p_phone text,
  p_points integer,
  p_at timestamptz default now(),
  p_include_expired boolean default false
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_needed integer := greatest(coalesce(p_points, 0), 0);
  v_take integer;
  v_lot record;
begin
  if v_needed = 0 then
    return 0;
  end if;

  for v_lot in
    select l.id, l.remaining_points
    from loyalty_private.point_lots l
    where l.customer_phone = v_phone
      and l.remaining_points > 0
      and (p_include_expired or l.expires_at > p_at)
    order by l.expires_at, l.earned_at, l.id
    for update
  loop
    exit when v_needed = 0;
    v_take := least(v_needed, v_lot.remaining_points);

    update loyalty_private.point_lots
    set remaining_points = remaining_points - v_take
    where id = v_lot.id;

    insert into loyalty_private.point_lot_allocations (debit_ledger_id, lot_id, points, created_at)
    values (p_debit_ledger_id, v_lot.id, v_take, p_at)
    on conflict (debit_ledger_id, lot_id) do update
    set points = loyalty_private.point_lot_allocations.points + excluded.points;

    v_needed := v_needed - v_take;
  end loop;

  perform loyalty_private.refresh_loyalty_point_expiry(v_phone);
  return greatest(coalesce(p_points, 0), 0) - v_needed;
end;
$$;

create or replace function loyalty_private.expire_loyalty_account_if_due(
  p_phone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_lot record;
  v_event_id text;
  v_expiry_key text;
  v_expired_any boolean := false;
begin
  if v_phone = '' then
    return false;
  end if;

  insert into public.loyalty_accounts (customer_phone, total_points, metadata)
  values (v_phone, 0, jsonb_build_object('source', 'loyalty_v2'))
  on conflict (customer_phone) do nothing;

  perform 1
  from public.loyalty_accounts
  where customer_phone = v_phone
  for update;

  for v_lot in
    select l.id, l.source_ledger_id, l.remaining_points, l.expires_at
    from loyalty_private.point_lots l
    where l.customer_phone = v_phone
      and l.remaining_points > 0
      and l.expires_at <= p_at
    order by l.expires_at, l.earned_at, l.id
    for update
  loop
    v_expiry_key := 'loyalty-lot-expiry:' || v_lot.id::text;
    v_event_id := 'loyalty-expiry-' || gen_random_uuid()::text;

    insert into public.loyalty_ledger (
      id, customer_phone, entry_type, points, amount, title, note, metadata,
      source, source_type, source_order_id, action, action_version,
      idempotency_key, actor_type, created_at
    ) values (
      v_event_id, v_phone, 'POINTS_EXPIRED', -v_lot.remaining_points, 0,
      'Điểm đã hết hạn',
      'Hết hạn sau 60 ngày kể từ ngày nhận điểm',
      jsonb_build_object(
        'source', 'loyalty_rolling_60_days',
        'sourceLedgerId', v_lot.source_ledger_id,
        'lotId', v_lot.id,
        'expiredAt', v_lot.expires_at
      ),
      'system', 'LOYALTY_LOT', v_lot.id::text, 'EXPIRE_POINTS', 1,
      v_expiry_key, 'SYSTEM', p_at
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id into v_event_id;

    if v_event_id is not null then
      insert into loyalty_private.point_lot_allocations (debit_ledger_id, lot_id, points, created_at)
      values (v_event_id, v_lot.id, v_lot.remaining_points, p_at)
      on conflict (debit_ledger_id, lot_id) do nothing;

      update loyalty_private.point_lots
      set remaining_points = 0
      where id = v_lot.id;

      v_expired_any := true;
    end if;
  end loop;

  perform loyalty_private.refresh_loyalty_point_expiry(v_phone);
  return v_expired_any;
end;
$$;

create or replace function loyalty_private.guard_loyalty_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_max_points integer;
  v_available_points integer;
begin
  if new.action = 'SPEND' then
    perform loyalty_private.expire_loyalty_account_if_due(new.customer_phone, now());

    perform 1
    from loyalty_private.point_lots l
    where l.customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      and l.remaining_points > 0
      and l.expires_at > now()
    for update;

    select coalesce(sum(l.remaining_points), 0)::integer
    into v_available_points
    from loyalty_private.point_lots l
    where l.customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      and l.remaining_points > 0
      and l.expires_at > now();

    if abs(new.points) > coalesce(v_available_points, 0) then
      raise exception 'Khách không đủ điểm còn hạn. Hiện có %, cần %.',
        coalesce(v_available_points, 0), abs(new.points);
    end if;

    if new.source_type <> 'ORDER' then
      raise exception 'Chỉ đơn hàng trực tiếp mới được sử dụng điểm.';
    end if;

    select floor(
      greatest(coalesce(o.points_base_amount, 0), 0)
      * loyalty_private.get_loyalty_max_redemption_percent(o.loyalty_rule_version_id) / 100
    )::integer
    into v_max_points
    from public.orders o
    where o.id = new.source_order_id;

    if abs(new.points) > coalesce(v_max_points, 0) then
      raise exception 'Số điểm sử dụng vượt quá tỷ lệ tối đa đang được cấu hình.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function loyalty_private.sync_loyalty_point_lot_after_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_allocated integer;
begin
  if new.points > 0 then
    insert into loyalty_private.point_lots (
      customer_phone, source_ledger_id, earned_points, remaining_points,
      earned_at, expires_at, metadata
    ) values (
      public.normalize_vietnam_phone(new.customer_phone), new.id, new.points, new.points,
      new.created_at, new.created_at + interval '60 days',
      jsonb_build_object('entryType', new.entry_type, 'action', new.action)
    )
    on conflict (source_ledger_id) do nothing;

    perform loyalty_private.refresh_loyalty_point_expiry(new.customer_phone);
  elsif new.points < 0 and coalesce(new.action, '') <> 'EXPIRE_POINTS' then
    v_allocated := loyalty_private.allocate_loyalty_debit(
      new.id, new.customer_phone, abs(new.points), new.created_at, false
    );
    if v_allocated <> abs(new.points) then
      raise exception 'Không thể phân bổ đủ điểm theo FIFO. Đã phân bổ %, cần %.',
        v_allocated, abs(new.points);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_loyalty_point_lot_sync on public.loyalty_ledger;
create trigger trg_loyalty_point_lot_sync
after insert on public.loyalty_ledger
for each row execute function loyalty_private.sync_loyalty_point_lot_after_ledger();

-- Build grandfathered lots from the immutable ledger. Their expiry stays at the
-- account's already-promised date; a missing old expiry remains non-expiring.
insert into loyalty_private.point_lots (
  customer_phone, source_ledger_id, earned_points, remaining_points,
  earned_at, expires_at, metadata
)
select
  public.normalize_vietnam_phone(ll.customer_phone), ll.id, ll.points, ll.points,
  ll.created_at,
  greatest(
    ll.created_at + interval '1 microsecond',
    coalesce(la.points_expires_at, 'infinity'::timestamptz)
  ),
  jsonb_build_object(
    'entryType', ll.entry_type,
    'action', ll.action,
    'backfilled', true,
    'grandfathered', true,
    'originalAccountExpiry', la.points_expires_at
  )
from public.loyalty_ledger ll
left join public.loyalty_accounts la
  on la.customer_phone = public.normalize_vietnam_phone(ll.customer_phone)
where ll.points > 0
on conflict (source_ledger_id) do nothing;

do $$
declare
  v_debit record;
  v_allocated integer;
begin
  for v_debit in
    select ll.id, ll.customer_phone, abs(ll.points)::integer as points, ll.created_at
    from public.loyalty_ledger ll
    where ll.points < 0
      and coalesce(ll.action, '') <> 'EXPIRE_POINTS'
      and not exists (
        select 1
        from loyalty_private.point_lot_allocations a
        where a.debit_ledger_id = ll.id
      )
    order by public.normalize_vietnam_phone(ll.customer_phone), ll.created_at, ll.id
  loop
    v_allocated := loyalty_private.allocate_loyalty_debit(
      v_debit.id, v_debit.customer_phone, v_debit.points, v_debit.created_at, true
    );
    if v_allocated <> v_debit.points then
      raise exception 'Backfill FIFO không khớp tại ledger %, đã phân bổ %, cần %.',
        v_debit.id, v_allocated, v_debit.points;
    end if;
  end loop;
end;
$$;

-- Replace the old rolling-account date with the earliest remaining lot date.
update public.loyalty_accounts la
set points_expires_at = lot.next_expiry,
    updated_at = now()
from (
  select customer_phone, min(expires_at) filter (
    where remaining_points > 0 and expires_at <> 'infinity'::timestamptz
  ) as next_expiry
  from loyalty_private.point_lots
  group by customer_phone
) lot
where la.customer_phone = lot.customer_phone;

-- Only honor an old expiry that was already due before cutover. In the normal
-- transition this changes no balance; new 60-day lots are handled from now on.
do $$
declare
  v_account record;
begin
  for v_account in
    select distinct customer_phone
    from loyalty_private.point_lots
    where remaining_points > 0 and expires_at <= now()
  loop
    perform loyalty_private.expire_loyalty_account_if_due(v_account.customer_phone, now());
  end loop;
end;
$$;

-- Preserve every existing tier/voucher behavior and remove only the old line
-- that extended the whole account balance by 12 months on each purchase.
do $$
declare
  v_definition text;
  v_old text := 'points_expires_at = greatest(coalesce(last_purchase_at, new.created_at), new.created_at) + interval ''12 months'',';
begin
  select pg_get_functiondef('loyalty_private.apply_loyalty_account_lifecycle()'::regprocedure)
  into v_definition;

  if position(v_old in v_definition) = 0 then
    raise notice 'Logic hạn điểm 12 tháng đã được bỏ hoặc không còn tồn tại.';
    return;
  end if;

  execute replace(v_definition, v_old, '');
end;
$$;

create or replace function loyalty_private.expire_due_loyalty_point_lots(
  p_at timestamptz default now(),
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_account record;
  v_processed integer := 0;
begin
  for v_account in
    select distinct l.customer_phone
    from loyalty_private.point_lots l
    where l.remaining_points > 0
      and l.expires_at <= p_at
    order by l.customer_phone
    limit greatest(1, least(coalesce(p_limit, 1000), 5000))
  loop
    if loyalty_private.expire_loyalty_account_if_due(v_account.customer_phone, p_at) then
      v_processed := v_processed + 1;
    end if;
  end loop;
  return v_processed;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  if to_regnamespace('cron') is null
    or to_regprocedure('cron.schedule(text,text,text)') is null
  then
    raise notice 'pg_cron chưa bật; SPEND vẫn kiểm tra hạn tức thời nhưng cần lịch gọi expire_due_loyalty_point_lots.';
    return;
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'expire-loyalty-point-lots-hourly'
  limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'expire-loyalty-point-lots-hourly',
    '7 * * * *',
    $cron$select loyalty_private.expire_due_loyalty_point_lots(now(), 1000);$cron$
  );
end;
$$;

comment on table loyalty_private.point_lots is
  'Các lô điểm có hạn riêng 60 ngày; remaining_points được tiêu thụ FIFO.';
comment on column public.loyalty_accounts.points_expires_at is
  'Ngày hết hạn gần nhất của lô điểm còn số dư; không còn là hạn chung của tài khoản.';

revoke all on function loyalty_private.allocate_loyalty_debit(text,text,integer,timestamptz,boolean) from public;
revoke all on function loyalty_private.expire_loyalty_account_if_due(text,timestamptz) from public;
revoke all on function loyalty_private.expire_due_loyalty_point_lots(timestamptz,integer) from public;
revoke all on function loyalty_private.refresh_loyalty_point_expiry(text) from public;
revoke all on function loyalty_private.sync_loyalty_point_lot_after_ledger() from public;

notify pgrst, 'reload schema';
