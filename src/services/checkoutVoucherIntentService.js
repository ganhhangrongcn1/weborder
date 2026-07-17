const CHECKOUT_VOUCHER_INTENT_KEY = "ghr_checkout_voucher_intent";
const CHECKOUT_VOUCHER_INTENT_TTL_MS = 12 * 60 * 60 * 1000;

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function normalizeVoucherIntent(voucher = {}) {
  const id = String(voucher?.id || voucher?.couponId || "").trim();
  const code = String(voucher?.code || "").trim().toUpperCase();
  if (!id && !code) return null;

  return {
    id,
    code,
    title: String(voucher?.title || voucher?.name || code || "Voucher đã chọn").trim(),
    savedAt: Date.now()
  };
}

export function saveCheckoutVoucherIntent(voucher = {}) {
  const storage = getSessionStorage();
  const intent = normalizeVoucherIntent(voucher);
  if (!storage || !intent) return false;

  try {
    storage.setItem(CHECKOUT_VOUCHER_INTENT_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function readCheckoutVoucherIntent() {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const parsed = JSON.parse(storage.getItem(CHECKOUT_VOUCHER_INTENT_KEY) || "null");
    const intent = normalizeVoucherIntent(parsed || {});
    const savedAt = Number(parsed?.savedAt || 0);
    if (!intent || !savedAt || Date.now() - savedAt > CHECKOUT_VOUCHER_INTENT_TTL_MS) {
      storage.removeItem(CHECKOUT_VOUCHER_INTENT_KEY);
      return null;
    }
    return { ...intent, savedAt };
  } catch {
    storage.removeItem(CHECKOUT_VOUCHER_INTENT_KEY);
    return null;
  }
}

export function clearCheckoutVoucherIntent() {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.removeItem(CHECKOUT_VOUCHER_INTENT_KEY);
  } catch {
    // Bỏ qua khi trình duyệt chặn sessionStorage.
  }
}

export function findCheckoutPromoByIntent(promos = [], intent = null) {
  if (!intent) return null;
  const targetId = String(intent.id || "").trim();
  const targetCode = String(intent.code || "").trim().toUpperCase();

  return (Array.isArray(promos) ? promos : []).find((promo) => {
    const promoIds = [promo?.id, promo?.couponId]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const promoCode = String(promo?.code || "").trim().toUpperCase();
    return (targetId && promoIds.includes(targetId)) || (targetCode && promoCode === targetCode);
  }) || null;
}
