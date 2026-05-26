import { useState } from "react";
import { orderStorage } from "../../../services/orderService.js";
import { defaultLoyaltyData, normalizeLoyaltyData } from "../../../services/loyaltyService.js";
import { getPartnerOrdersByPhone, mergeCustomerLookupOrders } from "../../../services/partnerOrderService.js";
import { loyaltyRepository } from "../../../services/repositories/loyaltyRepository.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { getDataSource } from "../../../services/repositories/dataSource.js";

function getOrderIdentityCandidates(order = {}) {
  return [
    order.id,
    order.orderCode,
    order.displayOrderCode,
    order.partnerOrderCode
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function buildEarnedOrderSet(pointHistory = []) {
  return new Set(
    (Array.isArray(pointHistory) ? pointHistory : [])
      .filter((entry) => {
        const type = String(entry?.type || entry?.entryType || "").toUpperCase();
        return type === "ORDER_EARN" || type === "PARTNER_ORDER_EARN";
      })
      .map((entry) => String(entry?.orderId || entry?.partnerOrderCode || entry?.displayOrderCode || "").trim())
      .filter(Boolean)
  );
}

function markPointStatus(orders = [], earnedOrderSet = new Set()) {
  return (orders || []).map((order) => {
    if (order?.sourceType === "partner" && order.pointStatus) return order;
    const hasEarnedPoint = getOrderIdentityCandidates(order).some((candidate) => earnedOrderSet.has(candidate));
    return {
      ...order,
      pointStatus: hasEarnedPoint ? "claimed" : "pending"
    };
  });
}

export default function useGuestOrderLookup() {
  const [phone, setPhone] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleLookup() {
    const normalizedPhone = getCustomerKey(phone);
    if (!normalizedPhone || normalizedPhone.length < 9) {
      alert("Vui lòng nhập số điện thoại hợp lệ.");
      return;
    }

    setIsLoading(true);
    setNotice("");
    try {
      const shouldUseSupabase = getDataSource() === "supabase";
      const [localOrders, partnerOrders] = await Promise.all([
        shouldUseSupabase
          ? orderStorage.getByPhoneAsync(normalizedPhone, { includeItems: false })
          : Promise.resolve(orderStorage.getByPhone(normalizedPhone)),
        getPartnerOrdersByPhone(normalizedPhone, { includeItems: false })
      ]);
      const loyalty = normalizeLoyaltyData(
        await loyaltyRepository.getByPhoneAsync(normalizedPhone, defaultLoyaltyData)
      );
      const earnedOrderSet = buildEarnedOrderSet(loyalty.pointHistory);
      const nextOrders = markPointStatus(mergeCustomerLookupOrders(localOrders, partnerOrders), earnedOrderSet);
      setLookupPhone(normalizedPhone);
      setOrders(nextOrders);
      setNotice(
        nextOrders.length
          ? `Đã tìm thấy ${nextOrders.length} đơn theo số ${normalizedPhone}.`
          : "Chưa tìm thấy đơn hàng theo số điện thoại này."
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleLookup();
  }

  return {
    phone,
    setPhone,
    lookupPhone,
    orders,
    isLoading,
    notice,
    handleLookup,
    handleSubmit
  };
}
