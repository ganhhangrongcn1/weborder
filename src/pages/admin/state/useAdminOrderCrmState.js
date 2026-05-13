import { useEffect, useState } from "react";
import { buildCustomersFromOrdersAsync } from "../../../services/crmService.js";
import { STORAGE_KEYS } from "../../../services/repositories/storageKeys.js";

export default function useAdminOrderCrmState(orderStorage) {
  const [ordersSnapshot, setOrdersSnapshot] = useState([]);
  const [crmSnapshot, setCrmSnapshot] = useState({ customers: [], loyaltyConfig: {} });
  const [customerAdminTab, setCustomerAdminTab] = useState("crm");
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState("");

  useEffect(() => {
    let disposed = false;
    const refreshSnapshots = async () => {
      const [ordersResult, crmResult] = await Promise.allSettled([
        orderStorage?.getAllAsync?.(),
        buildCustomersFromOrdersAsync(orderStorage)
      ]);
      if (disposed) return;
      const nextOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
      const nextCrm = crmResult.status === "fulfilled" ? crmResult.value : { customers: [], loyaltyConfig: {} };
      if (ordersResult.status === "rejected") {
        console.error("[admin][orders] failed to load snapshot", ordersResult.reason);
      }
      if (crmResult.status === "rejected") {
        console.error("[admin][crm] failed to load snapshot", crmResult.reason);
      }
      setCrmSnapshot(nextCrm);
      setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
    };

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEYS.ordersByPhone) refreshSnapshots();
    };

    window.addEventListener("ghr:orders-changed", refreshSnapshots);
    window.addEventListener("storage", handleStorageChange);
    refreshSnapshots();

    return () => {
      disposed = true;
      window.removeEventListener("ghr:orders-changed", refreshSnapshots);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [orderStorage]);

  return {
    ordersSnapshot,
    setOrdersSnapshot,
    crmSnapshot,
    setCrmSnapshot,
    customerAdminTab,
    setCustomerAdminTab,
    selectedCustomerPhone,
    setSelectedCustomerPhone
  };
}
