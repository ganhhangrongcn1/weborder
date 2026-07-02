function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeSalesChannels(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["web", "qr", "pos"]);
  return Array.from(new Set(
    value
      .map((item) => toText(item).toLowerCase())
      .filter((item) => allowed.has(item))
  ));
}

function isVoucherAllowedForPos(voucher = {}) {
  const source = Array.isArray(voucher.salesChannels)
    ? voucher.salesChannels
    : Array.isArray(voucher.sales_channels)
      ? voucher.sales_channels
      : null;
  if (!source) return true;
  return normalizeSalesChannels(source).includes("pos");
}


function greatestCommonDivisor(a = 1, b = 1) {
  let x = Math.abs(Math.floor(toNumber(a, 1))) || 1;
  let y = Math.abs(Math.floor(toNumber(b, 1))) || 1;
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function leastCommonMultiple(a = 1, b = 1) {
  const x = Math.max(1, Math.floor(toNumber(a, 1)));
  const y = Math.max(1, Math.floor(toNumber(b, 1)));
  return Math.floor((x * y) / greatestCommonDivisor(x, y));
}

function getPointSpendStep(redeemPointUnit = 1) {
  return leastCommonMultiple(redeemPointUnit, 1000);
}

function roundPointsToSpendStep(points = 0, spendStep = 1000) {
  const safeStep = Math.max(1, Math.floor(toNumber(spendStep, 1000)));
  return Math.floor(Math.max(0, Math.floor(toNumber(points, 0))) / safeStep) * safeStep;
}

function isDateActive(startAt = "", endAt = "", now = new Date()) {
  const start = toText(startAt);
  const end = toText(endAt);

  if (start) {
    const startTime = new Date(`${start.slice(0, 10)}T00:00:00`).getTime();
    if (Number.isFinite(startTime) && now.getTime() < startTime) return false;
  }

  if (end) {
    const endTime = new Date(`${end.slice(0, 10)}T23:59:59`).getTime();
    if (Number.isFinite(endTime) && now.getTime() > endTime) return false;
  }

  return true;
}

export function buildVoucherSelectionKey(voucher = {}) {
  const source = toText(voucher.source || "loyalty").toLowerCase();
  const id = toText(voucher.id || voucher.couponId || voucher.coupon_id);
  const code = toText(voucher.code).toUpperCase();
  return [source, id || code].filter(Boolean).join(":");
}

export function calculateVoucherDiscount(voucher = {}, subtotal = 0) {
  const baseSubtotal = Math.max(0, toNumber(subtotal, 0));
  const minOrder = Math.max(0, toNumber(voucher.minOrder ?? voucher.min_order, 0));
  if (!voucher || baseSubtotal <= 0 || baseSubtotal < minOrder) return 0;

  const value = Math.max(0, toNumber(voucher.value ?? voucher.discountValue ?? voucher.discount_value, 0));
  const discountType = toText(voucher.discountType || voucher.discount_type || voucher.type).toLowerCase();

  if (discountType === "percent" || discountType === "percentage") {
    const raw = Math.floor((baseSubtotal * value) / 100);
    const maxDiscount = Math.max(0, toNumber(voucher.maxDiscount ?? voucher.max_discount, 0));
    return Math.min(baseSubtotal, maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw);
  }

  return Math.min(baseSubtotal, value);
}

function buildPointRoundSuggestions(loyaltyBenefit = {}) {
  const baseTotal = Math.max(
    0,
    Math.floor(toNumber(loyaltyBenefit.subtotal, 0) - toNumber(loyaltyBenefit.voucherDiscount, 0))
  );
  const availablePoints = Math.max(0, Math.floor(toNumber(loyaltyBenefit.availablePoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemValue, 1)));
  const pointSpendStep = getPointSpendStep(redeemPointUnit);
  const usablePoints = roundPointsToSpendStep(availablePoints, pointSpendStep);
  const maxUnits = Math.floor(usablePoints / redeemPointUnit);
  const maxDiscount = Math.min(baseTotal, maxUnits * redeemValue);
  const suggestions = [];
  const seen = new Set();

  [1000, 5000, 10000, 20000, 50000].forEach((roundTo) => {
    if (baseTotal <= roundTo) return;
    const roundedTotal = Math.floor(baseTotal / roundTo) * roundTo;
    const remainder = baseTotal - roundedTotal;
    if (!remainder || remainder > maxDiscount) return;

    const unitCount = Math.ceil(remainder / redeemValue);
    const points = roundPointsToSpendStep(unitCount * redeemPointUnit, pointSpendStep);
    if (!points || points > usablePoints || seen.has(points)) return;

    seen.add(points);
    suggestions.push({
      label: `Chẵn ${new Intl.NumberFormat("vi-VN").format(Math.max(0, roundedTotal))}đ`,
      points
    });
  });

  if (usablePoints > 0 && !seen.has(usablePoints)) {
    suggestions.push({
      label: "Dùng tối đa",
      points: usablePoints
    });
  }

  return suggestions.sort((a, b) => a.points - b.points).slice(0, 4);
}

function normalizeLoyaltyVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const title = toText(voucher.title || voucher.name || voucher.label || code || "Voucher loyalty");
  const minOrder = toNumber(voucher.minOrder ?? voucher.min_order, 0);

  return {
    ...voucher,
    source: "loyalty",
    id: toText(voucher.id || voucher.couponId || voucher.coupon_id || code || title),
    code,
    title,
    minOrder,
    maxDiscount: toNumber(voucher.maxDiscount ?? voucher.max_discount, 0),
    discountType: toText(voucher.discountType || voucher.discount_type || voucher.type || "fixed"),
    value: toNumber(voucher.value ?? voucher.discountValue ?? voucher.discount_value, 0),
    expiredAt: toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at),
    customerType: "registered",
    fulfillmentType: "all",
    conditionText: minOrder > 0
      ? `Đơn từ ${new Intl.NumberFormat("vi-VN").format(minOrder)}đ`
      : "Áp dụng trực tiếp tại quầy"
  };
}

function normalizeCheckoutVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const minOrder = toNumber(voucher.minOrder ?? voucher.min_order, 0);
  const salesChannels = normalizeSalesChannels(voucher.salesChannels || voucher.sales_channels);


  return {
    ...voucher,
    source: "checkout",
    id: toText(voucher.id || code || voucher.name),
    code,
    title: toText(voucher.title || voucher.name || code || "Voucher"),
    name: toText(voucher.name || voucher.title || code || "Voucher"),
    minOrder,
    maxDiscount: toNumber(voucher.maxDiscount ?? voucher.max_discount, 0),
    discountType: toText(voucher.discountType || voucher.discount_type || voucher.type || "fixed"),
    value: toNumber(voucher.value ?? voucher.discountValue ?? voucher.discount_value, 0),
    voucherType: toText(voucher.voucherType || voucher.voucher_type || "checkout").toLowerCase(),
    customerType: toText(voucher.customerType || voucher.customer_type || "all").toLowerCase(),
    fulfillmentType: toText(voucher.fulfillmentType || voucher.fulfillment_type || "all").toLowerCase(),
    startAt: toText(voucher.startAt || voucher.start_at),
    endAt: toText(voucher.endAt || voucher.expiry || voucher.end_at),
    expiry: toText(voucher.endAt || voucher.expiry || voucher.end_at),
    ...(salesChannels.length ? { salesChannels } : {}),

    active: voucher.active !== false,
    conditionText: minOrder > 0
      ? `Đơn từ ${new Intl.NumberFormat("vi-VN").format(minOrder)}đ`
      : "Áp dụng trực tiếp tại quầy"
  };
}

