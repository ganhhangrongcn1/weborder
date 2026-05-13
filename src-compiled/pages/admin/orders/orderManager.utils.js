export function toAdminStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending_zalo" || normalized === "new") return "new";
  if (normalized === "delivering" || normalized === "đang giao") return "delivering";
  if (normalized === "done" || normalized === "completed" || normalized === "hoàn tất") return "done";
  return "doing";
}

export function formatOrderTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
}

export function getWaitingMinutes(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

export function getSettlement(order) {
  const fulfillmentType = String(order.fulfillmentType || "").toLowerCase() === "pickup" ? "pickup" : "delivery";
  const totalValue = Number(order.totalAmount || order.total || 0);
  const shippingFeeCustomer = fulfillmentType === "pickup" ? 0 : Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupport = fulfillmentType === "pickup" ? 0 : Number(order.shippingSupportDiscount || 0);
  const shippingRaw = fulfillmentType === "pickup"
    ? 0
    : Number(order.originalShippingFee ?? (shippingFeeCustomer + shippingSupport));
  const paymentMethod = String(order.paymentMethod || "COD").toUpperCase();
  const isCOD = paymentMethod.includes("COD");
  const shipperCollectFromCustomer = fulfillmentType === "delivery" ? (isCOD ? totalValue : 0) : 0;
  const shipperPayBackStore = Math.max(shipperCollectFromCustomer - shippingFeeCustomer, 0);
  const customerNeedPayWhenReceive = fulfillmentType === "delivery" ? shipperCollectFromCustomer : totalValue;

  return {
    fulfillmentType,
    paymentMethod,
    shippingRaw,
    shippingSupport,
    shippingFeeCustomer,
    shipperCollectFromCustomer,
    shipperPayBackStore,
    customerNeedPayWhenReceive
  };
}

export function groupOrdersByBoard(orders) {
  const groupedOrders = { new: [], doing: [], done: [] };
  (orders || []).forEach((order) => {
    const fulfillmentType = String(order.fulfillmentType || "").toLowerCase() === "pickup" ? "pickup" : "delivery";
    const rawStatus = toAdminStatus(order.status);
    const status = fulfillmentType === "pickup" && rawStatus === "delivering" ? "done" : rawStatus;
    if (status === "delivering") {
      groupedOrders.doing.push(order);
      return;
    }
    groupedOrders[status].push(order);
  });
  return groupedOrders;
}

export function buildShipperInfoText(order, formatMoney) {
  const items = order.items || [];
  const totalItemQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const lat = order.lat || order.latitude;
  const lng = order.lng || order.longitude;
  const mapLink = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : order.deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`
      : "";
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const settlement = getSettlement(order);
  const branchText = [order.deliveryBranchName || order.branchName || "", order.deliveryBranchAddress || order.branchAddress || ""].filter(Boolean).join(" - ");

  return [
    `*** Mã đơn: ${order.orderCode || order.id} ***`,
    `KHÁCH: ${order.customerName || "Khách"}`,
    `SĐT: ${order.customerPhone || order.phone || "--"}`,
    `ĐỊA CHỈ GIAO: ${order.deliveryAddress || "--"}`,
    mapLink ? `ĐỊNH VỊ: ${mapLink}` : "ĐỊNH VỊ: --",
    `CHI NHÁNH GIAO: ${branchText || "--"}`,
    `THANH TOÁN: ${settlement.paymentMethod}`,
    `SỐ LƯỢNG MÓN: ${totalItemQuantity}`,
    `*** SHIPPER CẦN THU KHÁCH: ${formatMoney(settlement.shipperCollectFromCustomer)} ***`,
    `*** SHIPPER NỘP LẠI QUÁN: ${formatMoney(settlement.shipperPayBackStore)} ***`,
    `PHÍ SHIP GỐC: ${formatMoney(settlement.shippingRaw)}`,
    `QUÁN HỖ TRỢ SHIP: ${formatMoney(settlement.shippingSupport)}`,
    `KHÁCH TRẢ SHIP: ${formatMoney(shippingFee)}`,
    `TỔNG TIỀN ĐƠN: ${formatMoney(totalValue)}`
  ].join("\n");
}
