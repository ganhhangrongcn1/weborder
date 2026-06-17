import { useEffect, useMemo, useState } from "react";

import {
  restorePosSession,
  signInPosOperator,
  signOutPosOperator
} from "../../../services/auth/posAuthService";
import { lookupPosCustomerByPhone, normalizeCustomerPhone } from "../../../services/pos/posCustomerService";
import { createPosTakeawayOrderMobile } from "../../../services/pos/posOrderService";
import {
  buildPosCustomerBillText,
  buildPosQrReceiptText,
  buildPosShiftCloseReceiptText,
  printLocalReceipt
} from "../../../services/pos/posPrinterService";
import {
  cancelPosOrder,
  getBusyPosPagerNumbers,
  getPosRecentOrders,
  normalizePagerNumber,
  readPosOrderDetail,
  readPosOrderForPrint
} from "../../../services/pos/posOrderQueryService";
import { buildPosPaymentReference } from "../../../services/pos/posPaymentService";
import {
  cancelPosPaymentSession,
  confirmPosPaymentSessionManually,
  createPosPaymentSession,
  forgetPosPaymentSession,
  isPosPaymentSessionExpired,
  isPosPaymentSessionPaid,
  isPosPaymentSessionTerminal,
  listPosPaymentSessions,
  markPosPaymentSessionConverted,
  readRememberedPosPaymentSession,
  readPosPaymentSession,
  rememberPosPaymentSession
} from "../../../services/pos/posPaymentSessionService";
import { fetchPosCatalogConfig } from "../../../services/pos/posCatalogConfigService";
import { fetchPosProducts } from "../../../services/pos/posProductService";
import { closePosShift, fetchActivePosShift, fetchPosShiftSummary, openPosShift } from "../../../services/pos/posShiftService";
import { createPosOrderIdentity } from "../../../shared/pos/posOrderIdentity";
import { ALL_CATEGORY, buildPosCatalog, filterPosProducts } from "../../../shared/pos/posCatalog";
import {
  calculatePosCartTotals,
  createPosCartItem,
  updatePosCartItemConfig,
  updatePosCartItemQuantity
} from "../../../shared/pos/posCart";
import { buildPosLoyaltyBenefit, buildVoucherSelectionKey } from "../../../shared/pos/posLoyalty";
import { calculateCashChange, normalizeCashReceived } from "../../../shared/pos/posPayment";
import { buildPosPromotionHints, syncAutoGiftItems } from "../../../shared/pos/posPromotions";

