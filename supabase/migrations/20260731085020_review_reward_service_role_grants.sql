grant select, insert, update, delete
  on public.review_reward_settings
  to service_role;

grant select, insert, update, delete
  on public.review_reward_claims
  to service_role;

notify pgrst, 'reload schema';
