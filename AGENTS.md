# AGENTS.md

## Project Overview

Ganh Hang Rong Webapp is a React/Vite application for F&B ordering and operations. The project contains customer ordering, menu, cart, checkout, loyalty, account, order tracking, admin backoffice, POS, kitchen display, cake ordering, QR ordering, PWA install, print jobs, and integration flows around Supabase, Goong, Zalo, SePay, NexPOS, and n8n.

The current direction in the source code and docs is Supabase-first: local storage is used for client session, draft state, fast display, or fallback only where the repository policy allows it.

## Architecture

The app uses a layered frontend architecture:

```txt
UI Component / Page
-> Hook / Feature state
-> Service
-> Repository / Adapter
-> Supabase / app_configs / local fallback
```

Main runtime flow:

- `src/main.jsx` initializes Supabase runtime client, registers the PWA service worker, selects `BrowserRouter` or `HashRouter` for APK builds, and renders `App`.
- `src/App.jsx` wraps routes with `AppProviders`.
- `src/features/app/useAppProviders.js` composes domain state and customer runtime state.
- `src/app/routes.jsx` defines customer, admin, POS, kitchen, QR, cake, download, and QR-code-tool routes.
- `src/features/app/useAppDomainState.js` builds shared product/admin domain state.
- `src/features/app/useCustomerRuntimeState.js` builds customer route props, cart/session/order/loyalty behavior, and navigation actions.
- `src/features/admin/adminBindings.js` maps shared state into admin props and persistence actions.

Data architecture:

- Runtime source is controlled by `src/services/repositories/dataSource.js`.
- Runtime strategy is controlled by `src/services/repositories/runtimeStrategy.js`.
- Write policy is controlled by `src/services/repositories/writeThroughPolicy.js`.
- Config data uses `app_configs` via `createSupabaseConfigAdapter`.
- Standard catalog data uses tables such as `products`, `categories`, `toppings`, `branches`, `coupons`, option group tables, and related promotion/home tables.
- Core customer/order/loyalty data is centralized in `src/services/repositories/coreSupabaseRepository.js`.

## Tech Stack

- React `18.2.0`
- Vite `5.4.19`
- React Router DOM `6.30.3`
- Supabase JS `^2.105.3`
- MapLibre GL `^5.24.0`
- Tailwind CSS `3.4.17`
- PostCSS `8.5.6`
- Autoprefixer `10.4.21`
- ESLint `^9.0.0`
- Supabase Edge Function for SePay POS webhook at `supabase/functions/sepay-pos-webhook/index.ts`
- Android POS printer wrapper under `android-pos-printer`
- PWA assets and service worker under `public`

## Folder Structure

- `src/main.jsx`: app bootstrap.
- `src/App.jsx`: provider wrapper and route entry.
- `src/app`: route definitions and route-state mapping.
- `src/features`: larger feature modules such as customer app shell, checkout, home, menu, orders, account, loyalty, admin bindings, and kitchen.
- `src/pages`: route-level pages and admin page composition.
- `src/components`: shared UI components plus customer/POS-specific component folders.
- `src/hooks`: reusable React hooks for cart, products, session, kitchen, POS, PWA, QR tool, and Supabase query helpers.
- `src/services`: business services, integrations, Supabase clients, repositories, printer/POS/order/customer/loyalty/cake services.
- `src/services/repositories`: runtime data source, strategy, storage keys, app config repositories, catalog/customer/order/loyalty repositories, and Supabase repository code.
- `src/services/supabase`: Supabase runtime clients, response normalizers, storage helper, CRUD helper, and runtime flags.
- `src/data`: seed/default data and UI text.
- `src/constants`: store config, feature flags, Supabase table constants.
- `src/utils`: formatting, profile normalization, pure helpers, UI events, image upload, date helpers.
- `src/styles`: base, customer, admin, POS, cake, and page/component CSS.
- `docs`: source-of-truth docs, n8n mapping docs, regression checklists, and SQL migration/audit files.
- `docs/supabase-sql`: Supabase SQL migrations, RPCs, RLS policies, audit scripts, and schema updates.
- `supabase/functions`: Supabase Edge Functions.
- `scripts`: build/encoding/smoke helper scripts.
- `public`: static assets, PWA manifest/service worker, Goong config, cake images.
- `android-pos-printer`: Android wrapper and printer bridge assets.

## Coding Standards

### Naming

- React components use PascalCase filenames and exports, for example `CustomerAppShell.jsx`, `OrderManager.jsx`.
- Hooks use `use*` naming and are placed in `src/hooks`, feature folders, or admin state/action folders.
- Services use camelCase filenames with `Service` suffix where appropriate, for example `orderService.js`, `kitchenOrderService.js`.
- Repositories use `*Repository.js`, for example `orderRepository.js`, `catalogConfigRepository.js`.
- Constants use uppercase object names where useful, for example `STORAGE_KEYS`, `SUPABASE_TABLES`.
- Config keys use stable `ghr_*` string keys, for example `ghr_products`, `ghr_orders_by_phone`, `ghr_cake_settings`.

