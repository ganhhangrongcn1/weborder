import { createClient } from "npm:@supabase/supabase-js@2.105.3";
import { createRecruitmentHandler } from "./handler.js";
import { drainRecruitmentNotifications } from "./notifications.js";

declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };

const getClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SERVER_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

// Public intake uses server validation; every privileged action has its own auth gate.
Deno.serve(async (request: Request) => {
  try {
    const client = getClient();
    const { data, error } = await client.rpc("get_recruitment_runtime_config");
    if (error || !data) throw new Error("CONFIG_UNAVAILABLE");
    const env = (name: string): string => Deno.env.get(name) || data[name] || "";
    return await createRecruitmentHandler({ env, getClient: () => client, onSaved: () => {
      if (typeof EdgeRuntime !== "undefined") {
        EdgeRuntime.waitUntil(drainRecruitmentNotifications({ client, env })
          .catch(() => console.error("[recruitment-api] dispatch pending; inspect recruitment queue")));
      }
    } })(request);
  } catch {
    return new Response(JSON.stringify({ ok: false, message: "Hệ thống đang tạm chưa sẵn sàng." }), {
      status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
});
