update public.partner_reviews
set
  replies = '[]'::jsonb,
  updated_at = now()
where platform = 'grabfood'
  and replies = '[null]'::jsonb;

notify pgrst, 'reload schema';
