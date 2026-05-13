import { useState } from "react";
import { loadZaloConfig } from "../../../services/zaloService.js";
import { loadShippingConfig } from "../../../services/shippingService.js";
import { loadOptionGroupPresets } from "../../../services/optionGroupService.js";

export default function useAdminStoreConfigState() {
  const [zaloConfig, setZaloConfig] = useState(() => loadZaloConfig("0788422424"));
  const [shippingConfig, setShippingConfig] = useState(() => loadShippingConfig());
  const [optionGroupPresets, setOptionGroupPresetsState] = useState(() => loadOptionGroupPresets());

  return {
    zaloConfig,
    setZaloConfig,
    shippingConfig,
    setShippingConfig,
    optionGroupPresets,
    setOptionGroupPresetsState
  };
}
