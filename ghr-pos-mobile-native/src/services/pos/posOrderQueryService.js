import { supabase } from "../supabase/client";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizePagerNumber(value = "") {
  const text = toText(value);
  const digits = text.replace(/\D/g, "");
  if (digits && digits.length <= 2) return digits.padStart(2, "0");
  return text;
}

function isOrderClosedStatus(status = "") {
  const normalized = toText(status).toLowerCase();
  return ["done", "completed", "complete", "cancelled", "canceled", "cancel"].includes(normalized);
}

export function canCancelPosOrder(order = {}) {
  const status = toText(order.status || getObject(order.metadata).status).toLowerCase();
  return Boolean(order?.id) && !["done", "completed", "complete", "cancelled", "canceled", "cancel"].includes(status);
}

function getRemoteOrderBranchKeys(row = {}) {
  const metadata = getObject(row.metadata);
  return [
    row.branch_uuid,
    row.pickup_branch_uuid,
    row.delivery_branch_uuid,
    metadata.branchUuid,
    metadata.branch_uuid,
    metadata.pickupBranchUuid,
    metadata.pickup_branch_uuid,
    metadata.deliveryBranchUuid,
    metadata.delivery_branch_uuid
  ].map(toText).filter(Boolean);
}

function matchesRemoteOrderBranch(row = {}, branchValue = "") {
  const safeBranchValue = toText(branchValue);
  if (!safeBranchValue) return true;
  return getRemoteOrderBranchKeys(row).includes(safeBranchValue);
}

function getRemoteOrderPagerNumber(row = {}) {
  const metadata = getObject(row.metadata);
  return normalizePagerNumber(metadata.pagerNumber || metadata.pager_number);
}

function isRemoteOrderPagerClosed(row = {}) {
  const metadata = getObject(row.metadata);
  const orderStatus = toText(row.status || metadata.status || metadata.orderStatus).toLowerCase();
  const kitchenStatus = toText(row.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status).toLowerCase();
  const pagerStatus = toText(metadata.pagerStatus || metadata.pager_status).toLowerCase();

  if (["released", "returned", "available"].includes(pagerStatus)) return true;
  if (isOrderClosedStatus(orderStatus)) return true;
  return isOrderClosedStatus(kitchenStatus);
}

export async function getBusyPosPagerNumbers({ branchUuid = "" } = {}) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id,status,kitchen_status,branch_uuid,pickup_branch_uuid,delivery_branch_uuid,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !Array.isArray(data)) return [];

  return Array.from(
    new Set(
      data
        .filter((row) => matchesRemoteOrderBranch(row, branchUuid))
        .filter((row) => getRemoteOrderPagerNumber(row))
        .filter((row) => !isRemoteOrderPagerClosed(row))
        .map(getRemoteOrderPagerNumber)
        .filter(Boolean)
    )
  );
}

export async function getPosRecentOrders({ branchUuid = "", limit = 8 } = {}) {
  if (!supabase) return [];

  const safeLimit = Math.max(1, Math.min(30, Math.floor(Number(limit || 8))));
  const fetchLimit = Math.max(24, safeLimit * 3);
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_code,customer_name,customer_phone,total_amount,payment_method,status,kitchen_status,branch_uuid,pickup_branch_uuid,metadata,created_at,pos_shift_id")
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((row) => matchesRemoteOrderBranch(row, branchUuid))
    .filter((row) => {
      const metadata = getObject(row.metadata);
      return toText(metadata.source || metadata.orderSource || metadata.channel).toLowerCase() === "pos";
    })
    .slice(0, safeLimit)
    .map((row) => {
      const metadata = getObject(row.metadata);
      return {
        id: toText(row.id || row.order_code),
        displayOrderCode: toText(metadata.displayOrderCode || row.order_code || row.id),
        customerName: toText(row.customer_name),
        customerPhone: toText(row.customer_phone),
        pagerNumber: getRemoteOrderPagerNumber(row),
        totalAmount: Number(row.total_amount || 0),
        paymentMethod: toText(row.payment_method || metadata.paymentMethod),
        status: toText(row.status),
        kitchenStatus: toText(row.kitchen_status || metadata.kitchenStatus),
        posShiftId: toText(row.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id),
        createdAt: toText(row.created_at),
        metadata,
        canCancel: canCancelPosOrder(row)
      };
    });
}

