-- Run inside a transaction with the migration, then ROLLBACK.
-- This table has only the loyalty trigger: no orders, points, printing or inventory writes.
create temporary table loyalty_net_paid_check (
  id text, customer_phone text, subtotal numeric, promo_discount numeric,
  points_discount numeric, total_amount numeric, shipping_fee numeric, metadata jsonb,
  loyalty_rule_version_id uuid, loyalty_tier_id text,
  loyalty_earn_numerator bigint, loyalty_earn_denominator bigint,
  points_base_amount numeric, expected_earn_points integer,
  points_discount_amount numeric, points_spent integer
) on commit drop;
create trigger snapshot_check before insert on loyalty_net_paid_check
for each row execute function loyalty_private.snapshot_order_loyalty_rule();
insert into loyalty_net_paid_check
  (id,customer_phone,subtotal,promo_discount,points_discount,total_amount,shipping_fee,metadata)
values
  ('reported','',40000,0,9000,31000,0,'{}'),
  ('voucher_and_points','',70000,21000,7000,42000,0,'{}'),
  ('delivery','',40000,0,9000,46000,15000,'{}'),
  ('zero','',40000,40000,0,0,0,'{}'),
  ('cash_rounding','',40500,0,0,40000,0,'{}'),
  ('redemption_cap','',40000,0,12000,28000,0,'{}');
do $test$
declare r record;
begin
  for r in select c.*, v.expected_base
    from loyalty_net_paid_check c
    join (values ('reported',31000),('voucher_and_points',42000),
      ('delivery',31000),('zero',0),('cash_rounding',40000),
      ('redemption_cap',28000)) v(id,expected_base) using(id)
  loop
    if r.points_base_amount <> r.expected_base
      or r.expected_earn_points <> floor(r.expected_base * r.loyalty_earn_numerator / r.loyalty_earn_denominator)
    then raise exception 'Net paid accrual mismatch: %', r.id; end if;
  end loop;
  if (select count(*) from loyalty_net_paid_check) <> 6 then
    raise exception 'Missing accrual scenarios';
  end if;
  if position('o.points_base_amount' in pg_get_functiondef('loyalty_private.guard_loyalty_ledger_event()'::regprocedure)) > 0 then
    raise exception 'Spend limit still depends on net accrual amount';
  end if;
end;
$test$;
select id,points_base_amount,expected_earn_points,points_spent from loyalty_net_paid_check order by id;
