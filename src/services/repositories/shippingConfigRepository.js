import { adminConfigRepository } from "./adminConfigRepository.js";
import { getRuntimeSupabaseClient } from "./repositoryRuntime.js";

export const SHIPPING_CONFIG_KEY = "ghr_shipping_config";

export const shippingConfigRepository = {
  get(fallback) {
    return adminConfigRepository.get(SHIPPING_CONFIG_KEY, fallback);
  },
  set(value) {
    return adminConfigRepository.set(SHIPPING_CONFIG_KEY, value);
  },
  async getAsync(fallback) {
    return adminConfigRepository.getAsync(SHIPPING_CONFIG_KEY, fallback);
  },
  async setAsync(value) {
    return adminConfigRepository.setAsync(SHIPPING_CONFIG_KEY, value);
  },
  async setStrictAsync(value) {
    const client = getRuntimeSupabaseClient();
    if (!client) {
      throw new Error("missing_supabase_client");
    }
    const { error } = await client
      .from("app_configs")
      .upsert(
        {
          id: SHIPPING_CONFIG_KEY,
          value,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "id"
        }
      );
    if (error) throw error;
    return value;
  }
};
