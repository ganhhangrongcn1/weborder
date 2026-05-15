export function calculateShippingFee(distanceKm, subtotal, freeshipMinSubtotal, deliveryFee) {
  if (subtotal >= freeshipMinSubtotal) return 0;
  return calculateBaseShippingFee(distanceKm, deliveryFee);
}

export function calculateBaseShippingFee(distanceKm, deliveryFee) {
  if (!distanceKm) return deliveryFee;
  if (distanceKm <= 3) return 15000;
  return 15000 + Math.ceil(distanceKm - 3) * 5000;
}

export function normalizeSmartPromotion(promotion = {}) {
  return {
    id: promotion.id || `promo-${Date.now()}`,
    name: promotion.name || "Chương trình mới",
    type: promotion.type || "coupon_hint",
    title: promotion.title || promotion.name || "Ưu đãi mới",
    text: promotion.text || "Mô tả ngắn hiển thị cho khách",
    icon: promotion.icon || "sale",
    active: promotion.active !== false,
    displayPlaces: Array.isArray(promotion.displayPlaces) ? promotion.displayPlaces : ["home"],
    condition: {
      ...(promotion.condition || {}),
      minSubtotal: Number(promotion.condition?.minSubtotal || 0),
      customerType: promotion.condition?.customerType || "all",
      productIds: promotion.condition?.productIds || "",
      categoryIds: promotion.condition?.categoryIds || ""
    },
    reward: {
      ...(promotion.reward || {}),
      type: promotion.reward?.type || "fixed_discount",
      value: promotion.reward?.value ?? 0,
      productId: promotion.reward?.productId || ""
    },
    startAt: promotion.startAt || "",
    endAt: promotion.endAt || "",
    priority: Number(promotion.priority || 99)
  };
}

export function getActivePromotions(promotions = [], place) {
  return promotions
    .map(normalizeSmartPromotion)
    .filter((promotion) => promotion.active && (!place || promotion.displayPlaces.includes(place)))
    .sort((first, second) => first.priority - second.priority);
}

export function buildHomePromoCards(cardPromos = [], smartPromotions = []) {
  const smartCards = getActivePromotions(smartPromotions, "home").map((promotion) => ({
    icon: promotion.icon || "sale",
    title: promotion.title || promotion.name,
    text: promotion.text || "Đang áp dụng"
  }));
  const fallbackCards = cardPromos.filter((promo) => !smartCards.some((smart) => smart.title === promo.title));
  return [...smartCards, ...fallbackCards].slice(0, 4);
}

export function getActiveVouchers(loyalty) {
  return (loyalty.voucherHistory || []).filter((voucher) => !voucher.used && !isVoucherExpired(voucher));
}

export function getOrderStats(orders) {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
  const latestOrder = orders[0] || null;
  return {
    totalOrders,
    totalSpent,
    latestOrder
  };
}

export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayKey() {
  return getDateKey(new Date());
}

export function getYesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getDateKey(date);
}

export function isYesterday(date) {
  return date === getYesterdayKey();
}

export function addDaysToKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

export function getDailyReward(streak) {
  const cycleDay = (Math.max(streak, 1) - 1) % 7 + 1;
  if (cycleDay <= 3) return 100;
  if (cycleDay <= 6) return 200;
  return 500;
}

export function getNextMilestone(streak) {
  if (streak < 7) return { days: 7, points: 700 };
  if (streak < 14) return { days: 14, points: 1500 };
  if (streak < 30) return { days: 30, points: 3000 };
  return null;
}

export function generateLuckyVoucher() {
  if (Math.random() >= 0.2) return null;
  const today = getTodayKey();
  const options = [
    { type: "FREE_TOPPING", title: "Tặng topping miễn phí" },
    { type: "FREE_DRINK", title: "Tặng trà xoài cho đơn từ 50k" },
    { type: "DISCOUNT_10K", title: "Giảm 10k cho đơn từ 59k" }
  ];
  const picked = options[Math.floor(Math.random() * options.length)];
  return {
    id: `${picked.type}-${Date.now()}`,
    type: picked.type,
    title: picked.title,
    createdAt: today,
    used: false,
    expiredAt: addDaysToKey(today, 7)
  };
}

export function isVoucherExpired(voucher) {
  return voucher.expiredAt < getTodayKey();
}

export function normalizeOrderOption(group, option) {
  return {
    id: option.id,
    name: option.name,
    price: Number(option.price) || 0,
    groupId: group.id,
    groupName: group.name,
    type: group.type
  };
}

export function getDefaultOrderChoices(product, fallbackToppings = []) {
  const groups = product.optionGroups || [];
  const firstSingleGroup = groups.find((group) => group.type === "single" && group.options?.length);
  const firstSingleOption = firstSingleGroup?.options?.[0];
  const paidDefaultOptions =
    firstSingleGroup && firstSingleOption && Number(firstSingleOption.price) > 0
      ? [normalizeOrderOption(firstSingleGroup, firstSingleOption)]
      : [];
  return {
    spice: firstSingleOption ? `${firstSingleGroup.name}: ${firstSingleOption.name}` : "",
    toppings: groups.length ? paidDefaultOptions : []
  };
}

export function buildHomeCategories(categories, t) {
  const allLabel = t?.all || "Tất cả";
  const normalized = [];
  categories.map((item) => String(item || "").trim()).filter(Boolean).forEach((item) => {
    if (!normalized.includes(item)) normalized.push(item);
  });
  const visibleCategories = normalized.filter((item) => item !== allLabel);
  const getMark = (label) => {
    const words = String(label || "").split(/\s+/).filter(Boolean);
    const mark = words.map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    return mark || "?";
  };

  return [
    { label: allLabel, value: "__ALL__", mark: "ALL" },
    ...visibleCategories.map((category) => ({
      label: category,
      value: category,
      mark: getMark(category)
    }))
  ];
}

export function getFlashSecondsLeft() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 0, 0, 0);
  if (now > end) end.setDate(end.getDate() + 1);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export function getCountdownParts(totalSeconds) {
  return [
    String(Math.floor(totalSeconds / 3600)).padStart(2, "0"),
    String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
    String(totalSeconds % 60).padStart(2, "0")
  ];
}

export function formatCountdown(totalSeconds) {
  return getCountdownParts(totalSeconds).join(":");
}

export function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
}
