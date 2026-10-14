-- Enforce the configured redemption percentage when an order is created and
-- again when its SPEND ledger entry is inserted.

begin;

create or replace function loyalty_private.get_loyalty_max_redemption_percent(
  p_rule_id uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
  select least(
    100::numeric,
    greatest(
      1::numeric,
      coalesce(
        (
          select nullif(rule.source_config ->> 'maxRedemptionPercent', '')::numeric
          from public.loyalty_rule_versions rule
          where rule.id = p_rule_id
        ),
        (
          select nullif(rule.source_config ->> 'maxRedemptionPercent', '')::numeric
          from public.loyalty_rule_versions rule
          where rule.status = 'ACTIVE'
            and rule.effective_from <= now()
          order by rule.effective_from desc, rule.version_number desc
          limit 1
        ),
        50::numeric
      )
    )
  );
$$;

revoke all on function loyalty_private.get_loyalty_max_redemption_percent(uuid)
from public, anon, authenticated;
grant execute on function loyalty_private.get_loyalty_max_redemption_percent(uuid)
to service_role;

do $migration$
declare
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef('loyalty_private.guard_loyalty_ledger_event()'::regprocedure)
  into v_definition;

  v_updated_definition := replace(
    v_definition,
    'floor(greatest(coalesce(o.points_base_amount, 0), 0) * 0.5)::integer',
    'floor(greatest(coalesce(o.points_base_amount, 0), 0) * loyalty_private.get_loyalty_max_redemption_percent(o.loyalty_rule_version_id) / 100)::integer'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    $pattern$raise exception '[^']*50%%[^']*';$pattern$,
    $replacement$raise exception 'Số điểm sử dụng vượt quá tỷ lệ tối đa đang được cấu hình.';$replacement$
  );

  if v_updated_definition = v_definition then
    raise exception 'Không tìm thấy giới hạn 50%% trong guard_loyalty_ledger_event.';
  end if;
  execute v_updated_definition;

  select pg_get_functiondef('loyalty_private.snapshot_order_loyalty_rule()'::regprocedure)
  into v_definition;

  v_updated_definition := replace(
    v_definition,
    'floor(new.points_base_amount * 0.5)::integer',
    'floor(new.points_base_amount * loyalty_private.get_loyalty_max_redemption_percent(v_rule.id) / 100)::integer'
  );
  v_updated_definition := regexp_replace(
    v_updated_definition,
    $pattern$raise exception '[^']*50%%[^']*';$pattern$,
    $replacement$raise exception 'Số điểm sử dụng vượt quá tỷ lệ tối đa đang được cấu hình.';$replacement$
  );

  if v_updated_definition = v_definition then
    raise exception 'Không tìm thấy giới hạn 50%% trong snapshot_order_loyalty_rule.';
  end if;
  execute v_updated_definition;
end;
$migration$;

commit;
