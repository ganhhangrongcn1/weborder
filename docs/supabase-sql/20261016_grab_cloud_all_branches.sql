-- Requires grab-vietsing-pilot v18+ and the existing Vault scheduler secret.
-- Preserve Vietsing's existing :00 job. Stagger the other accounts to stay
-- below Browserless Free's concurrency limit; healthy sessions use no browser.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'grab-vietsing-pilot-cron') then
    raise exception 'Provision the scheduler secret first';
  end if;
end;
$$;

select cron.schedule(
  'grab-cloud-' || account_key || '-hourly',
  minute || ' * * * *',
  format($job$
    select net.http_post(
      url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/grab-vietsing-pilot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets
          where name = 'grab-vietsing-pilot-cron' limit 1)
      ),
      body := jsonb_build_object('action','sync','account_key',%L),
      timeout_milliseconds := 120000
    );
  $job$, account_key)
)
from (values
  ('grab_304_primary','5'),
  ('grab_304_secondary','10'),
  ('grab_lhp','15'),
  ('grab_tqd','20')
) as accounts(account_key,minute);

select jobid,jobname,schedule,active from cron.job
where jobname in (
  'grab-vietsing-pilot-hourly','grab-cloud-grab_304_primary-hourly',
  'grab-cloud-grab_304_secondary-hourly','grab-cloud-grab_lhp-hourly',
  'grab-cloud-grab_tqd-hourly'
);

-- Rollback only the four new schedules; preserve Vietsing and stored data.
-- select cron.alter_job(jobid, active := false) from cron.job
-- where jobname in ('grab-cloud-grab_304_primary-hourly',
-- 'grab-cloud-grab_304_secondary-hourly','grab-cloud-grab_lhp-hourly',
-- 'grab-cloud-grab_tqd-hourly');
