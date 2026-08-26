-- Hardening Phase 6B: giữ quyền cao trong private schema, public chỉ là wrapper invoker.

alter function public.inventory_save_production_order_draft(uuid, uuid, numeric, text)
  set schema private;
alter function public.inventory_start_production_order(uuid, text)
  set schema private;
alter function public.inventory_complete_production_order(uuid, numeric, jsonb, text)
  set schema private;
alter function public.inventory_cancel_production_order(uuid, text, text)
  set schema private;
alter function public.inventory_delete_production_order_draft(uuid)
  set schema private;

create or replace function public.inventory_save_production_order_draft(
  p_order_id uuid,
  p_bom_id uuid,
  p_planned_output_quantity numeric,
  p_notes text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_save_production_order_draft(
    p_order_id,
    p_bom_id,
    p_planned_output_quantity,
    p_notes
  );
$$;

create or replace function public.inventory_start_production_order(
  p_order_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_start_production_order(p_order_id, p_idempotency_key);
$$;

create or replace function public.inventory_complete_production_order(
  p_order_id uuid,
  p_actual_output_quantity numeric,
  p_actual_inputs jsonb,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_production_order(
    p_order_id,
    p_actual_output_quantity,
    p_actual_inputs,
    p_idempotency_key
  );
$$;

create or replace function public.inventory_cancel_production_order(
  p_order_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_cancel_production_order(p_order_id, p_reason, p_idempotency_key);
$$;

create or replace function public.inventory_delete_production_order_draft(p_order_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_delete_production_order_draft(p_order_id);
$$;

revoke all on function private.inventory_save_production_order_draft(uuid, uuid, numeric, text) from public, anon;
revoke all on function private.inventory_start_production_order(uuid, text) from public, anon;
revoke all on function private.inventory_complete_production_order(uuid, numeric, jsonb, text) from public, anon;
revoke all on function private.inventory_cancel_production_order(uuid, text, text) from public, anon;
revoke all on function private.inventory_delete_production_order_draft(uuid) from public, anon;

grant execute on function private.inventory_save_production_order_draft(uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function private.inventory_start_production_order(uuid, text) to authenticated, service_role;
grant execute on function private.inventory_complete_production_order(uuid, numeric, jsonb, text) to authenticated, service_role;
grant execute on function private.inventory_cancel_production_order(uuid, text, text) to authenticated, service_role;
grant execute on function private.inventory_delete_production_order_draft(uuid) to authenticated, service_role;

revoke all on function public.inventory_save_production_order_draft(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.inventory_start_production_order(uuid, text) from public, anon;
revoke all on function public.inventory_complete_production_order(uuid, numeric, jsonb, text) from public, anon;
revoke all on function public.inventory_cancel_production_order(uuid, text, text) from public, anon;
revoke all on function public.inventory_delete_production_order_draft(uuid) from public, anon;

grant execute on function public.inventory_save_production_order_draft(uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.inventory_start_production_order(uuid, text) to authenticated, service_role;
grant execute on function public.inventory_complete_production_order(uuid, numeric, jsonb, text) to authenticated, service_role;
grant execute on function public.inventory_cancel_production_order(uuid, text, text) to authenticated, service_role;
grant execute on function public.inventory_delete_production_order_draft(uuid) to authenticated, service_role;

drop policy if exists inventory_production_order_operations_no_client_read
  on public.inventory_production_order_operations;
create policy inventory_production_order_operations_no_client_read
on public.inventory_production_order_operations for select to authenticated
using (false);

notify pgrst, 'reload schema';
