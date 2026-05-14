import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateBaseShippingFeeByConfig,
  loadShippingConfig,
  loadShippingConfigAsync
} from "../../../services/shippingService.js";
import {
  buildDeliveryInfoFromAddress,
  createInitialDeliveryInfo,
  normalizeDeliveryInfoOnSave,
  resolveDeliveryContext
} from "../checkoutDomain.js";
import { estimateDistanceKm } from "../checkoutHelpers.js";
import { saveLatestDeliveryAddress } from "../../../services/checkoutService.js";

export default function useCheckoutDeliveryState({
  branches,
  selectedDeliveryBranchId,
  setSelectedDeliveryBranchId,
  currentPhone,
  demoUser,
  demoAddresses,
  setDemoAddresses,
  deliveryFee
}) {
  const [deliveryInfo, setDeliveryInfo] = useState(() =>
    createInitialDeliveryInfo({
      currentPhone,
      demoUser,
      demoAddresses
    })
  );
  const initialDistance = deliveryInfo.distanceKm || estimateDistanceKm(deliveryInfo.address);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState(initialDistance);
  const [deliveryFeeSource, setDeliveryFeeSource] = useState(initialDistance ? "Demo ước tính" : "Chưa có địa chỉ");
  const [shippingConfig, setShippingConfig] = useState(() => loadShippingConfig());

  useEffect(() => {
    let disposed = false;

    loadShippingConfigAsync()
      .then((remoteConfig) => {
        if (!disposed && remoteConfig) {
          setShippingConfig(remoteConfig);
        }
      })
      .catch((error) => {
        console.warn("[checkout] load shipping config failed", error);
      });

    return () => {
      disposed = true;
    };
  }, []);

  const { deliveryEligibleBranches, deliverySourceBranch, deliveryOrigin } = useMemo(
    () => resolveDeliveryContext({
      branches,
      selectedDeliveryBranchId,
      shippingConfig
    }),
    [branches, selectedDeliveryBranchId, shippingConfig]
  );

  const syncSelectedDeliveryBranch = useCallback(() => {
    if (!deliveryEligibleBranches.length) return;
    const stillExists = deliveryEligibleBranches.some((branch) => branch.id === selectedDeliveryBranchId);
    if (!selectedDeliveryBranchId || !stillExists) {
      setSelectedDeliveryBranchId(deliveryEligibleBranches[0].id);
    }
  }, [deliveryEligibleBranches, selectedDeliveryBranchId, setSelectedDeliveryBranchId]);

  const handleSelectAddress = (address) => {
    const { nextInfo, distanceKm } = buildDeliveryInfoFromAddress({
      address,
      shippingConfig,
      deliveryFee
    });
    setDeliveryInfo(nextInfo);
    setDeliveryDistanceKm(distanceKm);
    setDeliveryFeeSource(distanceKm ? "Địa chỉ đã lưu" : "Chưa có địa chỉ");
  };

  const handleSaveAddress = (nextInfo) => {
    const { normalizedInfo, nextDistance, recalculatedDeliveryFee } = normalizeDeliveryInfoOnSave({
      nextInfo,
      shippingConfig,
      deliveryFee
    });
    setDeliveryInfo(normalizedInfo);
    setDeliveryDistanceKm(nextDistance);
    setDeliveryFeeSource(nextInfo.shippingStatus === "OK" ? "Goong.io" : "Nhân viên xác nhận");

    if (nextInfo.saveToAccount && setDemoAddresses) {
      const nextAddresses = saveLatestDeliveryAddress({
        demoAddresses,
        nextInfo,
        nextDistance,
        recalculatedDeliveryFee
      });
      setDemoAddresses(nextAddresses);
    }
  };

  const baseShippingByConfig = calculateBaseShippingFeeByConfig(deliveryDistanceKm, shippingConfig, deliveryFee);

  return {
    deliveryInfo,
    deliveryDistanceKm,
    deliveryFeeSource,
    shippingConfig,
    deliveryEligibleBranches,
    deliverySourceBranch,
    deliveryOrigin,
    baseShippingByConfig,
    syncSelectedDeliveryBranch,
    handleSelectAddress,
    handleSaveAddress
  };
}
