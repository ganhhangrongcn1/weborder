alter table public.nexpos_shadow_sync_control
  add column if not exists last_full_sweep_at timestamptz;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'nexpos-shadow-sync-every-30-seconds') then
    perform cron.unschedule('nexpos-shadow-sync-every-30-seconds');
  end if;
  if exists (select 1 from cron.job where jobname = 'nexpos-shadow-sync-active-hours-15-seconds') then
    perform cron.unschedule('nexpos-shadow-sync-active-hours-15-seconds');
  end if;
end
$$;

select cron.schedule(
  'nexpos-shadow-sync-active-hours-15-seconds',
  '15 seconds',
  $cron$
    select net.http_post(
      url := 'https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/nexpos-order-shadow-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select cron_secret
          from public.nexpos_shadow_sync_control
          where control_key = 'nexpos_partner_orders'
        )
      ),
      body := jsonb_build_object('trigger', 'supabase_cron'),
      timeout_milliseconds := 55000
    );
  $cron$
);
