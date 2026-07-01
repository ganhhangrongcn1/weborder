export const APPLY_SCOPE_OPTIONS = [
  { value: "all", label: "Toàn menu" },
  { value: "category", label: "Theo danh mục" },
  { value: "product", label: "Theo món cụ thể" }
];

export const DISCOUNT_TYPE_OPTIONS = [
  { value: "percent_discount", label: "Giảm theo %" },
  { value: "fixed_discount", label: "Giảm số tiền cố định" },
  { value: "fixed_price", label: "Đồng giá / giá bán cuối" }
];

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" }
];

export const ROUND_MODE_OPTIONS = [
  { value: "none", label: "Không làm tròn" },
  { value: "round_1000", label: "Làm tròn 1.000đ" },
  { value: "round_5000", label: "Làm tròn 5.000đ" }
];

export const MIN_DISCOUNT_TO_SHOW_OPTIONS = [5, 10, 15];

export const FLASH_APPLY_SCOPE_OPTIONS = [
  { value: "category", label: "Theo danh mục" },
  { value: "product", label: "Theo món cụ thể" }
];

function normalizeVietnameseSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function isFixedPriceIntent(promo = {}) {
  if (promo?.reward?.type === "fixed_price") return true;
  if (promo?.reward?.priceMode === "fixed_price") return true;
  if (promo?.condition?.priceMode === "fixed_price") return true;
  const intentText = normalizeVietnameseSearch([promo?.name, promo?.title, promo?.text].filter(Boolean).join(" "));
  return intentText.includes("dong gia");
}

export function formatDateShort(value) {
  if (!value) return "--/--/----";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("vi-VN");
}

