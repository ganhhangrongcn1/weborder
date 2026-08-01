alter table public.review_reward_claims
  alter column partner_order_id drop not null;

alter table public.review_reward_claims
  drop constraint if exists review_reward_claims_partner_source_check;

alter table public.review_reward_claims
  add constraint review_reward_claims_partner_source_check
  check (partner_source in ('grabfood', 'shopeefood', 'xanhngon', 'googlemaps'));

alter table public.review_reward_claims
  drop constraint if exists review_reward_claims_subject_check;

alter table public.review_reward_claims
  add constraint review_reward_claims_subject_check
  check (
    (partner_source = 'googlemaps' and partner_order_id is null and branch_uuid is not null)
    or
    (partner_source <> 'googlemaps' and partner_order_id is not null)
  ) not valid;

alter table public.review_reward_claims
  validate constraint review_reward_claims_subject_check;

create unique index if not exists review_reward_claims_google_branch_unique
  on public.review_reward_claims (auth_user_id, branch_uuid)
  where partner_source = 'googlemaps';

update public.review_reward_settings
set platforms = coalesce(platforms, '{}'::jsonb) || '{"googlemaps":true}'::jsonb,
    updated_at = now()
where id = 'default'
  and not (coalesce(platforms, '{}'::jsonb) ? 'googlemaps');

notify pgrst, 'reload schema';
