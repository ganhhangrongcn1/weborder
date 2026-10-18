-- Gánh Reply: additive module only. Production rollout authorized by owner.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';
create table if not exists public.ai_module_settings (
  id text primary key check (id = 'ganh-reply'),
  enabled boolean not null default false,
  model text not null default 'gpt-4.1-mini',
  daily_token_budget integer not null default 2400000 check (daily_token_budget between 54000 and 24000000),
  updated_at timestamptz not null default now()
);
insert into public.ai_module_settings(id) values ('ganh-reply') on conflict (id) do nothing;
create table if not exists public.ai_module_access (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  module_role text not null check (module_role in ('manager','staff')),
  branch_uuid uuid references public.branches(branch_uuid),
  can_edit_brain boolean not null default false,
  is_active boolean not null default true
);
create table if not exists public.ai_brain_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('identity','voice','knowledge','principles')),
  title text not null check (length(title) between 1 and 150),
  content text not null check (length(content) between 1 and 6000),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create table if not exists public.ai_response_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 150),
  content text not null check (length(content) between 1 and 6000),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  comment text not null check (length(comment) between 1 and 6000),
  platform text not null check (platform in ('tiktok','facebook','grabfood','shopeefood','google_maps')),
  branch_uuid uuid references public.branches(branch_uuid),
  facts text not null default '' check (length(facts) <= 6000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','pending','approved')),
  analysis jsonb not null,
  requires_review boolean not null default true,
  version integer not null default 0,
  final_text text not null default '',
  approved_version integer
);
create index if not exists customer_feedback_ai_branch_created_idx on public.customer_feedback(branch_uuid, created_at desc);
create index if not exists customer_feedback_ai_owner_created_idx on public.customer_feedback(created_by, created_at desc);
create table if not exists public.ai_response_suggestions (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.customer_feedback(id) on delete cascade,
  result jsonb not null,
  retrieval_ids jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.ai_response_revisions (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.customer_feedback(id) on delete cascade,
  suggestion_id uuid not null references public.ai_response_suggestions(id),
  author_id uuid not null references auth.users(id),
  version integer not null,
  selected_option text not null check (selected_option in ('A','B','C')),
  text text not null check (length(text) between 1 and 1800),
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique(feedback_id, version)
);
create table if not exists public.ai_feedback_reviews (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.customer_feedback(id) on delete cascade,
  version integer not null,
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('pending','approved')),
  created_at timestamptz not null default now()
);
create table if not exists public.ai_approved_examples (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.customer_feedback(id) on delete cascade,
  version integer not null,
  comment text not null,
  response text not null,
  category text not null,
  branch_uuid uuid references public.branches(branch_uuid),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(feedback_id, version)
);
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id),
  action text not null check (action in ('analyze','extract','rewrite')),
  model text not null,
  reserved_tokens integer not null,
  input_tokens integer,
  output_tokens integer,
  state text not null default 'reserved' check (state in ('reserved','completed','failed')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_time_idx on public.ai_usage_logs(created_at, auth_user_id);
create index if not exists ai_response_suggestions_feedback_idx on public.ai_response_suggestions(feedback_id, created_at desc);
create index if not exists ai_response_revisions_feedback_idx on public.ai_response_revisions(feedback_id, version desc);

-- Supporting foreign-key indexes are limited to the new module tables.
create index if not exists ai_module_access_branch_idx on public.ai_module_access(branch_uuid);
create index if not exists ai_brain_documents_editor_idx on public.ai_brain_documents(updated_by);
create index if not exists ai_response_rules_editor_idx on public.ai_response_rules(updated_by);
create index if not exists ai_response_revisions_suggestion_idx on public.ai_response_revisions(suggestion_id);
create index if not exists ai_response_revisions_author_idx on public.ai_response_revisions(author_id);
create index if not exists ai_feedback_reviews_feedback_idx on public.ai_feedback_reviews(feedback_id,version);
create index if not exists ai_feedback_reviews_reviewer_idx on public.ai_feedback_reviews(reviewer_id);
create index if not exists ai_approved_examples_branch_idx on public.ai_approved_examples(branch_uuid);
create index if not exists ai_approved_examples_approver_idx on public.ai_approved_examples(approved_by);
create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs(auth_user_id);

-- All access goes through the authenticated/authorized Edge Function. No browser grants.
do $$ declare t text; begin
  foreach t in array array['ai_module_settings','ai_module_access','ai_brain_documents','ai_response_rules','customer_feedback','ai_response_suggestions','ai_response_revisions','ai_feedback_reviews','ai_approved_examples','ai_usage_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

-- Serializes global quota reservation across isolates. Failed attempts remain reserved for safety.
create or replace function public.ganh_reply_reserve(p_user uuid, p_action text, p_model text, p_daily_tokens integer)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_count integer; v_tokens bigint;
begin
  perform pg_advisory_xact_lock(918726401);
  select count(*) into v_count from public.ai_usage_logs where auth_user_id = p_user and created_at > now() - interval '1 minute';
  if v_count >= 6 then raise exception 'Bạn đã đạt giới hạn 6 yêu cầu/phút.'; end if;
  select coalesce(sum(reserved_tokens),0) into v_tokens from public.ai_usage_logs where created_at >= date_trunc('day',now());
  if v_tokens + 54000 > p_daily_tokens then raise exception 'Đã đạt ngân sách token trong ngày.'; end if;
  select count(*) into v_count from public.ai_usage_logs where auth_user_id = p_user and created_at >= date_trunc('day',now());
  if v_count >= 100 then raise exception 'Bạn đã đạt giới hạn 100 yêu cầu/ngày.'; end if;
  insert into public.ai_usage_logs(auth_user_id,action,model,reserved_tokens) values (p_user,p_action,p_model,54000) returning id into v_id;
  return v_id;
end $$;

create or replace function public.ganh_reply_store_generation(p_user uuid, p_feedback uuid, p_input jsonb, p_result jsonb, p_sensitive boolean, p_retrieval jsonb, p_expected_version integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_feedback public.customer_feedback; v_suggestion public.ai_response_suggestions;
begin
  if p_feedback is null then
    insert into public.customer_feedback(comment,platform,branch_uuid,facts,created_by,analysis,requires_review)
    values(p_input->>'comment',p_input->>'platform',nullif(p_input->>'branch_uuid','')::uuid,coalesce(p_input->>'facts',''),p_user,p_result->'analysis',p_sensitive)
    returning * into v_feedback;
  else
    select * into strict v_feedback from public.customer_feedback where id=p_feedback for update;
    if v_feedback.version <> p_expected_version then raise exception 'Phiên bản đã thay đổi trong lúc AI xử lý. Hãy tải lại.'; end if;
    if v_feedback.created_by <> p_user then raise exception 'Chỉ tác giả được viết lại.'; end if;
    update public.customer_feedback set analysis=p_result->'analysis', requires_review=requires_review or p_sensitive,
      status='draft', approved_version=null, final_text='', version=version+1 where id=p_feedback returning * into v_feedback;
  end if;
  insert into public.ai_response_suggestions(feedback_id,result,retrieval_ids) values(v_feedback.id,p_result,p_retrieval) returning * into v_suggestion;
  return jsonb_build_object('feedback',to_jsonb(v_feedback),'suggestion',to_jsonb(v_suggestion));
end $$;

create or replace function public.ganh_reply_save_revision(p_user uuid, p_feedback uuid, p_suggestion uuid, p_version integer, p_text text, p_option text, p_reason text, p_approve boolean, p_example boolean)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare f public.customer_feedback; s public.ai_response_suggestions; v_status text;
begin
  select * into strict f from public.customer_feedback where id=p_feedback for update;
  if f.version <> p_version then raise exception 'Phiên bản đã thay đổi. Hãy mở lại phản hồi.'; end if;
  select * into strict s from public.ai_response_suggestions where id=p_suggestion and feedback_id=p_feedback;
  if s.id <> (select id from public.ai_response_suggestions where feedback_id=p_feedback order by created_at desc, id desc limit 1) then
    raise exception 'Đề xuất đã thay đổi. Hãy mở lại phản hồi.';
  end if;
  v_status := case when p_approve then 'approved' else 'pending' end;
  insert into public.ai_response_revisions(feedback_id,suggestion_id,author_id,version,selected_option,text,reason)
  values(f.id,s.id,p_user,f.version+1,p_option,p_text,p_reason);
  insert into public.ai_feedback_reviews(feedback_id,version,reviewer_id,decision) values(f.id,f.version+1,p_user,v_status);
  update public.customer_feedback set final_text=p_text, version=version+1, status=v_status,
    approved_version=case when p_approve then version+1 else null end where id=f.id returning * into f;
  if p_example and p_approve then
    insert into public.ai_approved_examples(feedback_id,version,comment,response,category,branch_uuid,approved_by)
    values(f.id,f.version,f.comment,p_text,f.analysis->>'category',f.branch_uuid,p_user);
  end if;
  return jsonb_build_object('feedback',to_jsonb(f),'suggestion',to_jsonb(s));
end $$;
revoke all on function public.ganh_reply_reserve(uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.ganh_reply_store_generation(uuid,uuid,jsonb,jsonb,boolean,jsonb,integer) from public,anon,authenticated;
revoke all on function public.ganh_reply_save_revision(uuid,uuid,uuid,integer,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.ganh_reply_reserve(uuid,text,text,integer) to service_role;
grant execute on function public.ganh_reply_store_generation(uuid,uuid,jsonb,jsonb,boolean,jsonb,integer) to service_role;
grant execute on function public.ganh_reply_save_revision(uuid,uuid,uuid,integer,text,text,text,boolean,boolean) to service_role;
-- Aggregates the complete authorized 30-day window rather than a REST row-limit sample.
create or replace function public.ganh_reply_stats(p_user uuid, p_branch uuid, p_own boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  with scoped as (
    select f.* from public.customer_feedback f
    where f.created_at >= now() - interval '30 days'
      and (p_branch is null or f.branch_uuid=p_branch)
      and (not p_own or f.created_by=p_user)
  ), categories as (
    select analysis->>'category' as label, count(*) as n from scoped
    where analysis->>'feedback_type'='complaint' group by 1
  ), emotions as (
    select analysis->>'emotion' as label, count(*) as n from scoped group by 1
  ), branch_topics as (
    select coalesce(branch_uuid::text,'unknown') as branch, analysis->>'category' as topic, count(*) as n
    from scoped where analysis->>'feedback_type'='complaint' group by 1,2
  ), branches as (
    select branch,jsonb_object_agg(topic,n) as topics from branch_topics group by branch
  )
  select jsonb_build_object(
    'total',(select count(*) from scoped),
    'approved',(select count(*) from scoped where status='approved' and approved_version=version),
    'exactApproved',(select count(*) from scoped f where f.status='approved' and f.approved_version=f.version
      and exists(select 1 from public.ai_response_suggestions s where s.feedback_id=f.id
        and f.final_text in (s.result->'options'->>'A',s.result->'options'->>'B',s.result->'options'->>'C'))),
    'categories',coalesce((select jsonb_object_agg(label,n) from categories),'{}'::jsonb),
    'emotions',coalesce((select jsonb_object_agg(label,n) from emotions),'{}'::jsonb),
    'branches',coalesce((select jsonb_object_agg(branch,topics) from branches),'{}'::jsonb)
  );
$$;
revoke all on function public.ganh_reply_stats(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.ganh_reply_stats(uuid,uuid,boolean) to service_role;
-- Starter knowledge is drawn solely from the owner's supplied brief.
-- No business policy, customer data, response example, or metric is invented.
insert into public.ai_brain_documents(kind,title,content)
select v.kind,v.title,v.content from (values
  ('identity','Nhận diện Gánh Hàng Rong', $brain$Tên thương hiệu: Gánh Hàng Rong. Trợ lý phản hồi: Gánh Reply. Mục tiêu: người bình luận được tôn trọng, người đọc công khai tin tưởng thương hiệu. Nguồn: yêu cầu trực tiếp của chủ dự án. Chưa có thông tin được xác minh trong Brain về giá, định lượng, giờ bán, hoàn tiền hoặc bồi thường; không tự suy đoán các chính sách này.$brain$),
  ('voice','Giọng văn Gánh', $brain$Theo yêu cầu chủ dự án: giọng Gen Z tự nhiên, gần gũi, dễ thương vừa đủ, có duyên nhưng có lập trường. Ưu tiên câu ngắn, rõ ý, không sáo rỗng, quá sến hoặc lạm dụng emoji. Khi bị chê giá, tập trung vào giá trị và cảm nhận đáng tiền; không kể lể chi phí.$brain$),
  ('principles','Nguyên tắc phản hồi đã được yêu cầu', $brain$Hiểu insight trước khi viết. Xét cả người bình luận và người đọc công khai. Không mặc định bên nào đúng. Không xin lỗi, tự nhận lỗi hoặc suy đoán khi chưa có căn cứ; có lỗi thật thì xin lỗi chân thành, nhận trách nhiệm phù hợp. Không tự hứa bồi thường, hoàn tiền, giảm giá hoặc đổi chính sách. Không tranh cãi, công kích khách. Phân biệt phản hồi công khai và khiếu nại cần trao đổi riêng. An toàn thực phẩm, hoàn tiền và pháp lý phải được người có quyền duyệt. Không yêu cầu khách đăng công khai thông tin riêng tư.$brain$)
) v(kind,title,content)
where not exists(select 1 from public.ai_brain_documents d where d.kind=v.kind);
notify pgrst, 'reload schema';
commit;
