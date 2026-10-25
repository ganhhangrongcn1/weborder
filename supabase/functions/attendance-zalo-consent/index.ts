import { createHandler } from "./handler.mjs";

// Server-only credentials; never include them in the Mini App bundle.
const handler = createHandler({
  apiKey: Deno.env.get("ZALO_MINIAPP_OPEN_API_KEY"),
  persist: async (row: Record<string, unknown>) => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Storage unavailable");
    const result = await fetch(`${url}/rest/v1/attendance_zalo_consent_requests?on_conflict=event_key`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(row), signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error("Storage unavailable");
  },
});
Deno.serve(handler);
