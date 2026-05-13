# Supabase Runtime Guide

This project now runs with a Supabase-first data path for admin catalog/config modules and a safe local fallback.

## 1) Environment

Set in `.env`:

```env
VITE_DATA_SOURCE=supabase
VITE_ENABLE_SUPABASE_CONFIG_SYNC=true
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

If `VITE_DATA_SOURCE=local`, app uses local storage only.

## 2) One-time SQL setup

Run these files in Supabase SQL Editor:

- `docs/supabase-one-time-setup.sql`
- `docs/supabase-phase-b1-core-tables.sql` (Phase B1: customers/orders/loyalty core tables)
- `docs/supabase-phase-b2-unified-schema.sql` (schema hợp nhất, gồm `app_configs`)
- `docs/supabase-phase-b3-production-rls.sql` (siết policy production)

This script creates/normalizes tables, enables RLS, creates anon policies, and reloads schema cache.

## 3) Runtime client behavior

- Supabase client is initialized in `src/main.jsx`.
- Repository runtime also lazily initializes client to avoid startup race conditions.
- If Supabase is unavailable, app falls back to local data and logs warnings.

## 4) Current synced modules

Admin save/read is wired to Supabase-first for:

- `products`
- `categories`
- `toppings`
- `product_toppings` (derived from product option groups)
- `shipping_config` (`app_configs`)
- `zalo_config` (`app_configs`)
- `option_group_presets` (`app_configs`)
- plus existing app_configs-based keys already wired

## 5) What customer app reads now

With `VITE_DATA_SOURCE=supabase` and valid env keys:

- Customer data reads prefer Supabase standard tables where implemented.
- If Supabase read fails, fallback path uses local/app_configs defaults to keep app running.

## 6) Quick verification checklist

1. Start app: `npm run dev`
2. Open Admin and save one product with option groups.
3. Check Supabase tables:
   - `products`
   - `categories`
   - `toppings`
   - `product_toppings`
4. Refresh Customer page and verify updated item/category/toppings are visible.
5. Console should not show:
   - `runtime client is missing`
   - repeated `write-through failed for key "ghr_products"`
