-- Giữ print_jobs gọn và tránh hai lệnh đang hoạt động cho cùng một đơn.
-- Nguồn áp dụng chính thức:
-- - supabase/migrations/20260721073654_cleanup_print_jobs.sql
-- - supabase/migrations/20260728065107_item_label_print_jobs_retention.sql

select public.cleanup_print_jobs();

-- Tem món đã in hoặc lỗi được giữ tối đa khoảng 24-25 giờ vì lịch dọn chạy mỗi giờ.
select count(*) as expired_item_labels
from public.print_jobs
where job_type = 'item_label'
  and status in ('printed', 'failed')
  and created_at < now() - interval '1 day';

select
  status,
  count(*) as job_count,
  min(created_at) as oldest_job,
  max(created_at) as newest_job
from public.print_jobs
group by status
order by status;
