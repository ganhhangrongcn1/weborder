import {
  isQrCounterPrepaidOrder,
  isQrOrderPaid,
  isQrOrderPaymentExpired
} from "./qrPaymentService.js";

function toText(value = "") {
  return String(value || "").trim();
}

function normalizeStatusText(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function getRawData(order = {}) {
  return order?.rawData && typeof order.rawData === "object"
    ? order.rawData
    : order?.raw_data && typeof order.raw_data === "object"
      ? order.raw_data
      : {};
}

function getOrderMetadata(order = {}) {
  return order?.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
    ? order.metadata
    : {};
}

function isPickupLike(order = {}) {
  const fulfillment = normalizeStatusText(order.fulfillmentType || order.fulfillment_type);
  const source = normalizeStatusText(order.source || order.channel || order.orderSource);
  return fulfillment === "pickup" || fulfillment === "qrcounter" || source === "qrcounter";
}

function getPartnerStatus(order = {}) {
  const rawData = getRawData(order);
  const status = normalizeStatusText(
    order.nexposStatus ||
      order.nexpos_status ||
      rawData.status ||
      order.orderStatus ||
      order.order_status ||
      order.status
  );

  if (["cancel", "canceled", "cancelled", "huy", "dahuy"].includes(status)) {
    return {
      key: "cancelled",
      label: "Đã hủy",
      tone: "cancelled",
      step: 0
    };
  }

  if (["preorder", "preordered", "scheduled", "dattruoc"].includes(status)) {
    return {
      key: "preorder",
      label: "Đặt trước",
      tone: "pending",
      step: 0
    };
  }

  if (["finish", "finished", "complete", "completed", "done", "served", "hoantat"].includes(status)) {
    return {
      key: "completed",
      label: "Hoàn tất",
      tone: "done",
      step: 3
    };
  }

  if (["pick", "picking", "ready", "readytopickup", "readytoship"].includes(status)) {
    return {
      key: "ready",
      label: "Sẵn sàng lấy món",
      tone: "ready",
      step: 2
    };
  }

  if (["doing", "preparing", "cooking", "inprogress", "confirmed", "accepted", "processing"].includes(status)) {
    return {
      key: "preparing",
      label: "Đang chuẩn bị",
      tone: "active",
      step: 1
    };
  }

  return {
    key: "pending",
    label: "Chờ xác nhận",
    tone: "pending",
    step: 0
  };
}

function getWebsiteStatus(order = {}) {
  const pickupLike = isPickupLike(order);
  const metadata = getOrderMetadata(order);
  const status = normalizeStatusText(order.status || order.orderStatus || order.order_status);
  const kitchenStatus = normalizeStatusText(order.kitchenStatus || order.kitchen_status);
  const paymentMethod = normalizeStatusText(
    order.paymentMethod || order.payment_method || metadata.paymentMethod || metadata.payment_method
  );
  const paymentStatus = normalizeStatusText(
    order.paymentStatus || order.payment_status || metadata.paymentStatus || metadata.payment_status
  );
  const isWaitingForQrPayment = ["bankqr", "momo"].includes(paymentMethod) && !["paid", "converted"].includes(paymentStatus);
  const isPaidAfterCancel = paymentStatus === "paidaftercancel";
  const cancelReason = normalizeStatusText(
    order.cancelReason || order.cancel_reason || metadata.cancelReason || metadata.cancel_reason
  );
  const isPaymentTimeout = !isPaidAfterCancel && (
    ["expired", "failed"].includes(paymentStatus) ||
    ["paymenttimeout", "momocreatefailed"].includes(cancelReason) ||
    (
      isQrCounterPrepaidOrder(order) &&
      isWaitingForQrPayment &&
      isQrOrderPaymentExpired(order)
    )
  );

  if (["cancel", "canceled", "cancelled", "huy", "dahuy", "refunded"].includes(status)) {
    return {
      key: "cancelled",
      label: isPaymentTimeout ? "Đã hết hạn thanh toán" : "Đã hủy",
      tone: "cancelled",
      step: 0,
      paymentExpired: isPaymentTimeout,
      needsPaymentSupport: isPaidAfterCancel
    };
  }

  if (["done", "completed", "complete", "hoantat"].includes(status)) {
    return {
      key: "completed",
      label: "Hoàn tất",
      tone: "done",
      step: pickupLike ? 2 : 3
    };
  }

  if (["readyforpickup", "readyfordelivery"].includes(status)) {
    return {
      key: "ready",
      label: pickupLike ? "Món đã làm xong" : "Sẵn sàng giao hàng",
      tone: "ready",
      step: pickupLike ? 2 : 1
    };
  }

  if (["delivering", "shipping", "danggiao"].includes(status)) {
    return {
      key: "delivering",
      label: "Đang giao",
      tone: "delivering",
      step: 2
    };
  }

  if (["done", "served"].includes(kitchenStatus)) {
    return {
      key: "completed",
      label: "Hoàn tất",
      tone: "done",
      step: pickupLike ? 2 : 3
    };
  }

  if (["ready"].includes(kitchenStatus)) {
    return {
      key: "ready",
      label: pickupLike ? "Món đã làm xong" : "Sẵn sàng giao hàng",
      tone: "ready",
      step: pickupLike ? 2 : 1
    };
  }

  if (isWaitingForQrPayment || status === "pendingpayment" || kitchenStatus === "waitingpayment") {
    if (isPaymentTimeout && !isQrOrderPaid(order)) {
      return {
        key: "cancelled",
        label: "Đã hết hạn thanh toán",
        tone: "cancelled",
        step: 0,
        paymentExpired: true
      };
    }
    return {
      key: "awaiting_payment",
      label: paymentMethod === "momo" ? "Chờ thanh toán MoMo" : "Chờ thanh toán QR",
      tone: "pending",
      step: 0
    };
  }

  if (["confirmed", "preparing", "cooking", "doing", "accepted", "processing"].includes(status)) {
    return {
      key: "preparing",
      label: "Đang chuẩn bị",
      tone: "active",
      step: 1
    };
  }

  if (["pendingzalo", "pending", "new", ""].includes(status)) {
    return {
      key: "preparing",
      label: "Đang chuẩn bị",
      tone: "active",
      step: 1
    };
  }

  return {
    key: "active",
    label: "Đang thực hiện",
    tone: "active",
    step: 1
  };
}

const ACTIVE_CUSTOMER_ORDER_STATUS_KEYS = new Set([
  "awaiting_payment",
  "pending",
  "preparing",
  "active",
  "ready",
  "delivering"
]);

function getOrderActivityTime(order = {}) {
  const rawValue =
    order.updatedAt ||
    order.updated_at ||
    order.kitchenDoneAt ||
    order.kitchen_done_at ||
    order.createdAt ||
    order.created_at ||
    order.orderTime ||
    order.order_time ||
    "";
  const parsed = new Date(rawValue).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getJourneyCopy(statusKey = "", pickupLike = false) {
  if (statusKey === "awaiting_payment") {
    return {
      title: "Chờ thanh toán",
      description: "Thanh toán xong là bếp lên món ngay nha."
    };
  }

  if (statusKey === "cancelled") {
    return {
      title: "Đơn hàng đã được hủy",
      description: "Đơn này không còn được quán tiếp tục xử lý."
    };
  }

  if (statusKey === "completed") {
    return {
      title: "Đơn hàng đã hoàn thành",
      description: pickupLike
        ? "Cảm ơn bạn đã ghé Gánh nhận món."
        : "Cảm ơn bạn đã đặt món tại Gánh."
    };
  }

  if (statusKey === "delivering") {
    return {
      title: "Đơn hàng đang trên đường",
      description: "Món ngon đang tới, để ý điện thoại nha."
    };
  }

  if (statusKey === "ready") {
    return pickupLike
      ? {
          title: "Món đã làm xong",
          description: "Ghé quầy rước món thôi."
        }
      : {
          title: "Món đã xong, đang chờ shipper",
          description: "Có shipper là Gánh giao ngay."
        };
  }

  if (["preparing", "active"].includes(statusKey)) {
    return {
      title: "Đơn hàng đang được chuẩn bị",
      description: "Bếp đang lên món, chờ xíu nha."
    };
  }

  if (statusKey === "preorder") {
    return {
      title: "Đơn đã được hẹn giờ",
      description: "Gánh sẽ bắt đầu chuẩn bị theo thời gian bạn đã chọn."
    };
  }

  return {
    title: "Quán đã nhận đơn",
    description: "Gánh nhận được đơn rồi nha."
  };
}

export function getCustomerOrderJourney(order = {}) {
  const pickupLike = isPickupLike(order);
  const statusMeta = getCustomerOrderDisplayStatus(order);
  const statusKey = statusMeta.key || "pending";
  const steps = pickupLike
    ? [
        { key: "received", label: "Đã nhận đơn", icon: "bag" },
        { key: "preparing", label: "Đang làm món", icon: "dish" },
        { key: "ready", label: "Đã làm xong", icon: "store" },
        { key: "completed", label: "Hoàn thành", icon: "check" }
      ]
    : [
        { key: "received", label: "Đã nhận đơn", icon: "bag" },
        { key: "preparing", label: "Đang làm món", icon: "dish" },
        { key: "ready", label: "Chờ shipper", icon: "clock" },
        { key: "delivering", label: "Đang giao", icon: "bike" },
        { key: "completed", label: "Hoàn thành", icon: "check" }
      ];

  let currentStepIndex = 0;
  if (["preparing", "active"].includes(statusKey)) currentStepIndex = 1;
  if (statusKey === "ready") currentStepIndex = 2;
  if (statusKey === "delivering") currentStepIndex = pickupLike ? 2 : 3;
  if (statusKey === "completed") currentStepIndex = steps.length - 1;
  if (statusKey === "cancelled") currentStepIndex = 0;

  const copy = getJourneyCopy(statusKey, pickupLike);
  return {
    ...copy,
    statusKey,
    statusLabel: statusMeta.label,
    pickupLike,
    steps,
    currentStepIndex,
    progressRatio: steps.length > 1 ? currentStepIndex / (steps.length - 1) : 0,
    cancelled: statusKey === "cancelled",
    completed: statusKey === "completed"
  };
}

export function isCustomerOrderInProgress(order = {}) {
  const sourceType = normalizeStatusText(order.sourceType || order.source_type);
  if (sourceType === "partner") return false;
  const rawData = getRawData(order);
  const sourceTokens = [
    sourceType,
    order.source,
    order.channel,
    order.orderSource,
    order.order_source,
    order.platform,
    order.partnerSource,
    order.partner_source,
    rawData.source,
    rawData.channel,
    rawData.platform
  ].map(normalizeStatusText).filter(Boolean);
  const excludedSources = new Set([
    "partner",
    "grab",
    "grabfood",
    "shopeefood",
    "xanhngon",
    "nexpos",
    "pos"
  ]);
  if (sourceTokens.some((source) => excludedSources.has(source))) return false;
  return ACTIVE_CUSTOMER_ORDER_STATUS_KEYS.has(getCustomerOrderDisplayStatus(order).key);
}

export function findLatestActiveCustomerOrder(orders = []) {
  const uniqueOrders = new Map();
  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const orderId = toText(order?.id || order?.orderCode || order?.order_code);
    if (!orderId) return;
    uniqueOrders.set(orderId, order);
  });

  return Array.from(uniqueOrders.values())
    .filter(isCustomerOrderInProgress)
    .sort((first, second) => getOrderActivityTime(second) - getOrderActivityTime(first))[0] || null;
}

export function getCustomerOrderJourneySignature(order = {}) {
  const orderId = toText(order.id || order.orderCode || order.order_code);
  if (!orderId) return "";
  return `${orderId}:${getCustomerOrderDisplayStatus(order).key}`;
}

export function getCustomerOrderDisplayStatus(order = {}) {
  const sourceType = normalizeStatusText(order.sourceType || order.source_type);
  if (sourceType === "partner") return getPartnerStatus(order);
  return getWebsiteStatus(order);
}

export function getCustomerOrderStatusToneClass(statusMeta = {}) {
  const tone = statusMeta.tone || statusMeta.key;
  if (tone === "done" || tone === "ready") return "bg-green-50 text-green-700";
  if (tone === "delivering") return "bg-blue-50 text-blue-600";
  if (tone === "cancelled") return "bg-red-50 text-red-600";
  return "bg-orange-50 text-orange-600";
}
