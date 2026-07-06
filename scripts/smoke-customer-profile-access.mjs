import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  customerSessionSource,
  accountViewModelSource,
  customerRepositorySource,
  coreRepositorySource,
  authServiceSource,
  profileRpcMigrationSource,
  profileRlsMigrationSource
] = await Promise.all([
  readFile(new URL("../src/hooks/useCustomerSession.js", import.meta.url), "utf8"),
  readFile(new URL("../src/features/account/hooks/useAccountViewModel.js", import.meta.url), "utf8"),
  readFile(new URL("../src/services/repositories/customerRepository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/services/repositories/coreSupabaseRepository.js", import.meta.url), "utf8"),
  readFile(new URL("../src/services/supabaseAuthService.js", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/migrations/20260706060204_harden_customer_profile_access.sql", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../supabase/migrations/20260706061433_harden_customer_profile_rls.sql", import.meta.url),
    "utf8"
  )
]);

assert.equal(
  customerSessionSource.includes("hydrateFromRemote"),
  false,
  "Customer session must not hydrate the full profiles table."
);
assert.equal(
  accountViewModelSource.includes("hydrateFromRemote"),
  false,
  "Customer account must use targeted profile reads."
);
assert.match(
  customerSessionSource,
  /customerRepository\.getUserByPhoneAsync\(currentPhone\)/,
  "Customer session must load only the current profile."
);
assert.match(
  customerRepositorySource,
  /userByPhoneReadInFlight/,
  "Per-phone profile requests must share an in-flight guard."
);
assert.match(
  coreRepositorySource,
  /get_customer_profile_login_hint/,
  "Pre-login profile lookup must use the minimal RPC."
);
assert.doesNotMatch(
  coreRepositorySource.match(/const CUSTOMER_PROFILE_COLUMNS = \[[\s\S]*?\]\.join\(","\);/)?.[0] || "",
  /password_demo/,
  "Frontend profile selects must not request password_demo."
);
assert.match(
  authServiceSource,
  /sync_own_customer_profile/,
  "Authenticated profile writes must use the owner-scoped RPC."
);
assert.match(
  profileRlsMigrationSource,
  /revoke all on table public\.profiles from anon;/,
  "Migration must revoke direct anonymous profiles access."
);
assert.match(
  profileRlsMigrationSource,
  /create policy profiles_owner_select/,
  "Migration must include an owner-only profile policy."
);
assert.match(
  profileRpcMigrationSource,
  /grant execute on function loyalty_private\.is_active_staff\(text\[\]\)[\s\S]*?to authenticated;/,
  "Authenticated backoffice policies must be allowed to execute the role helper."
);
assert.match(
  profileRpcMigrationSource,
  /create index if not exists profiles_auth_user_id_idx/,
  "Owner profile lookups must have an auth_user_id index."
);
assert.match(
  profileRpcMigrationSource,
  /trg_sync_web_order_customer_stub/,
  "Migration must preserve guest order profile hydration through a trigger."
);

console.log("Customer profile access smoke test passed.");
