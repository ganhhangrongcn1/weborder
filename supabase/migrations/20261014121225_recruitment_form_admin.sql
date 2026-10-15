create table if not exists public.recruitment_form_settings (
 id text primary key check(id='default'), revision integer not null default 1,
 config jsonb not null, updated_at timestamptz not null default now()
);
alter table public.recruitment_form_settings enable row level security;
revoke all on public.recruitment_form_settings from public, anon, authenticated;
grant select, insert, update on public.recruitment_form_settings to service_role;
insert into public.recruitment_form_settings(id,config) values('default','{"accepting":true,"introduction":"Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.","successMessage":"Cảm ơn bạn đã dành thời gian chia sẻ. Chúng mình sẽ chủ động liên hệ lại khi bạn phù hợp với các tiêu chí của bên cửa hàng.","questions":[{"id":"fullName","label":"Họ và tên","required":true,"active":true,"type":"text"},{"id":"birthDate","label":"Ngày tháng năm sinh","required":true,"active":true,"type":"date"},{"id":"phone","label":"Số điện thoại","required":true,"active":true,"type":"tel"},{"id":"address","label":"Nơi ở của bạn","required":true,"active":true,"type":"text"},{"id":"gender","label":"Giới tính của bạn","required":true,"active":true,"type":"radio","options":["Nam","Nữ","LGBT"]},{"id":"branch","label":"Cửa hàng bạn muốn ứng tuyển","required":true,"active":true,"type":"radio","options":["277 Thích Quảng Đức, Phường Thủ Dầu Một, TP.HCM (Bình Dương Cũ)","306A Lê Hồng Phong, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)","113/108 Đường 30/4, Phường Phú Lợi, TP.HCM (Bình Dương Cũ)","64/1 NA5, KDC VietSing, Phường Thuận Giao, TP.HCM (Bình Dương Cũ)"]},{"id":"education","label":"Trình độ học vấn","required":true,"active":true,"type":"radio","options":["12/12","Sinh viên năm 1","Sinh viên năm 2","Sinh viên năm 3","Sinh viên năm 4","Mục khác"]},{"id":"school","label":"Nếu đang đi học thì bạn đang học trường nào?","required":true,"active":true,"type":"text"},{"id":"shifts","label":"Khung giờ bạn có thể làm việc","required":true,"active":true,"type":"checkbox","options":["9h - 16h","16h - 22h30","Cả 2 ca"]},{"id":"workTypes","label":"Thời gian bạn muốn làm việc tại cửa hàng","required":true,"active":true,"type":"checkbox","options":["Full ca sáng hoặc chiều","Part-time","Đóng gói bánh tráng (linh động theo lịch của quán)"]},{"id":"impression","label":"Cảm nhận của bạn về Gánh Hàng Rong","required":true,"active":true,"type":"textarea"},{"id":"previousJob","label":"Mô tả công việc và mức lương gần nhất của bạn","required":true,"active":true,"type":"textarea"},{"id":"selfDescription","label":"Bạn hãy tự nhận xét về bản thân mình","required":true,"active":true,"type":"textarea"}]}'::jsonb) on conflict(id) do nothing;
alter table public.recruitment_applications add column if not exists form_snapshot jsonb not null default '{}'::jsonb;
alter table public.recruitment_applications add column if not exists form_version integer not null default 1;
create index if not exists recruitment_branch_time_idx on public.recruitment_applications((application->>'branch'), submitted_at desc);
create or replace function public.recruitment_summary(p_branch text default '', p_from timestamptz default null, p_to timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$
 with filtered as (
  select * from public.recruitment_applications where (p_branch='' or application->>'branch'=p_branch)
   and (p_from is null or submitted_at >= p_from) and (p_to is null or submitted_at < p_to)
 ), branch_counts as (
  select application->>'branch' as branch, count(*) as count from filtered group by application->>'branch'
 ), choices as (
  select q->>'id' as question_id, q->>'label' as label, v.value as answer, count(*) as count
  from filtered f cross join lateral jsonb_array_elements(coalesce(f.form_snapshot->'questions', '[]'::jsonb)) q
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.application->(q->>'id'))='array'
   then f.application->(q->>'id') else jsonb_build_array(f.application->(q->>'id')) end) v
  where q->>'type' in ('radio','checkbox') and v.value is not null and v.value<>''
  group by q->>'id', q->>'label', v.value
 )
 select jsonb_build_object('total',(select count(*) from filtered),
  'notificationFailed',(select count(*) from filtered where notification_status in ('failed','uncertain') or (notification_status='sending' and notification_attempts>=5)),
  'branches',coalesce((select jsonb_agg(to_jsonb(b)) from branch_counts b),'[]'::jsonb),
  'choices',coalesce((select jsonb_agg(to_jsonb(c)) from choices c),'[]'::jsonb));
$$;
revoke all on function public.recruitment_summary(text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.recruitment_summary(text,timestamptz,timestamptz) to service_role;
notify pgrst,'reload schema';
