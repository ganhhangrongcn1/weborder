import {
  getSupabaseAdminAuthClient,
  initSupabaseAdminAuthClient
} from "./supabaseRuntimeClient.js";

export async function getAdminSupabaseClient() {
  return getSupabaseAdminAuthClient() || await initSupabaseAdminAuthClient();
}

export default getAdminSupabaseClient;
