import { createClient } from "npm:@supabase/supabase-js@2";
import { type JsonRecord, toText, toNumber, getObject, normalizePhone, normalizeIsoDate } from "./bankTransferUtils.ts";

async function readOrderItems(supabase: ReturnType<typeof createClient>, orderId: string, strict = false) {
  const { data, error } = await supabase
    .from("order_items")
    .select("id,product_id,product_name,quantity,unit_price,line_total,note,toppings,option_groups,spice,metadata")
    .eq("order_id", orderId);

  if (error && strict) throw error;
  if (error) return [];
  return Array.isArray(data) ? data : [];
}

async function hasExistingPrintJob(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  orderCode: string,
  sourceType: string
) {
  const comparableKeys = [
    { column: "order_id", value: orderId },
    { column: "order_code", value: orderCode }
  ].filter((item) => item.value);

  for (const item of comparableKeys) {
    const { data, error } = await supabase
      .from("print_jobs")
      .select("id,status")
      .eq("job_type", "customer_bill")
      .eq("source_type", sourceType)
      .eq(item.column, item.value)
      .in("status", ["pending", "printing", "printed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error && Array.isArray(data) && data[0]?.id) return true;
  }

  return false;
}

function buildPrintOrder(order: JsonRecord, items: JsonRecord[]) {
  const metadata = getObject(order.metadata);
  return {
    id: toText(order.id),
    orderCode: toText(order.order_code || order.id),
    displayOrderCode: toText(metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id),
    platform: "POS",
    sourceType: "qr_order",
    source: "qr_order",
    channel: "qr_order",
    orderSource: "qr_order",
    branchUuid: toText(order.branch_uuid || metadata.branchUuid),
    branchName: toText(order.branch_name || metadata.branchName),
    branchAddress: toText(order.branch_address || metadata.branchAddress),
    branchPhone: toText(metadata.branchPhone),
    customerName: toText(order.customer_name),
    customerPhone: normalizePhone(order.customer_phone),
    paymentMethod: "Chuyển khoản QR",
    paymentProvider: toText(metadata.paymentProvider),
    paymentReference: toText(metadata.paymentReference || metadata.payment_reference),
    paidAt: toText(metadata.paidAt || metadata.paid_at),
    fulfillmentType: toText(order.fulfillment_type || "pickup"),
    note: toText(metadata.orderNote || metadata.note),
    promoCode: toText(order.promo_code || metadata.promoCode),
    createdAt: normalizeIsoDate(order.updated_at || order.created_at),
    subtotal: toNumber(order.subtotal),
    promoDiscount: toNumber(order.promo_discount),
    pointsDiscount: toNumber(order.points_discount),
    expectedEarnPoints: toNumber(order.expected_earn_points),
    paymentStatus: "paid",
    shippingFee: toNumber(order.shipping_fee),
    discount:
      toNumber(order.promo_discount) +
      toNumber(order.points_discount) +
      toNumber(order.shipping_support_discount),
    totalAmount: toNumber(metadata.paymentAmount || metadata.payment_amount || order.total_amount),
    items: (Array.isArray(items) ? items : []).map((item) => ({
      id: toText(item.id),
      name: toText(item.product_name),
      quantity: Math.max(1, Math.floor(toNumber(item.quantity))),
      price: toNumber(item.unit_price),
      total: toNumber(item.line_total),
      note: toText(item.note),
      options: [
        ...((Array.isArray(item.toppings) ? item.toppings : []).map((entry) => toText(getObject(entry).name || getObject(entry).label || getObject(entry).value))),
        ...((Array.isArray(item.option_groups) ? item.option_groups : []).flatMap((group) => {
          const groupObject = getObject(group);
          const groupName = toText(groupObject.name || groupObject.label);
          const options = Array.isArray(groupObject.options) ? groupObject.options : [];
          return options.map((option) => {
            const optionObject = getObject(option);
            const optionName = toText(optionObject.name || optionObject.label || optionObject.value);
            return groupName && optionName ? `${groupName}: ${optionName}` : optionName;
          });
        }))
      ].filter(Boolean)
    }))
  };
}

function formatReceiptMoney(value: unknown) {
  const amount = Math.max(0, Math.round(toNumber(value)));
  return `${amount.toLocaleString("vi-VN")}d`;
}

function buildReceiptLine(label = "", value = "", width = 42) {
  const left = toText(label);
  const right = toText(value);
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`;
}

function buildReceiptSeparator(width = 42) {
  return "-".repeat(width);
}

function buildQrOrderReceiptText(printOrder: JsonRecord) {
  const width = 42;
  const items = Array.isArray(printOrder.items) ? printOrder.items : [];
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:HOA DON BAN HANG",
    `@@BIG:${toText(printOrder.displayOrderCode || printOrder.orderCode || printOrder.id || "GHR")}`,
    buildReceiptSeparator(width),
    `Chi nhanh: ${toText(printOrder.branchName) || "Ganh Hang Rong"}`,
    "Thu ngan: QR tai quay",
    `Gio in: ${new Date().toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh"
    })}`
  ];

  if (toText(printOrder.customerName)) lines.push(`Khach: ${toText(printOrder.customerName)}`);
  if (toText(printOrder.customerPhone)) lines.push(`SDT: ${toText(printOrder.customerPhone)}`);

  lines.push(buildReceiptSeparator(width));
  for (const item of items) {
    const itemObject = getObject(item);
    const quantity = Math.max(1, Math.floor(toNumber(itemObject.quantity || 1)));
    lines.push(`@@BOLDROW:${quantity} x ${toText(itemObject.name || "Mon")}\t`);
    const options = Array.isArray(itemObject.options) ? itemObject.options : [];
    for (const option of options) {
      if (toText(option)) lines.push(`  + ${toText(option)}`);
    }
    if (toText(itemObject.note)) lines.push(`  Ghi chu: ${toText(itemObject.note)}`);
    lines.push(buildReceiptLine("  Thanh tien", formatReceiptMoney(itemObject.total || itemObject.lineTotal), width));
  }

  lines.push(buildReceiptSeparator(width));
  lines.push(buildReceiptLine("Tam tinh", formatReceiptMoney(printOrder.subtotal || printOrder.totalAmount), width));
  if (toNumber(printOrder.discount) > 0) {
    lines.push(buildReceiptLine("Giam gia", `-${formatReceiptMoney(printOrder.discount)}`, width));
  }
  lines.push(buildReceiptLine("Tong don", formatReceiptMoney(printOrder.totalAmount), width));
  lines.push(`@@BOLDROW:DA THANH TOAN QR\t${formatReceiptMoney(printOrder.totalAmount)}`);
  lines.push("@@BOLDROW:CON PHAI THU\t0d");
  lines.push("@@CENTER:*** KHONG THU THEM TIEN ***");
  lines.push(buildReceiptSeparator(width));
  lines.push("Thanh toan: QR");
  if (toText(printOrder.paymentReference)) lines.push(`Ma TT: ${toText(printOrder.paymentReference)}`);
  if (toText(printOrder.note)) {
    lines.push(buildReceiptSeparator(width));
    lines.push(`Ghi chu: ${toText(printOrder.note)}`);
  }
  lines.push(buildReceiptSeparator(width));
  return lines.join("\n");
}

function buildQrOrderPreparationText(printOrder: JsonRecord) {
  const width = 42;
  const items = Array.isArray(printOrder.items) ? printOrder.items : [];
  const lines = [
    "@@CENTER:GANH HANG RONG",
    "@@CENTER:PHIẾU LÀM MÓN",
    `@@BIG:${toText(printOrder.displayOrderCode || printOrder.orderCode || printOrder.id || "GHR")}`,
    buildReceiptSeparator(width),
    `Chi nhanh: ${toText(printOrder.branchName) || "Ganh Hang Rong"}`,
    toText(printOrder.paymentProvider) === "pay2s" ? "Nguon: Website - Pay2S" : "Nguon: Website - SePay",
    buildReceiptSeparator(width)
  ];

  for (const item of items) {
    const itemObject = getObject(item);
    const quantity = Math.max(1, Math.floor(toNumber(itemObject.quantity || 1)));
    lines.push(`@@BOLDROW:${quantity} x ${toText(itemObject.name || "Mon")}\t`);
    const options = Array.isArray(itemObject.options) ? itemObject.options : [];
    for (const option of options) {
      if (toText(option)) lines.push(`  + ${toText(option)}`);
    }
    if (toText(itemObject.note)) lines.push(`  Ghi chu: ${toText(itemObject.note)}`);
    lines.push("@@SPACE");
  }

  if (toText(printOrder.note)) {
    lines.push(buildReceiptSeparator(width));
    lines.push(`Ghi chu don: ${toText(printOrder.note)}`);
  }
  lines.push(buildReceiptSeparator(width));
  lines.push("@@CENTER:KIEM TRA DU MON - TOPPING - GHI CHU");
  return lines.join("\n");
}

export async function ensureCustomerBillPrintJob(
  supabase: ReturnType<typeof createClient>,
  order: JsonRecord
) {
  const orderId = toText(order.id);
  const orderCode = toText(order.order_code || order.id);

  if (!orderId || !orderCode) {
    return { created: false, reason: "missing_order_id" };
  }

  const metadata = getObject(order.metadata);
  const items = await readOrderItems(supabase, orderId, metadata.paymentProvider === "pay2s");
  const now = new Date().toISOString();
  const printOrder = buildPrintOrder(order, items);
  const isPhoneOrder = metadata.deviceMode === "phone";

  const sourceType = "qr_order_bundle";
  const exists = await hasExistingPrintJob(supabase, orderId, orderCode, sourceType);
  if (exists) {
    return { created: false, reason: "already_exists" };
  }

  const isPay2s = metadata.paymentProvider === "pay2s";
  const digest = isPay2s ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pay2s:qr_order_bundle:${orderId}`)))).map((byte) => byte.toString(16).padStart(2, "0")).join("") : "";
  const stableId = digest ? `${digest.slice(0,8)}-${digest.slice(8,12)}-5${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}` : "";
  const job = {
      ...(isPay2s ? { id: stableId } : {}),
      ...(isPhoneOrder ? { id: toText(metadata.phoneCustomerBillJobId) } : {}),
      branch_uuid: toText(order.branch_uuid),
      printer_key: "cashier-80mm",
      job_type: "customer_bill",
      status: "pending",
      order_id: orderId,
      order_code: toText(metadata.displayOrderCode || metadata.display_order_code || order.order_code || order.id),
      source_type: sourceType,
      payload: {
        printerName: "Xprinter",
        receiptWidthMm: 80,
        type: sourceType,
        sourceType,
        text: buildQrOrderPreparationText(printOrder),
        secondaryText: buildQrOrderReceiptText(printOrder),
        order: printOrder
      },
      requested_by: isPay2s ? "pay2s_webhook" : "sepay_webhook",
      requested_at: now,
      created_at: now,
      updated_at: now
    };
  const query = supabase.from("print_jobs");
  const { error } = isPhoneOrder || isPay2s
    ? await query.upsert(job, { onConflict: "id", ignoreDuplicates: true })
    : await query.insert(job);

  return {
    created: !error,
    reason: error ? (error.message || "insert_failed") : "created"
  };
}

