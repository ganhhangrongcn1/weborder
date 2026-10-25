import { getRuntimeSupabaseClient } from "./repositoryRuntime.js";
import { shouldWriteConfigKeyToSupabase } from "./writeThroughPolicy.js";
import { RECEIPT_TEMPLATE_KEY } from "../../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js";

export const receiptTemplateRepository = {
  async read() {
    const client = getRuntimeSupabaseClient();
    if (!client) throw new Error("Chưa kết nối được máy chủ cấu hình.");
    const controller = new globalThis.AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const { data, error } = await client.from("app_configs").select("value")
        .eq("id", RECEIPT_TEMPLATE_KEY).maybeSingle().abortSignal(controller.signal);
      if (error) throw error;
      return data?.value || null;
    } finally { clearTimeout(timeout); }
  },
  async save(value) {
    if (!shouldWriteConfigKeyToSupabase(RECEIPT_TEMPLATE_KEY)) throw new Error("Chưa bật quyền lưu cấu hình máy chủ.");
    const client = getRuntimeSupabaseClient();
    if (!client) throw new Error("Chưa kết nối được máy chủ cấu hình.");
    const { error } = await client.from("app_configs").upsert({
      id: RECEIPT_TEMPLATE_KEY, value, updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (error) throw error;
    return value;
  }
};
