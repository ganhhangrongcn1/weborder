## Customer Profiles Regression Checklist

Muc tieu:
- xac nhan `public.profiles` dang tro thanh customer source of truth dung
- khong bi spam request
- khong tao nham customer profile cho admin/staff/kitchen
- khong lam gay login/register/account/tracking/CRM

### 1. Guest Lookup / Tracking

- Nhap mot so partner da co `partner_orders` nhung truoc do chua co `profiles`
- Mo man guest lookup hoac tracking theo so do
- Ky vong:
  - don partner hien ra binh thuong
  - UI khong bi delay bat thuong
  - trong `public.profiles` xuat hien `stub profile`
  - `phone` dung dinh dang `0xxxxxxxxx`
  - `role = customer`
  - `registered = false`
  - `metadata.customer_stub = true`
  - `metadata.customer_source_latest` dung theo nguon partner

### 2. Bao Ve Profile Van Hanh

- Thu lookup/tracking voi so `0383340888` (admin)
- Ky vong:
  - khong tao them customer profile moi
  - khong doi role cua profile admin
  - khong gay loi UI lookup

### 3. Account Save Profile

- Dang nhap customer that
- Sua ten/avatar trong man account va bam luu
- Ky vong:
  - UI cap nhat ngay
  - reload trang van giu du lieu moi
  - `profiles` chi cap nhat 1 ban ghi customer do
  - khong bi mat `auth_user_id`
  - khong bi doi `registered` sai

### 4. Login

- Dang nhap bang so dien thoai + mat khau dung
- Ky vong:
  - vao duoc tai khoan
  - session duoc khoi phuc sau reload
  - `profiles.auth_user_id` van dung
  - `profiles.registered = true`
  - khong tao them profile trung phone

### 5. Register

- Dang ky bang mot so moi chua co member account
- Ky vong:
  - tao auth account thanh cong
  - tao/hoac nang cap profile customer dung phone
  - `registered = true`
  - co `auth_user_id`
  - email luu dung
  - khong tao 2 profile cung phone

### 6. Partner Hydration

- Chon 2-3 so partner o 3 chi nhanh khac nhau
- Mo tracking hoac account history cho tung so
- Ky vong:
  - moi so sau khi lookup deu co `stub profile`
  - ten duoc lay tu order neu co ten hop le
  - neu ten cu la placeholder thi duoc nang len
  - khong bi flood request khi mo lai cung 1 so lien tuc trong vai phut

### 7. Loyalty / Claim

- Claim diem cho 1 partner order cua customer vua duoc hydrate
- Ky vong:
  - claim thanh cong
  - khong cong diem trung neu bam lai
  - lookup lai van thay lich su don va diem dung
  - `profiles` khong bi doi thanh `registered = true` chi vi claim diem

### 8. CRM / Admin

- Mo CRM customer
- Tim mot phone web customer va mot phone partner customer vua hydrate
- Ky vong:
  - CRM doc duoc profile customer
  - khong bi hien nham admin/staff vao nhom customer
  - tong don / tong chi tieu / loyalty khong bi am hoac mat

### 9. SQL Quick Checks

- Kiem tra duplicate customer phone:

```sql
select phone, count(*)
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
group by phone
having count(*) > 1;
```

- Kiem tra customer stub vua hydrate:

```sql
select
  phone,
  role,
  registered,
  metadata
from public.profiles
where phone in ('0862858721', '0344391670');
```

- Kiem tra admin phone khong bi hydrate nham:

```sql
select
  phone,
  role,
  registered,
  metadata
from public.profiles
where phone = '0383340888';
```
