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

const assertIncludes = (content, expected, message) => {
  if (!content.includes(expected)) {
    throw new Error(message);
  }
};

const [foundation, audit, postcheck, cutover] = await Promise.all([
  readFile(FOUNDATION_FILE, "utf8"),
  readFile(AUDIT_FILE, "utf8"),
  readFile(POSTCHECK_FILE, "utf8"),
  readFile(CUTOVER_FILE, "utf8"),
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
assertIncludes(
  cutover,
  "revoke all on public.loyalty_ledger from anon;",
  "Security cutover must revoke anonymous ledger access",
);

console.log("Loyalty V2 SQL smoke test passed.");
