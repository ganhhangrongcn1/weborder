-- Bổ sung mô tả cho nhóm hàng hóa trong ứng dụng Kho.
-- An toàn khi chạy lại nhiều lần.

alter table public.inventory_item_groups
  add column if not exists description text;

notify pgrst, 'reload schema';
