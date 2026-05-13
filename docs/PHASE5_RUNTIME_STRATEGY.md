# PHASE 5 - Runtime Data Strategy (2026-05-08)

Muc tieu:
- Chot chien luoc du lieu ro rang cho app.
- Giam logic sync Supabase bi phan tan.
- Khong doi UI va flow nghiep vu.

## Chien luoc da chot

- `mode`: `local_first`
- LocalStorage la nguon phan hoi ngay cho UI.
- Supabase la tang dong bo nen (read-through/write-through theo runtime).

## Runtime strategy module

File moi:
- `src/services/repositories/runtimeStrategy.js`

Gia tri tra ve:
- `mode`
- `source`
- `hasSupabaseClient`
- `configSyncEnabled`
- `shouldReadThroughSupabase`
- `shouldWriteThroughSupabase`
- `effectiveSource`

## Da ap dung vao

1. `storageService`
- Dung `getRuntimeStrategy()` thay cho dieu kien sync rời rac.

2. `catalogConfigRepository`
- `getAsync`: chi read standard table khi runtime cho phep.
- `setAsync`: chi write-through Supabase khi runtime cho phep.

3. `repositoryRuntime`
- Runtime info co them `mode` va `configSyncEnabled`.

## Ket qua

- Logic quyet dinh sync duoc gom ve mot diem.
- De doi sang chien luoc khac trong phase sau ma khong sua nhieu file.
