select jsonb_build_object(
  'migration_applied', exists (
    select 1 from supabase_migrations.schema_migrations where version = '20260729034204'
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'authenticated_execute', has_function_privilege('authenticated', p.oid, 'execute'),
      'anon_execute', has_function_privilege('anon', p.oid, 'execute')
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_checklist_supervision_report', 'get_checklist_employee_monthly_report')
  )
) as phase_4_audit;