export async function cancelPosOrder(order = {}, { cashierName = "", reason = "" } = {}) {
  const orderId = toText(order.id || order.orderCode || order.displayOrderCode);
  if (!orderId) {
    return { ok: false, message: "Thiếu mã đơn để hủy." };
  }
  if (!canCancelPosOrder(order)) {
    return { ok: false, message: "Đơn này không còn ở trạng thái cho phép hủy trên POS." };
  }
  if (!supabase) {
    return {
      ok: true,
      order: {
        ...order,
        status: "cancelled",
        kitchenStatus: "cancelled"
      },
      message: `Đã hủy đơn ${toText(order.displayOrderCode || orderId)}.`
    };
  }

  const cancelledAt = new Date().toISOString();
  const metadata = getObject(order.metadata);
  const payload = {
    status: "cancelled",
    kitchen_status: "cancelled",
    metadata: {
      ...metadata,
      status: "cancelled",
      kitchenStatus: "cancelled",
      kitchen_status: "cancelled",
      pagerStatus: "released",
      pager_status: "released",
      cancelledAt,
      cancelledBy: toText(cashierName) || "POS mobile",
      cancelReason: toText(reason) || "Nhân viên hủy tại quầy"
    }
  };

  const { data, error } = await supabase
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .select("id,order_code,customer_name,total_amount,status,kitchen_status,metadata,created_at")
    .single();

  if (error) {
    return { ok: false, message: error.message || "Không hủy được đơn POS." };
  }

  return {
    ok: true,
    order: data,
    message: `Đã hủy đơn ${toText(order.displayOrderCode || data?.order_code || orderId)}.`
  };
}

