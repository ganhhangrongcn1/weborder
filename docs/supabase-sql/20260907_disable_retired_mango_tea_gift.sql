-- Restore the owner's retired mango-tea gift setting in both existing sources.
-- Narrow data correction only; preserves other promotions and historical orders.
begin;
update public.smart_promotions
set data = jsonb_set(data, '{active}', 'false'::jsonb), updated_at = now()
where data->>'id' = 'promo-gift-threshold'
  and data->>'type' = 'gift_threshold'
  and data#>>'{reward,productId}' = 'product-1778831358565'
  and data->>'active' = 'true';
update public.app_configs c
set value = (
  select jsonb_agg(case
    when item->>'id' = 'promo-gift-threshold'
      and item->>'type' = 'gift_threshold'
      and item#>>'{reward,productId}' = 'product-1778831358565'
    then jsonb_set(item, '{active}', 'false'::jsonb)
    else item end order by position)
  from jsonb_array_elements(c.value) with ordinality as entries(item, position)
), updated_at = now()
where c.id = 'ghr_smart_promotions'
  and jsonb_typeof(c.value) = 'array'
  and exists (
    select 1 from jsonb_array_elements(c.value) item
    where item->>'id' = 'promo-gift-threshold'
      and item->>'type' = 'gift_threshold'
      and item#>>'{reward,productId}' = 'product-1778831358565'
      and item->>'active' = 'true'
  );
commit;
