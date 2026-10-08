import { getRuntimeSupabaseClient } from "./repositories/repositoryRuntime.js";
import { readCatalogFromStandardTable } from "./repositories/catalogSupabaseRepository.js";

// Catalog visibility changes when the Admin session reaches the runtime client.
// Never reuse anonymous promotion data after authentication (or vice versa).
export default function subscribePromotionSession(onChange, {
  client = getRuntimeSupabaseClient(),
  read = readCatalogFromStandardTable
} = {}) {
  if (!client?.auth?.onAuthStateChange) return () => {};
  let disposed = false;
  let revision = 0;
  let identity;
  let timer;
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const nextIdentity = session?.user?.id || "anonymous";
    if (nextIdentity === identity) return;
    identity = nextIdentity;
    const requestRevision = ++revision;
    clearTimeout(timer);
    // Leave the auth callback before invoking Supabase to avoid its auth lock.
    timer = setTimeout(async () => {
      if (disposed) return;
      onChange([]);
      const next = await read("ghr_smart_promotions", [], { force: true });
      if (!disposed && requestRevision === revision && Array.isArray(next)) {
        onChange(next);
      }
    }, 0);
  });
  return () => {
    disposed = true;
    revision++;
    clearTimeout(timer);
    data?.subscription?.unsubscribe();
  };
}
