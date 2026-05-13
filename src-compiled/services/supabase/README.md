# Supabase Ready Guide

## 1) Cấu hình env

`.env` cần có:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_SUPABASE_RUNTIME_WRITES=true` khi bắt đầu ghi dữ liệu thật

## 2) Luồng chuẩn

UI Component -> Hook -> Service -> Supabase

## 3) Cách tạo service mới

1. Khai báo tên bảng ở `src/constants/supabaseTables.js`
2. Tạo service bằng `createSupabaseCrudService(tableName)`
3. Hook gọi service và xử lý loading/error bằng `useSupabaseQuery`

## 4) Ví dụ nhanh

```js
import { useSupabaseQuery } from "../../hooks/useSupabaseQuery.js";
import { getProducts } from "../../services/productService.js";

const { data: products, loading, error, run } = useSupabaseQuery(getProducts);
```

Mọi response service đều chuẩn format:

```js
{ data, error, count }
```
