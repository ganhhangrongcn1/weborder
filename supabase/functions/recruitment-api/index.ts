import { createClient } from "npm:@supabase/supabase-js@2.105.3";
import { createRecruitmentHandler } from "./handler.js";

const env = (name: string) => Deno.env.get(name) || "";
const getClient = () => {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SERVER_NOT_CONFIGURED");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
};

// Deploy with --no-verify-jwt: applicants do not need a user account.
Deno.serve(createRecruitmentHandler({ env, getClient }));
