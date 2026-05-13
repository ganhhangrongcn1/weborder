import { addAddress, setDefaultAddress } from "./addressService.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";

const defaultLoyaltyRule = {
  currencyPerPoint: 1000,
  pointPerUnit: 1,
  redeemPointUnit: 1,
  redeemValue: 1
};

export function getCheckoutLoyaltyRule() {
  return loyaltyRepository.getLoyaltyRule(defaultLoyaltyRule);
}

export function saveLatestDeliveryAddress({
  demoAddresses = [],
  nextInfo,
  nextDistance,
  recalculatedDeliveryFee
}) {
  const nextAddresses = addAddress(demoAddresses, {
    label: "Giao gần nhất",
    receiverName: nextInfo.name,
    phone: nextInfo.phone,
    address: nextInfo.address,
    lat: nextInfo.lat,
    lng: nextInfo.lng,
    distanceKm: nextDistance,
    deliveryFee: recalculatedDeliveryFee,
    isDefault: true
  });
  return setDefaultAddress(nextAddresses, nextAddresses[0].id);
}
