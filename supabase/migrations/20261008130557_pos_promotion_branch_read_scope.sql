-- Restrict only branch-scoped promotion reads. Existing global programs stay visible.
-- Separate policies avoid reading profiles from the anonymous role.
create policy smart_promotions_branch_scope_anon
on public.smart_promotions as restrictive for select to anon
using (coalesce(data #> '{condition,branchIds}', '[]'::jsonb) = '[]'::jsonb);

create policy smart_promotions_branch_scope_authenticated
on public.smart_promotions as restrictive for select to authenticated
using (
  coalesce(data #> '{condition,branchIds}', '[]'::jsonb) = '[]'::jsonb
  or exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and p.status = 'active'
      and p.role in ('admin', 'staff', 'kitchen', 'crm')
      and (
        p.role = 'admin'
        or (
          jsonb_typeof(data #> '{condition,branchIds}') = 'array'
          and (data #> '{condition,branchIds}') ? p.branch_uuid::text
        )
      )
  )
);

notify pgrst, 'reload schema';
