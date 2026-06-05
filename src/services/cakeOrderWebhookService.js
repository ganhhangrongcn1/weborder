const CAKE_ORDER_WEBHOOK_URL = "https://n8nhosting-13007771.phoai.vn/webhook/cake-order";
const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

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

function formatVietnamDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: VIETNAM_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function formatPickupTimeLocal(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return text;
  const [, year, month, day, hour, minute] = match;
  return `${hour}:${minute} ${day}/${month}/${year}`;
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

  const createdAt = new Date();
  const pickupTimeLocal = form?.pickupTime || "";
  const payload = {
    event: "cake_order_created",
    source: "banh_kem_banh_trang",
    status: "pending_zalo",
    statusText: "Chờ khách gửi Zalo",
    orderCode: saved?.orderCode || "",
    orderId: saved?.id || "",
    savedOk: Boolean(saved?.ok),
    savedError: saved?.error || "",
    createdAt: createdAt.toISOString(),
    createdAtLocal: formatVietnamDateTime(createdAt),
    customerName: form?.customerName || "",
    customerPhone: form?.customerPhone || "",
    cakeId: product?.id || "",
    cakeName: product?.name || "",
    cakePrice: toNumber(product?.price),
    addOnTotal: toNumber(addOnTotal),
    finalCakePrice: toNumber(finalCakePrice),
    fulfillmentType: form?.fulfillmentType || "pickup",
    pickupTime: pickupTimeLocal,
    pickupTimeLocal,
    pickupTimeText: formatPickupTimeLocal(pickupTimeLocal),
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
