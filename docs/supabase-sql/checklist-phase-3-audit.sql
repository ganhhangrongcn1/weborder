-- Audit read-only cho GHR Checklist Phase 3.

select jsonb_build_object(
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'uses_security_definer', p.prosecdef,
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'execute'),
      'anon_can_execute', has_function_privilege('anon', p.oid, 'execute')
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('start_checklist_inspection', 'save_checklist_answer', 'submit_checklist_inspection')
  ),
  'evidence_bucket', (
    select jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit)
    from storage.buckets where id = 'checklist-evidence'
  ),
  'migration_applied', exists (
    select 1 from supabase_migrations.schema_migrations where version = '20260729032054'
  ),
  'supervisor_self_read_policy', exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'checklist_user_access'
      and policyname = 'checklist_access_self_read'
  ),
  'supervisor_access_migration_applied', exists (
    select 1 from supabase_migrations.schema_migrations where version = '20260729033200'
  )
) as phase_3_audit;
