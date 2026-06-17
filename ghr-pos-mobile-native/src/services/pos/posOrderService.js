import { createPosOrderIdentity } from "../../shared/pos/posOrderIdentity";
import { supabase } from "../supabase/client";
import { applyPosOrderLoyaltyMobile } from "./posLoyaltyService";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCartForOrder(cart = []) {
  return (Array.isArray(cart) ? cart : [])
    .map((item) => {
      const quantity = Math.max(1, Math.floor(toNumber(item.quantity, 1)));
      const unitPrice = Math.max(0, toNumber(item.price, 0));
      const unitTotal = Math.max(0, toNumber(item.unitTotal ?? item.price, unitPrice));
      return {
        id: toText(item.id),
        name: toText(item.name),
        quantity,
        unitPrice,
        unitTotal,
        lineTotal: toNumber(item.lineTotal, quantity * unitTotal),
        note: toText(item.note),
        toppings: Array.isArray(item.toppings) ? item.toppings : [],
        selectedOptions: Array.isArray(item.selectedOptions) ? item.selectedOptions : []
      };
    })
    .filter((item) => item.id && item.name);
}

function normalizeBranchForOrder(branch = {}) {
  return {
    branchUuid: toText(branch.branchUuid || branch.branch_uuid),
    branchName: toText(branch.branchName || branch.branch_name || branch.name),
    pickupBranchUuid: toText(branch.branchUuid || branch.branch_uuid),
    pickupBranchName: toText(branch.branchName || branch.branch_name || branch.name)
  };
}

function buildSelectedOptionGroups(selectedOptions = []) {
  const groupMap = new Map();
  (Array.isArray(selectedOptions) ? selectedOptions : []).forEach((option) => {
    const groupId = toText(option.groupId || option.group_id || option.groupName || option.group_name || "option");
    const groupName = toText(option.groupName || option.group_name || groupId || "Tùy chọn");
    const current = groupMap.get(groupId) || {
      id: groupId,
      name: groupName,
      options: []
    };
    current.options.push({
      id: toText(option.id),
      name: toText(option.name),
      price: Math.max(0, toNumber(option.price, 0))
    });
    groupMap.set(groupId, current);
  });
  return Array.from(groupMap.values());
}

function buildOrderItemLineKey(item = {}, index = 0) {
  const optionKey = (Array.isArray(item.selectedOptions) ? item.selectedOptions : [])
    .map((option) => [
      toText(option.groupId || option.groupName),
      toText(option.id || option.name),
      toNumber(option.price, 0)
    ].join(":"))
    .sort()
    .join("|");
  const toppingKey = (Array.isArray(item.toppings) ? item.toppings : [])
    .map((topping) => [
      toText(topping.id || topping.name),
      toNumber(topping.price, 0),
      Math.max(1, Math.floor(toNumber(topping.quantity, 1)))
    ].join(":"))
    .sort()
    .join("|");

  return [
    toText(item.id),
    toText(item.note),
    optionKey,
    toppingKey,
    Math.max(1, Math.floor(toNumber(item.quantity, 1))),
    index + 1
  ].join("#");
}

async function replaceOrderItems(orderId = "", itemRows = []) {
  const safeOrderId = toText(orderId);
  if (!safeOrderId) {
    return { ok: false, message: "Thiếu mã đơn để lưu món." };
  }

  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", safeOrderId);

  if (deleteError) {
    return {
      ok: false,
      message: deleteError.message || "Không làm mới được danh sách món của đơn POS."
    };
  }

  if (!itemRows.length) {
    return { ok: true };
  }

  const { error: insertError } = await supabase.from("order_items").insert(itemRows);
  if (insertError) {
    return {
      ok: false,
      message: insertError.message || "Không lưu được món trong đơn POS."
    };
  }

  return { ok: true };
}

