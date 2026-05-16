import { useEffect } from "react";

export default function useCheckoutPickupContactSync({
  currentPhone,
  demoUser,
  userProfile,
  setPickupContact
}) {
  useEffect(() => {
    if (!currentPhone && !demoUser?.phone && !userProfile?.phone) return;
    setPickupContact((current) => ({
      name: current.name || demoUser?.name || userProfile?.name || "",
      phone: current.phone || currentPhone || demoUser?.phone || userProfile?.phone || ""
    }));
  }, [currentPhone, demoUser?.name, demoUser?.phone, userProfile?.name, userProfile?.phone, setPickupContact]);
}

