# PHASE 1 - Baseline Safety (2026-05-08)

Muc tieu phase 1:
- Khong doi logic app.
- Dat guardrail de giam roi codebase.
- Dam bao build + encoding on dinh truoc khi vao tach module.

## Quy uoc bat buoc

1. `src/` la source code duy nhat duoc sua tay.
2. `src-compiled/` la thu muc generated output, khong sua tay.
3. Moi thay doi code can pass:
- `npm run check:encoding`
- `npm run build`

## Script moi trong phase 1

- `npm run check:generated`
- Script: `scripts/check-generated-sync.mjs`
- Tac dung: kiem tra mapping file tu `src/` sang `src-compiled/` (bao gom `.jsx -> .js`).

## Build pipeline hien tai

`npm run build` da bao gom:
1. `check-encoding`
2. `patch-vite`
3. `compile-jsx`
4. `check:generated`
5. `vite build`

## Ghi chu van hanh

- Neu `check:generated` fail, chay lai `npm run build` hoac `node scripts/compile-jsx.mjs`.
- Khong review business logic trong `src-compiled/`; review trong `src/`.

## Scope phase 1 da lam

- Them guardrail generated sync.
- Chuan hoa checklist build + encoding.
- Khong refactor, khong doi behavior.