function canUseCheckoutVoucher(voucher = {}, customer = null, now = new Date()) {
  if (!voucher || voucher.active === false) return false;
  if (toText(voucher.voucherType).toLowerCase() === "loyalty") return false;
  if (!isVoucherAllowedForPos(voucher)) return false;

  if (!isDateActive(voucher.startAt, voucher.endAt || voucher.expiry, now)) return false;

  const fulfillmentType = toText(voucher.fulfillmentType).toLowerCase();
  if (fulfillmentType && !["all", "pickup", "pos"].includes(fulfillmentType)) return false;

  const customerType = toText(voucher.customerType).toLowerCase();
  const isRegisteredCustomer = Boolean(customer?.registeredCustomer);
  if (customerType === "registered" && !isRegisteredCustomer) return false;
  if (["guest", "new", "walk_in", "walkin"].includes(customerType) && isRegisteredCustomer) return false;

  return true;
}

export function buildPosLoyaltyBenefit({
  subtotal = 0,
  customer = null,
  coupons = [],
  selectedVoucherId = "",
  pointsInput = ""
} = {}) {
  const baseSubtotal = Math.max(0, toNumber(subtotal, 0));
  const loyalty = customer?.loyalty || {};
  const loyaltyRule = customer?.loyaltyRule || {};
  const availablePoints = Math.max(0, Math.floor(toNumber(loyalty.totalPoints || customer?.totalPoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemValue, 1)));
  const pointSpendStep = getPointSpendStep(redeemPointUnit);
  const usablePoints = roundPointsToSpendStep(availablePoints, pointSpendStep);
  const now = new Date();

  const loyaltyVouchers = (Array.isArray(customer?.availableVouchers) ? customer.availableVouchers : [])
    .map(normalizeLoyaltyVoucher)
    .filter((voucher) => !voucher.used && !voucher.canceled && !voucher.cancelled)
    .filter((voucher) => isDateActive("", voucher.expiredAt || voucher.endAt || voucher.expiry, now));

  const checkoutVouchers = (Array.isArray(coupons) ? coupons : [])
    .map(normalizeCheckoutVoucher)
    .filter((voucher) => canUseCheckoutVoucher(voucher, customer, now));

  const availableVouchers = [...loyaltyVouchers, ...checkoutVouchers];
  const selectedVoucher = availableVouchers.find((voucher) => buildVoucherSelectionKey(voucher) === selectedVoucherId) || null;
  const voucherDiscount = selectedVoucher ? calculateVoucherDiscount(selectedVoucher, baseSubtotal) : 0;
  const maxPointUnits = Math.floor(usablePoints / redeemPointUnit);
  const maxPointDiscount = Math.min(Math.max(0, baseSubtotal - voucherDiscount), maxPointUnits * redeemValue);
  const typedPoints = Math.max(0, Math.floor(toNumber(String(pointsInput).replace(/[^\d]/g, ""), 0)));
  const normalizedTypedPoints = roundPointsToSpendStep(typedPoints, pointSpendStep);
  const normalizedPointUnits = Math.min(maxPointUnits, Math.floor(normalizedTypedPoints / redeemPointUnit));
  const pointsSpent = normalizedPointUnits * redeemPointUnit;
  const pointsDiscount = Math.min(maxPointDiscount, normalizedPointUnits * redeemValue);

  return {
    subtotal: baseSubtotal,
    loyaltyRule,
    availablePoints,
    usablePoints,
    pointSpendStep,
    redeemPointUnit,
    redeemValue,
    loyaltyVouchers,
    checkoutVouchers,
    availableVouchers,
    selectedVoucher,
    selectedVoucherKey: selectedVoucher ? buildVoucherSelectionKey(selectedVoucher) : "",
    voucherDiscount,
    pointsSpent,
    pointsDiscount,
    pointSuggestions: buildPointRoundSuggestions({
      subtotal: baseSubtotal,
      voucherDiscount,
      availablePoints,
      redeemPointUnit,
      redeemValue
    })
  };
}
