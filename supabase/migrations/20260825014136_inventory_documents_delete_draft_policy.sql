-- Chỉ cho phép xóa chứng từ Kho khi còn là bản nháp.
-- Admin có thể dọn mọi bản nháp; tài khoản kho chỉ được xóa bản nháp do chính mình tạo.
drop policy if exists inventory_documents_delete_draft on public.inventory_documents;

create policy inventory_documents_delete_draft
on public.inventory_documents
for delete
to authenticated
using (
  status = 'draft'
  and (
    created_by = (select auth.uid())
    or (select private.inventory_is_admin())
  )
);

grant delete on table public.inventory_documents to authenticated;

notify pgrst, 'reload schema';
