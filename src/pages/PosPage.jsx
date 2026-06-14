import { useEffect, useMemo, useState } from "react";
import PosCartPanel from "../components/pos/PosCartPanel.jsx";
import PosLoginScreen from "../components/pos/PosLoginScreen.jsx";
import { CashPaymentModal, QrPaymentModal } from "../components/pos/PosPaymentModals.jsx";
import ProductOptionsModal from "../components/pos/ProductOptionsModal.jsx";
import { CategoryButton, PosPagerInlinePicker, PosSessionBrand, ProductCard, UtilityActionButton } from "../components/pos/PosPrimitives.jsx";
import PosRecentOrdersPanel from "../components/pos/PosRecentOrdersPanel.jsx";
import PosSettingsPanel from "../components/pos/PosSettingsPanel.jsx";
import { formatMoney, getBranchLabel, getBranchUuid } from "../components/pos/posHelpers.js";
import usePosCart from "../hooks/usePosCart.js";
import usePosCatalog from "../hooks/usePosCatalog.js";
import usePosCustomerLookup from "../hooks/usePosCustomerLookup.js";
import { startPosAutoPrint, subscribePosDraftOrderRealtime } from "../services/posAutomationService.js";
import { buildPosPaymentReference, calculateCashChange, normalizeCashReceived } from "../services/posPaymentService.js";
import { clearPosSession, getBranchValue, readPosSession } from "../services/posSessionService.js";
import {
  cancelPosOrderAsync,
  createPosCartItem,
  createPosOrderIdentity,
  createPosTakeawayOrder,
  getBusyPosPagerNumbersAsync,
  getPosRecentOrdersAsync,
  markPosQrOrderPaidAsync
} from "../services/posService.js";
import "../styles/pos.css";

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

  return suggestions.slice(0, 4);
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
  const [busyPagers, setBusyPagers] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [createError, setCreateError] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [configuringProduct, setConfiguringProduct] = useState(null);
  const [cashPaymentOpen, setCashPaymentOpen] = useState(false);
  const [qrPaymentOpen, setQrPaymentOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
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

  const { activeCategory, setActiveCategory, categories: posCategories, visibleProducts } = usePosCatalog({ products, categories });
  const { cart, totals, addProduct, updateQuantity, removeItem, syncGiftItems, clearCart } = usePosCart();
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

  const selectedBranch = (Array.isArray(branches) ? branches : []).find((branch, index) => getBranchValue(branch, index) === posSession?.branchValue) || null;
  const branchLabel = selectedBranch ? getBranchLabel(selectedBranch) : posSession?.branchName || "";
  const selectedBranchUuid = selectedBranch ? getBranchUuid(selectedBranch, getBranchValue) : posSession?.branchValue || "";
  const hasSelectedPager = Boolean(pagerNumber.trim());
  const selectedPagerIsBusy = hasSelectedPager &&
    busyPagers.map(normalizePagerNumber).includes(normalizePagerNumber(pagerNumber)) &&
    !qrDraftOrder;
  const draftLocked = Boolean(qrDraftOrder && !paymentConfirmed);
  const isMenuLocked = !hasSelectedPager || selectedPagerIsBusy || draftLocked;

  const resetComposer = () => {
    setPagerNumber("");
    setCustomerName("");
    setCustomerPhone("");
    setCashReceived("");
    setPaymentMethod("cash");
    setPaymentConfirmed(null);
    setQrDraftOrder(null);
    setQrPreviewIdentity(null);
    setQrDraftLoading(false);
    setQrDraftError("");
    setSelectedVoucherId("");
    setPointsInput("");
    setCashPaymentOpen(false);
    setQrPaymentOpen(false);
    clearCart();
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

  useEffect(() => {
    if (!posSession?.branchValue) return;
    loadBusyPagers();
    loadRecentOrders();
  }, [posSession?.branchValue]);

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
    if (!qrDraftOrder?.id || paymentConfirmed) return undefined;

    let active = true;
    let cleanup = () => {};

    subscribePosDraftOrderRealtime(qrDraftOrder.id, async (updatedOrder) => {
      if (!active) return;
      if (toText(updatedOrder.paymentStatus).toLowerCase() !== "paid") return;

      resetComposer();
      await loadBusyPagers();
      await loadRecentOrders();
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
  }, [paymentConfirmed, qrDraftOrder?.id]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    if (paymentConfirmed.method !== "cash") return;
    if (paymentConfirmed.amount === posTotals.total) return;
    setPaymentConfirmed(null);
  }, [paymentConfirmed, posTotals.total]);

  const handleAddProduct = (product) => {
    if (!hasSelectedPager) {
      setCreateError("Nhân viên cần chọn thẻ rung trước khi thêm món.");
      return;
    }
    if (selectedPagerIsBusy) {
      setCreateError(`Thẻ rung ${pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.`);
      return;
    }
    if (draftLocked) {
      setCreateError("Đơn QR đang chờ thanh toán. Vui lòng chờ xác nhận hoặc hủy bill trước.");
      return;
    }
    setCreateError("");
    if (Array.isArray(product.optionGroups) && product.optionGroups.length) {
      setConfiguringProduct(product);
      return;
    }
    addProduct(product);
  };

  const handleSubmitProductOptions = (product, config) => {
    addProduct(product, config);
    setConfiguringProduct(null);
  };

  const handleChangeQuantity = (cartId, quantity) => {
    if (quantity <= 0) {
      removeItem(cartId);
      return;
    }
    updateQuantity(cartId, quantity);
  };

  const handleClearCart = async () => {
    if (!qrDraftOrder) {
      resetComposer();
      setCreateError("");
      return;
    }

    const confirmed = window.confirm(`Hủy đơn chờ thanh toán ${qrDraftOrder.displayOrderCode || qrDraftOrder.orderCode || qrDraftOrder.id}?`);
    if (!confirmed) return;

    const result = await cancelPosOrderAsync(qrDraftOrder, {
      cashierName: posSession?.cashierName || "Thu ngân",
      reason: "Hủy đơn QR chờ thanh toán tại POS"
    });

    if (!result.ok) {
      setCreateError(result.message || "Không hủy được đơn chờ thanh toán.");
      return;
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleOpenCashPayment = () => {
    if (!cart.length) {
      setCreateError("Chưa có món trong bill.");
      return;
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
      meta: {
        received,
        change: calculateCashChange(posTotals.total, received)
      }
    });
    setCashPaymentOpen(false);
  };

  const createQrDraftOrder = async (identity = null) => {
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
    const result = await createPosTakeawayOrder({
      cart,
      totals: posTotals,
      pagerNumber,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      branch: selectedBranch,
      cashierName: posSession?.cashierName || "Thu ngân",
      customerLookup: customerLookup.result,
      promoDiscount: loyaltyBenefit.voucherDiscount,
      promoCode: toText(selectedVoucher?.code).toUpperCase(),
      promoSource: toText(selectedVoucher?.source),
      promoVoucherId: toText(selectedVoucher?.id),
      pointsDiscount: loyaltyBenefit.pointsSpent,
      pointsDiscountAmount: loyaltyBenefit.pointsDiscount,
      pointRedeemRule: loyaltyBenefit.loyaltyRule,
      paymentMethod: "bank_qr",
      paymentStatus: "pending",
      paymentAmount: posTotals.total,
      paymentReference: buildPosPaymentReference(orderIdentity, selectedBranch),
      orderIdentity,
      status: "pending_payment",
      kitchenStatus: "pending"
    });

    if (!result.ok) {
      setCreateError(result.message || "Không tạo được đơn chờ thanh toán.");
      return result;
    }

    setQrDraftOrder(result.order);
    await loadBusyPagers();
    return result;
  };

  const handleOpenQrPayment = async () => {
    if (posTotals.total <= 0) {
      setCreateError("Bill hiện chưa có số tiền để tạo QR thanh toán.");
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
    const result = await markPosQrOrderPaidAsync(qrDraftOrder, {
      cashierName: posSession?.cashierName || "Thu ngân",
      paymentReference: buildPosPaymentReference(qrDraftOrder, selectedBranch),
      paymentAmount: posTotals.total,
      paidAt: new Date().toISOString()
    });
    setCreatingOrder(false);

    if (!result.ok) {
      setCreateError(result.message || "Không xác nhận được thanh toán QR.");
      return;
    }

    resetComposer();
    await loadBusyPagers();
    await loadRecentOrders();
  };

  const handleCreateOrder = async () => {
    if (creatingOrder || (paymentMethod === "bank_qr" && !paymentConfirmed)) {
      setCreateError("Vui lòng xác nhận thanh toán trước khi tạo đơn POS.");
      return;
    }

    setCreatingOrder(true);
    setCreateError("");
    const effectivePaymentConfirmed = paymentConfirmed || {
      method: "cash",
      reference: `CASH-${Date.now()}`,
      paidAt: new Date().toISOString(),
      amount: posTotals.total,
      meta: {
        received: posTotals.total,
        change: 0
      }
    };
    const selectedVoucher = loyaltyBenefit.selectedVoucher;
    const result = await createPosTakeawayOrder({
      cart,
      totals: posTotals,
      pagerNumber,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone,
      branch: selectedBranch,
      cashierName: posSession?.cashierName || "Thu ngân",
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
      paymentReference: effectivePaymentConfirmed.reference,
      paidAt: effectivePaymentConfirmed.paidAt,
      paymentMeta: effectivePaymentConfirmed.meta,
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

  const handleLogout = async () => {
    await clearPosSession();
    setPosSession(null);
    resetComposer();
    setBusyPagers([]);
  };

  if (!posSession || !selectedBranch) {
    return <PosLoginScreen branches={branches} onLogin={setPosSession} />;
  }

  return (
    <main className="pos-page">
      <section className="pos-shell">
        <div className={`pos-content-grid ${activeWorkspace === "orders" ? "is-orders" : "is-secondary"}`}>
          {activeWorkspace === "orders" ? (
            <section className="pos-menu-panel">
              <div className="pos-menu-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Lịch sử" onClick={() => setActiveWorkspace("history")} />
                  <UtilityActionButton label="Thiết lập" onClick={() => setActiveWorkspace("settings")} />
                  <UtilityActionButton label="Đổi ca" tone="danger" onClick={handleLogout} />
                </div>
              </div>
              <nav className="pos-category-list" aria-label="Danh mục POS">
                {posCategories.map((category) => (
                  <CategoryButton key={category} label={category} active={activeCategory === category} onClick={() => setActiveCategory(category)} />
                ))}
              </nav>
              <div className={`pos-product-grid ${isMenuLocked ? "is-locked" : ""}`}>
                {!hasSelectedPager ? (
                  <div className="pos-grid-lock-notice">
                    <strong>Nhân viên cần chọn thẻ rung trước khi thêm món</strong>
                  </div>
                ) : selectedPagerIsBusy ? (
                  <div className="pos-grid-lock-notice">
                    <strong>Thẻ rung {pagerNumber} đang có đơn chưa hoàn thành. Vui lòng chọn thẻ khác.</strong>
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
              <div className="pos-menu-footer">
                <PosPagerInlinePicker value={pagerNumber} busyPagers={busyPagers} onSelect={setPagerNumber} />
              </div>
            </section>
          ) : null}

          {activeWorkspace === "history" ? (
            <section className="pos-workspace-panel">
              <div className="pos-workspace-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Bán hàng" onClick={() => setActiveWorkspace("orders")} />
                  <UtilityActionButton label="Thiết lập" onClick={() => setActiveWorkspace("settings")} />
                </div>
              </div>
              <PosRecentOrdersPanel
                orders={recentOrders}
                loading={recentOrdersLoading}
                error={recentOrdersError}
                cancellingOrderId={cancellingOrderId}
                onRefresh={loadRecentOrders}
                onCancelOrder={handleCancelRecentOrder}
              />
            </section>
          ) : null}

          {activeWorkspace === "settings" ? (
            <section className="pos-workspace-panel">
              <div className="pos-workspace-toolbar">
                <PosSessionBrand branchLabel={branchLabel} />
                <div className="pos-utility-actions">
                  <UtilityActionButton label="Bán hàng" onClick={() => setActiveWorkspace("orders")} />
                  <UtilityActionButton label="Lịch sử" onClick={() => setActiveWorkspace("history")} />
                </div>
              </div>
              <PosSettingsPanel branchLabel={branchLabel} cashierName={posSession?.cashierName || "Thu ngân"} />
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
              onRemove={removeItem}
              onClear={handleClearCart}
              onCreateOrder={handleCreateOrder}
            />
          ) : null}
        </div>
      </section>

      {configuringProduct ? (
        <ProductOptionsModal product={configuringProduct} onClose={() => setConfiguringProduct(null)} onSubmit={handleSubmitProductOptions} />
      ) : null}

      {cashPaymentOpen ? (
        <CashPaymentModal amount={posTotals.total} cashReceived={cashReceived} setCashReceived={setCashReceived} onClose={() => setCashPaymentOpen(false)} onConfirm={handleConfirmCash} />
      ) : null}

      {qrPaymentOpen ? (
        <QrPaymentModal
          branch={selectedBranch}
          amount={posTotals.total}
          draftOrder={qrDraftOrder}
          previewIdentity={qrPreviewIdentity}
          processing={creatingOrder}
          loading={qrDraftLoading}
          errorMessage={qrDraftError}
          onClose={() => setQrPaymentOpen(false)}
          onConfirmPaid={handleConfirmQrPaid}
        />
      ) : null}
    </main>
  );
}
