alter table public.inventory_items
  add column if not exists default_purchase_price numeric(18, 4) not null default 0;

alter table public.inventory_items
  drop constraint if exists inventory_items_default_purchase_price_check;

alter table public.inventory_items
  add constraint inventory_items_default_purchase_price_check
  check (default_purchase_price >= 0);

comment on column public.inventory_items.default_purchase_price is
  'Giá mua mặc định theo đơn vị mua/nhập của nguyên vật liệu; dùng để gợi ý khi tạo phiếu nhập kho.';

notify pgrst, 'reload schema';
