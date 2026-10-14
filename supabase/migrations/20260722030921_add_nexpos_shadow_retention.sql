do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-nexpos-shadow-history') then
    perform cron.unschedule('cleanup-nexpos-shadow-history');
  end if;
end
$$;

select cron.schedule(
  'cleanup-nexpos-shadow-history',
  '15 3 * * *',
  $cron$
    delete from public.nexpos_shadow_sync_runs
    where started_at < now() - interval '14 days';

    delete from public.nexpos_shadow_orders
    where last_seen_at < now() - interval '14 days';

    delete from cron.job_run_details
    where end_time < now() - interval '14 days';
  $cron$
);
