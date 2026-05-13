import { saveShippingConfig, saveShippingConfigAsync, saveShippingConfigStrictAsync } from "../../../services/shippingService.js";
import { saveZaloConfig, saveZaloConfigAsync } from "../../../services/zaloService.js";
import { saveOptionGroupPresets, saveOptionGroupPresetsAsync } from "../../../services/optionGroupService.js";

export default function useAdminStoreConfigActions({
  supabaseConfigSyncEnabled,
  zaloConfig,
  setZaloConfig,
  shippingConfig,
  setShippingConfig,
  setOptionGroupPresetsState
}) {
  const saveOptionGroupPresetsState = (valueOrUpdater) => {
    setOptionGroupPresetsState((current) => {
      const resolved = typeof valueOrUpdater === "function" ? valueOrUpdater(current) : valueOrUpdater;
      const normalized = saveOptionGroupPresets(resolved);
      if (supabaseConfigSyncEnabled) {
        saveOptionGroupPresetsAsync(normalized).catch(() => {});
      }
      return normalized;
    });
  };

  const handleSaveZalo = (nextConfig = zaloConfig) => {
    const next = saveZaloConfig(nextConfig);
    setZaloConfig(next);
    if (supabaseConfigSyncEnabled) {
      saveZaloConfigAsync(next).catch(() => {});
    }
  };

  const handleSaveShipping = async (nextConfig = shippingConfig) => {
    const next = saveShippingConfig(nextConfig);
    setShippingConfig(next);
    if (supabaseConfigSyncEnabled) {
      try {
        await saveShippingConfigStrictAsync(next);
      } catch (_error) {
        await saveShippingConfigAsync(next).catch(() => {});
        throw _error;
      }
    }
    return next;
  };

  return {
    saveOptionGroupPresetsState,
    handleSaveZalo,
    handleSaveShipping
  };
}
