-- Tem món chỉ phục vụ vận hành ngắn hạn: xóa sau 24 giờ.
-- Bill khách vẫn giữ chính sách hiện tại là 2 ngày.

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
  where job_type = 'item_label'
    and status in ('printed', 'failed')
    and created_at < now() - interval '1 day';

  delete from public.print_jobs
  where job_type <> 'item_label'
    and status in ('printed', 'failed')
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
  '15 * * * *',
  'select public.cleanup_print_jobs();'
);

notify pgrst, 'reload schema';
