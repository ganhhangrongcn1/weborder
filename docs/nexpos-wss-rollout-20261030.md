# NexPOS WSS rollout - 30/10/2026

## Baseline

- Latest verified cloud main: `922e0b527168154158eb2c684cb4352bf2cea2a1`.
- Production importer: `nexpos-order-shadow-sync`, version 38.
- Production differs from main in Grab display code and item price/quantity mapping.
- Do not redeploy the importer from main without reconciling these differences.
- Keep existing 15-second polling and its rare/full/late reconciliation schedule.
- Four current enabled HUBs are the target; disabled/test HUBs must stay disabled.

## First deployment: metadata observation only

The VPS maintains WSS to NexPOS. It uses one enrolled HUB initially. The broker
returns the existing cached source token, never a Supabase service-role key.
Worker authentication uses a random 256-bit token stored only on VPS; DB stores
its SHA-256. No unauthenticated enrollment is supported. Enrollment expires.
Reports contain only connection counters, topic counters per allowed HUB and
timestamps. Source payloads, customer information and source credentials are
not logged or retained in reports. `connected` proves a socket opened, not that
NexPOS authenticated it or that any order event arrived.

The observation broker has no sync action. It does not call the importer or
write orders, items, print jobs, loyalty, stamps or inventory. Source session
refresh stays under existing polling; an unavailable session fails closed.

Files:

- `supabase/functions/nexpos-event-observer/index.ts`: machine-auth broker.
- `supabase/functions/nexpos-event-observer/policy.mjs`: metadata allowlist.
- `services/nexpos-events/observer.mjs`: Node 24 worker, reconnect/backoff,
  bounded connection lifetime and application heartbeat.
- `services/nexpos-events/ghr-nexpos-observer.service`: restricted service user.
- `supabase/migrations/20261030002921_nexpos_wss_observation.sql`: private-to-
  service-role enrollment table with RLS, no public/client grants.
- `docs/supabase-sql/nexpos-wss-observation.sql`: matching SQL artifact.
- `scripts/nexpos-event-observer.test.mjs`: metadata tests.
- `scripts/nexpos-event-observer-auth.test.mjs`: broker authentication tests.
- `services/nexpos-events/prepare.sh`: prepare reviewed files without activation.

## Activation gate

Before order-write activation, verify real events for the canary HUB, including
new order, cancellation, status changes, reconnect and source session renewal.
Check corresponding REST snapshots and existing DB results, without creating
test orders or triggering real prints/loyalty redemptions. A successful socket
connection, heartbeat or fake-socket test does not pass this gate.

The next deployment must introduce durable per-HUB pending work, owner-checked
renewable leases shared by polling and events, bounded scoped REST reads,
stale-result protection, atomic order/items persistence and changed-field writes.
Use production v38 mappings and existing DB triggers. Recheck rollback and
unchanged order/items/finance/kitchen/loyalty contracts before activation.
Only then can the canary activate order synchronization. Expand to the other
three enabled HUBs only after its live acceptance succeeds. Keep polling.

## Operations and rollback

- VPS: `systemctl status ghr-nexpos-observer`; logs must not contain credentials
  or source payloads. `journalctl -u ghr-nexpos-observer` contains metadata only.
- Cloud: read `last_seen_at`, `last_report` in `nexpos_event_workers`.
- Stop observation: `systemctl disable --now ghr-nexpos-observer` and disable
  the worker enrollment. Polling continues independently.
- Revoke a worker by disabling its enrollment; do not delete business data.
- Never publish or print `/etc/ghr-nexpos-observer/worker-token`.
- Do not enable four-HUB sync automatically based only on uptime/event counts.

## Validation

`node --experimental-vm-modules --test scripts/nexpos-event-observer.test.mjs scripts/nexpos-event-observer-auth.test.mjs`

`node --check services/nexpos-events/observer.mjs`

`npm run build`

Actual deployment/observation outcomes must be recorded separately from this plan.

## Recorded preparation outcome

- Five auth/metadata tests passed; JS worker syntax check passed.
- Enrollment table applied to production. Verified RLS enabled, no anon or
  authenticated SELECT access, and zero enrolled workers.
- Security advisor reports RLS-without-policy as expected: this table is
  intentionally inaccessible to app users, with explicit service-role grants.
- Existing polling remains active at 15 seconds; all four prior HUBs stay enabled.
- Broker deployment was rejected by automatic approval review because returning
  the cached NexPOS token to VPS needs explicit credential-transfer authorization.
  No broker activation or live authenticated WSS acceptance has occurred yet.
- VPS Node 24.15.0 runtime was downloaded from nodejs.org and its archive SHA-256
  matched the official SHASUMS256.txt. No order importer changes were deployed.
- Canary scope chosen for the pending observation is HUB `69e18c814673b293b04be1ab`.
- VPS observation files were prepared from cloud commit
  `2b4c0a4498e272cdf4570fdcb46bf4ae313692ed`; service verified disabled/inactive,
  without a worker credential. Source syntax and systemd unit verification passed.
- Local migration filename matches the version actually applied by the cloud
  migration tool, `20261030002921`; do not apply it a second time.
- Web encoding passed for 707 source files. Full web build reached Vite but
  did not finish in the verification window; do not record a passing web build.
- Preparation is not completed WSS synchronization. Do not expand to four HUBs
  until the live canary gate and synchronization implementation are complete.

## Authorized activation - 30/10/2026, 07:42 (UTC+7)

- User explicitly authorized the authenticated broker, a separate worker key,
  and transferring the existing NexPOS source session from Supabase to VPS
  `180.93.195.93` for WSS. The earlier credential approval blocker is resolved.
- Deployed `nexpos-event-observer` v1, ACTIVE; its own machine-key authentication
  is enforced with platform JWT validation disabled for this machine endpoint.
- Missing key and a 64-character unregistered key both returned HTTP 401 in live
  tests. Five local broker/metadata tests passed again.
- Generated the 256-bit worker key on VPS; raw key was not exported to local
  files or source. VPS file is root-owned, group `ghr-observer`, mode 640.
  DB stores its SHA-256 only. Enrollment expires 06/11/2026 at 07:42 UTC+7;
  renew or rotate deliberately before that date if observation must continue.
- Enrolled only `69e18c814673b293b04be1ab`. Worker service enabled and started
  under the dedicated non-login user. No Supabase service-role key was given
  to VPS. Broker bootstrap and metadata reports succeeded from VPS.
- First source socket opened at 07:42:58 UTC+7; the worker received a source
  message at 07:43:27.899. That message was not a scoped business event and was
  discarded by the metadata allowlist. Socket open/source response does not
  establish event coverage or order-sync acceptance.
- A controlled worker restart at 07:44:57 UTC+7 recovered successfully. At
  07:46:01.936, cloud received a fresh report from the new process: connected,
  one socket open, two received messages, zero closes and zero scoped business
  events. Last source response was at 07:45:58.998. This passes worker restart
  recovery, not new-order/cancellation/status acceptance or source-token renewal.
- No scoped new-order/cancellation/status events had arrived at this checkpoint.
  Order synchronization through WSS is NOT activated. Four-HUB expansion is NOT
  performed. All four existing polling HUBs and 15-second fallback cron remain
  unchanged. Do not equate observing a socket with faster ingestion in production.
- No frontend or importer code was changed in this activation turn. Web build
  remains the earlier uncompleted check; it is not represented as passing.