### Components

- Components should receive data and callbacks through props.
- Components must not call Supabase directly.
- Prefer existing customer/admin UI primitives before creating new UI style.
- Keep route/page components focused on composition and delegate logic to hooks/services.
- Export default from component files unless the existing file intentionally exports named helpers.

### Hooks

- Hooks own React state, effects, memoization, and lifecycle cleanup.
- Hooks may call services/repositories.
- Realtime subscriptions must return cleanup functions and avoid broad unscoped subscriptions.
- Follow existing patterns such as `useCustomerSession`, `useKitchenOrders`, `useMenuManagerState`, `useAdminStoreConfigState`.

### Utilities

- Utilities in `src/utils` and pure service helpers should be deterministic when possible.
- Shared domain rules such as customer phone normalization, order counting, branch identity, and formatting should not be reimplemented in UI files.
- Reuse existing helpers:
  - `getCustomerKey`
  - `branchIdentityService`
  - `customerOrderCountingService`
  - `pureHelpers`
  - `format`

### TypeScript

- The React app source is JavaScript/JSX, not TypeScript.
- The Supabase Edge Function uses TypeScript at `supabase/functions/sepay-pos-webhook/index.ts`.
- Do not introduce TypeScript into the React app unless the project is intentionally migrated.
- If editing the Edge Function, keep Deno/Supabase function conventions and environment variable access through `Deno.env`.

## React Standards

### Component Organization

- Customer routes are composed through `CustomerAppShell`.
- Admin routes are composed through `AppAdminRoutes` and `AdminApp`.
- Admin UI primitives live in `src/pages/admin/ui`.
- POS components live in `src/components/pos`.
- Customer reusable UI lives in `src/components/customer`.
- Feature-specific components stay inside their feature/page folder.

### State Management

- The project uses React state/hooks, not Redux/Zustand.
- Shared app state is composed in `useAppDomainState` and `useCustomerRuntimeState`.
- Admin state is split into `src/pages/admin/state` and `src/pages/admin/actions`.
- Cart state is handled by `useCart`.
- Customer session state is handled by `useCustomerSession`.
- Kitchen state is handled by `useKitchenOrders` and kitchen services.

### Data Fetching

- UI must go through hooks/services/repositories.
- Supabase reads/writes must stay in services/repositories unless a file already exists as a low-level Supabase service.
- Config reads should use repository helpers and config keys.
- Customer/order/loyalty reads should use repository services instead of direct localStorage or direct Supabase calls from components.

### Performance Optimization

- Reuse existing TTL caches and in-flight request guards:
  - `supabaseConfigAdapter` caches config values and batches reads.
  - `orderRepository` has remote cache and in-flight guards.
  - `customerRepository` has remote cache and in-flight guards.
- Realtime should be scoped by table/domain and filtered by phone, branch, day, order id, or route where available.
- Avoid recomputing derived lists in render when `useMemo` is already the local pattern.
- Avoid adding broad `postgres_changes` subscriptions on customer routes.

## Supabase Standards

### Database Access

- Use `src/services/supabase/supabaseRuntimeClient.js` to initialize Supabase clients.
- Runtime auth scopes exist for `runtime`, `customer`, `admin`, and `kitchen`.
- Use `getRuntimeSupabaseClient`, `createRepositoryAdapter`, and repository modules for domain access.
- Service responses should normalize errors/data where helpers already exist.
- Do not place service role keys in frontend code.

### Source Of Truth

Current source-of-truth contract from docs and services:

- Customers: `public.profiles`
- Web/QR/POS orders: `public.orders`
- Web order items: `public.order_items`
- Partner orders: `public.partner_orders`
- Partner order items: `public.partner_order_items`
- Loyalty: `public.loyalty_accounts` and `public.loyalty_ledger`
- Monthly gifts: `public.monthly_customer_gifts`
- App/config snapshots: `public.app_configs`
- Cake orders: `public.cake_orders`
- SePay webhook logs: `public.sepay_webhook_logs`
- Print jobs: `public.print_jobs`

### RPC Conventions

Existing RPC/function names include:

- `apply_loyalty_event`
- `claim_partner_order_points`
- `upsert_customer_stub_profile`
- `get_customer_order_count_summary`
- `get_monthly_customer_gift_stats_by_phones`
- `get_admin_dashboard_summary`
- `get_admin_business_analytics`
- `get_admin_crm_analytics`
- `assign_operational_profile_branch`
- `upsert_operational_profile`

When adding RPC usage:

