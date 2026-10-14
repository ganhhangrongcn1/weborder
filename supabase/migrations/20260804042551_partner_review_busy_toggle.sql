alter table public.partner_review_sources
  add column if not exists busy_enabled boolean not null default false;

comment on column public.partner_review_sources.busy_enabled is
  'Cho phép worker chuyển riêng gian hàng Grab sang Busy trong 15 phút khi đồng bộ.';

notify pgrst, 'reload schema';
