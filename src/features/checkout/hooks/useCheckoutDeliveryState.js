import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { goongDistanceMatrix } from "../../../services/goongService.js";

function estimateDistanceFromCoordinate(lat, lng, origin) {
  if (!lat || !lng || !origin?.lat || !origin?.lng) return null;
  const earthRadiusKm = 6371;
  const dLat = (Number(lat) - Number(origin.lat)) * Math.PI / 180;
  const dLng = (Number(lng) - Number(origin.lng)) * Math.PI / 180;
  const fromLat = Number(origin.lat) * Math.PI / 180;
  const toLat = Number(lat) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  return Math.max(0.1, earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function resolveDistanceForDeliveryInfo(deliveryInfo, deliveryOrigin) {
  const lat = Number(deliveryInfo?.lat || 0);
  const lng = Number(deliveryInfo?.lng || 0);
  if (lat && lng && deliveryOrigin?.lat && deliveryOrigin?.lng) {
    const distance = await goongDistanceMatrix(deliveryOrigin, { lat, lng });
    const fallbackDistance = estimateDistanceFromCoordinate(lat, lng, deliveryOrigin);
    return {
      distanceKm: distance?.distanceKm ?? fallbackDistance ?? null,
      source: distance?.distanceKm ? "Goong.io" : (fallbackDistance ? "Ước tính theo tọa độ" : "Nhân viên xác nhận")
    };
  }

  const fallbackDistance = estimateDistanceKm(deliveryInfo?.address || "");
  return {
    distanceKm: fallbackDistance,
    source: fallbackDistance ? "Demo ước tính" : "Nhân viên xác nhận"
  };
}

export default function useCheckoutDeliveryState({
  branches,
  selectedDeliveryBranchId,
  setSelectedDeliveryBranchId,
  currentPhone,
  demoUser,
  demoAddresses,
  initialDeliveryInfo = null,
  setDemoAddresses,
  deliveryFee
}) {
  const distanceRequestRef = useRef(0);

  const [deliveryInfo, setDeliveryInfo] = useState(() =>
    createInitialDeliveryInfo({
      currentPhone,
      demoUser,
      demoAddresses,
      initialDeliveryInfo
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
    () =>
      resolveDeliveryContext({
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

  const handleSelectAddress = async (address) => {
    const { nextInfo } = buildDeliveryInfoFromAddress({
      address,
      shippingConfig,
      deliveryFee
    });
    const requestId = distanceRequestRef.current + 1;
    distanceRequestRef.current = requestId;
    const resolved = await resolveDistanceForDeliveryInfo(nextInfo, deliveryOrigin);
    if (requestId !== distanceRequestRef.current) return;
    const recalculatedDeliveryFee = calculateBaseShippingFeeByConfig(resolved.distanceKm, shippingConfig, deliveryFee);
    setDeliveryInfo({
      ...nextInfo,
      distanceKm: resolved.distanceKm,
      deliveryFee: recalculatedDeliveryFee,
      shippingStatus: resolved.distanceKm ? "OK" : "NEED_CONFIRM"
    });
    setDeliveryDistanceKm(resolved.distanceKm);
    setDeliveryFeeSource(resolved.source);
  };

  const handleSaveAddress = async (nextInfo) => {
    const { normalizedInfo } = normalizeDeliveryInfoOnSave({
      nextInfo,
      shippingConfig,
      deliveryFee
    });
    const requestId = distanceRequestRef.current + 1;
    distanceRequestRef.current = requestId;
    const resolved = await resolveDistanceForDeliveryInfo(normalizedInfo, deliveryOrigin);
    if (requestId !== distanceRequestRef.current) return;
    const recalculatedDeliveryFee = calculateBaseShippingFeeByConfig(resolved.distanceKm, shippingConfig, deliveryFee);
    const nextDeliveryInfo = {
      ...normalizedInfo,
      distanceKm: resolved.distanceKm,
      deliveryFee: recalculatedDeliveryFee,
      shippingStatus: resolved.distanceKm ? "OK" : "NEED_CONFIRM"
    };

    setDeliveryInfo(nextDeliveryInfo);
    setDeliveryDistanceKm(resolved.distanceKm);
    setDeliveryFeeSource(resolved.source);

    if (nextInfo.saveToAccount && setDemoAddresses) {
      const nextAddresses = saveLatestDeliveryAddress({
        demoAddresses,
        nextInfo: nextDeliveryInfo,
        nextDistance: resolved.distanceKm,
        recalculatedDeliveryFee
      });
      setDemoAddresses(nextAddresses);
    }
  };

  useEffect(() => {
    const hasAddress = String(deliveryInfo?.address || "").trim().length > 0;
    if (!hasAddress || !selectedDeliveryBranchId) return;

    const requestId = distanceRequestRef.current + 1;
    distanceRequestRef.current = requestId;
    let disposed = false;

    async function recalculateShippingForBranch() {
      const resolved = await resolveDistanceForDeliveryInfo(deliveryInfo, deliveryOrigin);
      if (disposed || requestId !== distanceRequestRef.current) return;
      const recalculatedDeliveryFee = calculateBaseShippingFeeByConfig(resolved.distanceKm, shippingConfig, deliveryFee);
      setDeliveryInfo((current) => ({
        ...current,
        distanceKm: resolved.distanceKm,
        deliveryFee: recalculatedDeliveryFee,
        shippingStatus: resolved.distanceKm ? "OK" : "NEED_CONFIRM"
      }));
      setDeliveryDistanceKm(resolved.distanceKm);
      setDeliveryFeeSource(resolved.source);
    }

    recalculateShippingForBranch();
    return () => {
      disposed = true;
    };
  }, [
    selectedDeliveryBranchId,
    deliveryOrigin?.lat,
    deliveryOrigin?.lng,
    deliveryInfo?.address,
    deliveryInfo?.lat,
    deliveryInfo?.lng,
    shippingConfig,
    deliveryFee
  ]);

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
