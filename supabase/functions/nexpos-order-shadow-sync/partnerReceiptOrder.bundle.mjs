// src/services/partnerReceiptOrder.js
var text = (value) => String(value || "").trim();
var number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
function partnerOptionLabels(value) {
  const labels = [];
  const walk = (item) => {
    if (!item) return;
    if (typeof item === "string") {
      if (text(item)) labels.push(text(item));
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(walk);
      return;
    }
    if (typeof item === "object") {
      const label = text(item.name || item.label || item.option_item || item.optionName || item.value || item.title);
      if (label) labels.push(label);
      [item.items, item.options, item.toppings, item.selectedOptions, item.values].forEach(walk);
    }
  };
  walk(value);
  return [...new Set(labels)];
}
function partnerReceiptOrder(row, items) {
  const source = text(row.partner_source);
  const platform = {
    grabfood: "Grab",
    grab: "Grab",
    shopeefood: "Shopee",
    shopee: "Shopee",
    xanhngon: "Xanh Ngon",
    xanh_ngon: "Xanh Ngon"
  }[source] || "Kh\xE1c";
  return {
    id: row.id,
    orderCode: row.order_code,
    displayOrderCode: row.display_order_code || row.order_code,
    sourceType: "partner",
    source,
    partnerSource: source,
    orderSource: source,
    channel: source,
    platform,
    branchUuid: row.branch_uuid,
    branchName: row.branch_name || row.nexpos_site_name || row.nexpos_hub_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || row.customer_phone_key,
    createdAt: row.order_time || row.created_at,
    fulfillmentType: "delivery",
    paymentMethod: "foodapp",
    subtotal: number(row.subtotal),
    shippingFee: number(row.shipping_fee),
    discountAmount: number(row.discount_amount),
    expectedEarnPoints: Math.max(0, Math.floor(number(row.expected_earn_points))),
    totalAmount: number(row.total_amount),
    raw: row,
    items: items.map((item) => ({
      name: item.web_product_name || item.partner_item_name || "Kh\xF4ng t\xEAn m\xF3n",
      quantity: number(item.quantity) || 1,
      price: number(item.unit_price),
      lineTotal: item.line_total == null ? number(item.unit_price) * (number(item.quantity) || 1) : number(item.line_total),
      note: text(item.note),
      options: partnerOptionLabels(item.options)
    }))
  };
}
export {
  partnerReceiptOrder as default,
  partnerOptionLabels
};
