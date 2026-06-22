import { useEffect, useMemo, useState } from "react";
import PosCartPanel from "../components/pos/PosCartPanel.jsx";
import PosLoginScreen from "../components/pos/PosLoginScreen.jsx";
import { CashPaymentModal, PosConfirmModal, QrPaymentModal } from "../components/pos/PosPaymentModals.jsx";
import ProductOptionsModal from "../components/pos/ProductOptionsModal.jsx";
import { CategoryButton, PosPagerInlinePicker, PosPagerModal, PosWorkspaceNav, ProductCard } from "../components/pos/PosPrimitives.jsx";
import PosRecentOrdersPanel from "../components/pos/PosRecentOrdersPanel.jsx";
import PosShiftCloseModal from "../components/pos/PosShiftCloseModal.jsx";
import PosShiftOpenPanel from "../components/pos/PosShiftOpenPanel.jsx";
import PosShiftOverviewPanel from "../components/pos/PosShiftOverviewPanel.jsx";
import PosSettingsPanel from "../components/pos/PosSettingsPanel.jsx";
import { buildVoucherSelectionKey, formatMoney, getBranchLabel, getBranchUuid } from "../components/pos/posHelpers.js";
import usePosCart from "../hooks/usePosCart.js";
import usePosCatalog from "../hooks/usePosCatalog.js";
import usePosCustomerLookup from "../hooks/usePosCustomerLookup.js";
import { lookupPosCustomerByPhone } from "../services/posCustomerService.js";
import { createPosQrPrintJob, createPosShiftClosePrintJob } from "../services/printJobService.js";
import { startPosAutoPrint } from "../services/posAutomationService.js";
import {
  readPosCatalogCache,
  savePosCatalogCache,
  subscribePosCatalogCache
} from "../services/posCatalogCacheService.js";
import {
  getPendingPosOfflineOrders,
  subscribePosOfflineQueue,
  syncPendingPosOfflineOrders
} from "../services/posOfflineQueueService.js";
import { buildPosPaymentReference, calculateCashChange, getPosQrPaymentConfig, normalizeCashReceived } from "../services/posPaymentService.js";
import { hasAndroidPrinterBridge, printCustomerBill, printPosQrReceipt, printXprinterTestBill } from "../services/printerService.js";
import {
  cancelPosPaymentSession,
  confirmPosPaymentSessionManually,
  createPosPaymentSession,
  forgetPosPaymentSession,
  listPosPaymentSessions,
  markPosPaymentSessionConverted,
  readRememberedPosPaymentSession,
  readPosPaymentSession,
  rememberPosPaymentSession,
  subscribePosPaymentSession,
  subscribePosPaymentSessionsByBranch
} from "../services/posPaymentSessionService.js";
import { clearPosSession, getBranchValue, readPosSession } from "../services/posSessionService.js";
import {
  cancelPosOrderAsync,
  createPosCartItem,
  createPosOrderIdentity,
  createPosTakeawayOrder,
  getBusyPosPagerNumbersAsync,
  getPosRecentOrdersAsync
} from "../services/posService.js";
import { clearActivePosShift, closePosShift, fetchActivePosShift, fetchPosShiftSummary, openPosShift, readActivePosShift } from "../services/posShiftService.js";
import "../styles/pos.css";

