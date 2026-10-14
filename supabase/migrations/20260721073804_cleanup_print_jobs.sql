create extension if not exists pg_cron with schema pg_catalog;

update public.print_jobs
set
  status = 'failed',
  failed_at = coalesce(failed_at, now()),
  error_message = coalesce(nullif(error_message, ''), 'Lệnh in bị treo quá 15 phút.'),
  updated_at = now()
where status in ('pending', 'printing')
  and created_at < now() - interval '15 minutes';

delete from public.print_jobs
where status in ('printed', 'failed')
  and created_at < now() - interval '2 days';

create unique index if not exists print_jobs_one_active_order_id_idx
  on public.print_jobs (branch_uuid, printer_key, job_type, order_id)
  where status in ('pending', 'printing')
    and order_id is not null
    and order_id <> '';

create unique index if not exists print_jobs_one_active_order_code_idx
  on public.print_jobs (branch_uuid, printer_key, job_type, order_code)
  where status in ('pending', 'printing')
    and (order_id is null or order_id = '')
    and order_code is not null
    and order_code <> '';

create or replace function public.cleanup_print_jobs()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.print_jobs
  set
    status = 'failed',
    failed_at = coalesce(failed_at, now()),
    error_message = coalesce(nullif(error_message, ''), 'Lệnh in bị treo quá 15 phút.'),
    updated_at = now()
  where status in ('pending', 'printing')
    and created_at < now() - interval '15 minutes';

  delete from public.print_jobs
  where status in ('printed', 'failed')
    and created_at < now() - interval '2 days';
end;
$$;

revoke all on function public.cleanup_print_jobs() from public, anon, authenticated;
grant execute on function public.cleanup_print_jobs() to postgres, service_role;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'cleanup-print-jobs'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'cleanup-print-jobs',
  '0 20 * * *',
  'select public.cleanup_print_jobs();'
);
