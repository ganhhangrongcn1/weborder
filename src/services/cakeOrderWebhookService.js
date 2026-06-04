const CAKE_ORDER_WEBHOOK_URL = "https://n8nhosting-13007771.phoai.vn/webhook/cake-order";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildAddOnSummary(selectedAddOns = {}) {
  return Object.values(selectedAddOns)
    .filter((item) => item?.selected)
    .map((item) => [item.name, item.optionName].filter(Boolean).join(" - "))
    .filter(Boolean)
    .join(", ");
}

function toFormBody(payload) {
  const body = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      body.set(key, "");
      return;
    }

    body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  return body;
}

export async function notifyCakeOrderWebhook({
  saved,
  product,
  form,
  addressInfo,
  selectedPickupBranch,
  selectedAddOns,
  addOnTotal,
  finalCakePrice,
  shippingFee,
  deliveryAddress,
  zaloMessage
}) {
  if (!CAKE_ORDER_WEBHOOK_URL) return { ok: false, skipped: true };

  const payload = {
    event: "cake_order_created",
    source: "banh_kem_banh_trang",
    status: "pending_zalo",
    statusText: "Chờ khách gửi Zalo",
    orderCode: saved?.orderCode || "",
    orderId: saved?.id || "",
    savedOk: Boolean(saved?.ok),
    savedError: saved?.error || "",
    createdAt: new Date().toISOString(),
    customerName: form?.customerName || "",
    customerPhone: form?.customerPhone || "",
    cakeId: product?.id || "",
    cakeName: product?.name || "",
    cakePrice: toNumber(product?.price),
    addOnTotal: toNumber(addOnTotal),
    finalCakePrice: toNumber(finalCakePrice),
    fulfillmentType: form?.fulfillmentType || "pickup",
    pickupTime: form?.pickupTime || "",
    pickupBranchId: selectedPickupBranch?.id || "",
    pickupBranchName: selectedPickupBranch?.name || "",
    pickupBranchAddress: selectedPickupBranch?.address || "",
    deliveryAddress: deliveryAddress || "",
    deliveryLat: addressInfo?.lat ?? "",
    deliveryLng: addressInfo?.lng ?? "",
    distanceKm: addressInfo?.distanceKm ?? "",
    shippingFee: shippingFee ?? "",
    cakeMessage: form?.cakeMessage || "",
    note: form?.note || "",
    addOnNote: form?.addOnNote || "",
    addOnSummary: buildAddOnSummary(selectedAddOns),
    zaloMessage: zaloMessage || "",
    raw: {
      saved,
      product,
      form,
      addressInfo,
      selectedPickupBranch,
      selectedAddOns
    }
  };

  await fetch(CAKE_ORDER_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    body: toFormBody(payload)
  });

  return { ok: true };
}
