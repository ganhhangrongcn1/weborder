-- Approved: align Xanh Ngon checklist with matching Grab choices only.
-- No schema, orders, items, prices, printer jobs or other-source configuration changes.
begin;
do $apply$
declare
  current_config jsonb;
  previous_time timestamptz;
  next_groups jsonb;
  patches jsonb := $patch${"xanhngon::name:tuy chon::option:tra xoai chanh day size l":{"enabled":true,"kitchenLabel":"Chọn Nước","kitchenType":"addon"},"xanhngon::name:tuy chon::option:banh trang tron dac biet":{"enabled":true,"kitchenLabel":"Chọn Món Bánh Tráng Trộn","kitchenType":"main"},"xanhngon::name:tuy chon::option:banh trang cham ganh":{"enabled":true,"kitchenLabel":"Chọn Món Combo","kitchenType":"main"}}$patch$::jsonb;
  additions jsonb := $add$[{"id":"xanhngon::name:tuy chon::option:tra sua gao rang size l","source":"xanhngon","enabled":true,"groupId":"","groupName":"Tùy chọn","matchMode":"option","sortOrder":133,"optionName":"Trà Sữa Gạo Rang - Size L","kitchenType":"addon","groupEnabled":false,"kitchenLabel":"Chọn Nước","sampleOptions":["Trà Sữa Gạo Rang - Size L"]},{"id":"xanhngon::name:tuy chon::option:sot muoi beo","source":"xanhngon","enabled":false,"groupId":"","groupName":"Tùy chọn","matchMode":"option","sortOrder":134,"optionName":"Sốt Muối Béo","kitchenType":"other","groupEnabled":false,"kitchenLabel":"Chọn Loại Sốt","sampleOptions":["Sốt Muối Béo"]}]$add$::jsonb;
  match_count integer;
begin
  select value, updated_at into strict current_config, previous_time
    from public.app_configs where id='ghr_kitchen_option_group_settings' for update;
  if previous_time is distinct from '2026-10-27 03:37:12.989+00'::timestamptz then
    raise exception 'Kitchen settings changed; reload and compare before applying';
  end if;
  select count(*) into match_count from jsonb_array_elements(current_config->'groups') g
    where g->>'source'='xanhngon' and patches ? (g->>'id');
  if match_count <> 3 then raise exception 'Unexpected Xanh target count'; end if;
  if exists(select 1 from jsonb_array_elements(current_config->'groups') g,
    jsonb_array_elements(additions) a where g->>'source'='xanhngon'
      and (g->>'id'=a->>'id' or g->>'optionName'=a->>'optionName')) then
    raise exception 'New Xanh rule already exists; inspect latest config';
  end if;
  select jsonb_agg(case when g->>'source'='xanhngon' and patches ? (g->>'id')
      then g || (patches->(g->>'id')) else g end order by ordinality)
    into next_groups
    from jsonb_array_elements(current_config->'groups') with ordinality as entries(g,ordinality);
  next_groups := next_groups || additions;
  if (select jsonb_agg(g order by ordinality) from jsonb_array_elements(next_groups)
        with ordinality as entries(g,ordinality) where g->>'source'<>'xanhngon')
    is distinct from
     (select jsonb_agg(g order by ordinality) from jsonb_array_elements(current_config->'groups')
        with ordinality as entries(g,ordinality) where g->>'source'<>'xanhngon') then
    raise exception 'Other-source settings changed';
  end if;
  update public.app_configs
    set value=jsonb_set(current_config,'{groups}',next_groups), updated_at=now()
    where id='ghr_kitchen_option_group_settings' and updated_at=previous_time;
  if not found then raise exception 'Concurrent kitchen settings edit'; end if;
end;
$apply$;
select g->>'optionName' as option_name, g->>'enabled' as checkbox, g->>'kitchenLabel' as kitchen_label
from public.app_configs c cross join lateral jsonb_array_elements(c.value->'groups') g
where c.id='ghr_kitchen_option_group_settings' and g->>'source'='xanhngon'
  and g->>'optionName' in ('Trà Xoài Chanh Dây - Size L','Bánh Tráng Trộn Đặc Biệt',
    'Bánh Tráng Chấm Gánh','Trà Sữa Gạo Rang - Size L','Sốt Muối Béo');
commit;
