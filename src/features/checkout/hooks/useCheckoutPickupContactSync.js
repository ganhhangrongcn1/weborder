import { useEffect } from "react";
import { getCustomerKey } from "../../../services/storageService.js";
import { customerRepository } from "../../../services/repositories/customerRepository.js";

function isPlaceholderName(name = "") {
  const normalized = String(name || "").trim().toLowerCase();
  return !normalized || ["khách", "khách hàng", "khach", "khach hang"].includes(normalized);
}

function pickCustomerName(...sources) {
  return sources
    .map((value) => String(value || "").trim())
    .find((value) => !isPlaceholderName(value)) || "";
}

function pickNameFromCustomer(customer = {}) {
  return pickCustomerName(
    customer?.name,
    customer?.fullName,
    customer?.full_name,
    customer?.displayName,
    customer?.display_name,
    customer?.customerName,
    customer?.customer_name
  );
}

function mergePickupContact(current, nextName, nextPhone) {
  return {
    ...current,
    name: nextName && isPlaceholderName(current.name) ? nextName : current.name,
    phone: current.phone || nextPhone
  };
}

export default function useCheckoutPickupContactSync({
  currentPhone,
  demoUser,
  pickupPhone,
  userProfile,
  setPickupContact
}) {
  useEffect(() => {
    const lookupPhone = getCustomerKey(currentPhone || pickupPhone || demoUser?.phone || userProfile?.phone || "");
    const storedUser = lookupPhone ? customerRepository.getUserByPhone(lookupPhone) : null;
    const nextName = pickNameFromCustomer(userProfile) || pickNameFromCustomer(demoUser) || pickNameFromCustomer(storedUser);
    const nextPhone = lookupPhone || currentPhone || pickupPhone || demoUser?.phone || userProfile?.phone || "";

    if (!nextName && !nextPhone) return;

    setPickupContact((current) => mergePickupContact(current, nextName, nextPhone));
  }, [
    currentPhone,
    demoUser?.displayName,
    demoUser?.display_name,
    demoUser?.fullName,
    demoUser?.full_name,
    demoUser?.name,
    demoUser?.phone,
    pickupPhone,
    userProfile?.customerName,
    userProfile?.customer_name,
    userProfile?.displayName,
    userProfile?.display_name,
    userProfile?.fullName,
    userProfile?.full_name,
    userProfile?.name,
    userProfile?.phone,
    setPickupContact
  ]);

  useEffect(() => {
    const lookupPhone = getCustomerKey(currentPhone || pickupPhone || demoUser?.phone || userProfile?.phone || "");
    if (!lookupPhone) return undefined;

    let isActive = true;

    customerRepository.getUserByPhoneAsync(lookupPhone).then((remoteUser) => {
      if (!isActive) return;
      const remoteName = pickNameFromCustomer(remoteUser);
      if (!remoteName) return;
      setPickupContact((current) => mergePickupContact(current, remoteName, lookupPhone));
    }).catch(() => {
      // Checkout still works if the profile lookup is temporarily unavailable.
    });

    return () => {
      isActive = false;
    };
  }, [
    currentPhone,
    demoUser?.phone,
    pickupPhone,
    userProfile?.phone,
    setPickupContact
  ]);
}
