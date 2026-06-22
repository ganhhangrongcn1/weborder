import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FOUNDATION_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260620110353_loyalty_v2_phase_2_foundation.sql",
);
const AUDIT_FILE = path.join(ROOT_DIR, "docs", "supabase-sql", "loyalty-v2-phase-2-audit.sql");
const POSTCHECK_FILE = path.join(ROOT_DIR, "docs", "supabase-sql", "loyalty-v2-phase-2-postcheck.sql");
const CUTOVER_FILE = path.join(
  ROOT_DIR,
  "docs",
  "supabase-sql",
  "loyalty-v2-phase-2-security-cutover.sql",
);
const PROGRAM_CONFIG_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260621102429_loyalty_program_phase_1_config.sql",
);
const PARTNER_NET_RECEIVED_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260621103652_loyalty_partner_net_received.sql",
);
const TIER_ENGINE_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260621130000_loyalty_tier_expiry_and_milestones.sql",
);
const DEFAULT_ACTIVATION_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260621131500_loyalty_program_default_activation.sql",
);
const REACHABLE_TIERS_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260622012305_loyalty_reachable_tiers_and_order_progress.sql",
);
const TIER_IDENTITY_FILE = path.join(
  ROOT_DIR,
  "supabase",
  "migrations",
  "20260622013732_loyalty_tier_names_and_icons.sql",
);

const assertIncludes = (content, expected, message) => {
  if (!content.includes(expected)) {
    throw new Error(message);
  }
};

const [foundation, audit, postcheck, cutover, programConfig, partnerNetReceived, tierEngine, defaultActivation, reachableTiers, tierIdentity] = await Promise.all([
  readFile(FOUNDATION_FILE, "utf8"),
  readFile(AUDIT_FILE, "utf8"),
  readFile(POSTCHECK_FILE, "utf8"),
  readFile(CUTOVER_FILE, "utf8"),
  readFile(PROGRAM_CONFIG_FILE, "utf8"),
  readFile(PARTNER_NET_RECEIVED_FILE, "utf8"),
  readFile(TIER_ENGINE_FILE, "utf8"),
  readFile(DEFAULT_ACTIVATION_FILE, "utf8"),
  readFile(REACHABLE_TIERS_FILE, "utf8"),
  readFile(TIER_IDENTITY_FILE, "utf8"),
]);

assertIncludes(foundation, "begin;", "Foundation migration must be transactional");
assertIncludes(foundation, "commit;", "Foundation migration must commit after all assertions");
if (/\brollback\s*;/i.test(foundation)) {
  throw new Error("Foundation migration still contains a dry-run ROLLBACK");
}

assertIncludes(
  foundation,
  "loyalty_ledger_v2_business_event_unique",
  "Missing business-event idempotency index",
);
assertIncludes(
  foundation,
  "loyalty_ledger_v2_idempotency_unique",
  "Missing request idempotency index",
);
assertIncludes(
  foundation,
  "reversal_of_ledger_id",
  "Missing reversal relationship in the ledger",
);
assertIncludes(
  foundation,
  "create or replace function public.process_order_loyalty(",
  "Missing public Loyalty V2 order facade",
);
assertIncludes(
  foundation,
  "create or replace function public.process_loyalty_checkin(",
  "Missing database-owned check-in flow",
);
assertIncludes(
  foundation,
  "create or replace function public.admin_adjust_loyalty_points(",
  "Missing ledger-based admin adjustment flow",
);
assertIncludes(
  foundation,
  "create or replace function public.activate_loyalty_rule_version(",
  "Missing immutable rule activation flow",
);

const publicOrderFacade = foundation.match(
  /create or replace function public\.process_order_loyalty\(([\s\S]*?)\)\s*returns table/i,
);
if (!publicOrderFacade) {
  throw new Error("Cannot inspect process_order_loyalty signature");
}
if (/p_(customer_)?phone|p_points|p_amount/i.test(publicOrderFacade[1])) {
  throw new Error("Order facade must not accept phone, points, or amount from the client");
}

if (/grant execute on function public\.process_order_loyalty[\s\S]{0,180}\bto\s+[^;]*anon/i.test(foundation)) {
  throw new Error("anon must not receive execute permission on process_order_loyalty");
}