- Create SQL in `docs/supabase-sql`.
- Add a service wrapper in `src/services`.
- Keep UI unaware of RPC details.
- Add fallback behavior only if the existing domain already supports fallback.

### Migration Conventions

- SQL files live in `docs/supabase-sql`.
- Migration/audit files are designed to be safe to rerun when possible.
- Prefer `create table if not exists`, `alter table ... add column if not exists`, `create index if not exists`, and explicit named constraints.
- Use audit scripts before destructive or schema-wide changes.
- Reload PostgREST schema when needed with `notify pgrst, 'reload schema';`.
- Vietnamese text in SQL should use proper UTF-8 or unicode escapes to avoid mojibake.

### RLS Conventions

- RLS is enabled in the SQL docs for tables such as `profiles`, `cake_orders`, order/kitchen tables, `monthly_customer_gifts`, and `sepay_webhook_logs`.
- Staff/admin/kitchen authorization is based on `profiles.auth_user_id = auth.uid()` and role checks such as `admin`, `staff`, `kitchen`.
- Public insert is allowed only for specific public flows where SQL already defines it, such as `cake_orders`.
- Do not weaken existing RLS policies without an explicit security reason.

### Realtime Conventions

- Core realtime is implemented through `coreSupabaseRepository.subscribeCoreDomainRealtime`.
- Customer routes block broad subscriptions for sensitive/admin tables.
- Existing realtime domains include orders/order items, loyalty, profiles, customer addresses, catalog, admin order feed, kitchen order feed, and print jobs.
- Realtime handlers should debounce or schedule sync instead of refetching aggressively on every event.

## n8n Standards

No n8n workflow JSON is stored in the repo. The project contains n8n contracts in docs:

- `docs/n8n-nexpos-partner-orders-mapping.md`
- `docs/n8n-partner-customer-profile-hydration.md`
- `docs/data-source-of-truth.md`

### Workflow Naming

- Use domain-oriented names that match the docs, for example partner order ingest, NexPOS partner orders mapping, or partner customer profile hydration.
- Include source/platform in names when the workflow is source-specific, such as GrabFood, ShopeeFood, or Xanh Ngon.

### Error Handling

- Partner order ingest must not write directly to `profiles`.
- Customer profile hydration should call RPC `upsert_customer_stub_profile`.
- Hydration RPC nodes should allow the order ingest to continue when profile hydration fails or is skipped.
- Preserve raw payloads in `raw_data` fields for debugging.

### Retry Strategy

- Retry external/API steps only when the operation is idempotent.
- Partner order upsert is idempotent only when using `partner_source + nexpos_order_id`.
- Partner item sync should delete/reinsert or upsert within the returned `partner_order_id`, not by display code.

### Idempotent Processing

- Never use `order_code` or `display_order_code` as the true identity for partner orders.
- Use `partner_source + nexpos_order_id` for `partner_orders`.
- Use `partner_order_id` for `partner_order_items`.
- For customer hydration, use normalized phone and the RPC contract; do not set `registered = true` from n8n.

## Database Rules

- Do not duplicate source-of-truth logic in multiple services.
- Prefer the existing repository/service contract before adding new table access.
- Avoid N+1 query patterns; use batch reads, `in(...)`, or RPC aggregation where the codebase already does this.
- Use appropriate indexes for filters used by admin, kitchen, tracking, phone lookup, date filters, branch filters, and realtime-heavy tables.
- Use stable identities:
  - Customer: normalized `profiles.phone`
  - Partner order: `partner_source + nexpos_order_id`
  - Web order item updates: `sourceItemId` / row id
  - Branch: branch UUID/code/candidates through `branchIdentityService`
- Do not infer final loyalty totals from orders alone; use `loyalty_accounts` and `loyalty_ledger`.
- Do not infer monthly gift claimed state from orders; use `monthly_customer_gifts`.
- Local cache is not the final source of truth in Supabase-first domains.

## Performance Rules

- Keep API calls scoped by domain, branch, phone, date, order id, or config key.
- Use existing batched config loading in `supabaseConfigAdapter`.
- Use RPC aggregate functions for dashboards/order-counting when available.
- Avoid adding realtime subscriptions without cleanup.
- Avoid broad frontend refetch loops after realtime events.
- Keep expensive normalization in services/helpers instead of repeating it in render paths.
- Preserve cache TTL behavior in repositories unless changing the data freshness contract intentionally.

## Security Rules

- Secrets must not be hardcoded in frontend code.
- Frontend may use Supabase anon/publishable keys only.
- Service role keys are only for server-side/Supabase Edge Function/n8n secure contexts.
- `SEPAY_WEBHOOK_SECRET` is required for the SePay Edge Function flow.
- Authentication uses scoped Supabase clients for runtime/customer/admin/kitchen.
- Authorization is enforced by Supabase RLS and role checks in `profiles`.
- Input validation should normalize phone, numeric amounts, ids, branch keys, and status values in services before writing.
- Do not let UI components write directly to protected tables.
- Do not allow n8n to overwrite `auth_user_id`, `role`, or `registered` for customer profiles.

