import { useEffect, useMemo, useState } from "react";
import PosCartPanel from "../components/pos/PosCartPanel.jsx";
import PosLoginScreen from "../components/pos/PosLoginScreen.jsx";
import { CashPaymentModal, PosConfirmModal, QrPaymentModal } from "../components/pos/PosPaymentModals.jsx";
import ProductOptionsModal from "../components/pos/ProductOptionsModal.jsx";
import { CategoryButton, PosPagerInlinePicker, PosPagerModal, PosWorkspaceNav, ProductCard } from "../components/pos/PosPrimitives.jsx";
import PosRecentOrdersPanel from "../components/pos/PosRecentOrdersPanel.jsx";
import PosShiftOpenPanel from "../components/pos/PosShiftOpenPanel.jsx";
import PosSettingsPanel from "../components/pos/PosSettingsPanel.jsx";
import { formatMoney, getBranchLabel, getBranchUuid } from "../components/pos/posHelpers.js";
import usePosCart from "../hooks/usePosCart.js";
import usePosCatalog from "../hooks/usePosCatalog.js";
import usePosCustomerLookup from "../hooks/usePosCustomerLookup.js";
import { startPosAutoPrint } from "../services/posAutomationService.js";
import { buildPosPaymentReference, calculateCashChange, normalizeCashReceived } from "../services/posPaymentService.js";
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
import { clearActivePosShift, fetchActivePosShift, openPosShift, readActivePosShift } from "../services/posShiftService.js";
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

