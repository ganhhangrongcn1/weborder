import { getCustomerKey } from "../../shared/pos/posCustomer";
import { createPosOrderIdentity } from "../../shared/pos/posOrderIdentity";
import { supabase } from "../supabase/client";

function toText(value = "") {
  return String(value || "").trim();
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
      return {
        id: toText(item.id),
        name: toText(item.name),
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice
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
  paymentMethod = "cash",
  paymentStatus = "paid",
  paymentAmount = 0,
  paymentReference = "",
  paidAt = "",
  posShiftId = "",
  status = "pending_zalo",
  kitchenStatus = "pending"
} = {}) {
  if (!supabase) return { ok: false, message: "Thiếu cấu hình Supabase." };

  const items = normalizeCartForOrder(cart);
  if (!items.length) return { ok: false, message: "Chưa có món trong bill." };

  const pager = toText(pagerNumber);
  if (!pager) return { ok: false, message: "Vui lòng nhập thẻ rung." };

  const orderIdentity = createPosOrderIdentity(new Date());
  const createdAt = new Date().toISOString();
  const subtotal = toNumber(totals.subtotal ?? items.reduce((sum, item) => sum + item.lineTotal, 0));
  const totalAmount = toNumber(totals.total ?? subtotal);
  const normalizedCustomerPhone = getCustomerKey(customerPhone);
  const branchInfo = normalizeBranchForOrder(branch || {});
  const shiftId = toText(posShiftId || shift?.id);
  const displayCustomerName = toText(customerName) || `Khách thẻ ${pager}`;

  const metadata = {
    source: "pos",
    channel: "pos",
    orderSource: "pos",
    orderType: "takeaway",
    walkIn: !normalizedCustomerPhone,
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
    posShiftId: shiftId,
    pos_shift_id: shiftId
  };

  const orderRow = {
    id: orderIdentity.orderCode,
    order_code: orderIdentity.orderCode,
    customer_phone: normalizedCustomerPhone || null,
    customer_name: displayCustomerName,
    fulfillment_type: "pickup",
    payment_method: paymentMethod,
    status,
    subtotal,
    shipping_fee: 0,
    original_shipping_fee: 0,
    shipping_support_discount: 0,
    promo_discount: 0,
    promo_code: "",
    points_discount: 0,
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

  const itemRows = items.map((item) => ({
    order_id: orderIdentity.orderCode,
    product_id: item.id || null,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.lineTotal,
    spice: "",
    note: "",
    toppings: [],
    option_groups: [],
    kitchen_item_status: "pending",
    metadata: {
      source: "pos"
    }
  }));

  const { error: itemError } = await supabase.from("order_items").insert(itemRows);
  if (itemError) {
    return { ok: false, message: itemError.message || "Không tạo được món trong đơn POS." };
  }

  return {
    ok: true,
    order: {
      id: orderIdentity.orderCode,
      orderCode: orderIdentity.orderCode,
      displayOrderCode: orderIdentity.displayOrderCode
    },
    message: `Đã tạo đơn ${orderIdentity.displayOrderCode}.`
  };
}
