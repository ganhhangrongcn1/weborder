alter table public.review_reward_claims
  add column if not exists resubmit_until timestamptz,
  add column if not exists resubmission_count integer not null default 0
    check (resubmission_count >= 0);

create index if not exists review_reward_claims_resubmit_idx
  on public.review_reward_claims (auth_user_id, resubmit_until)
  where status = 'rejected' and resubmit_until is not null;
