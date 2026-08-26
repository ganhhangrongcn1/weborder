-- Bút toán do hàng đợi đơn bán tự động tạo không có người thao tác trực tiếp.
-- Các phiếu thủ công vẫn truyền auth.uid() từ RPC nghiệp vụ; tài khoản frontend
-- không có quyền INSERT trực tiếp vào bảng movement.

alter table public.inventory_stock_movements
  alter column created_by drop not null;

comment on column public.inventory_stock_movements.created_by is
  'Người thực hiện đối với nghiệp vụ thủ công; NULL đối với bút toán hệ thống có nguồn truy vết qua chứng từ.';

notify pgrst, 'reload schema';
