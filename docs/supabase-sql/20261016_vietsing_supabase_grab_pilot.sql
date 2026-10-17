-- Requires deployed grab-vietsing-pilot and its provision_cron action.
-- Authentication value stays in Vault; it is never embedded into cron.job.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'grab-vietsing-pilot-cron') then
    raise exception 'Provision the pilot scheduler secret first';
  end if;
end;
$$;

select cron.schedule(
  'grab-vietsing-pilot-hourly',
  '0 * * * *',
  $job$
  select net.http_post(
    url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/grab-vietsing-pilot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'grab-vietsing-pilot-cron' limit 1)
    ),
    body := '{"action":"sync"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);

-- Verify configuration without selecting credentials or the full command:
select jobid, jobname, schedule, active from cron.job
where jobname = 'grab-vietsing-pilot-hourly';

-- Rollback: disable only this job. Existing local worker remains available.
-- select cron.alter_job(jobid, active := false) from cron.job
-- where jobname = 'grab-vietsing-pilot-hourly';
