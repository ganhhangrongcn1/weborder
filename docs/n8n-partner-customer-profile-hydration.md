# n8n Partner -> Customer Stub Profile Hydration

Muc tieu:
- sau khi upsert `partner_orders`, n8n goi RPC `upsert_customer_stub_profile`
- tao/cap nhat `stub profile` cho customer partner
- khong ghi thang vao `profiles`
- khong tu y set `registered = true`

## Flow de xuat

```txt
Normalize Partner Orders
-> IF rollout gate pass
-> HTTP Request: Upsert Customer Stub Profile RPC
-> Continue
```

Nen dat node nay:
- sau `Normalize Partner Orders`
- sau khi order da duoc normalize day du:
  - `customer_phone_key`
  - `customer_name`
  - `partner_source`
  - `nexpos_order_id`
- co the dat truoc hoac sau `Upsert Partner Orders`
- de an toan va de debug, minh khuyen:

```txt
Normalize Partner Orders
-> Upsert Partner Orders
-> Upsert Customer Stub Profile RPC
-> Upsert Partner Items
```

Ly do:
- neu order upsert fail thi khong hydrate profile mo coi nhu khach da co giao dich
- `source_ref` co the dung identity cua order vua upsert

## Phase rollout an toan

Bat truoc:
- chi `grabfood`
- chi chi nhanh `30/4`

Sau khi on:
- mo rong `grabfood` toan bo
- mo tiep `shopeefood`
- mo tiep `xanhngon`

## Node 1: Rollout Gate (Code node)

Copy node nay vao sau `Normalize Partner Orders`.

```javascript
const row = $json;

const source = String(row.partner_source || "").trim().toLowerCase();
const branchName = String(row.branch_name || "").trim().toLowerCase();
const phoneKey = String(row.customer_phone_key || "").trim();

const isGrab = source === "grabfood";
const is304 =
  branchName.includes("30/4") ||
  branchName.includes("đường 30/4") ||
  branchName.includes("duong 30/4");

return {
  json: {
    ...row,
    hydrate_customer_profile: Boolean(phoneKey && isGrab && is304)
  }
};
```

## Node 2: IF

Dieu kien:

```txt
{{ $json.hydrate_customer_profile === true }}
```

Nhan `true` moi di tiep RPC.

## Node 3: HTTP Request - Upsert Customer Stub Profile RPC

Method:

```txt
POST
```

URL:

```txt
https://YOUR_PROJECT.supabase.co/rest/v1/rpc/upsert_customer_stub_profile
```

Headers:

```txt
apikey: YOUR_SERVICE_ROLE_OR_SECRET
Authorization: Bearer YOUR_SERVICE_ROLE_OR_SECRET
Content-Type: application/json
Prefer: return=representation
```

Body JSON:

```json
{
  "p_phone": "={{ $json.customer_phone_key }}",
  "p_name": "={{ $json.customer_name || '' }}",
  "p_source": "={{ $json.partner_source || '' }}",
  "p_source_ref": "={{ ['partner', $json.partner_source || 'partner', 'nexpos', $json.nexpos_order_id || $json.order_code || ''].join(':') }}"
}
```

## Neu ban muon dung source_ref gon hon

Co the dung:

```json
{
  "p_phone": "={{ $json.customer_phone_key }}",
  "p_name": "={{ $json.customer_name || '' }}",
  "p_source": "={{ $json.partner_source || '' }}",
  "p_source_ref": "={{ $json.nexpos_order_id || $json.order_code || '' }}"
}
```

Nhung minh van khuyen identity day du:

```txt
partner:grabfood:nexpos:abcd-1234
```

## Expected RPC responses

### Tao moi stub profile

```json
[
  {
    "ok": true,
    "message": "Da tao customer stub profile.",
    "profile_id": "...",
    "phone": "0862858721",
    "role": "customer",
    "registered": false,
    "created_new": true,
    "source_tag": "grabfood",
    "hydrated_name": "Ngọc Linh"
  }
]
```

### Cap nhat stub cu

```json
[
  {
    "ok": true,
    "message": "Da cap nhat customer stub profile.",
    "profile_id": "...",
    "phone": "0862858721",
    "role": "customer",
    "registered": false,
    "created_new": false,
    "source_tag": "grabfood",
    "hydrated_name": "Ngọc Linh"
  }
]
```

### Bo qua vi phone la profile van hanh

```json
[
  {
    "ok": false,
    "message": "Phone nay dang thuoc profile van hanh, khong hydrate customer stub.",
    "profile_id": "...",
    "phone": "0383340888",
    "role": "admin",
    "registered": true,
    "created_new": false,
    "source_tag": "grabfood",
    "hydrated_name": "Anh Phúc"
  }
]
```

Node nay nen de:
- `Continue On Fail = true`

De:
- order van tiep tuc ingest du hydrate profile bi bo qua hoac fail

## Node 4: Optional Log/Filter Result

Neu muon debug de, them Code node:

```javascript
const result = Array.isArray($json) ? $json[0] : $json;

return {
  json: {
    ok: Boolean(result?.ok),
    message: String(result?.message || ""),
    phone: String(result?.phone || ""),
    role: String(result?.role || ""),
    created_new: Boolean(result?.created_new)
  }
};
```

## SQL check nhanh sau khi test

Kiem tra profile vua duoc hydrate:

```sql
select
  id,
  phone,
  name,
  role,
  registered,
  metadata,
  created_at,
  updated_at
from public.profiles
where phone = '0862858721';
```

Kiem tra khong tao trung:

```sql
select
  phone,
  count(*) as total
from public.profiles
where phone = '0862858721'
group by phone
having count(*) > 1;
```

Kiem tra admin phone khong bi hydrate nham:

```sql
select
  phone,
  role,
  registered,
  metadata
from public.profiles
where phone = '0383340888';
```

## Rule quan trong

- n8n chi goi RPC
- khong `POST` thang vao `profiles`
- khong tu set `registered`
- khong tu set `role`
- khong overwrite `auth_user_id`
- rollout nho truoc, khong bat toan bo ngay
