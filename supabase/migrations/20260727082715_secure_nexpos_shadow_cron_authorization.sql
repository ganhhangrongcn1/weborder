do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'nexpos_shadow_cron_anon_key'
      and nullif(decrypted_secret, '') is not null
  ) then
    raise exception
      'Missing Vault secret nexpos_shadow_cron_anon_key. Seed it with the project anon key before applying this migration.';
  end if;

  select jobid
  into v_job_id
  from cron.job
  where jobname = 'nexpos-shadow-sync-active-hours-15-seconds'
  limit 1;

  if v_job_id is null then
    raise exception 'Missing cron job nexpos-shadow-sync-active-hours-15-seconds.';
  end if;

  perform cron.alter_job(
    job_id := v_job_id,
    command := $cron$
      select net.http_post(
        url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/nexpos-order-shadow-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'nexpos_shadow_cron_anon_key'
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'nexpos_shadow_cron_anon_key'
          ),
          'x-cron-secret', (
            select cron_secret
            from public.nexpos_shadow_sync_control
            where control_key = 'nexpos_partner_orders'
          )
        ),
        body := jsonb_build_object('trigger', 'supabase_cron'),
        timeout_milliseconds := 55000
      )
      where timezone('Asia/Bangkok', now())::time >= time '10:00'
        and timezone('Asia/Bangkok', now())::time < time '23:30';
    $cron$
  );
end
$$;
