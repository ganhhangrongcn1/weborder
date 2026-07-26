# Kho Gánh Hàng Rong

Ứng dụng quản lý kho độc lập, dùng chung Supabase với hệ thống Gánh Hàng Rong.

## Phạm vi MVP

- Đăng nhập tài khoản nhân viên.
- Phân quyền theo kho.
- Kho tổng, chi nhánh và xe đẩy được tạo động.
- Danh mục hàng hóa, đơn vị và nhà cung cấp.
- Tồn kho, nhập hàng, giao nhận và kiểm kê.
- Dashboard riêng theo phạm vi kho được giao.

BOM và sản xuất chưa được bật trong MVP.

## Chạy cục bộ

1. Sao chép `.env.example` thành `.env.local`.
2. Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Chạy `npm install`.
4. Chạy `npm run dev`.

Không sử dụng service-role key trong ứng dụng frontend.

## Chuẩn bị database

File schema nằm tại:

`../docs/supabase-sql/20260725_inventory_mvp.sql`

Không chạy trực tiếp trên production trước khi:

1. Kiểm tra schema ở môi trường thử nghiệm.
2. Tạo tài khoản Supabase Auth cho chủ doanh nghiệp.
3. Thêm quyền `owner` đầu tiên bằng SQL Editor.
4. Kiểm tra RLS bằng ít nhất một tài khoản chi nhánh.

Ví dụ cấp quyền chủ sở hữu đầu tiên sau khi đã tạo kho:

```sql
insert into public.inventory_user_access (
  auth_user_id,
  warehouse_id,
  role,
  is_active
)
values (
  '<AUTH_USER_ID>',
  null,
  'owner',
  true
);
```

Không đặt `AUTH_USER_ID` cố định trong source code.