export async function readPosOrderForPrint(orderId = "") {
  const safeOrderId = toText(orderId);
  if (!safeOrderId) {
    return { ok: false, message: "Thiếu mã đơn để in lại." };
  }
  if (!supabase) {
    return { ok: false, message: "Supabase chưa sẵn sàng." };
  }

  const [{ data: orderRow, error: orderError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_code,customer_name,customer_phone,total_amount,subtotal,promo_discount,points_discount,payment_method,status,branch_name,metadata,created_at")
      .eq("id", safeOrderId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_id,product_name,quantity,unit_price,line_total,note,option_groups,metadata")
      .eq("order_id", safeOrderId)
      .order("id", { ascending: true })
  ]);

  if (orderError || !orderRow) {
    return { ok: false, message: orderError?.message || "Không tìm thấy đơn để in lại." };
  }
  if (itemError) {
    return { ok: false, message: itemError.message || "Không đọc được chi tiết món của đơn." };
  }

  const metadata = getObject(orderRow.metadata);
  const cart = (Array.isArray(itemRows) ? itemRows : []).map((item, index) => {
    const itemMetadata = getObject(item.metadata);
    const optionGroups = Array.isArray(item.option_groups) ? item.option_groups : [];
    const selectedOptions = Array.isArray(itemMetadata.selectedOptions)
      ? itemMetadata.selectedOptions
      : optionGroups.flatMap((group) =>
          (Array.isArray(group?.options) ? group.options : []).map((option) => ({
            id: toText(option.id),
            name: toText(option.name),
            price: Number(option.price || 0),
            groupId: toText(group.id),
            groupName: toText(group.name)
          }))
        );

    return {
      cartId: `${safeOrderId}-${index + 1}`,
      productId: toText(item.product_id),
      id: toText(item.product_id || `${index + 1}`),
      name: toText(item.product_name || "Món"),
      quantity: Math.max(1, Number(item.quantity || 1)),
      price: Number(item.unit_price || 0),
      unitTotal: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
      note: toText(item.note),
      selectedOptions,
      options: selectedOptions.map((option) => `${option.groupName}: ${option.name}`)
    };
  });

  return {
    ok: true,
    printableOrder: {
      id: toText(orderRow.id || orderRow.order_code),
      displayOrderCode: toText(metadata.displayOrderCode || orderRow.order_code || orderRow.id),
      customerName: toText(orderRow.customer_name),
      customerPhone: toText(orderRow.customer_phone),
      pagerNumber: getRemoteOrderPagerNumber(orderRow),
      branchName: toText(orderRow.branch_name || metadata.branchName),
      orderNote: toText(metadata.orderNote || metadata.note),
      paymentMethod: toText(orderRow.payment_method || metadata.paymentMethod).toLowerCase(),
      paymentReference: toText(metadata.paymentReference),
      paidAt: toText(metadata.paidAt),
      createdAt: toText(orderRow.created_at),
      totals: {
        subtotal: Number(orderRow.subtotal || orderRow.total_amount || 0),
        voucherDiscount: Number(orderRow.promo_discount || metadata.promoDiscount || 0),
        pointsDiscount: Number(orderRow.points_discount || metadata.pointsDiscountAmount || 0),
        total: Number(orderRow.total_amount || 0)
      },
      cart
    }
  };
}

export async function readPosOrderDetail(orderId = "") {
  const safeOrderId = toText(orderId);
  if (!safeOrderId) {
    return { ok: false, message: "Thiếu mã đơn để xem chi tiết." };
  }
  if (!supabase) {
    return { ok: false, message: "Supabase chưa sẵn sàng." };
  }

  const [{ data: orderRow, error: orderError }, { data: itemRows, error: itemError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,order_code,customer_name,customer_phone,total_amount,subtotal,promo_discount,points_discount,payment_method,status,kitchen_status,branch_name,metadata,created_at,pos_shift_id")
      .eq("id", safeOrderId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("product_id,product_name,quantity,unit_price,line_total,note,option_groups,metadata")
      .eq("order_id", safeOrderId)
      .order("id", { ascending: true })
  ]);

  if (orderError || !orderRow) {
    return { ok: false, message: orderError?.message || "Không tìm thấy đơn để xem chi tiết." };
  }
  if (itemError) {
    return { ok: false, message: itemError.message || "Không đọc được chi tiết món của đơn." };
  }

  const metadata = getObject(orderRow.metadata);
  const items = (Array.isArray(itemRows) ? itemRows : []).map((item, index) => {
    const itemMetadata = getObject(item.metadata);
    const optionGroups = Array.isArray(item.option_groups) ? item.option_groups : [];
    const selectedOptions = Array.isArray(itemMetadata.selectedOptions)
      ? itemMetadata.selectedOptions
      : optionGroups.flatMap((group) =>
          (Array.isArray(group?.options) ? group.options : []).map((option) => ({
            id: toText(option.id),
            name: toText(option.name),
            price: Number(option.price || 0),
            groupId: toText(group.id),
            groupName: toText(group.name)
          }))
        );

    return {
      id: `${safeOrderId}-${index + 1}`,
      productId: toText(item.product_id),
      name: toText(item.product_name || "Món"),
      quantity: Math.max(1, Number(item.quantity || 1)),
      unitPrice: Number(item.unit_price || 0),
      lineTotal: Number(item.line_total || 0),
      note: toText(item.note),
      selectedOptions,
      optionGroups
    };
  });

  return {
    ok: true,
    order: {
      id: toText(orderRow.id || orderRow.order_code),
      displayOrderCode: toText(metadata.displayOrderCode || orderRow.order_code || orderRow.id),
      customerName: toText(orderRow.customer_name),
      customerPhone: toText(orderRow.customer_phone),
      pagerNumber: getRemoteOrderPagerNumber(orderRow),
      branchName: toText(orderRow.branch_name || metadata.branchName),
      orderNote: toText(metadata.orderNote || metadata.note),
      paymentMethod: toText(orderRow.payment_method || metadata.paymentMethod).toLowerCase(),
      paymentStatus: toText(metadata.paymentStatus || metadata.payment_status || "paid").toLowerCase(),
      paymentReference: toText(metadata.paymentReference || metadata.payment_reference),
      paidAt: toText(metadata.paidAt || metadata.paid_at),
      createdAt: toText(orderRow.created_at),
      subtotal: Number(orderRow.subtotal || orderRow.total_amount || 0),
      promoDiscount: Number(orderRow.promo_discount || metadata.promoDiscount || 0),
      pointsDiscountAmount: Number(orderRow.points_discount || metadata.pointsDiscountAmount || 0),
      totalAmount: Number(orderRow.total_amount || 0),
      status: toText(orderRow.status || metadata.status),
      kitchenStatus: toText(orderRow.kitchen_status || metadata.kitchenStatus || metadata.kitchen_status),
      posShiftId: toText(orderRow.pos_shift_id || metadata.posShiftId || metadata.pos_shift_id),
      cashierName: toText(metadata.cashierName || metadata.shift?.cashierName),
      items,
      metadata,
      canCancel: canCancelPosOrder(orderRow)
    }
  };
}

export { normalizePagerNumber };
