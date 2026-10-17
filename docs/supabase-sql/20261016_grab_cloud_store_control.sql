-- Requires grab-vietsing-pilot v20+. Existing per-source leases serialize
-- store polling against review/finance sync. Keep each job under 120 seconds.
select cron.schedule(
  'grab-cloud-store-' || account_key,
  minutes || ' * * * *',
  format($job$
    select net.http_post(
      url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/grab-vietsing-pilot',
      headers := jsonb_build_object('Content-Type','application/json',
        'x-automation-secret',(select decrypted_secret from vault.decrypted_secrets
          where name='grab-vietsing-pilot-cron' limit 1)),
      body := jsonb_build_object('action','store_sync','account_key',%L),
      timeout_milliseconds := 120000);
  $job$,account_key)
)
from (values
  ('grab_vietsing','1-59/5'),
  ('grab_304_primary','2-59/5'),
  ('grab_304_secondary','3-59/5'),
  ('grab_lhp','4-59/5'),
  ('grab_tqd','1-59/5')
) as accounts(account_key,minutes);

select jobid,jobname,schedule,active from cron.job
where jobname like 'grab-cloud-store-%' order by jobid;

-- Rollback: disable only these five monitor/Busy jobs; retain review schedules.
-- select cron.alter_job(jobid,active:=false) from cron.job
-- where jobname like 'grab-cloud-store-%';