export function getStrikeStatus(promo) {
  if (!promo?.active) return { label: "Đã tắt", className: "bg-slate-100 text-slate-600" };
  const now = new Date();
  const startDate = promo?.startAt ? new Date(`${promo.startAt}T00:00:00`) : null;
  const endDate = promo?.endAt ? new Date(`${promo.endAt}T23:59:59`) : null;

  if (startDate && !Number.isNaN(startDate.getTime()) && startDate.getTime() > now.getTime()) {
    return { label: "Sắp chạy", className: "bg-orange-100 text-orange-700" };
  }

  if (endDate && !Number.isNaN(endDate.getTime()) && endDate.getTime() < now.getTime()) {
    return { label: "Hết hạn", className: "bg-slate-100 text-slate-600" };
  }

  return { label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
}

export function normalizeStrikePromo(promo, fallback) {
  const rewardType = ["percent_discount", "fixed_discount", "fixed_price"].includes(promo?.reward?.type)
    ? promo.reward.type
    : "percent_discount";

  return {
    ...promo,
    name: promo?.name || fallback.name,
    title: promo?.title || fallback.title,
    text: promo?.text || fallback.text,
    active: promo?.active !== false,
    startAt: promo?.startAt || fallback.startAt,
    endAt: promo?.endAt || fallback.endAt,
    priority: Number(promo?.priority ?? fallback.priority),
    condition: {
      ...fallback.condition,
      ...(promo?.condition || {}),
      applyScope: promo?.condition?.applyScope || fallback.condition.applyScope,
      useTimeWindow: Boolean(promo?.condition?.useTimeWindow),
      startTime: promo?.condition?.startTime || fallback.condition.startTime,
      endTime: promo?.condition?.endTime || fallback.condition.endTime,
      noStackWithOtherPromotions: Boolean(promo?.condition?.noStackWithOtherPromotions),
      minDiscountToShow: Number(promo?.condition?.minDiscountToShow || fallback.condition.minDiscountToShow),
      minFinalPrice: Number(promo?.condition?.minFinalPrice || fallback.condition.minFinalPrice),
      categoryIds: String(promo?.condition?.categoryIds || ""),
      productIds: String(promo?.condition?.productIds || "")
    },
    reward: {
      ...fallback.reward,
      ...(promo?.reward || {}),
      type: rewardType,
      value: Number(promo?.reward?.value ?? fallback.reward.value),
      roundMode: promo?.reward?.roundMode || fallback.reward.roundMode
    }
  };
}

function applyRoundMode(value, mode) {
  if (mode === "round_1000") return Math.round(value / 1000) * 1000;
  if (mode === "round_5000") return Math.round(value / 5000) * 5000;
  return value;
}

export function calcPreviewPrice(promo, fallback, sampleOriginal = 35000) {
  const normalized = normalizeStrikePromo(promo, fallback);
  const rawFinal = normalized.reward.type === "fixed_price"
    ? Math.max(Number(normalized.reward.value || 0), 0)
    : Math.max(
        sampleOriginal - (
          normalized.reward.type === "percent_discount"
            ? (sampleOriginal * Number(normalized.reward.value || 0)) / 100
            : Number(normalized.reward.value || 0)
        ),
        0
      );
  const roundedFinal = Math.max(applyRoundMode(rawFinal, normalized.reward.roundMode), 0);
  const finalPrice = Math.max(roundedFinal, Number(normalized.condition.minFinalPrice || 0));
  const percentDiscount = sampleOriginal > 0 ? ((sampleOriginal - finalPrice) / sampleOriginal) * 100 : 0;
  return {
    originalPrice: sampleOriginal,
    finalPrice,
    percentDiscount: Math.max(percentDiscount, 0)
  };
}

export function mergeDateAndTime(dateValue, timeValue, endOfDay = false) {
  if (!dateValue) return null;
  const fallbackTime = endOfDay ? "23:59" : "00:00";
  const normalizedTime = String(timeValue || fallbackTime);
  const date = new Date(`${dateValue}T${normalizedTime}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeFlashPromo(promo, fallback) {
  const rewardType = isFixedPriceIntent(promo)
    ? "fixed_price"
    : ["percent_discount", "fixed_discount", "fixed_price"].includes(promo?.reward?.type)
    ? promo.reward.type
    : "percent_discount";
  const weekdays = Array.isArray(promo?.condition?.weekdays)
    ? promo.condition.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];

  return {
    ...promo,
    name: promo?.name || fallback.name,
    title: promo?.title || fallback.title,
    text: promo?.text || fallback.text,
    active: promo?.active !== false,
    startAt: promo?.startAt || fallback.startAt,
    endAt: promo?.endAt || fallback.endAt,
    priority: Number(promo?.priority ?? fallback.priority),
    condition: {
      ...fallback.condition,
      ...(promo?.condition || {}),
      applyScope: promo?.condition?.applyScope === "category" ? "category" : "product",
      useTimeWindow: promo?.condition?.useTimeWindow !== false,
      startTime: promo?.condition?.startTime || fallback.condition.startTime,
      endTime: promo?.condition?.endTime || fallback.condition.endTime,
      categoryIds: String(promo?.condition?.categoryIds || ""),
      productIds: String(promo?.condition?.productIds || ""),
      totalSlots: Math.max(0, Number(promo?.condition?.totalSlots ?? fallback.condition.totalSlots)),
      soldCount: Math.max(0, Number(promo?.condition?.soldCount ?? 0)),
      maxPerCustomer: Math.max(1, Number(promo?.condition?.maxPerCustomer ?? fallback.condition.maxPerCustomer)),
      noStackWithOtherPromotions: Boolean(promo?.condition?.noStackWithOtherPromotions),
      weekdays
    },
    reward: {
      ...fallback.reward,
      ...(promo?.reward || {}),
      type: rewardType,
      value: Number(promo?.reward?.value ?? fallback.reward.value),
      roundMode: promo?.reward?.roundMode || fallback.reward.roundMode
    }
  };
}

export function isWeekdayActive(promo, now = new Date()) {
  const weekdays = Array.isArray(promo?.condition?.weekdays) ? promo.condition.weekdays : [];
  if (!weekdays.length) return true;
  return weekdays.map((day) => Number(day)).includes(now.getDay());
}

export function formatWeekdaySummary(weekdays = []) {
  const selected = Array.isArray(weekdays)
    ? weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  if (!selected.length) return "Mọi ngày";
  const labelByValue = WEEKDAY_OPTIONS.reduce((map, item) => ({ ...map, [item.value]: item.label }), {});
  return selected.map((day) => labelByValue[day]).filter(Boolean).join(", ");
}

export function getFlashStatus(promo, now = new Date()) {
  if (!promo?.active) return { code: "off", label: "Đã tắt", className: "bg-slate-100 text-slate-600" };

  const soldCount = Number(promo?.condition?.soldCount || 0);
  const totalSlots = Number(promo?.condition?.totalSlots || 0);
  if (totalSlots > 0 && soldCount >= totalSlots) {
    return { code: "sold_out", label: "Đã bán hết", className: "bg-rose-100 text-rose-700" };
  }

  const startDate = mergeDateAndTime(promo?.startAt, promo?.condition?.startTime || "00:00");
  const endDate = mergeDateAndTime(promo?.endAt, promo?.condition?.endTime || "23:59", true);
  if (startDate && now.getTime() < startDate.getTime()) {
    return { code: "upcoming", label: "Sắp chạy", className: "bg-orange-100 text-orange-700" };
  }
  if (endDate && now.getTime() > endDate.getTime()) {
    return { code: "expired", label: "Hết hạn", className: "bg-slate-100 text-slate-600" };
  }
  if (!isWeekdayActive(promo, now)) {
    return { code: "waiting_weekday", label: "Chưa tới ngày chạy", className: "bg-sky-100 text-sky-700" };
  }
  return { code: "running", label: "Đang chạy", className: "bg-emerald-100 text-emerald-700" };
}

export function formatRewardValue(reward = {}) {
  if (reward.type === "percent_discount") return `-${Number(reward.value || 0)}%`;
  if (reward.type === "fixed_price") return `Đồng giá ${formatMoney(reward.value || 0)}`;
  return `-${formatMoney(reward.value || 0)}`;
}

export function formatCountdownFromMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hour = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minute = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const second = String(totalSeconds % 60).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
}

export function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

export function toIdList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toggleCsvId(csv, id) {
  const current = toIdList(csv);
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  return next.join(",");
}
