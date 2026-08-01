-- Tách mức thưởng Google Maps khỏi mức thưởng đánh giá đơn đối tác.
-- An toàn khi chạy lại.

alter table public.review_reward_settings
  add column if not exists google_reward_points integer not null default 5000;

alter table public.review_reward_settings
  drop constraint if exists review_reward_settings_google_reward_points_check;

alter table public.review_reward_settings
  add constraint review_reward_settings_google_reward_points_check
  check (google_reward_points between 1 and 100000);

notify pgrst, 'reload schema';

select id, reward_points, google_reward_points
from public.review_reward_settings
where id = 'default';