assertIncludes(audit, "begin transaction read only;", "Preflight audit must be read-only");
assertIncludes(audit, "rollback;", "Preflight audit must end with ROLLBACK");
assertIncludes(postcheck, "begin transaction read only;", "Postcheck must be read-only");
assertIncludes(postcheck, "rollback;", "Postcheck must end with ROLLBACK");
assertIncludes(
  cutover,
  "app.loyalty_v2_allow_legacy_cutover",
  "Security cutover must require an explicit unlock flag",
);
assertIncludes(programConfig, "begin;", "Program config migration must be transactional");
assertIncludes(programConfig, "commit;", "Program config migration must commit");
assertIncludes(
  programConfig,
  "create or replace function public.activate_loyalty_program_version(",
  "Missing five-tier loyalty program activation RPC",
);
assertIncludes(partnerNetReceived, "begin;", "Partner net received migration must be transactional");
assertIncludes(partnerNetReceived, "commit;", "Partner net received migration must commit");
assertIncludes(
  partnerNetReceived,
  "add column if not exists net_received_amount numeric null",
  "Missing canonical partner net received amount",
);
assertIncludes(
  partnerNetReceived,
  "new.loyalty_hold_reason := 'missing_partner_net_received'",
  "Missing reconciliation hold behavior",
);
if (/coalesce\(po\.(?:net_received_amount|points_base_amount)[^)]*po\.total_amount/i.test(partnerNetReceived)) {
  throw new Error("Partner loyalty migration must not fall back to total_amount");
}
assertIncludes(
  programConfig,
  "jsonb_array_length(v_tiers) <> 5",
  "Five-tier database validation is missing",
);
assertIncludes(
  programConfig,
  "values ('ghr_loyalty', v_config, now())",
  "Program activation must update the shared ghr_loyalty config",
);
assertIncludes(
  cutover,
  "revoke all on public.loyalty_ledger from anon;",
  "Security cutover must revoke anonymous ledger access",
);
assertIncludes(tierEngine, "begin;", "Tier engine migration must be transactional");
assertIncludes(tierEngine, "commit;", "Tier engine migration must commit");
assertIncludes(
  tierEngine,
  "add column if not exists tier_qualifying_spend numeric not null default 0",
  "Missing annual tier qualification state",
);
assertIncludes(
  tierEngine,
  "create or replace function loyalty_private.expire_loyalty_account_if_due(",
  "Missing last-purchase point expiry engine",
);
assertIncludes(
  tierEngine,
  "unique (customer_phone, tier_id, cycle_year)",
  "Milestone voucher grants must be idempotent per tier and year",
);
assertIncludes(
  tierEngine,
  "new.points_base_amount * 0.5",
  "Order snapshot must enforce the 50 percent redemption ceiling",
);
assertIncludes(
  tierEngine,
  "new.loyalty_earn_numerator / new.loyalty_earn_denominator",
  "Partner refresh must preserve the snapshotted tier earn rate",
);
assertIncludes(defaultActivation, "begin;", "Default tier activation must be transactional");
assertIncludes(defaultActivation, "commit;", "Default tier activation must commit");
assertIncludes(
  defaultActivation,
  "'ganh_legend', 'name', 'Huyền Thoại Gánh'",
  "Default activation must include the highest agreed tier",
);
assertIncludes(
  defaultActivation,
  "'maxRedemptionPercent', 50",
  "Default activation must publish the 50 percent redemption setting",
);
assertIncludes(reachableTiers, "begin;", "Reachable tier migration must be transactional");
assertIncludes(reachableTiers, "commit;", "Reachable tier migration must commit");
assertIncludes(
  reachableTiers,
  "add column if not exists tier_qualifying_order_count integer not null default 0",
  "Missing annual qualifying order count",
);
assertIncludes(tierIdentity, "begin;", "Tier identity migration must be transactional");
assertIncludes(tierIdentity, "commit;", "Tier identity migration must commit");
assertIncludes(
  tierIdentity,
  "when 'inner_circle_fan' then 'Ghiền Chính Hiệu'",
  "Tier identity migration must publish the agreed fourth tier name",
);
assertIncludes(
  tierIdentity,
  "when 'new_customer' then 'sprout'",
  "Tier identity migration must publish stable icon keys",
);
assertIncludes(
  reachableTiers,
  "when 'returning_customer' then 500000",
  "Returning customer threshold must be 500k",
);
assertIncludes(
  reachableTiers,
  "when 'ganh_legend' then 6000000",
  "Legend threshold must be 6m",
);
assertIncludes(
  reachableTiers,
  "tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0) + 1, 0)",
  "Completed loyalty events must advance annual order progress",
);

console.log("Loyalty V2 SQL smoke test passed.");
