-- Run after the module migration. All test rows are rolled back.
-- This script writes only Ganh Reply tables and never modifies existing business data.
begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
do $$
declare
  actor uuid;
  generated jsonb;
  saved jsonb;
  rewritten jsonb;
  feedback uuid;
  suggestion uuid;
  result jsonb := '{"analysis":{"feedback_type":"complaint","category":"Kiểm thử giao dịch","emotion":"Chưa rõ","responsibility":"unknown"},"options":{"A":"Nội dung kiểm tra kỹ thuật.","B":"Phương án B.","C":"Phương án C."},"recommended":"A","reason":"Kiểm tra kỹ thuật"}'::jsonb;
  caught boolean;
  n integer;
  report jsonb;
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('ai_module_settings','ai_module_access','ai_brain_documents','ai_response_rules','customer_feedback','ai_response_suggestions','ai_response_revisions','ai_feedback_reviews','ai_approved_examples','ai_usage_logs')
      and (not c.relrowsecurity or has_table_privilege('anon',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'SELECT') or has_table_privilege('authenticated',c.oid,'INSERT'))
  ) then raise exception 'Module RLS/grants are unsafe'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'ganh_reply_%'
      and (p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ) then raise exception 'Module RPC permissions are unsafe'; end if;

  select auth_user_id into actor from public.profiles
  where role='admin' and status='active' and branch_uuid is null and auth_user_id is not null
  order by auth_user_id limit 1;
  if actor is null then raise exception 'No active global admin available for rolled-back verification'; end if;

  generated := public.ganh_reply_store_generation(actor,null,
    '{"comment":"Kiểm thử kỹ thuật - sẽ hoàn tác","platform":"tiktok","facts":"Không phải dữ liệu khách hàng"}',result,true,'{}',0);
  feedback := (generated->'feedback'->>'id')::uuid;
  suggestion := (generated->'suggestion'->>'id')::uuid;
  saved := public.ganh_reply_save_revision(actor,feedback,suggestion,0,'Nội dung kiểm tra kỹ thuật.','A','Kiểm tra lưu bản nháp',false,false);
  if saved->'feedback'->>'status' <> 'pending' or (saved->'feedback'->>'version')::integer <> 1 then raise exception 'Pending save failed'; end if;
  select count(*) into n from public.ai_approved_examples where feedback_id=feedback;
  if n <> 0 then raise exception 'Unapproved example was created'; end if;

  saved := public.ganh_reply_save_revision(actor,feedback,suggestion,1,'Nội dung kiểm tra kỹ thuật.','A','Kiểm tra duyệt đúng phiên bản',true,true);
  if (saved->'feedback'->>'approved_version')::integer <> 2 or saved->'feedback'->>'status' <> 'approved' then raise exception 'Approval version failed'; end if;
  select count(*) into n from public.ai_approved_examples where feedback_id=feedback;
  if n <> 1 then raise exception 'Approved example missing'; end if;

  caught := false;
  begin
    perform public.ganh_reply_save_revision(actor,feedback,suggestion,1,'Bản cũ.','A','',true,false);
  exception when others then
    if sqlerrm like 'Phiên bản đã thay đổi%' then caught := true; else raise; end if;
  end;
  if not caught then raise exception 'Stale version was accepted'; end if;

  rewritten := public.ganh_reply_store_generation(actor,feedback,'{}',result,false,'{}',2);
  if rewritten->'feedback'->>'status' <> 'draft'
    or (rewritten->'feedback'->>'requires_review')::boolean is not true
    or rewritten->'feedback'->>'final_text' <> ''
    or rewritten->'feedback'->>'approved_version' is not null
  then raise exception 'Rewrite failed to invalidate approval or preserve sensitivity'; end if;

  caught := false;
  begin
    perform public.ganh_reply_store_generation(actor,feedback,'{}',result,false,'{}',2);
  exception when others then
    if sqlerrm like 'Phiên bản đã thay đổi%' then caught := true; else raise; end if;
  end;
  if not caught then raise exception 'Concurrent generation overwrite was accepted'; end if;

  report := public.ganh_reply_stats(actor,null,true);
  if (report->>'total')::integer < 1 then raise exception 'Scoped statistics missing own feedback'; end if;
  report := public.ganh_reply_stats(actor,gen_random_uuid(),false);
  if (report->>'total')::integer <> 0 then raise exception 'Branch statistics leaked other scopes'; end if;

  -- No quota records existed for this module before first rollout.
  -- Avoid disturbing an operator who has already started using the module.
  if not exists(select 1 from public.ai_usage_logs where created_at >= date_trunc('day',now())) then
    perform public.ganh_reply_reserve(actor,'analyze','test-model',54000);
    caught := false;
    begin
      perform public.ganh_reply_reserve(actor,'analyze','test-model',54000);
    exception when others then
      if sqlerrm like 'Đã đạt ngân sách%' then caught := true; else raise; end if;
    end;
    if not caught then raise exception 'Daily quota was exceeded'; end if;
    for n in 1..5 loop perform public.ganh_reply_reserve(actor,'analyze','test-model',5400000); end loop;
    caught := false;
    begin
      perform public.ganh_reply_reserve(actor,'analyze','test-model',5400000);
    exception when others then
      if sqlerrm like 'Bạn đã đạt giới hạn 6%' then caught := true; else raise; end if;
    end;
    if not caught then raise exception 'Minute quota was exceeded'; end if;
  end if;
end $$;
rollback;
