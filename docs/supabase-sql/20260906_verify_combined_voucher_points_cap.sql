begin;

-- Isolated trigger regression: no customer/order/ledger rows are created.
create temporary table combined_cap_test (
  subtotal numeric, promo_discount numeric, points_discount numeric,
  points_discount_amount numeric, points_spent integer, metadata jsonb,
  status text
) on commit drop;
create trigger combined_cap_test_guard before insert or update on combined_cap_test
for each row execute function loyalty_private.guard_order_combined_benefits();

do $test$
declare
  v_field text;
begin
  if loyalty_private.combined_benefit_points_limit(70000, 21000) <> 7000
    or loyalty_private.combined_benefit_points_limit(100000, 30000) <> 10000
    or loyalty_private.combined_benefit_points_limit(70000, 28000) <> 0
    or loyalty_private.combined_benefit_points_limit(70001, 21000) <> 7000
    or loyalty_private.combined_benefit_points_limit(50000, 25000) <> 0
  then raise exception 'Combined limit arithmetic regression'; end if;

  insert into combined_cap_test values (70000,21000,7000,7000,7000,'{"pointsSpent":7000}','new');
  update combined_cap_test set status = 'ready';
  update combined_cap_test set metadata = metadata || '{"paymentCollected":true}'::jsonb;
  begin
    insert into combined_cap_test values (70000,21000,14700,14700,14700,'{}','new');
    raise exception 'Over-cap insert was accepted';
  exception when sqlstate 'P4001' then null;
  end;
  begin
    update combined_cap_test set promo_discount = 21001;
    raise exception 'Over-cap financial update was accepted';
  exception when sqlstate 'P4001' then null;
  end;
  foreach v_field in array array['points_discount','points_discount_amount','points_spent'] loop
    begin
      execute format('insert into combined_cap_test (subtotal,promo_discount,%I,metadata) values (70000,21000,7001,''{}'')', v_field);
      raise exception 'Over-cap field % was accepted', v_field;
    exception when sqlstate 'P4001' then null;
    end;
  end loop;
  begin
    insert into combined_cap_test values (70000,21000,0,0,0,'{"pointsSpent":7001}','new');
    raise exception 'Over-cap metadata was accepted';
  exception when sqlstate 'P4001' then null;
  end;
  -- Standalone vouchers and orders without redemption keep their existing behavior.
  insert into combined_cap_test values (50000,25000,0,0,0,'{}','new');
end;
$test$;

-- Simulate a historical order, then prove ordinary updates remain allowed.
alter table combined_cap_test disable trigger combined_cap_test_guard;
insert into combined_cap_test values (70000,21000,14700,14700,14700,'{"pointsSpent":14700}','historical');
alter table combined_cap_test enable trigger combined_cap_test_guard;
update combined_cap_test set status = 'completed', metadata = metadata || '{"paymentCollected":true}'::jsonb
where status = 'historical';
update combined_cap_test set subtotal = subtotal where status = 'completed';

rollback;