export async function createPosTakeawayOrderMobile({
  cart = [],
  totals = {},
  pagerNumber = "",
  customerName = "",
  customerPhone = "",
  branch = null,
  orderNote = "",
  shift = null,
  cashierName = "Thu ngân",
  customerLookup = null,
  promoDiscount = 0,
  promoCode = "",
  promoSource = "",
  promoVoucherId = "",
  pointsDiscount = 0,
  pointsDiscountAmount = 0,
  pointRedeemRule = null,
  paymentMethod = "cash",
  paymentStatus = "paid",
  paymentAmount = 0,
  paymentReference = "",
  paidAt = "",
  posShiftId = "",
  paymentMeta = null,
  orderIdentity: providedOrderIdentity = null
} = {}) {
  const items = normalizeCartForOrder(cart);
  if (!items.length) return { ok: false, message: "Chưa có món trong bill." };

  const pager = toText(pagerNumber);
  if (!pager) return { ok: false, message: "Vui lòng nhập thẻ rung." };

  const orderIdentity = providedOrderIdentity?.orderCode
    ? providedOrderIdentity
    : createPosOrderIdentity(new Date());
  const createdAt = new Date().toISOString();
  const subtotal = toNumber(totals.subtotal ?? items.reduce((sum, item) => sum + item.lineTotal, 0));
  const totalAmount = toNumber(totals.total ?? subtotal);
  const voucherDiscountAmount = Math.max(0, toNumber(promoDiscount || totals.voucherDiscount, 0));
  const pointsSpent = Math.max(0, Math.floor(toNumber(pointsDiscount, 0)));
  const pointDiscountAmount = Math.max(0, toNumber(pointsDiscountAmount || totals.pointsDiscount, 0));
  const normalizedOrderStatus = "pending_zalo";
  const displayCustomerName = toText(customerName) || `Khách thẻ ${pager}`;
  const displayCustomerPhone = toText(customerPhone);
  const branchInfo = normalizeBranchForOrder(branch || {});
  const shiftId = toText(posShiftId || shift?.id);
  const safePaymentMeta = paymentMeta && typeof paymentMeta === "object" ? paymentMeta : {};
  const safeCustomerLookup = customerLookup && typeof customerLookup === "object" ? customerLookup : null;
  const safeRedeemRule = pointRedeemRule && typeof pointRedeemRule === "object" ? pointRedeemRule : null;
  const requestKey = toText(
    safePaymentMeta.requestKey ||
    safePaymentMeta.paymentSessionId ||
    paymentReference ||
    orderIdentity.orderCode
  );

  if (supabase) {
    const metadata = {
      source: "pos",
      channel: "pos",
      orderSource: "pos",
      orderType: "takeaway",
      walkIn: true,
      displayOrderCode: orderIdentity.displayOrderCode,
      pagerNumber: pager,
      pager_number: pager,
      pagerStatus: "assigned",
      paymentStatus,
      paymentMethod,
      paymentAmount: Math.max(0, toNumber(paymentAmount || totalAmount)),
      paymentReference: toText(paymentReference),
      paidAt: toText(paidAt) || createdAt,
      cashierName: toText(cashierName),
      orderNote: toText(orderNote),
      promoSource: toText(promoSource),
      promoVoucherId: toText(promoVoucherId),
      pointsSpent,
      pointsDiscountAmount: pointDiscountAmount,
      pointRedeemRule: safeRedeemRule,
      customerLookup: safeCustomerLookup,
      posShiftId: shiftId,
      pos_shift_id: shiftId,
      paymentMeta: safePaymentMeta
        ? {
            ...safePaymentMeta,
            requestKey
          }
        : { requestKey },
      requestKey
    };

    const orderRow = {
      id: orderIdentity.orderCode,
      order_code: orderIdentity.orderCode,
      customer_phone: displayCustomerPhone || null,
      customer_name: displayCustomerName,
      fulfillment_type: "pickup",
      payment_method: paymentMethod,
      status: normalizedOrderStatus,
      subtotal,
      shipping_fee: 0,
      original_shipping_fee: 0,
      shipping_support_discount: 0,
      promo_discount: voucherDiscountAmount,
      promo_code: toText(promoCode).toUpperCase(),
      points_discount: pointsSpent,
      points_earned: 0,
      total_amount: totalAmount,
      branch_uuid: branchInfo.branchUuid || null,
      branch_name: branchInfo.branchName,
      pickup_branch_uuid: branchInfo.pickupBranchUuid || null,
      pickup_branch_name: branchInfo.pickupBranchName,
      pickup_time_text: "Lấy tại quầy",
      delivery_address: "Khách nhận tại quầy",
      pos_shift_id: shiftId || null,
      metadata
    };

    const { error: orderError } = await supabase.from("orders").upsert(orderRow, { onConflict: "id" });
    if (orderError) {
      return { ok: false, message: orderError.message || "Không tạo được đơn POS." };
    }

    const itemRows = items.map((item, index) => {
      const optionGroups = buildSelectedOptionGroups(item.selectedOptions);
      return {
        order_id: orderIdentity.orderCode,
        product_id: item.id || null,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        spice: "",
        note: item.note || "",
        toppings: item.toppings,
        option_groups: optionGroups,
        kitchen_item_status: "pending",
        metadata: {
          source: "pos",
          requestKey,
          lineKey: buildOrderItemLineKey(item, index),
          selectedOptions: item.selectedOptions,
          optionGroups
        }
      };
    });

    const itemResult = await replaceOrderItems(orderIdentity.orderCode, itemRows);
    if (!itemResult.ok) {
      return { ok: false, message: itemResult.message || "Không tạo được món trong đơn POS." };
    }

    let loyaltyWarning = "";
    try {
      await applyPosOrderLoyaltyMobile({
        phone: displayCustomerPhone,
        orderId: orderIdentity.orderCode,
        amount: totalAmount,
        createdAt,
        orderStatus: normalizedOrderStatus,
        pointsDiscount: pointsSpent,
        promoSource,
        promoVoucherId,
        promoCode,
        loyaltyRule: safeRedeemRule
      });
    } catch (error) {
      loyaltyWarning = ` Đơn đã tạo nhưng chưa đồng bộ được điểm loyalty: ${error?.message || "kiểm tra RPC apply_loyalty_event."}`;
    }

    return {
      ok: true,
      order: {
        id: orderIdentity.orderCode,
        orderCode: orderIdentity.orderCode,
        displayOrderCode: orderIdentity.displayOrderCode
      },
      message: `Đã tạo đơn ${orderIdentity.displayOrderCode}.${loyaltyWarning}`
    };
  }

  const order = {
    id: orderIdentity.orderCode,
    orderCode: orderIdentity.orderCode,
    displayOrderCode: orderIdentity.displayOrderCode,
    customerName: displayCustomerName,
    customerPhone: displayCustomerPhone,
    pagerNumber: pager,
    branchName: branchInfo.branchName,
    orderNote: toText(orderNote),
    shiftId,
    cashierName: toText(cashierName),
    paymentMethod,
    paymentStatus,
    paymentAmount: Math.max(0, toNumber(paymentAmount || totalAmount)),
    paymentReference: toText(paymentReference),
    paidAt: toText(paidAt) || createdAt,
    subtotal,
    promoDiscount: voucherDiscountAmount,
    promoCode: toText(promoCode).toUpperCase(),
    promoSource: toText(promoSource),
    promoVoucherId: toText(promoVoucherId),
    pointsDiscount: pointsSpent,
    pointsDiscountAmount: pointDiscountAmount,
    pointRedeemRule: safeRedeemRule,
    totalAmount,
    items
  };

  return {
    ok: true,
    order,
    message: `Đã tạo đơn ${order.displayOrderCode}.`
  };
}