## Deployment Rules

### Build Process

- Main build command:

```txt
npm run build
```

- Build runs:

```txt
node scripts/check-encoding.mjs
node scripts/patch-vite.mjs
vite build --minify false --target es2020
```

- APK web build:

```txt
npm run build:apk-web
```

- Preview:

```txt
npm run preview
```

### Migration Process

- Put SQL changes in `docs/supabase-sql`.
- Run audit/check SQL before schema changes when an audit file exists for that domain.
- Apply schema changes in Supabase SQL Editor or Supabase deployment tooling.
- Deploy Supabase Edge Functions separately when changing `supabase/functions`.
- For SePay POS webhook, deploy function `sepay-pos-webhook` and set:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SEPAY_WEBHOOK_SECRET`

### Release Checklist

- `npm run build`
- `npm run lint` when editing JS/JSX broadly.
- Relevant smoke scripts:
  - `npm run smoke`
  - `npm run smoke:flows`
  - `npm run smoke:loyalty`
  - `npm run smoke:supabase-config`
  - `npm run smoke:supabase-core`
  - `npm run smoke:supabase-catalog`
  - `npm run smoke:supabase-health`
- Check route smoke manually for touched areas such as `/home`, `/menu`, `/checkout`, `/orders`, `/admin/orders`, `/admin/customers`, `/kitchen`, `/pos`, `/banhkembanhtrang`.
- Verify Vietnamese text after changes.
- Verify Supabase RLS/RPC changes before enabling runtime writes in production.

## AI Agent Instructions

- Read the relevant files before editing. Do not guess architecture from filenames only.
- Keep changes scoped to the user's request.
- Do not rewrite the whole project unless explicitly requested.
- Do not rename files, components, functions, routes, storage keys, config keys, or database columns unless required and verified.
- Do not remove `src/main.jsx`, `src/App.jsx`, `index.html`, `package.json`, or `vite.config.js`.
- Preserve the current React/Vite structure.
- Preserve UTF-8 Vietnamese text. Run `npm run build` or at least `npm run check:encoding` when text changes.
- Use existing services/repositories instead of adding direct Supabase calls in UI.
- Follow `Component -> Hook -> Service -> Repository -> Supabase`.
- Keep Supabase writes behind existing runtime flags and write policy.
- Do not weaken RLS or expose service-role secrets to frontend code.
- Keep localStorage/sessionStorage use limited to existing session/cache/draft patterns.
- For new domain data, add service/repository boundaries first.
- For SQL changes, create or update a file under `docs/supabase-sql`.
- For n8n-related changes, follow the docs contract and keep processing idempotent.
- For partner orders, never use `order_code` as identity; use `partner_source + nexpos_order_id`.
- For customer profiles, do not set `registered = true` just because an order exists.
- For loyalty, prefer `loyalty_accounts` and `loyalty_ledger`.
- For monthly gift state, prefer `monthly_customer_gifts`.
- For branch matching, use `branchIdentityService` helpers.
- For UI work, match the existing F&B/POS/admin style and keep controls clear, dense, and practical.
- Before final response, check imports, exports, JSX syntax, braces, and Vietnamese encoding.
- If many files are changed, list every changed file in the response.

## Recommendations

### High Priority

- Fix mojibake/encoding in docs and any source files flagged by `scripts/check-encoding.mjs`. Several docs and at least one service message show corrupted Vietnamese text.
- Remove hardcoded fallback Supabase URL/anon key from `src/services/supabase/runtimeFlags.js` and rely on environment configuration.
- Continue consolidating customer profile write paths so `profiles` has one clear write contract.
- Keep partner customer hydration behind RPC and avoid direct `profiles` writes from n8n.

### Medium Priority

- Split very large repository/service files, especially `coreSupabaseRepository.js`, `kitchenOrderService.js`, and other long domain services, into smaller domain modules.
- Reduce prop-drilling in customer/admin route props by grouping props by domain or using smaller view-model objects.
- Add explicit regression tests or smoke coverage for POS, kitchen, partner orders, and cake ordering.
- Document exact standard table schemas for catalog/config tables that are currently inferred from repository code and SQL docs.

### Low Priority

- Remove unused route composition if `AppRouters.jsx` is no longer used.
- Gradually migrate high-risk domain contracts to typed schemas or runtime validators if the project later adopts TypeScript.
- Normalize docs language/encoding style so SQL docs consistently use UTF-8 or unicode escapes for Vietnamese text.
