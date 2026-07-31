-- Source of truth: supabase/migrations/20260731073417_review_reward_claims.sql
-- Apply through the Supabase migration workflow.

select
  id,
  enabled,
  reward_points,
  claim_window_hours,
  proof_retention_days,
  platforms,
  updated_at
from public.review_reward_settings;

select
  status,
  count(*) as total
from public.review_reward_claims
group by status
order by status;
