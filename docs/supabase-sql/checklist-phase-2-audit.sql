-- Audit read-only cho GHR Checklist Phase 2.

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
      and p.proname in (
        'save_checklist_employee',
        'create_checklist_template_draft',
        'publish_checklist_template_version'
      )
  ),
  'draft_guards', (
    select jsonb_agg(jsonb_build_object(
      'table', trigger_row.event_object_table,
      'trigger', trigger_row.trigger_name,
      'timing', trigger_row.action_timing,
      'event', trigger_row.event_manipulation
    ) order by trigger_row.event_object_table, trigger_row.event_manipulation)
    from information_schema.triggers as trigger_row
    where trigger_row.trigger_schema = 'public'
      and trigger_row.trigger_name in ('checklist_sections_require_draft', 'checklist_items_require_draft')
  ),
  'migration_applied', exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '20260729030255'
  )
) as phase_2_audit;
