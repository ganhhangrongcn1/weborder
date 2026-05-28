import { getRuntimeSupabaseClient } from "./repositories/repositoryRuntime.js";
import { initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import { isSupabaseRuntimeWriteEnabled } from "./supabase/runtimeFlags.js";

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeRpcMessage(error, fallback = "Khong the dong bo customer profile.") {
  const message = toText(error?.message || error);
  return message || fallback;
}

async function getClientReady() {
  const existing = getRuntimeSupabaseClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  return getRuntimeSupabaseClient();
}

function mapCustomerStubResult(row = {}, fallbackMessage = "") {
  return {
    ok: Boolean(row?.ok),
    message: toText(row?.message) || fallbackMessage,
    profileId: toText(row?.profile_id),
    phone: toText(row?.phone),
    role: toText(row?.role || "customer"),
    registered: Boolean(row?.registered),
    createdNew: Boolean(row?.created_new),
    sourceTag: toText(row?.source_tag),
    hydratedName: toText(row?.hydrated_name)
  };
}

export async function upsertCustomerStubProfile({
  phone,
  name = "",
  source = "",
  sourceRef = ""
}) {
  if (!isSupabaseRuntimeWriteEnabled()) {
    return { ok: false, message: "Supabase runtime write dang tat." };
  }

  const client = await getClientReady();
  if (!client) return { ok: false, message: "Supabase chua san sang." };

  try {
    const { data, error } = await client.rpc("upsert_customer_stub_profile", {
      p_phone: toText(phone),
      p_name: toText(name) || null,
      p_source: toText(source) || null,
      p_source_ref: toText(sourceRef) || null
    });

    if (error) {
      return {
        ok: false,
        message: normalizeRpcMessage(error, "Khong the dong bo customer stub profile.")
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    return mapCustomerStubResult(row, "Da dong bo customer stub profile.");
  } catch (error) {
    return {
      ok: false,
      message: normalizeRpcMessage(error, "Khong the dong bo customer stub profile.")
    };
  }
}

export default {
  upsertCustomerStubProfile
};
