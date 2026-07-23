alter table public.partner_orders
  add column if not exists nexpos_enrichment_hash text;

comment on column public.partner_orders.nexpos_enrichment_hash is
  'SHA-256 of the last NexPOS payload used for additive enrichment; prevents repeated writes during 30-second polling.';
