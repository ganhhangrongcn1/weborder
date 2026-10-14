-- Allow Admin CRM to configure the maximum percentage of an eligible order
-- that customers may pay with loyalty points.

begin;

do $migration$
declare
  v_function regprocedure := 'loyalty_private.activate_program_rule_internal(jsonb,text)'::regprocedure;
  v_definition text;
  v_updated_definition text;
begin
  select pg_get_functiondef(v_function)
  into v_definition;

  v_updated_definition := regexp_replace(
    v_definition,
    $pattern$if coalesce\(v_config ->> 'maxRedemptionPercent', ''\) <> '50' then\s+raise exception '[^']+';\s+end if;$pattern$,
    $replacement$if coalesce(v_config ->> 'maxRedemptionPercent', '') !~ '^\d+$'
    or (v_config ->> 'maxRedemptionPercent')::integer not between 1 and 100 then
    raise exception 'Giới hạn sử dụng điểm phải từ 1%% đến 100%% giá trị đơn hợp lệ.';
  end if;$replacement$
  );

  if v_updated_definition = v_definition then
    raise exception 'Không tìm thấy quy tắc giới hạn dùng điểm 50%% cần nâng cấp.';
  end if;

  execute v_updated_definition;
end;
$migration$;

comment on function public.activate_loyalty_program_version(jsonb, text) is
  'Atomically activates a validated five-tier loyalty program with a configurable 1-100 percent redemption limit.';

notify pgrst, 'reload schema';

commit;
