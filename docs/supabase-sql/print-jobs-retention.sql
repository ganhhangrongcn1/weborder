-- Giữ print_jobs gọn và tránh hai lệnh đang hoạt động cho cùng một đơn.
-- Nguồn áp dụng chính thức: supabase/migrations/20260721073654_cleanup_print_jobs.sql

select public.cleanup_print_jobs();

select
  status,
  count(*) as job_count,
  min(created_at) as oldest_job,
  max(created_at) as newest_job
from public.print_jobs
group by status
order by status;