const POS_REGISTER_KEY = "main";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePagerNumber(value = "") {
  const text = toText(value);
  const digits = text.replace(/\D/g, "");
  if (digits && digits.length <= 2) return digits.padStart(2, "0");
  return text;
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

function calculateVoucherDiscount(voucher = {}, subtotal = 0) {
  const minOrder = toNumber(voucher.minOrder, 0);
  if (subtotal < minOrder) return 0;
  const value = toNumber(voucher.value, 0);
  if (toText(voucher.discountType).toLowerCase() === "percent") {
    const raw = Math.floor(subtotal * value / 100);
    const maxDiscount = toNumber(voucher.maxDiscount, 0);
    return maxDiscount > 0 ? Math.min(raw, maxDiscount) : raw;
  }
  return value;
}

function buildPointRoundSuggestions(loyaltyBenefit = {}) {
  const baseTotal = Math.max(0, Math.floor(toNumber(loyaltyBenefit.subtotal, 0) - toNumber(loyaltyBenefit.voucherDiscount, 0)));
  const availablePoints = Math.max(0, Math.floor(toNumber(loyaltyBenefit.availablePoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemValue, 1)));
  const maxUnits = Math.floor(availablePoints / redeemPointUnit);
  const maxDiscount = Math.min(baseTotal, maxUnits * redeemValue);
  const suggestions = [];
  const seen = new Set();

  [10000, 5000, 1000].forEach((roundTo) => {
    const remainder = baseTotal % roundTo;
    if (!remainder || remainder > maxDiscount) return;
    const unitCount = Math.ceil(remainder / redeemValue);
    const points = unitCount * redeemPointUnit;
    if (!points || points > availablePoints || seen.has(points)) return;
    seen.add(points);
    suggestions.push({
      label: `Còn ${formatMoney(Math.max(0, baseTotal - unitCount * redeemValue))}`,
      points
    });
  });

  if (availablePoints > 0 && !seen.has(availablePoints)) {
    suggestions.push({
      label: "Dùng tối đa",
      points: availablePoints
    });
  }

  suggestions.sort((a, b) => a.points - b.points);
  if (suggestions.length > 2) {
    const first = suggestions[0];
    const last = suggestions[suggestions.length - 1];
    return first.points === last.points ? [first] : [first, last];
  }

  return suggestions;
}

function buildPointRoundSuggestionsV2(loyaltyBenefit = {}) {
  const baseTotal = Math.max(0, Math.floor(toNumber(loyaltyBenefit.subtotal, 0) - toNumber(loyaltyBenefit.voucherDiscount, 0)));
  const availablePoints = Math.max(0, Math.floor(toNumber(loyaltyBenefit.availablePoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyBenefit.redeemValue, 1)));
  const maxRedemptionPercent = Math.min(50, Math.max(0, toNumber(loyaltyBenefit.maxRedemptionPercent, 50)));
  const maxUnits = Math.floor(availablePoints / redeemPointUnit);
  const maxDiscount = Math.min(
    Math.floor(baseTotal * maxRedemptionPercent / 100),
    maxUnits * redeemValue
  );
  const suggestions = [];
  const seen = new Set();

  [1000, 5000, 10000, 20000, 50000].forEach((roundTo) => {
    if (baseTotal <= roundTo) return;
    const roundedTotal = Math.floor(baseTotal / roundTo) * roundTo;
    const remainder = baseTotal - roundedTotal;
    if (!remainder || remainder > maxDiscount) return;

    const unitCount = Math.ceil(remainder / redeemValue);
    const points = unitCount * redeemPointUnit;
    if (!points || points > availablePoints || seen.has(points)) return;

    seen.add(points);
    suggestions.push({
      label: `Chẵn ${formatMoney(Math.max(0, roundedTotal))}`,
      points
    });
  });

  const maxSuggestedUnits = Math.floor(maxDiscount / redeemValue);
  const maxSuggestedPoints = Math.min(availablePoints, maxSuggestedUnits * redeemPointUnit);
  if (maxSuggestedPoints > 0 && !seen.has(maxSuggestedPoints)) {
    suggestions.push({
      label: "Dùng tối đa",
      points: maxSuggestedPoints
    });
  }

  suggestions.sort((a, b) => a.points - b.points);
  return suggestions.slice(0, 4);
}

function buildPosLoyaltyBenefit({ subtotal = 0, customer = null, coupons = [], selectedVoucherId = "", pointsInput = "" }) {
  const loyalty = customer?.loyalty || {};
  const loyaltyRule = customer?.loyaltyRule || {};
  const availablePoints = Math.max(0, Math.floor(toNumber(loyalty.totalPoints || customer?.totalPoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemValue, 1)));
  const maxRedemptionPercent = Math.min(50, Math.max(0, toNumber(loyaltyRule.maxRedemptionPercent, 50)));
  const now = new Date();
  const couponById = Object.fromEntries((coupons || []).map((coupon) => [toText(coupon.id), coupon]));
  const couponByCode = Object.fromEntries((coupons || []).map((coupon) => [toText(coupon.code).toUpperCase(), coupon]));

  const loyaltyVouchers = (customer?.availableVouchers || [])
    .map((voucher) => {
      const matched = couponById[toText(voucher.couponId || voucher.id)] || couponByCode[toText(voucher.code).toUpperCase()] || {};
      const merged = {
        ...matched,
        ...voucher,
        source: "loyalty",
        title: voucher.title || matched.name || matched.title || voucher.code || "Voucher loyalty",
        conditionText: toNumber(matched.minOrder || voucher.minOrder, 0) > 0 ? `Đơn từ ${formatMoney(matched.minOrder || voucher.minOrder)}` : "Áp dụng trực tiếp tại quầy"
      };
      return merged;
    })
    .filter((voucher) => !voucher.used && !voucher.canceled && !voucher.cancelled)
    .filter((voucher) => isDateActive("", voucher.expiredAt || voucher.endAt || voucher.expiry, now));

  const normalVouchers = (coupons || [])
    .filter((coupon) => coupon?.active !== false)
    .filter((coupon) => toText(coupon.voucherType || "checkout") !== "loyalty")
    .filter((coupon) => isDateActive(coupon.startAt, coupon.endAt || coupon.expiry, now))
    .map((coupon) => ({
      ...coupon,
      source: "checkout",
      title: coupon.name || coupon.title || coupon.code || "Voucher thường",
      conditionText: toNumber(coupon.minOrder, 0) > 0 ? `Đơn từ ${formatMoney(coupon.minOrder)}` : "Áp dụng trực tiếp tại quầy"
    }));

  const combinedVouchers = [...loyaltyVouchers, ...normalVouchers];
  const selectedVoucher = combinedVouchers.find((voucher) => buildVoucherSelectionKey(voucher) === selectedVoucherId) || null;
  const voucherDiscount = selectedVoucher ? calculateVoucherDiscount(selectedVoucher, subtotal) : 0;

  const maxPointUnits = Math.floor(availablePoints / redeemPointUnit);
  const eligiblePointAmount = Math.max(0, subtotal - voucherDiscount);
  const maxPointDiscount = Math.min(
    Math.floor(eligiblePointAmount * maxRedemptionPercent / 100),
    maxPointUnits * redeemValue
  );
  const typedPoints = Math.max(0, Math.floor(toNumber(String(pointsInput).replace(/[^\d]/g, ""), 0)));
  const maxPointUnitsByOrder = Math.floor(maxPointDiscount / redeemValue);
  const normalizedPointUnits = Math.min(
    maxPointUnits,
    maxPointUnitsByOrder,
    Math.floor(typedPoints / redeemPointUnit)
  );
  const pointsSpent = normalizedPointUnits * redeemPointUnit;
  const pointsDiscount = Math.min(maxPointDiscount, normalizedPointUnits * redeemValue);

  return {
    subtotal,
    loyaltyRule,
    availablePoints,
    redeemPointUnit,
    redeemValue,
    maxRedemptionPercent,
    maxPointDiscount,
    normalVouchers,
    loyaltyVouchers,
    selectedVoucher,
    selectedVoucherKey: selectedVoucher ? buildVoucherSelectionKey(selectedVoucher) : "",
    voucherDiscount,
    pointsSpent,
    pointsDiscount,
    pointSuggestions: buildPointRoundSuggestionsV2({
      subtotal,
      voucherDiscount,
      availablePoints,
      redeemPointUnit,
      redeemValue,
      maxRedemptionPercent
    })
  };
}

function buildPromotionHints(smartPromotions = [], products = [], subtotal = 0) {
  const now = new Date();
  return (smartPromotions || [])
    .filter((promotion) => promotion?.active !== false)
    .filter((promotion) => promotion?.type === "gift_threshold" || promotion?.reward?.type === "gift")
    .filter((promotion) => isDateActive(promotion.startAt, promotion.endAt, now))
    .map((promotion) => {
      const minSubtotal = toNumber(promotion?.condition?.minSubtotal, 0);
      const productId = toText(promotion?.reward?.productId);
      const product = (products || []).find((item) => toText(item.id) === productId);
      const rewardText = product?.name || toText(promotion?.reward?.name || promotion?.reward?.title || promotion?.reward?.value) || "Món tặng";
      return {
        id: toText(promotion.id || rewardText),
        product,
        productId,
        minSubtotal,
        rewardText,
        eligible: subtotal >= minSubtotal && Boolean(product),
        missing: Math.max(0, minSubtotal - subtotal)
      };
    })
    .filter((promotion) => promotion.product)
    .sort((a, b) => a.missing - b.missing);
}

export default function PosPage({ products = [], categories = [], branches = [], coupons = [], smartPromotions = [] }) {
  const [posSession, setPosSession] = useState(() => readPosSession());
  const [activeWorkspace, setActiveWorkspace] = useState("orders");
  const [pagerNumber, setPagerNumber] = useState("");
  const [pagerPickerOpen, setPagerPickerOpen] = useState(false);
  const [pendingPagerProduct, setPendingPagerProduct] = useState(null);
  const [busyPagers, setBusyPagers] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState(null);
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [qrPaymentOpen, setQrPaymentOpen] = useState(false);
  const [cancelQrConfirmOpen, setCancelQrConfirmOpen] = useState(false);
  const [cancellingQr, setCancellingQr] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(null);
  const [qrDraftOrder, setQrDraftOrder] = useState(null);
  const [qrPreviewIdentity, setQrPreviewIdentity] = useState(null);
  const [qrDraftLoading, setQrDraftLoading] = useState(false);
  const [qrDraftError, setQrDraftError] = useState("");
  const [qrPrintLoading, setQrPrintLoading] = useState(false);
  const [qrPrintMessage, setQrPrintMessage] = useState("");
  const [qrPrintMessageType, setQrPrintMessageType] = useState("");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState("");
  const [recentOrdersActionMessage, setRecentOrdersActionMessage] = useState("");
  const [recentOrdersActionType, setRecentOrdersActionType] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [reprintingOrderId, setReprintingOrderId] = useState("");
  const [pendingPaymentSessions, setPendingPaymentSessions] = useState([]);
  const [pendingPaymentsLoading, setPendingPaymentsLoading] = useState(false);
  const [pendingPaymentsError, setPendingPaymentsError] = useState("");
  const [pendingOfflineOrders, setPendingOfflineOrders] = useState([]);
  const [pendingOfflineOrderCount, setPendingOfflineOrderCount] = useState(0);
  const [offlineOrdersSyncing, setOfflineOrdersSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [printStationLabel, setPrintStationLabel] = useState("");
  const [printStationTone, setPrintStationTone] = useState("idle");
  const [printerTesting, setPrinterTesting] = useState(false);
  const [printerTestMessage, setPrinterTestMessage] = useState("");
  const [printerTestTone, setPrinterTestTone] = useState("");
  const [pendingCancelTarget, setPendingCancelTarget] = useState(null);
  const [cancellingPaymentSessionId, setCancellingPaymentSessionId] = useState("");
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState("");
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftSummaryLoading, setShiftSummaryLoading] = useState(false);
  const [shiftSummaryError, setShiftSummaryError] = useState("");
  const [shiftCloseOpen, setShiftCloseOpen] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const [shiftCloseError, setShiftCloseError] = useState("");
  const [posCatalogCache, setPosCatalogCache] = useState(() => readPosCatalogCache());

  const hasLiveProducts = Array.isArray(products) && products.length > 0;
  const hasLiveBranches = Array.isArray(branches) && branches.length > 0;
  const effectiveProducts = hasLiveProducts ? products : posCatalogCache.products;
  const effectiveCategories = hasLiveProducts || (Array.isArray(categories) && categories.length)
    ? categories
    : posCatalogCache.categories;
  const effectiveBranches = hasLiveBranches ? branches : posCatalogCache.branches;
  const usingCachedCatalog = !hasLiveProducts && posCatalogCache.products.length > 0;

  const { activeCategory, setActiveCategory, categories: posCategories, visibleProducts } = usePosCatalog({ products: effectiveProducts, categories: effectiveCategories });
  const { cart, totals, addProduct, updateQuantity, removeItem, syncGiftItems, restoreCart, clearCart } = usePosCart();
  const customerLookup = usePosCustomerLookup(customerPhone);
  const loyaltyBenefit = useMemo(
    () => buildPosLoyaltyBenefit({
      subtotal: totals.subtotal,
      customer: customerLookup.result,
      coupons,
      selectedVoucherId,
      pointsInput
    }),
    [coupons, customerLookup.result, pointsInput, selectedVoucherId, totals.subtotal]
  );
  const posTotals = useMemo(() => ({
    ...totals,
    voucherDiscount: loyaltyBenefit.voucherDiscount,
    pointsDiscount: loyaltyBenefit.pointsDiscount,
    total: Math.max(0, totals.subtotal - loyaltyBenefit.voucherDiscount - loyaltyBenefit.pointsDiscount)
  }), [loyaltyBenefit.pointsDiscount, loyaltyBenefit.voucherDiscount, totals]);
  const usesOfflineLockedBenefit = Boolean(
    loyaltyBenefit.selectedVoucher ||
    toNumber(loyaltyBenefit.pointsSpent, 0) > 0 ||
    toNumber(loyaltyBenefit.voucherDiscount, 0) > 0 ||
    toNumber(loyaltyBenefit.pointsDiscount, 0) > 0
  );
  const promotionHints = useMemo(
    () => buildPromotionHints(smartPromotions, effectiveProducts, totals.subtotal),
    [effectiveProducts, smartPromotions, totals.subtotal]
  );
  const billPaymentKey = useMemo(() => JSON.stringify({
    items: cart.map((item) => ({
      id: item.id || item.productId || item.cartId,
      cartId: item.cartId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      options: item.options || [],
      note: item.note || "",
      lineTotal: item.lineTotal
    })),
    subtotal: posTotals.subtotal,
    voucherDiscount: posTotals.voucherDiscount,
    pointsDiscount: posTotals.pointsDiscount,
    total: posTotals.total
  }), [
    cart,
    posTotals.pointsDiscount,
    posTotals.subtotal,
    posTotals.total,
    posTotals.voucherDiscount
  ]);

  const selectedBranch = (Array.isArray(effectiveBranches) ? effectiveBranches : []).find((branch, index) => getBranchValue(branch, index) === posSession?.branchValue) || null;
  const branchLabel = selectedBranch ? getBranchLabel(selectedBranch) : posSession?.branchName || "";
  const selectedBranchUuid = selectedBranch ? getBranchUuid(selectedBranch, getBranchValue) : posSession?.branchValue || "";
  const syncStatusLabel = pendingOfflineOrderCount > 0
    ? `${pendingOfflineOrderCount} đơn chờ đồng bộ`
    : "Đã đồng bộ";
  const workspacePendingCount = pendingPaymentSessions.length + pendingOfflineOrderCount;
  const offlineMode = !isOnline;
  const qrPaymentReady = getPosQrPaymentConfig(selectedBranch || {}).ready;
  const hasOpenShift = Boolean(activeShift?.id && toText(activeShift.status).toLowerCase() === "open");
  const hasSelectedPager = Boolean(pagerNumber.trim());
  const selectedPagerIsBusy = hasSelectedPager &&
    busyPagers.map(normalizePagerNumber).includes(normalizePagerNumber(pagerNumber)) &&
    !qrDraftOrder;
  const qrSessionStatus = toText(qrDraftOrder?.status).toLowerCase();
  const isQrDraftPending = Boolean(
    qrDraftOrder &&
    !paymentConfirmed &&
    (!qrDraftOrder.isPaymentSession || ["draft", "pending_payment"].includes(qrSessionStatus))
  );
  const draftLocked = Boolean(paymentConfirmed || isQrDraftPending);
  const isMenuLocked = Boolean(paymentConfirmed || !hasOpenShift);

  const validateLiveLoyaltySelection = async ({
    phone = customerPhone,
    pointsSpent = loyaltyBenefit.pointsSpent,
    selectedVoucher = loyaltyBenefit.selectedVoucher
  } = {}) => {
    const normalizedPhone = toText(phone);
    const usesLoyaltyPoints = toNumber(pointsSpent, 0) > 0;
    const usesLoyaltyVoucher = toText(selectedVoucher?.source).toLowerCase() === "loyalty";

    if (offlineMode && (usesLoyaltyPoints || selectedVoucher)) {
      return {
        ok: false,
        message: "Đang mất mạng. Vui lòng bỏ voucher/điểm loyalty hoặc nhận tiền mặt không ưu đãi."
      };
    }

    if (!normalizedPhone || (!usesLoyaltyPoints && !usesLoyaltyVoucher)) {
      return { ok: true, customer: customerLookup.result };
    }

    const latestCustomer = await lookupPosCustomerByPhone(normalizedPhone);
    if (!latestCustomer?.ok) {
      return {
        ok: false,
        message: latestCustomer?.message || "Không đọc được điểm loyalty mới nhất của khách."
      };
    }

    const latestPoints = Math.max(0, Math.floor(toNumber(latestCustomer?.loyalty?.totalPoints, 0)));
    if (usesLoyaltyPoints && toNumber(pointsSpent, 0) > latestPoints) {
      return {
        ok: false,
        customer: latestCustomer,
        message: `Điểm loyalty vừa thay đổi. Khách hiện còn ${latestPoints.toLocaleString("vi-VN")} điểm.`
      };
    }

    if (usesLoyaltyVoucher) {
      const selectedVoucherId = toText(selectedVoucher?.id);
      const selectedVoucherCode = toText(selectedVoucher?.code).toUpperCase();
      const matchedVoucher = (latestCustomer.availableVouchers || []).some((voucher) => {
        const voucherId = toText(voucher?.id);
        const voucherCode = toText(voucher?.code).toUpperCase();
        return (selectedVoucherId && voucherId === selectedVoucherId)
          || (selectedVoucherCode && voucherCode === selectedVoucherCode);
      });

      if (!matchedVoucher) {
        return {
          ok: false,
          customer: latestCustomer,
          message: "Voucher loyalty vừa thay đổi hoặc đã được dùng ở nơi khác. Vui lòng chọn lại."
        };
      }
    }

    return { ok: true, customer: latestCustomer };
  };

  const resetComposer = ({ preserveRememberedSession = false } = {}) => {
    if (!preserveRememberedSession) {
      forgetPosPaymentSession(selectedBranchUuid);
    }
    setPagerNumber("");
    setPagerPickerOpen(false);
    setPendingPagerProduct(null);
    setCustomerName("");
    setCustomerPhone("");
    setCashReceived("");
    setPaymentMethod("");
    setPaymentConfirmed(null);
    setQrDraftOrder(null);
    setQrPreviewIdentity(null);
    setQrDraftLoading(false);
    setQrDraftError("");
    setSelectedVoucherId("");
    setPointsInput("");
    setCashPaymentOpen(false);
    setQrPaymentOpen(false);
    setCancelQrConfirmOpen(false);
    setCancellingQr(false);
    clearCart();
  };

  const restorePaymentSessionToComposer = (session, { restored = true } = {}) => {
    if (!session?.id) return;

    const status = toText(session.status).toLowerCase();
    const checkout = session.checkoutSnapshot || {};
    restoreCart(session.cartSnapshot, checkout.orderNote || "");
    setPagerNumber(session.pagerNumber || "");
    setCustomerName(session.customerName || "");
    setCustomerPhone(session.customerPhone || "");
    setSelectedVoucherId(toText(checkout.selectedVoucherKey || checkout.promoSelectionKey || checkout.promoVoucherId));
    setPointsInput(checkout.pointsSpent ? String(checkout.pointsSpent) : "");
    setPaymentMethod("bank_qr");
    setPaymentConfirmed(
      ["paid", "converting"].includes(status)
        ? {
            method: "bank_qr",
            reference: session.paymentReference,
            paidAt: session.paidAt || new Date().toISOString(),
            amount: session.amountPaid || session.amountExpected
          }
        : null
    );
    setQrPreviewIdentity(session.orderIdentity || checkout.orderIdentity || null);
    setQrDraftOrder({ ...session, restored });
    setQrDraftError("");
    setCreateError("");
    rememberPosPaymentSession(selectedBranchUuid, session.id);
  };

  const loadBusyPagers = async () => {
    if (!posSession?.branchValue) {
      setBusyPagers([]);
      return;
    }
    try {
      const values = await getBusyPosPagerNumbersAsync({ branchValue: posSession.branchValue });
      setBusyPagers(values);
    } catch {
      setBusyPagers([]);
    }
  };

  const loadRecentOrders = async () => {
    if (!posSession?.branchValue) return;
    setRecentOrdersLoading(true);
    setRecentOrdersError("");
    try {
      const rows = await getPosRecentOrdersAsync({ branchValue: posSession.branchValue, limit: 60 });
      setRecentOrders(rows);
    } catch (error) {
      setRecentOrdersError(error?.message || "Không tải được đơn gần đây.");
    } finally {
      setRecentOrdersLoading(false);
    }
  };

  const loadPendingOfflineOrders = () => {
    if (!selectedBranchUuid) {
      setPendingOfflineOrders([]);
      setPendingOfflineOrderCount(0);
      return [];
    }

    const rows = getPendingPosOfflineOrders({ branchValue: selectedBranchUuid });
    setPendingOfflineOrders(rows);
    setPendingOfflineOrderCount(rows.length);
    return rows;
  };

  const syncPendingOfflineOrders = async ({ silent = true } = {}) => {
    if (!selectedBranchUuid) return null;
    const result = await syncPendingPosOfflineOrders({
      branchValue: selectedBranchUuid,
      limit: 20
    });
    loadPendingOfflineOrders();

    if (result?.syncedCount > 0) {
      if (!silent) {
        setRecentOrdersActionMessage(result.message || `Đã đồng bộ ${result.syncedCount} đơn POS.`);
        setRecentOrdersActionType("success");
      }
      await loadRecentOrders();
      await loadBusyPagers();
      if (activeShift?.id) {
        await loadShiftSummary({ silent: true });
      }
    } else if (!silent && result?.failedCount > 0) {
      setRecentOrdersActionMessage(result.message || "Một số đơn POS chưa đồng bộ được.");
      setRecentOrdersActionType("error");
    }

    return result;
  };

  const printPosBillLocalFirst = async (order = {}) => {
    if (!hasAndroidPrinterBridge()) {
      return {
        ok: true,
        skipped: true,
        message: ""
      };
    }

    const result = await printCustomerBill(order, {
      branchName: branchLabel,
      printerName: "Xprinter",
      receiptWidthMm: 80
    });

    return {
      ok: Boolean(result?.ok),
      skipped: false,
      message: result?.message || (result?.ok ? "Đã in bill." : "Không in được bill.")
    };
  };

  const handleReprintRecentOrder = async (order) => {
    const orderId = toText(order?.id || order?.orderCode);
    if (!orderId) return;

    setReprintingOrderId(orderId);
    setRecentOrdersActionMessage("");
    setRecentOrdersActionType("");

    try {
      const result = await printCustomerBill(order);
      setRecentOrdersActionMessage(result.message || (result.ok ? "Đã in lại bill." : "Không in lại được bill."));
      setRecentOrdersActionType(result.ok ? "success" : "error");
    } catch (error) {
      setRecentOrdersActionMessage(error?.message || "Không in lại được bill.");
      setRecentOrdersActionType("error");
    } finally {
      setReprintingOrderId("");
    }
  };

  const loadPendingPaymentSessions = async () => {
    if (!selectedBranchUuid) {
      setPendingPaymentSessions([]);
      return;
    }

    setPendingPaymentsLoading(true);
    setPendingPaymentsError("");
    try {
      const rows = await listPosPaymentSessions(selectedBranchUuid);
      setPendingPaymentSessions(rows);
    } catch (error) {
      setPendingPaymentsError(error?.message || "Không tải được các phiên QR đang chờ.");
    } finally {
      setPendingPaymentsLoading(false);
    }
  };

  const loadActiveShift = async ({ silent = false } = {}) => {
    if (!selectedBranchUuid) {
      setActiveShift(null);
      setShiftSummary(null);
      return null;
    }

    if (!silent) setShiftLoading(true);
    setShiftError("");
    const cachedShift = readActivePosShift(selectedBranchUuid, POS_REGISTER_KEY);
    if (cachedShift?.id && toText(cachedShift.status).toLowerCase() === "open") {
      setActiveShift(cachedShift);
    }

    const result = await fetchActivePosShift({
      branchUuid: selectedBranchUuid,
      registerKey: POS_REGISTER_KEY
    });

    if (result.shift?.id && toText(result.shift.status).toLowerCase() === "open") {
      setActiveShift(result.shift);
    } else if (result.ok) {
      setActiveShift(null);
      setShiftSummary(null);
    }

    if (!result.ok && !cachedShift?.id) {
      setShiftError(result.message || "Không tải được ca POS đang mở.");
    }
    if (!silent) setShiftLoading(false);
    return result.shift || null;
  };

  const loadShiftSummary = async ({ silent = false, shift = activeShift } = {}) => {
    if (!shift?.id) {
      setShiftSummary(null);
      return null;
    }

    if (!silent) setShiftSummaryLoading(true);
    setShiftSummaryError("");
    const result = await fetchPosShiftSummary({
      shiftId: shift.id,
      openingCash: shift.openingCash
    });
    if (result.ok) {
      setShiftSummary(result.summary);
    } else {
      setShiftSummaryError(result.message || "Không tải được tổng ca POS.");
    }
    if (!silent) setShiftSummaryLoading(false);
    return result.summary || null;
  };

  const requireOpenShift = () => {
    if (hasOpenShift) return true;
    setCreateError("Vui lòng mở ca POS trước khi bán hàng.");
    setShiftError("");
    return false;
  };

  const cancelPendingQrDraft = async ({ silent = false, reason = "Nhân viên đổi bill trước khi thanh toán" } = {}) => {
    if (!isQrDraftPending || !qrDraftOrder) return true;

    const result = qrDraftOrder.isPaymentSession
      ? await cancelPosPaymentSession(qrDraftOrder.id, reason)
      : await cancelPosOrderAsync(qrDraftOrder, {
        cashierName: posSession?.cashierName || "Thu ngân",
        reason
      });

    if (!result.ok) {
      setCreateError(
        result.message ||
        (silent
          ? "Phiên thanh toán đã thay đổi, không thể sửa bill."
          : "Không hủy được đơn chờ thanh toán.")
      );
      return false;
    }

    setQrDraftOrder(null);
    setQrPreviewIdentity(null);
    setQrDraftLoading(false);
    setQrDraftError("");
    setQrPaymentOpen(false);
    forgetPosPaymentSession(selectedBranchUuid);

    if (!silent) {
      setCreateError("");
    }
    return true;
  };

  useEffect(() => {
    if (!posSession?.branchValue) return;
    loadActiveShift();
    loadBusyPagers();
    loadRecentOrders();
    loadPendingPaymentSessions();
    loadPendingOfflineOrders();
  }, [posSession?.branchValue, selectedBranchUuid]);

  useEffect(() => {
    if (hasLiveProducts || hasLiveBranches) {
      setPosCatalogCache(savePosCatalogCache({ products, categories, branches }));
    }
  }, [hasLiveProducts, hasLiveBranches, products, categories, branches]);

  useEffect(() => {
    const unsubscribe = subscribePosCatalogCache(() => {
      setPosCatalogCache(readPosCatalogCache());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refreshPendingOfflineCount = () => loadPendingOfflineOrders();
    const updateOnline = () => setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine !== false);

    refreshPendingOfflineCount();
    updateOnline();

    const unsubscribeQueue = subscribePosOfflineQueue(refreshPendingOfflineCount);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);

    return () => {
      unsubscribeQueue();
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [selectedBranchUuid]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid || typeof window === "undefined") return undefined;
    let active = true;
    let timer = null;

    const runSync = ({ silent = true } = {}) => {
      if (!active) return;
      syncPendingOfflineOrders({ silent }).catch((error) => {
        if (!silent) {
          setRecentOrdersActionMessage(error?.message || "Không đồng bộ được đơn POS đang chờ.");
          setRecentOrdersActionType("error");
        }
      });
    };

    timer = window.setTimeout(() => runSync({ silent: true }), 900);
    const handleOnline = () => runSync({ silent: false });
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [posSession, selectedBranchUuid, activeShift?.id]);

  useEffect(() => {
    if (!offlineMode || paymentConfirmed || isQrDraftPending) return;
    if (!selectedVoucherId && !toText(pointsInput)) return;
    setSelectedVoucherId("");
    setPointsInput("");
    setCreateError("Đang mất mạng nên POS đã bỏ voucher/điểm loyalty khỏi bill. Bạn vẫn có thể nhận tiền mặt.");
  }, [offlineMode, paymentConfirmed, isQrDraftPending, selectedVoucherId, pointsInput]);

  useEffect(() => {
    if (!activeShift?.id) return;
    loadShiftSummary({ silent: true });
  }, [activeShift?.id]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid) return undefined;

    let active = true;
    let refreshTimer = null;
    let unsubscribeRealtime = () => {};

    subscribePosPaymentSessionsByBranch(selectedBranchUuid, () => {
      if (!active) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadPendingPaymentSessions();
        loadShiftSummary({ silent: true });
      }, 250);
    }).then((unsubscribe) => {
      if (!active) {
        if (typeof unsubscribe === "function") unsubscribe();
        return;
      }
      unsubscribeRealtime = typeof unsubscribe === "function" ? unsubscribe : () => {};
    });

    return () => {
      active = false;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      unsubscribeRealtime();
    };
  }, [posSession, selectedBranchUuid, activeShift?.id]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid || qrDraftOrder || cart.length) return undefined;

    const rememberedSessionId = readRememberedPosPaymentSession(selectedBranchUuid);
    if (!rememberedSessionId) return undefined;

    let active = true;

    const restorePaymentSession = async () => {
      setQrDraftLoading(true);
      try {
        const session = await readPosPaymentSession(rememberedSessionId);
        if (!active || !session) return;

        const status = toText(session.status).toLowerCase();
        const expiresAt = new Date(session.expiresAt || "").getTime();
        if (
          status === "pending_payment" &&
          Number.isFinite(expiresAt) &&
          expiresAt <= Date.now()
        ) {
          await cancelPosPaymentSession(session.id, "Phiên QR hết hạn trước khi POS được mở lại");
          forgetPosPaymentSession(selectedBranchUuid);
          if (active) {
            setCreateError("Phiên QR trước đã hết hạn. Bạn có thể tạo bill mới.");
          }
          return;
        }

        if (["cancelled", "expired", "converted", "failed"].includes(status)) {
          forgetPosPaymentSession(selectedBranchUuid);
          return;
        }

        restorePaymentSessionToComposer(session);
      } catch (error) {
        if (active) {
          setCreateError(error?.message || "Không khôi phục được phiên QR đang chờ.");
        }
      } finally {
        if (active) setQrDraftLoading(false);
      }
    };

    restorePaymentSession();

    return () => {
      active = false;
    };
  }, [posSession, selectedBranchUuid]);

  useEffect(() => {
    if (!toText(customerPhone)) return;
    if (!customerLookup.result?.customerName) return;
    if (toText(customerName)) return;
    setCustomerName(customerLookup.result.customerName);
  }, [customerLookup.result?.customerName, customerName, customerPhone]);

  useEffect(() => {
    const nextGiftItems = promotionHints
      .filter((promotion) => promotion.eligible)
      .map((promotion) => createPosCartItem(promotion.product, {
        quantity: 1,
        unitPrice: 0,
        options: ["Quà tặng tự động"],
        metadata: {
          autoAddedGift: true,
          giftPromotionId: promotion.id
        }
      }));
    syncGiftItems(nextGiftItems);
  }, [promotionHints, syncGiftItems]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid) return undefined;
    if (!hasAndroidPrinterBridge()) {
      setPrintStationLabel("");
      setPrintStationTone("idle");
      return undefined;
    }

    let active = true;
    let cleanup = () => {};

    setPrintStationLabel("Sẵn sàng nhận lệnh");
    setPrintStationTone("ready");
    startPosAutoPrint({
      branchUuid: selectedBranchUuid,
      onPrinted: (job) => {
        if (!active) return;
        setPrintStationLabel(`Đã in ${job?.order_code || "bill"}`);
        setPrintStationTone("ready");
      },
      onFailed: (_job, result) => {
        if (!active) return;
        const message = result?.message || "Không in được bill tự động.";
        setPrintStationLabel("Lỗi in tự động");
        setPrintStationTone("error");
        setCreateError(message);
      }
    }).then((unsubscribe) => {
      if (!active) {
        if (typeof unsubscribe === "function") unsubscribe();
        return;
      }
      cleanup = typeof unsubscribe === "function" ? unsubscribe : () => {};
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [posSession, selectedBranchUuid]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    if (paymentConfirmed.method !== "cash") return;
    if (paymentConfirmed.billKey === billPaymentKey) return;
    setPaymentConfirmed(null);
    setPaymentMethod("");
    setCashReceived("");
    setCreateError("Bill đã thay đổi. Vui lòng xác nhận lại tiền mặt trước khi tạo đơn.");
  }, [billPaymentKey, paymentConfirmed]);

  const continueAddProduct = (product) => {
    if (!product) return;
    setCreateError("");
    if (Array.isArray(product.optionGroups) && product.optionGroups.length) {
      setConfiguringProduct(product);
      return;
    }
    addProduct(product);
  };

  const handleAddProduct = async (product) => {
    if (!requireOpenShift()) return;
    if (isQrDraftPending) {
      const cancelled = await cancelPendingQrDraft({
        silent: true,
        reason: "Nhân viên thêm món làm thay đổi bill trước khi thanh toán"
      });
      if (!cancelled) return;
    }
    if (!hasSelectedPager || selectedPagerIsBusy) {
      setPendingPagerProduct(product);
      setPagerPickerOpen(true);
      setCreateError("");
      return;
    }
    continueAddProduct(product);
  };

  const handleSelectPager = (nextPager) => {
    const pendingProduct = pendingPagerProduct;
    setPagerNumber(nextPager);
    setPagerPickerOpen(false);
    setPendingPagerProduct(null);
    setCreateError("");
    if (pendingProduct) continueAddProduct(pendingProduct);
  };

  const handleSubmitProductOptions = (product, config) => {
    addProduct(product, config);
    setConfiguringProduct(null);
  };

  const handleChangeQuantity = async (cartId, quantity) => {
    if (isQrDraftPending) {
      const cancelled = await cancelPendingQrDraft({
        silent: true,
        reason: "Nhân viên sửa số lượng làm thay đổi bill trước khi thanh toán"
      });
      if (!cancelled) return;
    }
    if (quantity <= 0) {
      removeItem(cartId);
      return;
    }
    updateQuantity(cartId, quantity);
  };

  const handleClearCart = () => {
    if (!isQrDraftPending) {
      resetComposer();
      setCreateError("");
      return;
    }

    setCancelQrConfirmOpen(true);
  };

  const handleConfirmCancelQr = async () => {
    if (cancellingQr) return;
    setCancellingQr(true);

    try {
      const cancelled = await cancelPendingQrDraft({
        silent: false,
        reason: "Hủy đơn QR chờ thanh toán tại POS"
      });
      if (!cancelled) {
        setCancelQrConfirmOpen(false);
        return;
      }

      resetComposer();
      await loadBusyPagers();
      await loadRecentOrders();
      await loadShiftSummary({ silent: true });
    } finally {
      setCancellingQr(false);
    }
  };

  const handleOpenCashPayment = async () => {
    if (!requireOpenShift()) return;
    if (!cart.length) {
      setCreateError("Chưa có món trong bill.");
      return;
    }
    if (offlineMode && usesOfflineLockedBenefit) {
      setCreateError("Đang mất mạng. Vui lòng bỏ voucher/điểm loyalty trước khi nhận tiền mặt.");
      return;
    }
    if (isQrDraftPending) {
      const cancelled = await cancelPendingQrDraft({
        silent: true,
        reason: "Đổi sang tiền mặt trước khi thanh toán"
      });
      if (!cancelled) return;
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi thanh toán.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }
    setPaymentMethod("cash");
    setCreateError("");
    setCashPaymentOpen(true);
  };

  const handleConfirmCash = () => {
    const received = normalizeCashReceived(cashReceived);
    if (received < posTotals.total) return;

    setPaymentConfirmed({
      method: "cash",
      reference: `CASH-${Date.now()}`,
      paidAt: new Date().toISOString(),
      amount: posTotals.total,
      billKey: billPaymentKey,
      meta: {
        received,
        change: calculateCashChange(posTotals.total, received)
      }
    });
    setCashPaymentOpen(false);
  };

  const createQrDraftOrder = async (identity = null) => {
    if (!requireOpenShift()) return { ok: false };
    if (offlineMode) {
      setCreateError("Đang mất mạng. QR chuyển khoản cần mạng để tạo và xác nhận thanh toán.");
      return { ok: false, message: "Đang mất mạng. QR chuyển khoản cần mạng để tạo và xác nhận thanh toán." };
    }
    if (!cart.length) {
      setCreateError("Chưa có món trong bill.");
      return { ok: false };
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi tạo QR thanh toán.");
      return { ok: false };
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return { ok: false };
    }
    if (qrDraftOrder) return { ok: true, order: qrDraftOrder };

    const orderIdentity = identity || createPosOrderIdentity(new Date());
    const selectedVoucher = loyaltyBenefit.selectedVoucher;
    const loyaltyValidation = await validateLiveLoyaltySelection({ selectedVoucher });
    if (!loyaltyValidation.ok) {
      setCreateError(loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.");
      return { ok: false, message: loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại." };
    }
    const paymentReference = buildPosPaymentReference(orderIdentity, selectedBranch);
    const result = await createPosPaymentSession({
      requestKey: `pos:${selectedBranchUuid}:${orderIdentity.orderCode}`,
      paymentReference,
      provider: "sepay",
      source: "pos",
      branchUuid: selectedBranchUuid,
      posShiftId: activeShift?.id,
      branchName: branchLabel,
      cashierName: posSession?.cashierName || "Thu ngân",
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      pagerNumber,
      amountExpected: posTotals.total,
      cart,
      checkout: {
        orderIdentity,
        posShiftId: activeShift?.id,
        shift: activeShift,
        totals: posTotals,
        promoDiscount: loyaltyBenefit.voucherDiscount,
        promoCode: toText(selectedVoucher?.code).toUpperCase(),
        promoSource: toText(selectedVoucher?.source),
        promoVoucherId: toText(selectedVoucher?.id),
        selectedVoucherKey: loyaltyBenefit.selectedVoucherKey,
        promoSelectionKey: loyaltyBenefit.selectedVoucherKey,
        pointsSpent: loyaltyBenefit.pointsSpent,
        pointsDiscountAmount: loyaltyBenefit.pointsDiscount,
        pointRedeemRule: loyaltyBenefit.loyaltyRule
      }
    });

    if (!result.ok) {
      setCreateError(result.message || "Không tạo được đơn chờ thanh toán.");
      return result;
    }

    setQrDraftOrder(result.session);
    rememberPosPaymentSession(selectedBranchUuid, result.session?.id);
    return result;
  };

  const handleOpenQrPayment = async () => {
    if (!requireOpenShift()) return;
    if (offlineMode) {
      setCreateError("Đang mất mạng. Vui lòng nhận tiền mặt hoặc thử lại QR khi có mạng.");
      return;
    }
    if (posTotals.total <= 0) {
      setCreateError("Bill hiện chưa có số tiền để tạo QR thanh toán.");
      return;
    }
    if (isQrDraftPending) {
      setQrPaymentOpen(true);
      return;
    }
    if (!hasSelectedPager) {
      setCreateError("Vui lòng chọn thẻ rung trước khi tạo QR thanh toán.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }

    setPaymentMethod("bank_qr");
    setCreateError("");
    setQrDraftError("");
    setQrPrintMessage("");
    setQrPrintMessageType("");
    const previewIdentity = qrDraftOrder || createPosOrderIdentity(new Date());
    setQrPreviewIdentity(previewIdentity);
    setQrDraftLoading(true);
    const result = await createQrDraftOrder(previewIdentity);
    setQrDraftLoading(false);
    if (!result.ok) {
      setQrDraftError(result.message || "Không tạo được đơn chờ thanh toán.");
      setCreateError(result.message || "Không tạo được đơn chờ thanh toán.");
      return;
    }
    setQrPaymentOpen(true);
  };

  const handlePrintQr = async ({ qrUrl, amount, transferContent, identity }) => {
    setQrPrintLoading(true);
    setQrPrintMessage("");
    setQrPrintMessageType("");

    try {
      const qrPayload = {
        branch: selectedBranch,
        amount,
        qrUrl,
        transferContent,
        orderCode: qrDraftOrder?.displayOrderCode || qrDraftOrder?.orderCode || identity?.displayOrderCode || identity?.orderCode,
        customerName: customerName || customerLookup.result?.customerName || ""
      };
      const result = hasAndroidPrinterBridge()
        ? await printPosQrReceipt(qrPayload, {
          branchName: branchLabel,
          printerName: "Xprinter",
          receiptWidthMm: 80
        })
        : await createPosQrPrintJob(qrPayload, {
        branchUuid: selectedBranchUuid,
        requestedBy: posSession?.cashierName || "POS"
      });

      setQrPrintMessage(result.message || (result.ok ? "Đã in QR." : "Không in được QR."));
      setQrPrintMessageType(result.ok ? "success" : "error");
      return result;
    } catch (error) {
      const message = error?.message || "Không gửi được lệnh in QR.";
      setQrPrintMessage(message);
      setQrPrintMessageType("error");
      return {
        ok: false,
        message
      };
    } finally {
      setQrPrintLoading(false);
    }
  };

  const handleConfirmQrPaid = async () => {
    if (!qrDraftOrder) return;
    if (offlineMode) {
      setCreateError("Đang mất mạng. Không thể xác nhận thanh toán QR lúc này.");
      return;
    }

    setCreatingOrder(true);
    const result = qrDraftOrder.isPaymentSession
      ? await confirmPosPaymentSessionManually(qrDraftOrder.id)
      : { ok: false, message: "Bill QR cũ không còn hỗ trợ xác nhận tay." };
    setCreatingOrder(false);

    if (!result.ok) {
      setCreateError(result.message || "Không xác nhận được thanh toán QR.");
      return;
    }

    setQrDraftOrder(result.session);
  };

  const finalizePaidQrSession = async (session) => {
    if (!session?.isPaymentSession) return false;
    const status = toText(session.status).toLowerCase();
    if (!["paid", "converting", "converted"].includes(status)) return false;
    if (status === "converted" && session.orderId) {
      resetComposer();
      await loadBusyPagers();
      await loadRecentOrders();
      await loadShiftSummary({ silent: true });
      return true;
    }

    const checkout = session.checkoutSnapshot || {};
    const sessionTotals = checkout.totals || posTotals;
    const orderIdentity = session.orderIdentity || checkout.orderIdentity || qrPreviewIdentity;
    const loyaltyValidation = await validateLiveLoyaltySelection({
      phone: session.customerPhone || customerPhone,
      pointsSpent: checkout.pointsSpent || 0,
      selectedVoucher: {
        id: checkout.promoVoucherId,
        code: checkout.promoCode,
        source: checkout.promoSource
      }
    });
    if (!loyaltyValidation.ok) {
      setCreateError(loyaltyValidation.message || "Ưu đãi loyalty không còn hợp lệ để chốt đơn QR.");
      return false;
    }
    setPaymentConfirmed({
      method: "bank_qr",
      reference: session.paymentReference,
      paidAt: session.paidAt || new Date().toISOString(),
      amount: session.amountPaid || session.amountExpected
    });
    setCreatingOrder(true);
    setCreateError("");

    const result = await createPosTakeawayOrder({
      cart: session.cartSnapshot?.length ? session.cartSnapshot : cart,
      totals: sessionTotals,
      pagerNumber: session.pagerNumber || pagerNumber,
      customerName: session.customerName || customerName || customerLookup.result?.customerName || "",
      customerPhone: session.customerPhone || customerPhone,
      branch: selectedBranch,
      cashierName: session.cashierName || posSession?.cashierName || "Thu ngân",
      shift: checkout.shift || activeShift,
      posShiftId: session.posShiftId || checkout.posShiftId || activeShift?.id,
      customerLookup: customerLookup.result,
      promoDiscount: checkout.promoDiscount || 0,
      promoCode: toText(checkout.promoCode).toUpperCase(),
      promoSource: toText(checkout.promoSource),
      promoVoucherId: toText(checkout.promoVoucherId),
      pointsDiscount: checkout.pointsSpent || 0,
      pointsDiscountAmount: checkout.pointsDiscountAmount || 0,
      pointRedeemRule: checkout.pointRedeemRule || loyaltyBenefit.loyaltyRule,
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: session.amountPaid || session.amountExpected,
      paymentReference: session.paymentReference,
      paidAt: session.paidAt || new Date().toISOString(),
      paymentMeta: {
        provider: session.provider || "sepay",
        paymentSessionId: session.id
      },
      orderIdentity,
      status: "pending_zalo",
      kitchenStatus: "pending"
    });

    if (!result.ok) {
      setCreatingOrder(false);
      setCreateError(result.message || "Đã nhận tiền nhưng chưa tạo được đơn. POS sẽ tự thử lại.");
      return false;
    }

    const conversion = await markPosPaymentSessionConverted(
      session.id,
      result.order?.id || result.order?.orderCode
    );
    setCreatingOrder(false);
    if (!conversion.ok) {
      setCreateError(conversion.message || "Đơn đã tạo nhưng chưa chốt được phiên thanh toán.");
      return false;
    }

    const printResult = await printPosBillLocalFirst(result.order);
    if (!printResult.ok) {
      setCreateError(printResult.message || "Đơn đã tạo nhưng chưa in được bill. Vui lòng bấm In lại.");
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
    return true;
  };

  useEffect(() => {
    if (!qrDraftOrder?.id || !qrDraftOrder.isPaymentSession) return undefined;

    let active = true;
    let finalizing = false;
    let pollTimer = null;
    let unsubscribeRealtime = () => {};

    const handlePaymentSession = async (session) => {
      if (!active || finalizing) return;
      if (!session) return;

      setQrDraftOrder(session);
      const status = toText(session.status).toLowerCase();
      const expiresAt = new Date(session.expiresAt || "").getTime();
      if (
        status === "pending_payment" &&
        Number.isFinite(expiresAt) &&
        expiresAt <= Date.now()
      ) {
        await cancelPosPaymentSession(session.id, "Phiên QR hết hạn sau 15 phút");
        if (!active) return;
        setQrDraftOrder(null);
        setQrPreviewIdentity(null);
        setQrPaymentOpen(false);
        setQrDraftError("");
        setCreateError("Mã QR đã hết hạn. Bấm QR chuyển khoản để tạo mã mới.");
        return;
      }
      if (["paid", "converting", "converted"].includes(status)) {
        finalizing = true;
        const completed = await finalizePaidQrSession(session);
        if (!completed) finalizing = false;
      }
    };

    const checkPaymentSession = async () => {
      if (!active || finalizing || document.visibilityState !== "visible") return;
      try {
        const session = await readPosPaymentSession(qrDraftOrder.id);
        await handlePaymentSession(session);
      } catch (error) {
        console.warn("[pos] Không kiểm tra được phiên thanh toán QR.", error);
      }
    };

    subscribePosPaymentSession(qrDraftOrder.id, (session) => {
      handlePaymentSession(session).catch((error) => {
        console.warn("[pos] Không xử lý được cập nhật Realtime của phiên QR.", error);
      });
    }).then((unsubscribe) => {
      if (!active) {
        if (typeof unsubscribe === "function") unsubscribe();
        return;
      }
      unsubscribeRealtime = typeof unsubscribe === "function" ? unsubscribe : () => {};
    });

    checkPaymentSession();
    pollTimer = window.setInterval(checkPaymentSession, 12000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkPaymentSession();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      if (pollTimer) window.clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribeRealtime();
    };
  }, [qrDraftOrder?.id, qrDraftOrder?.isPaymentSession]);

  const handleCreateOrder = async () => {
    if (!requireOpenShift()) return;
    if (creatingOrder || !paymentConfirmed) {
      setCreateError("Vui lòng xác nhận thanh toán trước khi tạo đơn POS.");
      return;
    }
    if (offlineMode && paymentMethod === "bank_qr") {
      setCreateError("Đang mất mạng. Không thể tạo đơn QR lúc này.");
      return;
    }
    if (offlineMode && usesOfflineLockedBenefit) {
      setCreateError("Đang mất mạng. Vui lòng bỏ voucher/điểm loyalty trước khi tạo đơn tiền mặt.");
      return;
    }

    const selectedVoucher = loyaltyBenefit.selectedVoucher;
    const loyaltyValidation = await validateLiveLoyaltySelection({ selectedVoucher });
    if (!loyaltyValidation.ok) {
      setCreateError(loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.");
      return;
    }

    setCreatingOrder(true);
    setCreateError("");
    setRecentOrdersActionMessage("");
    setRecentOrdersActionType("");
    const result = await createPosTakeawayOrder({
      cart,
      totals: posTotals,
      pagerNumber,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      branch: selectedBranch,
      cashierName: posSession?.cashierName || "Thu ngân",
      shift: activeShift,
      posShiftId: activeShift?.id,
      customerLookup: customerLookup.result,
      promoDiscount: loyaltyBenefit.voucherDiscount,
      promoCode: toText(selectedVoucher?.code).toUpperCase(),
      promoSource: toText(selectedVoucher?.source),
      promoVoucherId: toText(selectedVoucher?.id),
      pointsDiscount: loyaltyBenefit.pointsSpent,
      pointsDiscountAmount: loyaltyBenefit.pointsDiscount,
      pointRedeemRule: loyaltyBenefit.loyaltyRule,
      paymentMethod,
      paymentStatus: "paid",
      paymentAmount: posTotals.total,
      paymentReference: paymentConfirmed.reference,
      paidAt: paymentConfirmed.paidAt,
      paymentMeta: paymentConfirmed.meta,
      status: "pending_zalo",
      kitchenStatus: "pending"
    });

    setCreatingOrder(false);
    if (!result.ok) {
      setCreateError(result.message || "Không tạo được đơn POS.");
      return;
    }

    const printResult = await printPosBillLocalFirst(result.order);
    const printSuffix = printResult.skipped
      ? ""
      : printResult.ok
        ? " Đã in bill."
        : ` ${printResult.message || "Không in được bill, vui lòng bấm In lại."}`;

    resetComposer();
    setRecentOrdersActionMessage(`${result.message || "Đã tạo đơn POS."}${printSuffix}`);
    setRecentOrdersActionType(printResult.ok ? "success" : "error");
    await loadBusyPagers();
    await loadRecentOrders();
    await loadShiftSummary({ silent: true });
  };

  const handleCancelRecentOrder = async (order) => {
    const confirmed = window.confirm(`Hủy đơn ${order.displayOrderCode || order.orderCode || order.id}?`);
    if (!confirmed) return;

    const orderId = toText(order.id || order.orderCode);
    setCancellingOrderId(orderId);
    const result = await cancelPosOrderAsync(order, {
      cashierName: posSession?.cashierName || "Thu ngân",
      reason: "Nhân viên hủy trên POS"
    });
    setCancellingOrderId("");

    if (!result.ok) {
      setRecentOrdersError(result.message || "Không hủy được đơn.");
      return;
    }

    await loadBusyPagers();
    await loadRecentOrders();
    await loadShiftSummary({ silent: true });
  };

  const handleRefreshHistory = async () => {
    loadPendingOfflineOrders();
    await Promise.all([
      loadRecentOrders(),
      loadPendingPaymentSessions(),
      loadShiftSummary({ silent: true })
    ]);
  };

  const handleSyncOfflineOrders = async () => {
    if (offlineOrdersSyncing) return;
    setOfflineOrdersSyncing(true);
    setRecentOrdersActionMessage("");
    setRecentOrdersActionType("");

    try {
      const result = await syncPendingOfflineOrders({ silent: false });
      if (!result || result.skipped) {
        setRecentOrdersActionMessage(result?.message || "Thiết bị đang offline, chưa thể đồng bộ đơn POS.");
        setRecentOrdersActionType("error");
      } else if (result.failedCount > 0) {
        setRecentOrdersActionMessage(result.message || "Một số đơn POS chưa đồng bộ được.");
        setRecentOrdersActionType("error");
      } else if (result.syncedCount > 0) {
        setRecentOrdersActionMessage(result.message || `Đã đồng bộ ${result.syncedCount} đơn POS.`);
        setRecentOrdersActionType("success");
      } else {
        setRecentOrdersActionMessage("Không còn đơn POS chờ đồng bộ.");
        setRecentOrdersActionType("success");
      }
    } catch (error) {
      setRecentOrdersActionMessage(error?.message || "Không đồng bộ được đơn POS đang chờ.");
      setRecentOrdersActionType("error");
    } finally {
      setOfflineOrdersSyncing(false);
      loadPendingOfflineOrders();
      await loadRecentOrders();
    }
  };

  const handleTestPrinter = async () => {
    if (printerTesting) return;
    setPrinterTesting(true);
    setPrinterTestMessage("");
    setPrinterTestTone("");

    try {
      const result = await printXprinterTestBill({
        branchName: branchLabel,
        printerName: "Xprinter",
        receiptWidthMm: 80
      });
      setPrinterTestMessage(result.message || (result.ok ? "Đã gửi bill test tới máy in." : "Không in được bill test."));
      setPrinterTestTone(result.ok ? "success" : "error");
    } catch (error) {
      setPrinterTestMessage(error?.message || "Không in được bill test.");
      setPrinterTestTone("error");
    } finally {
      setPrinterTesting(false);
    }
  };

  const handleWorkspaceChange = (workspace) => {
    setActiveWorkspace(workspace);
    if (workspace === "history") {
      handleRefreshHistory();
    }
    if (workspace === "shift") {
      loadShiftSummary();
    }
  };

  const handleRequestCloseShift = async () => {
    setShiftCloseError("");
    if (cart.length || qrDraftOrder || paymentConfirmed) {
      setShiftCloseError("Vui lòng hoàn tất hoặc xóa bill hiện tại trước khi kết ca.");
      setShiftCloseOpen(true);
      return;
    }

    const latestSummary = await loadShiftSummary({ silent: true });
    if ((latestSummary?.pendingQrCount || 0) > 0) {
      setShiftCloseError("Còn phiên QR đang chờ thanh toán. Vui lòng hủy hoặc hoàn tất trước khi kết ca.");
    }
    setShiftCloseOpen(true);
  };

  const handleConfirmCloseShift = async ({
    closingCashCounted = 0,
    closingCashBreakdown = null,
    closingNote = "",
    printReceipt = true
  } = {}) => {
    if (closingShift || !activeShift?.id) return false;

    setClosingShift(true);
    setShiftCloseError("");

    const latestSummary = await loadShiftSummary({ silent: true });
    if ((latestSummary?.pendingQrCount || 0) > 0) {
      setShiftCloseError("Còn phiên QR đang chờ thanh toán. Vui lòng hủy hoặc hoàn tất trước khi kết ca.");
      setClosingShift(false);
      return false;
    }

    const result = await closePosShift({
      shift: activeShift,
      summary: latestSummary || shiftSummary,
      closingCashCounted,
      closingCashBreakdown,
      closingNote
    });
    setClosingShift(false);

    if (!result.ok) {
      setShiftCloseError(result.message || "Không kết được ca POS.");
      return false;
    }

    if (printReceipt) {
      const printResult = await createPosShiftClosePrintJob({
        shift: result.shift || activeShift,
        summary: latestSummary || shiftSummary,
        closingCashCounted,
        closingCashBreakdown,
        closingNote
      }, {
        branchUuid: selectedBranchUuid,
        requestedBy: posSession?.cashierName || "Thu ngân"
      });
      if (!printResult.ok) {
        console.warn("[POS] close shift print job failed", printResult.message);
      }
    }

    clearActivePosShift(selectedBranchUuid, POS_REGISTER_KEY);
    setShiftCloseOpen(false);
    setActiveShift(null);
    setShiftSummary(null);
    setShiftSummaryError("");
    setActiveWorkspace("orders");
    resetComposer();
    await Promise.all([
      loadBusyPagers(),
      loadRecentOrders(),
      loadPendingPaymentSessions()
    ]);
    return true;
  };

  const handleOpenPendingPayment = (session) => {
    const sessionId = toText(session?.id);
    if (!sessionId) return;

    const currentSessionId = toText(qrDraftOrder?.id);
    const isCurrentSession = currentSessionId === sessionId;
    if (currentSessionId && !isCurrentSession) {
      setPendingPaymentsError("Bill hiện tại đang có một phiên QR khác. Hãy hoàn tất hoặc hủy bill đó trước.");
      return;
    }
    if (cart.length && !isCurrentSession) {
      setPendingPaymentsError("Giỏ bán hàng hiện đang có món. Hãy hoàn tất hoặc xóa bill trước khi mở phiên QR khác.");
      return;
    }

    if (!isCurrentSession) {
      restorePaymentSessionToComposer(session);
    }
    setPendingPaymentsError("");
    setActiveWorkspace("orders");
    if (toText(session.status).toLowerCase() === "pending_payment") {
      setQrPaymentOpen(true);
    }
  };

  const handleConfirmCancelPaymentSession = async () => {
    const sessionId = toText(pendingCancelTarget?.id);
    if (!sessionId || cancellingPaymentSessionId) return;

    setCancellingPaymentSessionId(sessionId);
    setPendingPaymentsError("");
    try {
      const result = await cancelPosPaymentSession(
        sessionId,
        "Nhân viên hủy tại màn hình quản lý phiên QR"
      );
      if (!result.ok) {
        setPendingPaymentsError(result.message || "Không hủy được phiên QR.");
        return;
      }

      if (toText(qrDraftOrder?.id) === sessionId) {
        resetComposer();
      } else if (readRememberedPosPaymentSession(selectedBranchUuid) === sessionId) {
        forgetPosPaymentSession(selectedBranchUuid);
      }
      setPendingCancelTarget(null);
      await loadPendingPaymentSessions();
      await loadBusyPagers();
      await loadShiftSummary({ silent: true });
    } finally {
      setCancellingPaymentSessionId("");
    }
  };

  const handleLogout = async () => {
    await clearPosSession();
    if (selectedBranchUuid) clearActivePosShift(selectedBranchUuid, POS_REGISTER_KEY);
    setPosSession(null);
    setActiveShift(null);
    setShiftSummary(null);
    resetComposer({ preserveRememberedSession: true });
    setBusyPagers([]);
  };

  const handleOpenShift = async ({ openingCash = 0, openingCashBreakdown = null, openingNote = "" } = {}) => {
    if (!selectedBranchUuid) return;
    setShiftLoading(true);
    setShiftError("");
    const result = await openPosShift({
      branchUuid: selectedBranchUuid,
      branchName: branchLabel,
      registerKey: POS_REGISTER_KEY,
      cashierName: posSession?.cashierName || "Thu ngân",
      profileId: posSession?.profileId,
      openingCash,
      openingCashBreakdown,
      openingNote
    });
    setShiftLoading(false);

    if (!result.ok) {
      setShiftError(result.message || "Không mở được ca POS.");
      return;
    }

    setActiveShift(result.shift);
    setShiftSummary(null);
    setCreateError("");
    await Promise.all([
      loadBusyPagers(),
      loadRecentOrders(),
      loadPendingPaymentSessions(),
      loadShiftSummary({ silent: true, shift: result.shift })
    ]);
  };

  if (!posSession || !selectedBranch) {
    return <PosLoginScreen branches={effectiveBranches} onLogin={setPosSession} />;
  }

  if (!hasOpenShift) {
    return (
      <main className="pos-page">
        <PosShiftOpenPanel
          branchLabel={branchLabel}
          cashierName={posSession?.cashierName || "Thu ngân"}
          loading={shiftLoading}
          error={shiftError}
          onOpenShift={handleOpenShift}
          onLogout={handleLogout}
        />
      </main>
    );
  }

  return (
    <main className="pos-page">
      <section className="pos-shell">
        <div className={`pos-content-grid ${activeWorkspace === "orders" ? "is-orders" : "is-secondary"}`}>
          {activeWorkspace === "orders" ? (
            <section className="pos-menu-panel">
              <nav className="pos-category-list" aria-label="Danh mục POS">
                {posCategories.map((category) => (
                  <CategoryButton key={category} label={category} active={activeCategory === category} onClick={() => setActiveCategory(category)} />
                ))}
              </nav>
              {usingCachedCatalog ? (
                <div className="pos-catalog-cache-banner">
                  <span>Đang dùng menu đã lưu trên máy</span>
                  <strong>{posCatalogCache.cachedAt ? `Cập nhật ${new Date(posCatalogCache.cachedAt).toLocaleString("vi-VN")}` : "Bản gần nhất"}</strong>
                </div>
              ) : null}
              <div className="pos-pager-toolbar">
                <PosPagerInlinePicker
                  value={pagerNumber}
                  busyPagers={busyPagers}
                  onOpen={() => {
                    setPendingPagerProduct(null);
                    setPagerPickerOpen(true);
                  }}
                />
              </div>
              <div className={`pos-product-grid ${isMenuLocked ? "is-locked" : ""}`}>
                {!hasOpenShift ? (
                  <div className="pos-empty-products">
                    <strong>Chưa mở ca POS</strong>
                    <span>Mở ca để bắt đầu bán hàng.</span>
                  </div>
                ) : null}
                {visibleProducts.length ? visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} disabled={isMenuLocked} onAdd={handleAddProduct} formatMoney={formatMoney} />
                )) : (
                  <div className="pos-empty-products">
                    <strong>Không tìm thấy món phù hợp</strong>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {activeWorkspace === "history" ? (
            <section className="pos-workspace-panel">
              <PosRecentOrdersPanel
                orders={recentOrders}
                paymentSessions={pendingPaymentSessions}
                offlineOrders={pendingOfflineOrders}
                loading={recentOrdersLoading}
                paymentSessionsLoading={pendingPaymentsLoading}
                offlineOrdersSyncing={offlineOrdersSyncing}
                error={recentOrdersError}
                paymentSessionsError={pendingPaymentsError}
                actionMessage={recentOrdersActionMessage}
                actionMessageType={recentOrdersActionType}
                cancellingOrderId={cancellingOrderId}
                reprintingOrderId={reprintingOrderId}
                activePaymentSessionId={qrDraftOrder?.id}
                activeShiftId={activeShift?.id}
                cancellingPaymentSessionId={cancellingPaymentSessionId}
                onRefresh={handleRefreshHistory}
                onCancelOrder={handleCancelRecentOrder}
                onReprintOrder={handleReprintRecentOrder}
                onOpenPaymentSession={handleOpenPendingPayment}
                onCancelPaymentSession={setPendingCancelTarget}
                onSyncOfflineOrders={handleSyncOfflineOrders}
              />
            </section>
          ) : null}

          {activeWorkspace === "shift" ? (
            <section className="pos-workspace-panel">
              <PosShiftOverviewPanel
                cashierName={posSession?.cashierName || "Thu ngân"}
                activeShift={activeShift}
                shiftSummary={shiftSummary}
                shiftSummaryError={shiftSummaryError}
                onRequestCloseShift={handleRequestCloseShift}
              />
            </section>
          ) : null}

          {activeWorkspace === "settings" ? (
            <section className="pos-workspace-panel">
              <PosSettingsPanel
                branchLabel={branchLabel}
                cashierName={posSession?.cashierName || "Thu ngân"}
                online={isOnline}
                printStationLabel={printStationLabel}
                printStationTone={printStationTone}
                pendingOfflineOrderCount={pendingOfflineOrderCount}
                usingCachedCatalog={usingCachedCatalog}
                qrReady={qrPaymentReady}
                printerTesting={printerTesting}
                printerTestMessage={printerTestMessage}
                printerTestTone={printerTestTone}
                onTestPrinter={hasAndroidPrinterBridge() ? handleTestPrinter : undefined}
              />
            </section>
          ) : null}

          {activeWorkspace === "orders" ? (
            <PosCartPanel
              cart={cart}
              totals={posTotals}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerLookup={customerLookup}
              loyaltyBenefit={loyaltyBenefit}
              selectedVoucherId={selectedVoucherId}
              setSelectedVoucherId={setSelectedVoucherId}
              pointsInput={pointsInput}
              setPointsInput={setPointsInput}
              promotionHints={promotionHints}
              paymentMethod={paymentMethod}
              paymentConfirmed={paymentConfirmed}
              qrDraftOrder={qrDraftOrder}
              qrDraftLoading={qrDraftLoading}
              offlineMode={offlineMode}
              draftLocked={draftLocked}
              createError={createError}
              creatingOrder={creatingOrder}
              onOpenCashPayment={handleOpenCashPayment}
              onOpenQrPayment={handleOpenQrPayment}
              onQuantityChange={handleChangeQuantity}
              onRemove={(cartId) => handleChangeQuantity(cartId, 0)}
              onClear={handleClearCart}
              onCreateOrder={handleCreateOrder}
            />
          ) : null}
        </div>

        <PosWorkspaceNav
          activeWorkspace={activeWorkspace}
          pendingCount={workspacePendingCount}
          online={isOnline}
          syncLabel={syncStatusLabel}
          printStationLabel={printStationLabel}
          printStationTone={printStationTone}
          branchLabel={branchLabel}
          onChange={handleWorkspaceChange}
          onLogout={handleLogout}
        />
      </section>

      {configuringProduct ? (
        <ProductOptionsModal product={configuringProduct} onClose={() => setConfiguringProduct(null)} onSubmit={handleSubmitProductOptions} />
      ) : null}

      <PosPagerModal
        open={pagerPickerOpen}
        value={pagerNumber}
        busyPagers={busyPagers}
        onClose={() => {
          setPagerPickerOpen(false);
          setPendingPagerProduct(null);
        }}
        onSelect={handleSelectPager}
      />

      {cashPaymentOpen ? (
        <CashPaymentModal amount={posTotals.total} cashReceived={cashReceived} setCashReceived={setCashReceived} onClose={() => setCashPaymentOpen(false)} onConfirm={handleConfirmCash} />
      ) : null}

      <PosShiftCloseModal
        open={shiftCloseOpen}
        activeShift={activeShift}
        summary={shiftSummary}
        loading={closingShift}
        error={shiftCloseError}
        onClose={() => {
          if (!closingShift) {
            setShiftCloseOpen(false);
            setShiftCloseError("");
          }
        }}
        onConfirm={handleConfirmCloseShift}
      />

      {qrPaymentOpen ? (
        <QrPaymentModal
          branch={selectedBranch}
          amount={qrDraftOrder?.amountExpected || posTotals.total}
          draftOrder={qrDraftOrder}
          previewIdentity={qrPreviewIdentity}
          processing={creatingOrder}
          loading={qrDraftLoading}
          errorMessage={qrDraftError}
          printMessage={qrPrintMessage}
          printMessageType={qrPrintMessageType}
          printingQr={qrPrintLoading}
          canConfirmManually={toText(posSession?.role).toLowerCase() === "admin"}
          onClose={() => {
            setQrPaymentOpen(false);
            setQrPrintMessage("");
            setQrPrintMessageType("");
          }}
          onCancelPending={() => setCancelQrConfirmOpen(true)}
          onConfirmPaid={handleConfirmQrPaid}
          onPrintQr={handlePrintQr}
        />
      ) : null}

      <PosConfirmModal
        open={cancelQrConfirmOpen}
        title="Hủy QR đang chờ?"
        message={`Mã ${qrDraftOrder?.paymentReference || qrDraftOrder?.orderCode || qrDraftOrder?.displayOrderCode || ""}. Chỉ hủy khi khách chưa chuyển khoản.`}
        confirmLabel="Hủy QR"
        cancelLabel="Giữ bill"
        processing={cancellingQr}
        onClose={() => setCancelQrConfirmOpen(false)}
        onConfirm={handleConfirmCancelQr}
      />

      <PosConfirmModal
        open={Boolean(pendingCancelTarget)}
        title="Hủy phiên QR?"
        message={`Mã ${pendingCancelTarget?.paymentReference || ""}. Chỉ hủy khi khách chưa chuyển khoản.`}
        confirmLabel="Hủy phiên"
        cancelLabel="Giữ lại"
        processing={Boolean(cancellingPaymentSessionId)}
        onClose={() => setPendingCancelTarget(null)}
        onConfirm={handleConfirmCancelPaymentSession}
      />
    </main>
  );
}
