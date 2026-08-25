-- Dữ liệu nền Kho GHR sau khi hoàn thành Phase 3 P0.
-- Idempotent: chạy lại không ghi đè tên, mô tả hoặc trạng thái người dùng đã chỉnh.
-- Không tạo nguyên vật liệu, chứng từ, movement hoặc số tồn.

begin;

insert into public.inventory_units (
  code, name, symbol, unit_type, decimal_places,
  base_unit_id, conversion_factor, display_order,
  created_by, updated_by
)
values
  ('G', 'Gram', 'g', 'weight', 3, null, 1, 10, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('ML', 'Mililít', 'ml', 'volume', 3, null, 1, 20, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('CAI', 'Cái', 'cái', 'count', 0, null, 1, 30, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('GOI', 'Gói', 'gói', 'count', 0, null, 1, 31, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('CHAI', 'Chai', 'chai', 'count', 0, null, 1, 32, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('HOP', 'Hộp', 'hộp', 'count', 0, null, 1, 33, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('PHAN', 'Phần', 'phần', 'count', 0, null, 1, 34, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72')
on conflict (code) do nothing;

insert into public.inventory_units (
  code, name, symbol, unit_type, decimal_places,
  base_unit_id, conversion_factor, display_order,
  created_by, updated_by
)
select
  'KG', 'Kilôgam', 'kg', 'weight', 3,
  base.id, 1000, 11,
  '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'
from public.inventory_units base
where base.code = 'G' and base.deleted_at is null
on conflict (code) do nothing;

insert into public.inventory_units (
  code, name, symbol, unit_type, decimal_places,
  base_unit_id, conversion_factor, display_order,
  created_by, updated_by
)
select
  'LIT', 'Lít', 'l', 'volume', 3,
  base.id, 1000, 21,
  '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'
from public.inventory_units base
where base.code = 'ML' and base.deleted_at is null
on conflict (code) do nothing;

insert into public.inventory_item_groups (
  code, name, description, display_order,
  created_by, updated_by
)
values
  ('BANH_TRANG_NL_KHO', 'Bánh tráng & nguyên liệu khô', 'Bánh tráng, đậu, hành phi và các nguyên liệu khô dùng lâu.', 10, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('THIT_HAI_SAN', 'Thịt & hải sản', 'Thịt, trứng, khô và hải sản tươi hoặc sơ chế.', 20, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('RAU_CU_DO_TUOI', 'Rau củ & đồ tươi', 'Rau, củ, xoài, tắc và nguyên liệu tươi cần theo dõi chất lượng.', 30, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('GIA_VI', 'Gia vị', 'Gia vị khô, bột nêm và thành phần dùng để nêm nếm.', 40, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('SOT_CHAT_LONG', 'Sốt & chất lỏng', 'Nước sốt, dầu, nước mắm và nguyên liệu dạng lỏng.', 50, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('BAN_THANH_PHAM', 'Bán thành phẩm', 'Nguyên liệu đã sơ chế hoặc phối trộn để dùng tiếp trong công thức.', 60, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72'),
  ('BAO_BI_VAT_TU', 'Bao bì & vật tư', 'Hộp, túi, tem, muỗng và vật tư tiêu hao phục vụ bán hàng.', 70, '25d99e1e-da00-4662-9c90-a1d70f870d72', '25d99e1e-da00-4662-9c90-a1d70f870d72')
on conflict (code) do nothing;

commit;

select jsonb_build_object(
  'units', (
    select jsonb_agg(jsonb_build_object(
      'code', u.code,
      'name', u.name,
      'symbol', u.symbol,
      'base_code', b.code,
      'factor', u.conversion_factor
    ) order by u.display_order, u.name)
    from public.inventory_units u
    left join public.inventory_units b on b.id = u.base_unit_id
    where u.deleted_at is null
  ),
  'groups', (
    select jsonb_agg(jsonb_build_object(
      'code', code,
      'name', name,
      'description', description
    ) order by display_order, name)
    from public.inventory_item_groups
    where deleted_at is null
  ),
  'items_count', (select count(*) from public.inventory_items where deleted_at is null),
  'documents_count', (select count(*) from public.inventory_documents),
  'movements_count', (select count(*) from public.inventory_stock_movements)
) as inventory_baseline_postcheck;
