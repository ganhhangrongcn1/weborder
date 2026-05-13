# PHASE CSS 1 - Baseline Modular Entry (2026-05-08)

Muc tieu:
- Khong doi UI.
- Khong doi selector.
- Tao nen tang de chia CSS theo feature o phase tiep theo.

Da lam:
1. Tach file nguon style thuc thi:
- `src/styles/customer.app.css`
- `src/styles/admin.app.css`

2. Giu file entry cu de tranh anh huong import hien tai:
- `src/styles/customer.css` -> `@import "./customer.app.css";`
- `src/styles/admin.css` -> `@import "./admin.app.css";`

Ket qua:
- App van import duong dan cu.
- Toan bo style hien tai duoc giu nguyen.
- San sang cho phase tiep theo: cat theo module feature (home/menu/checkout/admin-*).
