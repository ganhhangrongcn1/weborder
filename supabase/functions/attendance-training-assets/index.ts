import { createClient } from "npm:@supabase/supabase-js@2.105.3";
import { assets } from "./assets.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Type, Content-Length",
};
function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return fail(405, "Method not allowed");
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return fail(401, "Authentication required");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  // Validate the user and the active demo account in the body as well as the gateway.
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) return fail(401, "Invalid session");
  const access = await client.from("attendance_preview_accounts").select("user_id")
    .eq("user_id", data.user.id).eq("is_active", true).maybeSingle();
  if (access.error || !access.data) return fail(403, "Account not allowed");
  try {
    const body = await request.text();
    if (body.length > 256) return fail(413, "Request too large");
    const { id } = JSON.parse(body);
    if (id !== "guide" && id !== "video") return fail(404, "File not found");
    const asset = assets[id];
    const bytes = Uint8Array.from(atob(asset.base64), (char) => char.charCodeAt(0));
    return new Response(bytes, { headers: { ...cors, "Content-Type": asset.type,
      "Content-Length": String(bytes.length), "Content-Disposition": `attachment; filename="${asset.name}"`,
      "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
  } catch { return fail(400, "Invalid request"); }
});
