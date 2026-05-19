# PHASE 1 - Baseline Safety (2026-05-08)

Muc tieu phase 1:
- Khong doi logic app.
- Dat guardrail de giam roi codebase.
- Dam bao build + encoding on dinh truoc khi vao tach module.

## Quy uoc bat buoc

1. `src/` la source code duy nhat duoc sua tay.
2. Du an chay truc tiep tu `src/main.jsx`; khong con dung `src-compiled/`.
3. Moi thay doi code can pass:
- `npm run check:encoding`
- `npm run build`

## Build pipeline hien tai

`npm run build` da bao gom:
1. `check-encoding`
2. `patch-vite`
3. `vite build`

## Ghi chu van hanh

- Chi review va sua business logic trong `src/`.
- `src-compiled/` da bi loai bo de tranh nham lan hai nguon source.

## Scope phase 1 da lam

- Chuyen du an ve mot source duy nhat la `src/`.
- Chuan hoa checklist build + encoding.
- Khong refactor, khong doi behavior.