function buildPosLoyaltyBenefit({ subtotal = 0, customer = null, coupons = [], selectedVoucherId = "", pointsInput = "" }) {
  const loyalty = customer?.loyalty || {};
  const loyaltyRule = customer?.loyaltyRule || {};
  const availablePoints = Math.max(0, Math.floor(toNumber(loyalty.totalPoints || customer?.totalPoints, 0)));
  const redeemPointUnit = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemPointUnit, 1)));
  const redeemValue = Math.max(1, Math.floor(toNumber(loyaltyRule.redeemValue, 1)));
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
  const selectedVoucher = combinedVouchers.find((voucher) => {
    const id = voucher.source ? `${voucher.source}:${toText(voucher.id || voucher.code || voucher.title)}` : toText(voucher.id);
    return id === selectedVoucherId;
  }) || null;
  const voucherDiscount = selectedVoucher ? calculateVoucherDiscount(selectedVoucher, subtotal) : 0;

  const maxPointUnits = Math.floor(availablePoints / redeemPointUnit);
  const maxPointDiscount = Math.min(Math.max(0, subtotal - voucherDiscount), maxPointUnits * redeemValue);
  const typedPoints = Math.max(0, Math.floor(toNumber(String(pointsInput).replace(/[^\d]/g, ""), 0)));
  const normalizedPointUnits = Math.min(maxPointUnits, Math.floor(typedPoints / redeemPointUnit));
  const pointsSpent = normalizedPointUnits * redeemPointUnit;
  const pointsDiscount = Math.min(maxPointDiscount, normalizedPointUnits * redeemValue);

  return {
    subtotal,
    loyaltyRule,
    availablePoints,
    redeemPointUnit,
    redeemValue,
    normalVouchers,
    loyaltyVouchers,
    selectedVoucher,
    voucherDiscount,
    pointsSpent,
    pointsDiscount,
    pointSuggestions: buildPointRoundSuggestions({
      subtotal,
      voucherDiscount,
      availablePoints,
      redeemPointUnit,
      redeemValue
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
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
  const [recentOrdersError, setRecentOrdersError] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [pendingPaymentSessions, setPendingPaymentSessions] = useState([]);
  const [pendingPaymentsLoading, setPendingPaymentsLoading] = useState(false);
  const [pendingPaymentsError, setPendingPaymentsError] = useState("");
  const [pendingCancelTarget, setPendingCancelTarget] = useState(null);
  const [cancellingPaymentSessionId, setCancellingPaymentSessionId] = useState("");
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState("");

  const { activeCategory, setActiveCategory, categories: posCategories, visibleProducts } = usePosCatalog({ products, categories });
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
  const promotionHints = useMemo(
    () => buildPromotionHints(smartPromotions, products, totals.subtotal),
    [products, smartPromotions, totals.subtotal]
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

  const selectedBranch = (Array.isArray(branches) ? branches : []).find((branch, index) => getBranchValue(branch, index) === posSession?.branchValue) || null;
  const branchLabel = selectedBranch ? getBranchLabel(selectedBranch) : posSession?.branchName || "";
  const selectedBranchUuid = selectedBranch ? getBranchUuid(selectedBranch, getBranchValue) : posSession?.branchValue || "";
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
    setSelectedVoucherId(toText(checkout.promoVoucherId));
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
    }

    if (!result.ok && !cachedShift?.id) {
      setShiftError(result.message || "Không tải được ca POS đang mở.");
    }
    if (!silent) setShiftLoading(false);
    return result.shift || null;
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
  }, [posSession?.branchValue, selectedBranchUuid]);

  useEffect(() => {
    if (!posSession || !selectedBranchUuid) return undefined;

    let active = true;
    let refreshTimer = null;
    let unsubscribeRealtime = () => {};

    subscribePosPaymentSessionsByBranch(selectedBranchUuid, () => {
      if (!active) return;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadPendingPaymentSessions, 250);
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
  }, [posSession, selectedBranchUuid]);

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

    let active = true;
    let cleanup = () => {};

    startPosAutoPrint({
      branchUuid: selectedBranchUuid,
      onFailed: (_job, result) => {
        if (active) setCreateError(result?.message || "Không in được bill tự động.");
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

  const handleConfirmQrPaid = async () => {
    if (!qrDraftOrder) return;

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
      return true;
    }

    const checkout = session.checkoutSnapshot || {};
    const sessionTotals = checkout.totals || posTotals;
    const orderIdentity = session.orderIdentity || checkout.orderIdentity || qrPreviewIdentity;
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

    setCreatingOrder(true);
    setCreateError("");
    const selectedVoucher = loyaltyBenefit.selectedVoucher;
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

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
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
  };

  const handleRefreshHistory = async () => {
    await Promise.all([
      loadRecentOrders(),
      loadPendingPaymentSessions()
    ]);
  };

  const handleWorkspaceChange = (workspace) => {
    setActiveWorkspace(workspace);
    if (workspace === "history") {
      handleRefreshHistory();
    }
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
    } finally {
      setCancellingPaymentSessionId("");
    }
  };

  const handleLogout = async () => {
    await clearPosSession();
    if (selectedBranchUuid) clearActivePosShift(selectedBranchUuid, POS_REGISTER_KEY);
    setPosSession(null);
    setActiveShift(null);
    resetComposer({ preserveRememberedSession: true });
    setBusyPagers([]);
  };

  const handleOpenShift = async ({ openingCash = 0, openingNote = "" } = {}) => {
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
      openingNote
    });
    setShiftLoading(false);

    if (!result.ok) {
      setShiftError(result.message || "Không mở được ca POS.");
      return;
    }

    setActiveShift(result.shift);
    setCreateError("");
    await Promise.all([
      loadBusyPagers(),
      loadRecentOrders(),
      loadPendingPaymentSessions()
    ]);
  };

  if (!posSession || !selectedBranch) {
    return <PosLoginScreen branches={branches} onLogin={setPosSession} />;
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
                loading={recentOrdersLoading}
                paymentSessionsLoading={pendingPaymentsLoading}
                error={recentOrdersError}
                paymentSessionsError={pendingPaymentsError}
                cancellingOrderId={cancellingOrderId}
                activePaymentSessionId={qrDraftOrder?.id}
                cancellingPaymentSessionId={cancellingPaymentSessionId}
                onRefresh={handleRefreshHistory}
                onCancelOrder={handleCancelRecentOrder}
                onOpenPaymentSession={handleOpenPendingPayment}
                onCancelPaymentSession={setPendingCancelTarget}
              />
            </section>
          ) : null}

          {activeWorkspace === "settings" ? (
            <section className="pos-workspace-panel">
              <PosSettingsPanel branchLabel={branchLabel} cashierName={posSession?.cashierName || "Thu ngân"} activeShift={activeShift} />
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
          pendingCount={pendingPaymentSessions.length}
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

      {qrPaymentOpen ? (
        <QrPaymentModal
          branch={selectedBranch}
          amount={qrDraftOrder?.amountExpected || posTotals.total}
          draftOrder={qrDraftOrder}
          previewIdentity={qrPreviewIdentity}
          processing={creatingOrder}
          loading={qrDraftLoading}
          errorMessage={qrDraftError}
          canConfirmManually={toText(posSession?.role).toLowerCase() === "admin"}
          onClose={() => setQrPaymentOpen(false)}
          onCancelPending={() => setCancelQrConfirmOpen(true)}
          onConfirmPaid={handleConfirmQrPaid}
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
