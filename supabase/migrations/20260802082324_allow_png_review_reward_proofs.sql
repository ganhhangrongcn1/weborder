update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png']::text[]
where id = 'review-reward-proofs';
