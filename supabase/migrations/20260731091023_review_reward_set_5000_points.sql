alter table public.review_reward_settings
  alter column reward_points set default 5000;

update public.review_reward_settings
set reward_points = 5000,
    updated_at = now()
where id = 'default';

notify pgrst, 'reload schema';
