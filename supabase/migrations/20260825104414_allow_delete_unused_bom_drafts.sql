-- Allow a never-activated draft formula to be removed completely.
-- Active/inactive formulas remain immutable history and can only be archived.

grant delete on table public.inventory_boms to authenticated;

drop policy if exists inventory_boms_delete on public.inventory_boms;
create policy inventory_boms_delete
on public.inventory_boms for delete to authenticated
using (
  status = 'draft'
  and deleted_at is null
  and (select private.inventory_can_manage_bom(default_warehouse_id, production_scope))
);

create or replace function public.inventory_delete_bom_draft(p_bom_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_target public.inventory_boms%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Phiên đăng nhập đã hết hạn.';
  end if;

  select bom.*
  into v_target
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.deleted_at is null
  for update;

  if not found then
    raise exception 'Không tìm thấy công thức cần xóa.';
  end if;

  if v_target.status <> 'draft' then
    raise exception 'Chỉ bản nháp chưa áp dụng mới được xóa. Công thức đã áp dụng phải lưu trữ để giữ lịch sử.';
  end if;

  if not (select private.inventory_can_manage_bom(v_target.default_warehouse_id, v_target.production_scope)) then
    raise exception 'Bạn không có quyền xóa công thức tại kho này.';
  end if;

  delete from public.inventory_boms
  where id = v_target.id
    and status = 'draft'
    and deleted_at is null;

  if not found then
    raise exception 'Bản nháp đã thay đổi, vui lòng tải lại trước khi xóa.';
  end if;

  return v_target.id;
end;
$$;

revoke all on function public.inventory_delete_bom_draft(uuid) from public, anon;
grant execute on function public.inventory_delete_bom_draft(uuid) to authenticated, service_role;

comment on function public.inventory_delete_bom_draft(uuid) is
  'Xóa vĩnh viễn bản nháp BOM chưa từng áp dụng; thành phần được xóa theo khóa ngoại cascade.';

notify pgrst, 'reload schema';