export default function usePosComposer() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [shift, setShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftSummaryError, setShiftSummaryError] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [menuMessage, setMenuMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pagerNumber, setPagerNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLookup, setCustomerLookup] = useState({
    loading: false,
    result: null,
    error: ""
  });
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [pointsInput, setPointsInput] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [rawProducts, setRawProducts] = useState([]);
  const [rawCoupons, setRawCoupons] = useState([]);
  const [rawSmartPromotions, setRawSmartPromotions] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(null);
  const [busyPagers, setBusyPagers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pendingPaymentSessions, setPendingPaymentSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [qrSession, setQrSession] = useState(null);
  const [qrPreviewIdentity, setQrPreviewIdentity] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrPrintBusy, setQrPrintBusy] = useState(false);

  const catalog = useMemo(
    () => buildPosCatalog({ products: rawProducts }),
    [rawProducts]
  );

  const defaultCategory = useMemo(
    () => catalog.categories.find((category) => category !== ALL_CATEGORY) || ALL_CATEGORY,
    [catalog.categories]
  );

  const effectiveCategory = catalog.categories.includes(activeCategory) ? activeCategory : defaultCategory;

  const visibleProducts = useMemo(
    () => filterPosProducts(catalog.products, { category: effectiveCategory }),
    [catalog.products, effectiveCategory]
  );

  const baseTotals = useMemo(() => calculatePosCartTotals(cart), [cart]);
  const loyaltyBenefit = useMemo(
    () => buildPosLoyaltyBenefit({
      subtotal: baseTotals.subtotal,
      customer: customerLookup.result,
      coupons: rawCoupons,
      selectedVoucherId,
      pointsInput
    }),
    [baseTotals.subtotal, customerLookup.result, pointsInput, rawCoupons, selectedVoucherId]
  );
  const totals = useMemo(() => ({
    ...baseTotals,
    voucherDiscount: loyaltyBenefit.voucherDiscount,
    pointsDiscount: loyaltyBenefit.pointsDiscount,
    total: Math.max(0, baseTotals.subtotal - loyaltyBenefit.voucherDiscount - loyaltyBenefit.pointsDiscount)
  }), [baseTotals, loyaltyBenefit.pointsDiscount, loyaltyBenefit.voucherDiscount]);

  const normalizedPager = useMemo(() => normalizePagerNumber(pagerNumber), [pagerNumber]);
  const pagerBusy = Boolean(normalizedPager && busyPagers.includes(normalizedPager));
  const branch = profile?.branch || {
    branchUuid: profile?.branchUuid,
    name: profile?.branchName
  };
  const promotionHints = useMemo(
    () => buildPosPromotionHints({
      smartPromotions: rawSmartPromotions,
      products: catalog.products,
      subtotal: baseTotals.subtotal
    }),
    [baseTotals.subtotal, catalog.products, rawSmartPromotions]
  );

  const cleanupExpiredPaymentSessions = async (branchUuid = "", sessions = []) => {
    const safeBranchUuid = String(branchUuid || "").trim();
    const currentSessions = Array.isArray(sessions) ? sessions : [];
    const expiredSessions = currentSessions.filter((session) => isPosPaymentSessionExpired(session));

    if (safeBranchUuid && expiredSessions.length) {
      await Promise.allSettled(
        expiredSessions.map((session) =>
          cancelPosPaymentSession(session.id, "POS mobile tự đóng phiên QR hết hạn")
        )
      );
      const rememberedSessionId = await readRememberedPosPaymentSession(safeBranchUuid);
      if (rememberedSessionId && expiredSessions.some((session) => session.id === rememberedSessionId)) {
        await forgetPosPaymentSession(safeBranchUuid);
      }
    }

    return currentSessions.filter((session) => !isPosPaymentSessionTerminal(session));
  };

  const refreshPosRuntime = async (branchUuid = "", { includeRecentOrders = true } = {}) => {
    if (!branchUuid) return;
    if (includeRecentOrders) {
      setHistoryLoading(true);
      setHistoryError("");
    }
    try {
      const [nextBusyPagers, nextRecentOrders, nextPaymentSessions] = await Promise.all([
        getBusyPosPagerNumbers({ branchUuid }),
        includeRecentOrders ? getPosRecentOrders({ branchUuid, limit: 8 }) : Promise.resolve(null),
        listPosPaymentSessions(branchUuid).catch((error) => {
          setHistoryError(error?.message || "Không tải được phiên QR đang chờ.");
          return [];
        })
      ]);
      const activePaymentSessions = await cleanupExpiredPaymentSessions(branchUuid, nextPaymentSessions);
      setBusyPagers(nextBusyPagers);
      if (includeRecentOrders && Array.isArray(nextRecentOrders)) {
        setRecentOrders(nextRecentOrders);
      }
      setPendingPaymentSessions(activePaymentSessions);
    } catch (error) {
      setHistoryError(error?.message || "Không tải được lịch sử POS.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshShiftSummary = async (targetShift = shift) => {
    if (!targetShift?.id) {
      setShiftSummary(null);
      setShiftSummaryError("");
      return null;
    }

    const result = await fetchPosShiftSummary({
      shiftId: targetShift.id,
      openingCash: targetShift.openingCash
    });

    if (result.ok) {
      setShiftSummary(result.summary);
      setShiftSummaryError("");
      return result.summary;
    }

    setShiftSummary(result.summary || null);
    setShiftSummaryError(result.message || "Không tải được tổng quan ca POS.");
    return result.summary || null;
  };

  const applyPaymentSessionState = (session) => {
    if (!session?.id) return;
    setQrSession(session);
    setQrPreviewIdentity(session.orderIdentity || null);
    if (Array.isArray(session.cartSnapshot) && session.cartSnapshot.length) {
      setCart(session.cartSnapshot);
    }
    if (session.pagerNumber) setPagerNumber(session.pagerNumber);
    if (session.customerName) setCustomerName(session.customerName);
    if (session.customerPhone) setCustomerPhone(session.customerPhone);
    if (session.checkoutSnapshot?.selectedVoucherKey) {
      setSelectedVoucherId(session.checkoutSnapshot.selectedVoucherKey);
    }
    if (session.checkoutSnapshot?.pointsDiscount) {
      setPointsInput(String(session.checkoutSnapshot.pointsDiscount));
    }

    if (isPosPaymentSessionPaid(session)) {
      setPaymentConfirmed({
        method: "bank_qr",
        reference: session.paymentReference,
        paidAt: session.paidAt || new Date().toISOString(),
        amount: session.amountPaid || session.amountExpected,
        paymentSessionId: session.id,
        orderIdentity: session.orderIdentity
      });
      setShiftMessage("Đã nhận thanh toán QR. Bấm Tạo đơn để chốt bill.");
      return false;
    }

    setPaymentConfirmed(null);
    setShiftMessage("Đã khôi phục QR đang chờ thanh toán.");
  };

  const finalizePaidQrSession = async (session) => {
    if (!session?.id || !session?.isPaymentSession) return false;

    const checkout = session.checkoutSnapshot || {};
    const sessionTotals = checkout.totals || totals;
    const sessionCustomer = checkout.customerLookup || customerLookup.result;
    const qrPaymentConfirmed = {
      method: "bank_qr",
      reference: session.paymentReference,
      paidAt: session.paidAt || new Date().toISOString(),
      amount: session.amountPaid || session.amountExpected,
      paymentSessionId: session.id,
      orderIdentity: session.orderIdentity || checkout.orderIdentity || null
    };

    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) {
      setPaymentConfirmed(qrPaymentConfirmed);
      setShiftMessage(loyaltyValidation.message || "Ưu đãi loyalty không còn hợp lệ để chốt đơn QR.");
      return false;
    }

    setBusy(true);
    setQrError("");
    setShiftMessage("Đã nhận thanh toán QR, đang chốt đơn...");
    const result = await createPosTakeawayOrderMobile({
      cart: Array.isArray(session.cartSnapshot) && session.cartSnapshot.length ? session.cartSnapshot : cart,
      totals: sessionTotals,
      pagerNumber: session.pagerNumber || normalizedPager,
      customerName: session.customerName || customerName || customerLookup.result?.customerName || "",
      customerPhone: normalizeCustomerPhone(session.customerPhone || customerPhone),
      branch: {
        branchUuid: profile.branchUuid,
        branchName: profile.branchName
      },
      orderNote,
      shift: checkout.shift || shift,
      cashierName: session.cashierName || profile.name || profile.email,
      customerLookup: loyaltyValidation.customer || sessionCustomer,
      promoDiscount: checkout.promoDiscount || loyaltyBenefit.voucherDiscount,
      promoCode: String(checkout.promoCode || loyaltyBenefit.selectedVoucher?.code || "").trim().toUpperCase(),
      promoSource: String(checkout.promoSource || loyaltyBenefit.selectedVoucher?.source || ""),
      promoVoucherId: String(checkout.promoVoucherId || loyaltyBenefit.selectedVoucher?.id || "").trim(),
      pointsDiscount: checkout.pointsDiscount || checkout.pointsSpent || loyaltyBenefit.pointsSpent,
      pointsDiscountAmount: checkout.pointsDiscountAmount || loyaltyBenefit.pointsDiscount,
      pointRedeemRule: checkout.pointRedeemRule || loyaltyBenefit.loyaltyRule,
      paymentMethod: "bank_qr",
      paymentStatus: "paid",
      paymentAmount: session.amountPaid || session.amountExpected,
      paymentReference: session.paymentReference,
      paidAt: session.paidAt || new Date().toISOString(),
      posShiftId: session.posShiftId || checkout.posShiftId || shift?.id,
      paymentMeta: {
        provider: session.provider || "sepay",
        paymentSessionId: session.id
      },
      orderIdentity: session.orderIdentity || checkout.orderIdentity || null
    });
    setBusy(false);

    if (!result.ok) {
      setPaymentConfirmed(qrPaymentConfirmed);
      setQrError(result.message || "Đã nhận tiền nhưng chưa tạo được đơn.");
      setShiftMessage(result.message || "Đã nhận tiền nhưng chưa tạo được đơn.");
      return false;
    }

    let printMessage = "";
    try {
      const receiptText = buildPosCustomerBillText({
        order: result.order,
        cart: Array.isArray(session.cartSnapshot) && session.cartSnapshot.length ? session.cartSnapshot : cart,
        totals: sessionTotals,
        customerName: session.customerName || customerName || customerLookup.result?.customerName || "",
        customerPhone: normalizeCustomerPhone(session.customerPhone || customerPhone),
        pagerNumber: session.pagerNumber || normalizedPager,
        branchName: profile.branchName,
        cashierName: session.cashierName || profile.name || profile.email,
        orderNote,
        paymentConfirmed: qrPaymentConfirmed
      });
      await printLocalReceipt({
        text: receiptText,
        sourceType: "customer_bill"
      });
      printMessage = " Da in bill tai may POS.";
    } catch (printError) {
      printMessage = ` Da tao don nhung chua in duoc bill: ${printError?.message || "Loi may in."}`;
    }

    await markPosPaymentSessionConverted(
      session.id,
      result.order?.id || result.order?.orderCode
    );

    setCart([]);
    setPaymentConfirmed(null);
    setOrderNote("");
    setCustomerName("");
    setCustomerPhone("");
    setSelectedVoucherId("");
    setPointsInput("");
    setPagerNumber("");
    await forgetPosPaymentSession(profile.branchUuid);
    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrModalOpen(false);
    await refreshPosRuntime(profile.branchUuid);
    await refreshShiftSummary(shift);
    setShiftMessage(`${result.message || ""}${printMessage}`.trim());
    return true;
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const [productResult, catalogConfigResult] = await Promise.all([
        fetchPosProducts(),
        fetchPosCatalogConfig()
      ]);
      if (active) {
        if (productResult.ok) {
          setRawProducts(productResult.products);
          setMenuMessage(productResult.message || "");
          if (catalogConfigResult.ok) {
            setRawCoupons(Array.isArray(catalogConfigResult.coupons) ? catalogConfigResult.coupons : []);
            setRawSmartPromotions(Array.isArray(catalogConfigResult.smartPromotions) ? catalogConfigResult.smartPromotions : []);
            if (catalogConfigResult.message) {
              setMenuMessage(catalogConfigResult.message);
            }
          }
        } else {
          setMenuMessage(productResult.message || "Không tải được menu POS.");
          if (catalogConfigResult.ok) {
            setRawCoupons(Array.isArray(catalogConfigResult.coupons) ? catalogConfigResult.coupons : []);
            setRawSmartPromotions(Array.isArray(catalogConfigResult.smartPromotions) ? catalogConfigResult.smartPromotions : []);
          } else {
            setMenuMessage(catalogConfigResult.message || productResult.message || "Không tải được dữ liệu POS.");
          }
        }
      }

      const restored = await restorePosSession();
      if (!active || !restored.ok) {
        return;
      }

      setSession(restored.session);
      setProfile(restored.profile);

      const shiftResult = await fetchActivePosShift({
        branchUuid: restored.profile.branchUuid
      });
      if (active && shiftResult.ok) {
        setShift(shiftResult.shift);
        await refreshShiftSummary(shiftResult.shift);
      }
      await refreshPosRuntime(restored.profile.branchUuid);

      const rememberedSessionId = await readRememberedPosPaymentSession(restored.profile.branchUuid);
      if (!active || !rememberedSessionId) return;

      try {
        const rememberedSession = await readPosPaymentSession(rememberedSessionId);
        if (!active || !rememberedSession?.id) return;
        if (isPosPaymentSessionExpired(rememberedSession)) {
          await cancelPosPaymentSession(rememberedSession.id, "POS mobile đóng phiên QR đã hết hạn khi khôi phục");
          await forgetPosPaymentSession(restored.profile.branchUuid);
          if (active) {
            setShiftMessage("Phiên QR trước đã hết hạn. Bạn có thể tạo lại bill mới.");
          }
          return;
        }
        if (isPosPaymentSessionTerminal(rememberedSession)) {
          await forgetPosPaymentSession(restored.profile.branchUuid);
          return;
        }
        applyPaymentSessionState(rememberedSession);
        setQrModalOpen(true);
      } catch (error) {
        await forgetPosPaymentSession(restored.profile.branchUuid);
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const phoneKey = normalizeCustomerPhone(customerPhone);
    if (!phoneKey) {
      setCustomerLookup({
        loading: false,
        result: null,
        error: customerPhone.trim().length >= 8 ? "Số điện thoại chưa hợp lệ." : ""
      });
      return undefined;
    }

    let alive = true;
    const timer = globalThis.setTimeout(() => {
      setCustomerLookup((current) => ({ ...current, loading: true, error: "" }));
      lookupPosCustomerByPhone(phoneKey)
        .then((result) => {
          if (!alive) return;
          setCustomerLookup({ loading: false, result, error: "" });
        })
        .catch((error) => {
          if (!alive) return;
          setCustomerLookup({
            loading: false,
            result: null,
            error: error?.message || "Không tra được thông tin khách."
          });
        });
    }, 350);

    return () => {
      alive = false;
      globalThis.clearTimeout(timer);
    };
  }, [customerPhone]);

  useEffect(() => {
    if (!customerPhone) return;
    if (!customerLookup.result?.customerName) return;
    if (customerName.trim()) return;
    setCustomerName(customerLookup.result.customerName);
  }, [customerLookup.result?.customerName, customerName, customerPhone]);

  useEffect(() => {
    if (!selectedVoucherId) return;
    const voucherExists = loyaltyBenefit.availableVouchers.some(
      (voucher) => buildVoucherSelectionKey(voucher) === selectedVoucherId
    );
    if (!voucherExists) {
      setSelectedVoucherId("");
    }
  }, [loyaltyBenefit.availableVouchers, selectedVoucherId]);

  useEffect(() => {
    setCart((current) => syncAutoGiftItems(current, promotionHints));
  }, [promotionHints]);

  useEffect(() => {
    if (!paymentConfirmed) return;
    setPaymentConfirmed(null);
    setShiftMessage("Bill vừa đổi tổng tiền. Vui lòng xác nhận thanh toán lại.");
  }, [totals.total]);

  useEffect(() => {
    if (!qrSession?.id || !qrSession.isPaymentSession) return undefined;

    let active = true;
    let finalizing = false;
    const handleSession = async (session) => {
      if (!active || !session || finalizing) return;
      if (isPosPaymentSessionExpired(session)) {
        await cancelPosPaymentSession(session.id, "POS mobile tự đóng QR đã hết hạn");
        if (!active) return;
        setQrSession(null);
        setQrPreviewIdentity(null);
        setQrModalOpen(false);
        setPaymentConfirmed(null);
        setQrError("");
        if (profile?.branchUuid) {
          await forgetPosPaymentSession(profile.branchUuid);
          await refreshPosRuntime(profile.branchUuid);
        }
        setShiftMessage("Mã QR đã hết hạn. Bạn có thể tạo lại bill mới.");
        return;
      }
      if (isPosPaymentSessionTerminal(session)) {
        setQrSession(null);
        setQrPreviewIdentity(null);
        setQrModalOpen(false);
        setPaymentConfirmed(null);
        if (profile?.branchUuid) {
          await forgetPosPaymentSession(profile.branchUuid);
          await refreshPosRuntime(profile.branchUuid);
        }
        setShiftMessage("Phiên QR này đã kết thúc.");
        return;
      }
      if (isPosPaymentSessionPaid(session)) {
        finalizing = true;
        const completed = await finalizePaidQrSession(session);
        if (!completed) finalizing = false;
        return;
      }
      applyPaymentSessionState(session);
    };

    const checkPaymentSession = async () => {
      try {
        const session = await readPosPaymentSession(qrSession.id);
        await handleSession(session);
      } catch (error) {
        setQrError(error?.message || "Không kiểm tra được phiên QR.");
      }
    };

    checkPaymentSession();
    const timer = globalThis.setInterval(checkPaymentSession, 12000);
    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [qrSession?.id, qrSession?.isPaymentSession]);

  useEffect(() => {
    if (!profile?.branchUuid || !shift?.id) return undefined;

    const timer = globalThis.setInterval(() => {
      refreshPosRuntime(profile.branchUuid, { includeRecentOrders: false });
      refreshShiftSummary(shift);
    }, 15000);

    return () => {
      globalThis.clearInterval(timer);
    };
  }, [profile?.branchUuid, shift?.id]);

  const cancelPendingQrForBillChange = async (reason = "POS mobile đổi bill trước khi thanh toán") => {
    if (!qrSession?.id) return true;

    const result = await cancelPosPaymentSession(qrSession.id, reason);
    if (!result.ok) {
      setShiftMessage(result.message || "Không hủy được QR đang chờ để cập nhật bill.");
      return false;
    }

    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrModalOpen(false);
    setPaymentConfirmed(null);
    setQrError("");
    if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
      await refreshPosRuntime(profile.branchUuid);
    }
    return true;
  };

  const addProduct = async (product, config = {}) => {
    if (!product?.id) return;
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile thêm món làm thay đổi bill trước khi thanh toán");
      if (!cancelled) return;
    }

    setCart((currentCart) => {
      const canMerge = !config.note && !config.spice && !(config.toppings || []).length && !(config.selectedOptions || []).length;
      const existing = canMerge
        ? currentCart.find((item) =>
            item.productId === product.id &&
            !item.note &&
            !(item.toppings || []).length &&
            !(item.selectedOptions || []).length &&
            !item.spice
          )
        : null;

      if (existing) {
        return currentCart.map((item) =>
          item.cartId === existing.cartId
            ? updatePosCartItemQuantity(item, Number(item.quantity || 1) + 1)
            : item
        );
      }

      return [createPosCartItem(product, config), ...currentCart];
    });
    setPaymentConfirmed(null);
    setShiftMessage("");
  };

  const changeQuantity = async (cartId, delta) => {
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile sửa số lượng làm thay đổi bill trước khi thanh toán");
      if (!cancelled) return;
    }

    setCart((current) =>
      current
        .map((item) => {
          if (item.cartId !== cartId) return item;
          const nextQuantity = Number(item.quantity || 1) + delta;
          return nextQuantity <= 0 ? null : updatePosCartItemQuantity(item, nextQuantity);
        })
        .filter((item) => item && item.quantity > 0)
    );
    setPaymentConfirmed(null);
  };

  const updateCartItem = async (cartId, product, config = {}) => {
    if (!cartId) return;
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile sửa món làm thay đổi bill trước khi thanh toán");
      if (!cancelled) return;
    }

    setCart((current) =>
      current.map((item) => (
        item.cartId === cartId
          ? updatePosCartItemConfig(item, product || item, config)
          : item
      ))
    );
    setPaymentConfirmed(null);
    setShiftMessage("");
  };

  const clearCart = async () => {
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile xóa bill đang chờ thanh toán");
      if (!cancelled) return;
    }

    setCart([]);
    setPaymentConfirmed(null);
    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrError("");
    setSelectedVoucherId("");
    setPointsInput("");
    if (profile?.branchUuid) {
      void forgetPosPaymentSession(profile.branchUuid);
    }
  };

  const validateLiveLoyaltySelection = async () => {
    const normalizedPhone = normalizeCustomerPhone(customerPhone);
    const selectedVoucher = loyaltyBenefit.selectedVoucher;
    const usesPoints = Number(loyaltyBenefit.pointsSpent || 0) > 0;
    const usesLoyaltyVoucher = Boolean(selectedVoucher) && String(selectedVoucher?.source || "").toLowerCase() === "loyalty";

    if ((!usesPoints && !usesLoyaltyVoucher) || (!normalizedPhone && !usesLoyaltyVoucher)) {
      return { ok: true, customer: customerLookup.result };
    }

    try {
      const latestCustomer = await lookupPosCustomerByPhone(normalizedPhone);
      if (!latestCustomer?.ok) {
        return {
          ok: false,
          message: latestCustomer?.message || "Không đọc được loyalty mới nhất của khách."
        };
      }

      setCustomerLookup({ loading: false, result: latestCustomer, error: "" });

      const latestPoints = Math.max(0, Math.floor(Number(latestCustomer?.loyalty?.totalPoints || 0)));
      if (usesPoints && Number(loyaltyBenefit.pointsSpent || 0) > latestPoints) {
        return {
          ok: false,
          customer: latestCustomer,
          message: `Điểm loyalty vừa thay đổi. Khách hiện còn ${latestPoints.toLocaleString("vi-VN")} điểm.`
        };
      }

      if (usesLoyaltyVoucher) {
        const selectedId = String(selectedVoucher?.id || "").trim();
        const selectedCode = String(selectedVoucher?.code || "").trim().toUpperCase();
        const matchedVoucher = (latestCustomer.availableVouchers || []).some((voucher) => {
          const voucherId = String(voucher?.id || "").trim();
          const voucherCode = String(voucher?.code || "").trim().toUpperCase();
          return (selectedId && voucherId === selectedId) || (selectedCode && voucherCode === selectedCode);
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
    } catch (error) {
      return {
        ok: false,
        message: error?.message || "Không kiểm tra được loyalty mới nhất của khách."
      };
    }
  };

  const signIn = async () => {
    setBusy(true);
    setQrError("");
    setAuthMessage("");
    setShiftMessage("");

    const result = await signInPosOperator({ email, password });
    setBusy(false);

    if (!result.ok) {
      setAuthMessage(result.message || "Đăng nhập thất bại.");
      return false;
    }

    setSession(result.session);
    setProfile(result.profile);
    setPassword("");
    setAuthMessage("");

    const shiftResult = await fetchActivePosShift({
      branchUuid: result.profile.branchUuid
    });
    if (shiftResult.ok) {
      setShift(shiftResult.shift);
      await refreshShiftSummary(shiftResult.shift);
    } else {
      setShiftMessage(shiftResult.message || "");
    }
    await refreshPosRuntime(result.profile.branchUuid);
  };

  const signOut = async () => {
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile đăng xuất khi đang có bill QR chờ thanh toán");
      if (!cancelled) return;
    } else if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
    }
    await signOutPosOperator();
    setSession(null);
    setProfile(null);
    setShift(null);
    setShiftSummary(null);
    setShiftSummaryError("");
    setClosingCash("");
    setClosingNote("");
    setOpeningCash("");
    setAuthMessage("");
    setShiftMessage("");
    setBusyPagers([]);
    setRecentOrders([]);
    setPendingPaymentSessions([]);
    setHistoryError("");
    setCustomerPhone("");
    setCustomerLookup({ loading: false, result: null, error: "" });
    await clearCart();
  };

  const openShiftNow = async (payload = {}) => {
    const {
      openingCashCounted = openingCash,
      openingCashBreakdown = null
    } = payload || {};
    if (openingCashBreakdown == null) {
      setShiftMessage("Vui lòng kiểm tiền đầu ca theo mệnh giá trước khi mở ca.");
      return false;
    }
    if (!profile || !session?.user?.id) {
      setShiftMessage("Vui lòng đăng nhập chi nhánh trước.");
      return false;
    }

    setBusy(true);
    setShiftMessage("");

    const result = await openPosShift({
      branchUuid: profile.branchUuid,
      branchName: profile.branchName,
      registerKey: "main",
      cashierName: profile.name || profile.email,
      profileId: profile.id,
      authUserId: session.user.id,
      openingCash: Number(openingCashCounted || 0),
      openingCashBreakdown,
      openingNote: ""
    });

    setBusy(false);
    setShift(result.shift || null);
    setShiftMessage(result.message || "");
    if (result.ok) {
      setOpeningCash("");
    }
    await refreshPosRuntime(profile.branchUuid);
    await refreshShiftSummary(result.shift || null);
    return result.ok;
  };

  const confirmCash = (cashReceived = "") => {
    if (!totals.total) {
      setShiftMessage("Chưa có món trong bill.");
      return false;
    }

    if (!normalizedPager) {
      setShiftMessage("Vui lòng nhập thẻ rung trước khi thanh toán.");
      return false;
    }

    if (pagerBusy) {
      setShiftMessage(`Thẻ rung ${normalizedPager} đang có đơn chưa hoàn tất.`);
      return false;
    }

    const normalizedReceived = normalizeCashReceived(cashReceived);
    if (normalizedReceived < totals.total) {
      setShiftMessage("Tiền khách đưa chưa đủ để xác nhận thanh toán.");
      return false;
    }

    setPaymentConfirmed({
      method: "cash",
      amount: totals.total,
      received: normalizedReceived,
      change: calculateCashChange(totals.total, normalizedReceived),
      reference: `CASH-${Date.now()}`
    });
    setShiftMessage("Đã xác nhận thanh toán tiền mặt.");
  };

  const openQrPayment = async () => {
    if (!profile || !shift?.id) {
      setShiftMessage("Cần đăng nhập và mở ca trước khi tạo QR.");
      return false;
    }
    if (!totals.total) {
      setShiftMessage("Bill hiện chưa có số tiền để tạo QR thanh toán.");
      return false;
    }
    if (!normalizedPager) {
      setShiftMessage("Vui lòng nhập thẻ rung trước khi tạo QR thanh toán.");
      return false;
    }
    if (pagerBusy) {
      setShiftMessage(`Thẻ rung ${normalizedPager} đang có đơn chưa hoàn tất.`);
      return;
    }
    if (qrSession) {
      setQrModalOpen(true);
      return;
    }

    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) {
      setShiftMessage(loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.");
      return;
    }

    const orderIdentity = createPosOrderIdentity(new Date());
    setQrPreviewIdentity(orderIdentity);
    setQrLoading(true);
    setQrError("");
    setShiftMessage("");

    const paymentReference = buildPosPaymentReference(orderIdentity, branch);
    const result = await createPosPaymentSession({
      requestKey: `pos:${profile.branchUuid}:${orderIdentity.orderCode}`,
      paymentReference,
      provider: "sepay",
      branchUuid: profile.branchUuid,
      posShiftId: shift.id,
      branchName: profile.branchName,
      cashierName: profile.name || profile.email,
      customerName,
      customerPhone: normalizeCustomerPhone(customerPhone),
      pagerNumber: normalizedPager,
      amountExpected: totals.total,
      cart,
      orderIdentity,
      checkout: {
        orderIdentity,
        posShiftId: shift.id,
        shift,
        totals,
        promoDiscount: loyaltyBenefit.voucherDiscount,
        promoCode: String(loyaltyBenefit.selectedVoucher?.code || "").trim().toUpperCase(),
        promoSource: String(loyaltyBenefit.selectedVoucher?.source || ""),
        promoVoucherId: String(loyaltyBenefit.selectedVoucher?.id || "").trim(),
        selectedVoucherKey: loyaltyBenefit.selectedVoucherKey,
        pointsDiscount: loyaltyBenefit.pointsSpent,
        pointsDiscountAmount: loyaltyBenefit.pointsDiscount,
        pointRedeemRule: loyaltyBenefit.loyaltyRule,
        customerLookup: loyaltyValidation.customer || customerLookup.result,
        customerName: customerName || customerLookup.result?.customerName || "",
        customerPhone: normalizeCustomerPhone(customerPhone)
      }
    });

    setQrLoading(false);
    if (!result.ok) {
      setQrError(result.message || "Không tạo được phiên thanh toán QR.");
      setShiftMessage(result.message || "Không tạo được phiên thanh toán QR.");
      setQrModalOpen(true);
      return;
    }

    setQrSession(result.session);
    await rememberPosPaymentSession(profile.branchUuid, result.session?.id);
    setQrModalOpen(true);
    setShiftMessage("Đã tạo QR, đang chờ khách chuyển khoản.");
  };

  const cancelQrPayment = async (session = null) => {
    const activeSession = session?.id ? session : qrSession;
    if (!activeSession?.id) {
      setQrSession(null);
      setQrPreviewIdentity(null);
      setQrModalOpen(false);
      setQrError("");
      return;
    }
    setBusy(true);
    setQrError("");
    const result = await cancelPosPaymentSession(activeSession.id, "POS mobile hủy QR");
    setBusy(false);
    if (!result.ok) {
      setQrError(result.message || "Không hủy được QR.");
      return;
    }
    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrModalOpen(false);
    setPaymentConfirmed(null);
    setQrError("");
    if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
      await refreshPosRuntime(profile.branchUuid);
    }
    setShiftMessage("Đã hủy QR thanh toán.");
  };

  const openPaymentSessionFromHistory = async (session = {}) => {
    if (!session?.id) return;
    if (cart.length && qrSession?.id !== session.id) {
      setShiftMessage("Bill hiện tại đang có món. Vui lòng tạo đơn hoặc xóa bill trước khi mở QR khác.");
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const latestSession = await readPosPaymentSession(session.id);
      if (!latestSession?.id) {
        setHistoryError("Không tìm thấy phiên QR.");
        return;
      }
      if (isPosPaymentSessionExpired(latestSession)) {
        await cancelPosPaymentSession(latestSession.id, "POS mobile đóng phiên QR đã hết hạn từ lịch sử");
        if (profile?.branchUuid) {
          await forgetPosPaymentSession(profile.branchUuid);
          await refreshPosRuntime(profile.branchUuid);
        }
        setHistoryError("Phiên QR này đã hết hạn.");
        return;
      }
      if (isPosPaymentSessionTerminal(latestSession)) {
        setHistoryError("Phiên QR này đã kết thúc.");
        await refreshPosRuntime(profile?.branchUuid);
        return;
      }
      applyPaymentSessionState(latestSession);
      setQrModalOpen(true);
      if (profile?.branchUuid) {
        await rememberPosPaymentSession(profile.branchUuid, latestSession.id);
      }
    } catch (error) {
      setHistoryError(error?.message || "Không mở được phiên QR.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const cancelPaymentSessionFromHistory = async (session = {}) => {
    if (!session?.id) return;

    setHistoryLoading(true);
    setHistoryError("");
    const result = await cancelPosPaymentSession(session.id, "POS mobile hủy từ lịch sử QR");
    setHistoryLoading(false);
    if (!result.ok) {
      setHistoryError(result.message || "Không hủy được phiên QR.");
      return;
    }

    if (qrSession?.id === session.id) {
      setQrSession(null);
      setQrPreviewIdentity(null);
      setQrModalOpen(false);
      setPaymentConfirmed(null);
    }
    if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
      await refreshPosRuntime(profile.branchUuid);
    }
    setShiftMessage("Đã hủy phiên QR đang chờ.");
  };

  const refreshCurrentPosRuntime = async () => {
    await refreshPosRuntime(profile?.branchUuid);
    await refreshShiftSummary(shift);
  };

  const printQrReceiptNow = async () => {
    if (!qrSession && !qrPreviewIdentity) {
      setQrError("Chưa có phiên QR để in.");
      return;
    }

    const identity = qrSession?.orderIdentity || qrPreviewIdentity || {};
    const receiptText = buildPosQrReceiptText({
      branchName: profile?.branchName,
      amount: qrSession?.amountExpected || totals.total,
      transferContent: qrSession?.paymentReference || buildPosPaymentReference(identity, branch),
      orderCode: identity.displayOrderCode || identity.orderCode || qrSession?.paymentReference,
      customerName: customerName || qrSession?.customerName || customerLookup.result?.customerName || ""
    });

    setQrPrintBusy(true);
    setQrError("");
    try {
      await printLocalReceipt({
        text: receiptText,
        qrUrl: qrSession?.qrImageUrl || "",
        sourceType: "pos_payment_qr"
      });
      setShiftMessage("Đã in phiếu QR tại máy POS.");
    } catch (error) {
      setQrError(error?.message || "Không in được phiếu QR.");
    } finally {
      setQrPrintBusy(false);
    }
  };

  const cancelRecentOrder = async (order = {}) => {
    if (!order?.id) return;

    setHistoryLoading(true);
    setHistoryError("");
    const result = await cancelPosOrder(order, {
      cashierName: profile?.name || profile?.email || "POS mobile",
      reason: "Nhân viên hủy tại màn hình lịch sử POS mobile"
    });
    setHistoryLoading(false);

    if (!result.ok) {
      setHistoryError(result.message || "Không hủy được đơn POS.");
      return;
    }

    setShiftMessage(result.message || "Đã hủy đơn POS.");
    await refreshPosRuntime(profile?.branchUuid);
    await refreshShiftSummary(shift);
  };

  const reprintRecentOrder = async (order = {}) => {
    if (!order?.id) return;

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await readPosOrderForPrint(order.id);
      if (!result.ok || !result.printableOrder) {
        setHistoryError(result.message || "Không đọc được đơn để in lại.");
        return;
      }

      const printableOrder = result.printableOrder;
      const receiptText = buildPosCustomerBillText({
        order: printableOrder,
        cart: printableOrder.cart,
        totals: printableOrder.totals,
        customerName: printableOrder.customerName,
        customerPhone: printableOrder.customerPhone,
        pagerNumber: printableOrder.pagerNumber,
        branchName: printableOrder.branchName || profile?.branchName,
        cashierName: profile?.name || profile?.email || "Thu ngân",
        orderNote: printableOrder.orderNote,
        paymentConfirmed: {
          method: printableOrder.paymentMethod === "bank_qr" ? "bank_qr" : "cash",
          reference: printableOrder.paymentReference,
          paidAt: printableOrder.paidAt || printableOrder.createdAt
        }
      });

      await printLocalReceipt({
        text: receiptText,
        sourceType: "customer_bill_reprint"
      });
      setShiftMessage(`Đã in lại bill ${printableOrder.displayOrderCode || order.displayOrderCode || order.id}.`);
    } catch (error) {
      setHistoryError(error?.message || "Không in lại được bill.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openRecentOrderDetail = async (order = {}) => {
    if (!order?.id) return null;

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const result = await readPosOrderDetail(order.id);
      if (!result.ok || !result.order) {
        setHistoryError(result.message || "Không đọc được chi tiết đơn POS.");
        return null;
      }
      return result.order;
    } catch (error) {
      setHistoryError(error?.message || "Không mở được chi tiết đơn POS.");
      return null;
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeShiftNow = async (payload = {}) => {
    const {
      closingCashCounted = closingCash,
      closingCashBreakdown = null,
      closingNote: nextClosingNote = closingNote,
      printReceipt = true
    } = payload || {};

    if (!shift?.id) {
      setShiftMessage("Chưa có ca POS đang mở.");
      return false;
    }
    if (cart.length || qrSession?.id) {
      setShiftMessage("Vui lòng tạo/xóa bill hiện tại và xử lý QR đang chờ trước khi kết ca.");
      return false;
    }

    if (closingCashBreakdown == null) {
      setShiftMessage("Vui lòng kiểm tiền theo mệnh giá trước khi kết ca.");
      return false;
    }

    setBusy(true);
    setShiftMessage("");
    const activePendingSessions = await cleanupExpiredPaymentSessions(profile?.branchUuid, pendingPaymentSessions);
    setPendingPaymentSessions(activePendingSessions);
    if (activePendingSessions.length) {
      setBusy(false);
      setShiftMessage("Còn phiên QR đang chờ thanh toán. Vui lòng hủy hoặc hoàn tất trước khi kết ca.");
      await refreshShiftSummary(shift);
      return false;
    }
    const latestSummary = await refreshShiftSummary(shift);
    if (Number(latestSummary?.pendingQrCount || 0) > 0) {
      setBusy(false);
      setShiftMessage("Còn phiên QR đang chờ thanh toán trong ca. Vui lòng xử lý hết trước khi kết ca.");
      await refreshPosRuntime(profile?.branchUuid);
      return false;
    }
    const result = await closePosShift({
      shift,
      summary: latestSummary || shiftSummary,
      closingCashCounted,
      closingCashBreakdown,
      closingNote: nextClosingNote,
      authUserId: session?.user?.id
    });
    setBusy(false);

    setShiftMessage(result.message || "");
    if (!result.ok) return false;

    let closePrintMessage = "";
    if (printReceipt) {
      try {
        const receiptText = buildPosShiftCloseReceiptText({
          shift: {
            ...shift,
            closedAt: result.shift?.closedAt || new Date().toISOString()
          },
          summary: latestSummary || shiftSummary || {},
          closingCashCounted,
          closingNote: nextClosingNote
        });
        await printLocalReceipt({
          text: receiptText,
          sourceType: "pos_shift_close"
        });
        closePrintMessage = " Đã in phiếu kết ca.";
      } catch (printError) {
        closePrintMessage = ` Đã kết ca nhưng chưa in được phiếu: ${printError?.message || "Lỗi máy in."}`;
      }
    }

    setShift(null);
    setShiftSummary(null);
    setShiftSummaryError("");
    setClosingCash("");
    setClosingNote("");
    setBusyPagers([]);
    setPendingPaymentSessions([]);
    setRecentOrders([]);
    setShiftMessage(`${result.message || ""}${closePrintMessage}`.trim());
    return true;
  };

  const confirmQrPaidManually = async () => {
    if (!qrSession?.id) return;
    if (isPosPaymentSessionPaid(qrSession)) {
      await finalizePaidQrSession(qrSession);
      return;
    }
    setBusy(true);
    setQrError("");
    const result = await confirmPosPaymentSessionManually(qrSession.id);
    setBusy(false);
    if (!result.ok) {
      setQrError(result.message || "Không xác nhận được thanh toán QR.");
      return;
    }
    setQrSession(result.session);
    if (isPosPaymentSessionPaid(result.session)) {
      await finalizePaidQrSession(result.session);
      return;
    }
    applyPaymentSessionState(result.session);
  };

  const createCashOrder = async () => {
    if (!paymentConfirmed || !profile || !shift?.id) {
      setShiftMessage("Cần đăng nhập và mở ca trước khi tạo đơn.");
      return;
    }

    if (pagerBusy) {
      setShiftMessage(`Thẻ rung ${normalizedPager} đang có đơn chưa hoàn tất.`);
      return;
    }

    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) {
      setShiftMessage(loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.");
      return;
    }

    setBusy(true);
    const result = await createPosTakeawayOrderMobile({
      cart,
      totals,
      pagerNumber: normalizedPager,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone: normalizeCustomerPhone(customerPhone),
      branch: {
        branchUuid: profile.branchUuid,
        branchName: profile.branchName
      },
      orderNote,
      shift,
      cashierName: profile.name || profile.email,
      customerLookup: loyaltyValidation.customer || customerLookup.result,
      promoDiscount: loyaltyBenefit.voucherDiscount,
      promoCode: String(loyaltyBenefit.selectedVoucher?.code || "").trim().toUpperCase(),
      promoSource: String(loyaltyBenefit.selectedVoucher?.source || ""),
      promoVoucherId: String(loyaltyBenefit.selectedVoucher?.id || "").trim(),
      pointsDiscount: loyaltyBenefit.pointsSpent,
      pointsDiscountAmount: loyaltyBenefit.pointsDiscount,
      pointRedeemRule: loyaltyBenefit.loyaltyRule,
      paymentMethod: paymentConfirmed.method,
      paymentStatus: "paid",
      paymentAmount: paymentConfirmed.amount,
      paymentReference: paymentConfirmed.reference,
      paidAt: paymentConfirmed.paidAt || new Date().toISOString(),
      posShiftId: shift.id,
      paymentMeta: paymentConfirmed.paymentSessionId
        ? { provider: "sepay", paymentSessionId: paymentConfirmed.paymentSessionId }
        : {},
      orderIdentity: paymentConfirmed.orderIdentity || null
    });
    setBusy(false);

    setShiftMessage(result.message || "");
    if (!result.ok) {
      return;
    }

    let printMessage = "";
    try {
      const receiptText = buildPosCustomerBillText({
        order: result.order,
        cart,
        totals,
        customerName: customerName || customerLookup.result?.customerName || "",
        customerPhone: normalizeCustomerPhone(customerPhone),
        pagerNumber: normalizedPager,
        branchName: profile.branchName,
        cashierName: profile.name || profile.email,
        orderNote,
        paymentConfirmed
      });
      await printLocalReceipt({
        text: receiptText,
        sourceType: "customer_bill"
      });
      printMessage = " Đã in bill tại máy POS.";
    } catch (printError) {
      printMessage = ` Đã tạo đơn nhưng chưa in được bill: ${printError?.message || "Lỗi máy in."}`;
    }

    setCart([]);
    setPaymentConfirmed(null);
    setOrderNote("");
    setCustomerName("");
    setCustomerPhone("");
    setSelectedVoucherId("");
    setPointsInput("");
    setPagerNumber("");
    if (paymentConfirmed.paymentSessionId) {
      await markPosPaymentSessionConverted(
        paymentConfirmed.paymentSessionId,
        result.order?.id || result.order?.orderCode
      );
    }
    await forgetPosPaymentSession(profile.branchUuid);
    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrModalOpen(false);
    await refreshPosRuntime(profile.branchUuid);
    await refreshShiftSummary(shift);
    setShiftMessage(`${result.message || ""}${printMessage}`.trim());
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    authMessage,
    shiftMessage,
    menuMessage,
    busy,
    isSignedIn: Boolean(session && profile),
    branchName: profile?.branchName || "Chi nhánh POS mobile",
    cashierName: profile?.name || profile?.email || "Thu ngân",
    shiftLabel: shift?.id ? `Ca đang mở: ${shift.cashierName || "Thu ngân"}` : "Chưa mở ca",
    shift,
    shiftSummary,
    shiftSummaryError,
    closingCash,
    setClosingCash,
    closingNote,
    setClosingNote,
    openingCash,
    setOpeningCash,
    pagerNumber,
    setPagerNumber,
    normalizedPager,
    pagerBusy,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    customerLookup,
    loyaltyBenefit,
    promotionHints,
    selectedVoucherId,
    setSelectedVoucherId,
    pointsInput,
    setPointsInput,
    orderNote,
    setOrderNote,
    products: visibleProducts,
    allProducts: catalog.products,
    categories: catalog.categories,
    activeCategory: effectiveCategory,
    setActiveCategory,
    cart,
    totals,
    paymentConfirmed,
    qrSession,
    qrPreviewIdentity,
    qrModalOpen,
    setQrModalOpen,
    qrLoading,
    qrError,
    qrPrintBusy,
    branch,
    busyPagers,
    recentOrders,
    pendingPaymentSessions,
    historyLoading,
    historyError,
    addProduct,
    updateCartItem,
    changeQuantity,
    clearCart,
    confirmCash,
    openQrPayment,
    cancelQrPayment,
    openPaymentSessionFromHistory,
    cancelPaymentSessionFromHistory,
    cancelRecentOrder,
    reprintRecentOrder,
    openRecentOrderDetail,
    refreshCurrentPosRuntime,
    confirmQrPaidManually,
    printQrReceiptNow,
    createCashOrder,
    signIn,
    signOut,
    openShiftNow,
    closeShiftNow,
    hasOpenShift: Boolean(shift?.id)
  };
}
