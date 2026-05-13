import { useEffect } from "react";
import { loadShippingConfigAsync } from "../../services/shippingService.js";
import { loadZaloConfigAsync } from "../../services/zaloService.js";
import { loadOptionGroupPresetsAsync } from "../../services/optionGroupService.js";

export default function useAdminConfigSyncEffect({
  supabaseConfigSyncEnabled,
  zaloConfig,
  setShippingConfig,
  setZaloConfig,
  setOptionGroupPresetsState
}) {
  useEffect(() => {
    if (!supabaseConfigSyncEnabled) return;
    let disposed = false;
    Promise.all([
      loadShippingConfigAsync(),
      loadZaloConfigAsync(zaloConfig.phone || "0788422424"),
      loadOptionGroupPresetsAsync()
    ])
      .then(([shippingRemote, zaloRemote, optionGroupPresets]) => {
        if (disposed) return;
        setShippingConfig(shippingRemote);
        setZaloConfig(zaloRemote);
        if (Array.isArray(optionGroupPresets)) {
          setOptionGroupPresetsState(optionGroupPresets);
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
    };
  }, [supabaseConfigSyncEnabled, zaloConfig.phone, setShippingConfig, setZaloConfig, setOptionGroupPresetsState]);
}
