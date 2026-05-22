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
  const status = normalizeStatusText(order.status || order.orderStatus || order.order_status);
  const kitchenStatus = normalizeStatusText(order.kitchenStatus || order.kitchen_status);

  if (["cancel", "canceled", "cancelled", "huy", "dahuy", "refunded"].includes(status)) {
    return {
      key: "cancelled",
      label: "Đã hủy",
      tone: "cancelled",
      step: 0
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
      label: pickupLike ? "Sẵn sàng nhận món" : "Sẵn sàng giao hàng",
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
      label: pickupLike ? "Sẵn sàng nhận món" : "Sẵn sàng giao hàng",
      tone: "ready",
      step: pickupLike ? 2 : 1
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
      key: "pending",
      label: "Chờ xác nhận",
      tone: "pending",
      step: 0
    };
  }

  return {
    key: "active",
    label: "Đang thực hiện",
    tone: "active",
    step: 1
  };
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
