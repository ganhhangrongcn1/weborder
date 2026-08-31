-- The draft-save RPC is SECURITY INVOKER and validates cycles through this
-- private helper, so authenticated inventory managers need execute permission.
grant execute on function private.inventory_sales_recipe_depends_on(text,text,text,text,uuid,date,text[])
  to authenticated, service_role;
