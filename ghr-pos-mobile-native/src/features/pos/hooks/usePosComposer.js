import { useEffect, useMemo, useRef, useState } from "react";

import {
  restorePosSession,
  signInPosOperator,
  signOutPosOperator,
  subscribePosAuthState
} from "../../../services/auth/posAuthService";
import { lookupPosCustomerByPhone, normalizeCustomerPhone } from "../../../services/pos/posCustomerService";
import { createPosTakeawayOrderMobile } from "../../../services/pos/posOrderService";
import {
  buildPosCustomerBillText,
  buildPosQrReceiptText,
  buildPosShiftCloseReceiptText,
  openLocalCashDrawer,
  playLocalQrPaymentAlert,
  printLocalReceipt,
  startLocalPrintStationService,
  stopLocalPrintStationService
} from "../../../services/pos/posPrinterService";
import {
  cancelPosOrder,
  getBusyPosPagerNumbers,
  getPosRecentOrders,
  normalizePagerNumber,
  readPosOrderDetail,
  readPosOrderForPrint
} from "../../../services/pos/posOrderQueryService";
import {
  getPosWebsiteHistoryOrders,
  getPosWebsiteOrders,
  markPickupOrderPaidCash,
  markPickupOrderPaidQr
} from "../../../services/pos/posPickupOrderService";
import { buildPosPaymentReference, buildPosQrImageUrl } from "../../../services/pos/posPaymentService";
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
import { startPosPrintStation } from "../../../services/pos/posPrintStationService";
import {
  checkPosSupabaseConnection,
  getPosOfflineOrderCount,
  markPosOfflineOrderRetry,
  readPosOfflineOrderQueue,
  removePosOfflineOrder
} from "../../../services/pos/posOfflineOrderQueueService";
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
import { calculateCashChange, getCashPaymentSummary, normalizeCashReceived } from "../../../shared/pos/posPayment";
import { applyPosPricePromotionToProduct, buildPosPromotionHints, syncAutoGiftItems } from "../../../shared/pos/posPromotions";

export default function usePosComposer() {
  const announcedQrPaymentIdsRef = useRef(new Set());
  const runtimeRefreshInFlightRef = useRef(false);
  const createCashOrderInFlightRef = useRef(false);
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
  const [rawCategories, setRawCategories] = useState([]);
  const [rawCoupons, setRawCoupons] = useState([]);
  const [rawSmartPromotions, setRawSmartPromotions] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentConfirmed, setPaymentConfirmed] = useState(null);
  const [busyPagers, setBusyPagers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [pickupOrders, setPickupOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [pendingPaymentSessions, setPendingPaymentSessions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [pickupOrdersLoading, setPickupOrdersLoading] = useState(false);
  const [pickupOrdersError, setPickupOrdersError] = useState("");
  const [qrSession, setQrSession] = useState(null);
  const [qrPreviewIdentity, setQrPreviewIdentity] = useState(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrPrintBusy, setQrPrintBusy] = useState(false);
  const [pickupQrSession, setPickupQrSession] = useState(null);
  const [pickupQrOrder, setPickupQrOrder] = useState(null);
  const [pickupQrModalOpen, setPickupQrModalOpen] = useState(false);
  const [pickupQrLoading, setPickupQrLoading] = useState(false);
  const [pickupQrError, setPickupQrError] = useState("");
  const [pickupQrPrintBusy, setPickupQrPrintBusy] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    checking: false,
    online: null,
    message: "Chưa kiểm tra kết nối.",
    lastCheckedAt: ""
  });
  const [offlineOrderCount, setOfflineOrderCount] = useState(0);
  const [offlineSyncBusy, setOfflineSyncBusy] = useState(false);
  const [promotionNowTick, setPromotionNowTick] = useState(() => Date.now());
  const [printStationStatus, setPrintStationStatus] = useState({
    running: false,
    tone: "idle",
    message: "Trạm in chưa khởi động."
  });

  const catalog = useMemo(
    () => buildPosCatalog({ products: rawProducts, categories: rawCategories }),
    [rawCategories, rawProducts]
  );

  const defaultCategory = useMemo(
    () => catalog.categories.find((category) => category !== ALL_CATEGORY) || ALL_CATEGORY,
    [catalog.categories]
  );

  const effectiveCategory = catalog.categories.includes(activeCategory) ? activeCategory : defaultCategory;

  const pricedProducts = useMemo(
    () => catalog.products.map((product) => applyPosPricePromotionToProduct(product, rawSmartPromotions, new Date(promotionNowTick))),
    [catalog.products, promotionNowTick, rawSmartPromotions]
  );

  const visibleProducts = useMemo(
    () => filterPosProducts(pricedProducts, { category: effectiveCategory }),
    [effectiveCategory, pricedProducts]
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
      products: pricedProducts,
      subtotal: baseTotals.subtotal
    }),
    [baseTotals.subtotal, pricedProducts, rawSmartPromotions]
  );

  useEffect(() => {
    const timer = globalThis.setInterval(() => setPromotionNowTick(Date.now()), 60000);
    return () => {
      globalThis.clearInterval(timer);
    };
  }, []);

  const buildPickupOrderIdentity = (order = {}) => ({
    orderCode: String(order.orderCode || order.id || "").trim(),
    displayOrderCode: String(order.displayOrderCode || order.orderCode || order.id || "").trim()
  });

  const getWebsiteOrderSourceType = (order = {}) => (
    order?.fulfillmentType === "delivery" ? "website_delivery" : "website_pickup"
  );

  const getWebsiteOrderAmount = (order = {}) => (
    Number(order?.collectAmount || order?.totalAmount || order?.paymentAmount || 0)
  );

  const getWebsiteOrderQrSourceType = (order = {}) => (
    order?.fulfillmentType === "delivery" ? "delivery_order_payment_qr" : "pickup_order_payment_qr"
  );

  const findPendingWebsiteQrSession = (order = {}) => {
    const orderId = String(order?.id || "").trim();
    if (!orderId) return null;

    return [pickupQrSession, ...pendingPaymentSessions].find((paymentSession) => {
      const source = String(paymentSession?.source || "").trim().toLowerCase();
      const status = String(paymentSession?.status || "").trim().toLowerCase();
      const sessionOrderId = String(
        paymentSession?.orderId ||
        paymentSession?.checkoutSnapshot?.websiteOrderId ||
        paymentSession?.checkoutSnapshot?.existingOrderId ||
        ""
      ).trim();

      return ["web", "qr_order"].includes(source)
        && ["draft", "pending_payment"].includes(status)
        && sessionOrderId === orderId;
    }) || null;
  };

  const mergeRecentHistoryOrders = (posOrders = [], pickupHistoryOrders = [], limit = 16) => {
    const merged = [
      ...(Array.isArray(posOrders) ? posOrders : []),
      ...(Array.isArray(pickupHistoryOrders) ? pickupHistoryOrders : [])
    ];

    return merged
      .sort((first, second) => {
        const firstTime = new Date(first?.createdAt || 0).getTime();
        const secondTime = new Date(second?.createdAt || 0).getTime();
        return secondTime - firstTime;
      })
      .slice(0, Math.max(1, Math.floor(Number(limit || 16))));
  };

  const printPickupCustomerBill = async ({ order = {}, paymentConfirmed = null } = {}) => {
    if (!order?.id) {
      return { ok: false, message: " Thiếu mã đơn để in bill." };
    }

    const result = await readPosOrderForPrint(order.id);
    if (!result.ok || !result.printableOrder) {
      return {
        ok: false,
        message: ` Chưa in được bill: ${result.message || "không đọc được dữ liệu đơn."}`
      };
    }

    const printableOrder = result.printableOrder;
    const receiptText = buildPosCustomerBillText({
      order: printableOrder,
      cart: printableOrder.cart,
      totals: printableOrder.totals,
      customerName: printableOrder.customerName || order.customerName,
      customerPhone: printableOrder.customerPhone || order.customerPhone,
      pagerNumber: printableOrder.pagerNumber,
      branchName: printableOrder.branchName || order.pickupBranchName || profile?.branchName,
      cashierName: profile?.name || profile?.email || "Thu ngân",
      orderNote: printableOrder.orderNote,
      paymentConfirmed
    });

    try {
      await printLocalReceipt({
        text: receiptText,
        sourceType: "customer_bill"
      });
      return { ok: true, message: " Đã in bill tại máy POS." };
    } catch (error) {
      return {
        ok: false,
        message: ` Chưa in được bill: ${error?.message || "lỗi máy in."}`
      };
    }
  };

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

  const refreshPosRuntime = async (branchUuid = "", { includeRecentOrders = true, silent = false } = {}) => {
    if (!branchUuid) return;
    if (runtimeRefreshInFlightRef.current) return;
    runtimeRefreshInFlightRef.current = true;
    if (includeRecentOrders && !silent) {
      setHistoryLoading(true);
      setHistoryError("");
      setPickupOrdersLoading(true);
      setPickupOrdersError("");
    }
    try {
      const [nextBusyPagers, nextRecentOrders, nextWebsiteOrders, nextWebsiteHistoryOrders, nextPaymentSessions] = await Promise.all([
        getBusyPosPagerNumbers({ branchUuid }),
        includeRecentOrders ? getPosRecentOrders({ branchUuid, limit: 8 }) : Promise.resolve(null),
        includeRecentOrders
          ? getPosWebsiteOrders({ branchUuid, limit: 80 }).catch((error) => {
              setPickupOrdersError(error?.message || "Không tải được đơn hẹn lấy.");
              return [];
            })
          : Promise.resolve(null),
        includeRecentOrders
          ? getPosWebsiteHistoryOrders({ branchUuid, limit: 20 }).catch((error) => {
              setHistoryError(error?.message || "Khong tai duoc lich su don hen lay.");
              return [];
            })
          : Promise.resolve(null),
        listPosPaymentSessions(branchUuid).catch((error) => {
          setHistoryError(error?.message || "Không tải được phiên QR đang chờ.");
          return [];
        })
      ]);
      const activePaymentSessions = await cleanupExpiredPaymentSessions(branchUuid, nextPaymentSessions);
      setBusyPagers(nextBusyPagers);
      if (includeRecentOrders && Array.isArray(nextRecentOrders)) {
        setRecentOrders(mergeRecentHistoryOrders(nextRecentOrders, nextWebsiteHistoryOrders, 16));
      }
      if (includeRecentOrders && nextWebsiteOrders && typeof nextWebsiteOrders === "object") {
        if (Array.isArray(nextWebsiteOrders)) {
          setPickupOrders(nextWebsiteOrders);
          setDeliveryOrders([]);
        } else {
          setPickupOrders(Array.isArray(nextWebsiteOrders.pickupOrders) ? nextWebsiteOrders.pickupOrders : []);
          setDeliveryOrders(Array.isArray(nextWebsiteOrders.deliveryOrders) ? nextWebsiteOrders.deliveryOrders : []);
        }
      }
      setPendingPaymentSessions(activePaymentSessions);
    } catch (error) {
      setHistoryError(error?.message || "Không tải được lịch sử POS.");
    } finally {
      runtimeRefreshInFlightRef.current = false;
      if (!silent) {
        setHistoryLoading(false);
        setPickupOrdersLoading(false);
      }
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

  const refreshOfflineOrderCount = async () => {
    const nextCount = await getPosOfflineOrderCount();
    setOfflineOrderCount(nextCount);
    return nextCount;
  };

  const checkConnectionNow = async () => {
    setConnectionStatus((current) => ({
      ...current,
      checking: true
    }));
    const result = await checkPosSupabaseConnection();
    setConnectionStatus({
      checking: false,
      online: Boolean(result.online),
      warning: Boolean(result.warning),
      message: result.message || (result.online ? "Kết nối Supabase ổn." : "Đang offline."),
      lastCheckedAt: new Date().toISOString()
    });
    await refreshOfflineOrderCount();
    return result;
  };

  const syncOfflineOrdersNow = async ({ silent = false } = {}) => {
    if (offlineSyncBusy) return { ok: false, synced: 0, remaining: offlineOrderCount };

    const connection = await checkPosSupabaseConnection();
    setConnectionStatus({
      checking: false,
      online: Boolean(connection.online),
      warning: Boolean(connection.warning),
      message: connection.message || (connection.online ? "Kết nối Supabase ổn." : "Đang offline."),
      lastCheckedAt: new Date().toISOString()
    });

    if (!connection.online) {
      const count = await refreshOfflineOrderCount();
      if (!silent) {
        setShiftMessage(count
          ? `Đang offline. Còn ${count} đơn lưu tạm trên máy.`
          : "Đang offline, chưa có đơn lưu tạm.");
      }
      return { ok: false, synced: 0, remaining: count };
    }

    const queue = await readPosOfflineOrderQueue();
    if (!queue.length) {
      setOfflineOrderCount(0);
      if (!silent) setShiftMessage("Không có đơn offline cần đồng bộ.");
      return { ok: true, synced: 0, remaining: 0 };
    }

    setOfflineSyncBusy(true);
    let synced = 0;
    for (const entry of queue) {
      const result = await createPosTakeawayOrderMobile({
        ...(entry.orderPayload || {}),
        skipOfflineQueue: true
      });

      if (result.ok && !result.offline) {
        await removePosOfflineOrder(entry.id);
        synced += 1;
      } else {
        await markPosOfflineOrderRetry(entry.id, result.message || "Chưa đồng bộ được đơn offline.");
        break;
      }
    }
    setOfflineSyncBusy(false);

    const remaining = await refreshOfflineOrderCount();
    if (!silent || synced > 0) {
      setShiftMessage(remaining
        ? `Đã đồng bộ ${synced} đơn. Còn ${remaining} đơn lưu tạm.`
        : synced
          ? `Đã đồng bộ ${synced} đơn offline lên Supabase.`
          : "Chưa đồng bộ được đơn offline, app sẽ thử lại khi có mạng.");
    }

    if (synced > 0 && profile?.branchUuid) {
      await refreshPosRuntime(profile.branchUuid);
      await refreshShiftSummary(shift);
    }

    return { ok: remaining === 0, synced, remaining };
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

    if (!announcedQrPaymentIdsRef.current.has(session.id)) {
      announcedQrPaymentIdsRef.current.add(session.id);
      try {
        await playLocalQrPaymentAlert();
      } catch {
        // Âm báo không được làm gián đoạn bước chốt đơn đã nhận tiền.
      }
    }

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

    if (result.offline) {
      await refreshOfflineOrderCount();
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
    if (!result.offline) {
      await refreshPosRuntime(profile.branchUuid);
      await refreshShiftSummary(shift);
    }
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
      await refreshOfflineOrderCount();
      if (active) {
        if (productResult.ok) {
          setRawProducts(productResult.products);
          setRawCategories(Array.isArray(productResult.categories) ? productResult.categories : []);
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
      await checkConnectionNow();
      await syncOfflineOrdersNow({ silent: true });

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
    return subscribePosAuthState(({ event, session: nextSession }) => {
      if (event === "SIGNED_OUT") {
        runtimeRefreshInFlightRef.current = false;
        setSession(null);
        setProfile(null);
        setShift(null);
        setShiftSummary(null);
        setShiftSummaryError("");
        setClosingCash("");
        setClosingNote("");
        setOpeningCash("");
        setBusy(false);
        setBusyPagers([]);
        setRecentOrders([]);
        setPickupOrders([]);
        setDeliveryOrders([]);
        setPendingPaymentSessions([]);
        setHistoryLoading(false);
        setHistoryError("");
        setPickupOrdersLoading(false);
        setPickupOrdersError("");
        setCart([]);
        setPaymentConfirmed(null);
        setQrSession(null);
        setQrPreviewIdentity(null);
        setQrModalOpen(false);
        setQrLoading(false);
        setQrError("");
        setPickupQrSession(null);
        setPickupQrOrder(null);
        setPickupQrModalOpen(false);
        setPickupQrLoading(false);
        setPickupQrError("");
        setCustomerName("");
        setCustomerPhone("");
        setCustomerLookup({ loading: false, result: null, error: "" });
        setSelectedVoucherId("");
        setPointsInput("");
        setOrderNote("");
        setPagerNumber("");
        setShiftMessage("");
        setAuthMessage("Phiên đăng nhập POS đã hết hạn. Vui lòng đăng nhập lại.");
        return;
      }

      if (nextSession?.user?.id) {
        setSession(nextSession);
      }
    });
  }, []);

  useEffect(() => {
    const branchUuid = String(profile?.branchUuid || "").trim();
    const userId = String(session?.user?.id || "").trim();
    if (!branchUuid || !userId) {
      setPrintStationStatus({
        running: false,
        tone: "idle",
        message: "Đăng nhập POS để khởi động trạm in."
      });
      return undefined;
    }

    let active = true;
    let stopStation = () => {};
    const deviceId = `pos-native-${userId}`;

    const startStation = async () => {
      await startLocalPrintStationService({
        branchUuid,
        branchName: profile?.branchName || "",
        deviceId
      });
      if (!active) {
        await stopLocalPrintStationService();
        return;
      }
      const stop = await startPosPrintStation({
        branchUuid,
        deviceId,
        onStatus: (status) => {
          if (active) setPrintStationStatus(status);
        }
      });
      if (!active) {
        if (typeof stop === "function") stop();
        return;
      }
      stopStation = typeof stop === "function" ? stop : () => {};
    };

    startStation().catch((error) => {
      if (!active) return;
      setPrintStationStatus({
        running: false,
        tone: "error",
        message: error?.message || "Không khởi động được trạm in chạy nền."
      });
    });

    return () => {
      active = false;
      stopStation();
      void stopLocalPrintStationService();
    };
  }, [profile?.branchName, profile?.branchUuid, session?.user?.id]);

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
    const currentName = customerName.trim().toLowerCase();
    const genericNames = new Set([
      "khách vãng lai",
      "khach vang lai",
      "khách cũ",
      "khach cu",
      "khách mới",
      "khach moi",
      "sđt mới",
      "sdt moi"
    ]);
    if (currentName && !genericNames.has(currentName)) return;
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
    if (!pickupQrSession?.id || !pickupQrSession.isPaymentSession) return undefined;

    let active = true;
    let finalizing = false;
    const handleSession = async (session) => {
      if (!active || !session || finalizing) return;
      if (isPosPaymentSessionExpired(session)) {
        await cancelPosPaymentSession(session.id, "POS mobile tự đóng QR đơn hẹn lấy đã hết hạn");
        if (!active) return;
        setPickupQrSession(null);
        setPickupQrOrder(null);
        setPickupQrModalOpen(false);
        setPickupQrError("");
        setShiftMessage("Mã QR của đơn hẹn lấy đã hết hạn.");
        return;
      }
      if (isPosPaymentSessionTerminal(session)) {
        setPickupQrSession(null);
        setPickupQrModalOpen(false);
        setPickupQrError("");
        return;
      }
      if (isPosPaymentSessionPaid(session)) {
        finalizing = true;
        const completed = await finalizePickupQrPayment(session);
        if (!completed) finalizing = false;
        return;
      }
      setPickupQrSession(session);
    };

    const checkPaymentSession = async () => {
      try {
        const session = await readPosPaymentSession(pickupQrSession.id);
        await handleSession(session);
      } catch (error) {
        setPickupQrError(error?.message || "Không kiểm tra được phiên QR đơn hẹn lấy.");
      }
    };

    checkPaymentSession();
    const timer = globalThis.setInterval(checkPaymentSession, 12000);
    return () => {
      active = false;
      globalThis.clearInterval(timer);
    };
  }, [pickupQrSession?.id, pickupQrSession?.isPaymentSession, pickupQrOrder?.id]);

  useEffect(() => {
    if (!profile?.branchUuid || !shift?.id) return undefined;

    const timer = globalThis.setInterval(() => {
      refreshPosRuntime(profile.branchUuid, { includeRecentOrders: true, silent: true });
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

  const getPromotionPricedProduct = (product = {}) => {
    const matched = pricedProducts.find((item) => item.id === product.id);
    return matched || applyPosPricePromotionToProduct(product, rawSmartPromotions, new Date(promotionNowTick));
  };

  const buildPromotedCartConfig = (product = {}, config = {}) => {
    const metadata = {
      ...(config.metadata && typeof config.metadata === "object" ? config.metadata : {}),
      ...(product.metadata && typeof product.metadata === "object" ? product.metadata : {})
    };

    if (config.unitPrice != null) {
      return { ...config, metadata };
    }

    if (!product.pricePromotionId && !product.flashPromoId) {
      return { ...config, metadata };
    }

    return {
      ...config,
      unitPrice: Number(product.price || 0),
      metadata: {
        ...metadata,
        pricePromotionApplied: true,
        flashPromoApplied: true
      }
    };
  };

  const addProduct = async (product, config = {}) => {
    if (!product?.id) return;
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile thêm món làm thay đổi bill trước khi thanh toán");
      if (!cancelled) return;
    }

    const promotedProduct = getPromotionPricedProduct(product);
    const promotedConfig = buildPromotedCartConfig(promotedProduct, config);

    setCart((currentCart) => {
      const targetUnitPrice = Number(promotedConfig.unitPrice ?? promotedProduct.price ?? 0);
      const targetPromoId = String(
        promotedConfig.metadata?.pricePromotionId ||
        promotedConfig.metadata?.flashPromoId ||
        ""
      );
      const canMerge = !promotedConfig.note && !promotedConfig.spice && !(promotedConfig.toppings || []).length && !(promotedConfig.selectedOptions || []).length;
      const existing = canMerge
        ? currentCart.find((item) =>
            item.productId === promotedProduct.id &&
            Number(item.price || 0) === targetUnitPrice &&
            String(item.metadata?.pricePromotionId || item.metadata?.flashPromoId || "") === targetPromoId &&
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

      return [createPosCartItem(promotedProduct, promotedConfig), ...currentCart];
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

    const promotedProduct = getPromotionPricedProduct(product || {});
    const promotedConfig = buildPromotedCartConfig(promotedProduct, config);

    setCart((current) =>
      current.map((item) => (
        item.cartId === cartId
          ? updatePosCartItemConfig(item, promotedProduct || item, promotedConfig)
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
    setPickupOrders([]);
    setDeliveryOrders([]);
    setPendingPaymentSessions([]);
    setHistoryError("");
    setPickupOrdersError("");
    setPickupQrSession(null);
    setPickupQrOrder(null);
    setPickupQrModalOpen(false);
    setPickupQrError("");
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

    const cashSummary = getCashPaymentSummary(totals.total);
    const normalizedReceived = normalizeCashReceived(cashReceived);
    if (normalizedReceived < cashSummary.paymentAmount) {
      setShiftMessage("Tiền khách đưa chưa đủ để xác nhận thanh toán.");
      return false;
    }

    const orderIdentity = createPosOrderIdentity(new Date());
    const requestKey = [
      "pos-cash",
      profile?.branchUuid || "branch",
      orderIdentity.orderCode
    ].join(":");

    setPaymentConfirmed({
      method: "cash",
      amount: cashSummary.paymentAmount,
      originalAmount: cashSummary.originalAmount,
      cashRoundingDiscount: cashSummary.cashRoundingDiscount,
      cashRoundingUnit: cashSummary.cashRoundingUnit,
      received: normalizedReceived,
      change: calculateCashChange(cashSummary.paymentAmount, normalizedReceived),
      reference: `CASH-${orderIdentity.orderCode}`,
      orderIdentity,
      requestKey
    });
    setShiftMessage("Đã xác nhận thanh toán tiền mặt. Đang mở két tiền...");
    void openLocalCashDrawer()
      .then(() => {
        setShiftMessage("Đã xác nhận thanh toán tiền mặt. Đã gửi lệnh mở két tiền.");
      })
      .catch((error) => {
        setShiftMessage(`Đã xác nhận thanh toán tiền mặt. Chưa mở được két: ${error?.message || "kiểm tra máy in/két tiền."}`);
      });
    return true;
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
    if (pickupQrSession?.id === session.id) {
      setPickupQrSession(null);
      setPickupQrOrder(null);
      setPickupQrModalOpen(false);
      setPickupQrError("");
    }
    if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
      await refreshPosRuntime(profile.branchUuid);
    }
    await refreshShiftSummary(shift);
    const source = String(session?.source || "").trim().toLowerCase();
    setShiftMessage(
      ["web", "qr_order"].includes(source)
        ? "Đã hủy QR của đơn website."
        : "Đã hủy phiên QR đang chờ."
    );
  };

  const refreshCurrentPosRuntime = async () => {
    await checkConnectionNow();
    await syncOfflineOrdersNow({ silent: true });
    const catalogConfigResult = await fetchPosCatalogConfig();
    if (catalogConfigResult.ok) {
      setRawCoupons(Array.isArray(catalogConfigResult.coupons) ? catalogConfigResult.coupons : []);
      setRawSmartPromotions(Array.isArray(catalogConfigResult.smartPromotions) ? catalogConfigResult.smartPromotions : []);
    }
    await refreshPosRuntime(profile?.branchUuid);
    await refreshShiftSummary(shift);
  };

  const printQrReceiptNow = async () => {
    if (!qrSession && !qrPreviewIdentity) {
      setQrError("Chưa có phiên QR để in.");
      return;
    }

    const identity = qrSession?.orderIdentity || qrPreviewIdentity || {};
    const qrUrl = qrSession?.qrImageUrl || buildPosQrImageUrl({
      branch,
      amount: qrSession?.amountExpected || totals.total,
      orderIdentity: identity
    });
    if (!qrUrl) {
      setQrError("Chưa tạo được mã QR để in. Kiểm tra cấu hình ngân hàng của chi nhánh.");
      return;
    }
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
        qrUrl,
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

  const confirmPickupOrderCashPayment = async (order = {}, cashReceived = "") => {
    if (!order?.id) return false;
    if (!shift?.id) {
      setPickupOrdersError("Cần mở ca POS trước khi thu tiền đơn hẹn lấy.");
      return false;
    }

    const amount = getWebsiteOrderAmount(order);
    const cashSummary = getCashPaymentSummary(amount);
    const normalizedReceived = normalizeCashReceived(cashReceived);
    if (normalizedReceived < cashSummary.paymentAmount) {
      setPickupOrdersError("Tiền khách đưa chưa đủ để xác nhận thanh toán.");
      return false;
    }

    const cashChange = calculateCashChange(cashSummary.paymentAmount, normalizedReceived);

    setPickupOrdersLoading(true);
    setPickupOrdersError("");
    const pendingWebsiteQrSession = findPendingWebsiteQrSession(order);
    if (pendingWebsiteQrSession?.id) {
      const cancelResult = await cancelPosPaymentSession(
        pendingWebsiteQrSession.id,
        "POS mobile tự hủy QR đơn website khi chuyển sang thu tiền mặt"
      );

      if (!cancelResult.ok) {
        setPickupOrdersLoading(false);
        setPickupOrdersError(
          cancelResult.message ||
          "Chưa hủy được QR đang chờ của đơn website. Vui lòng hủy QR trước khi thu tiền mặt."
        );
        return false;
      }

      setPendingPaymentSessions((currentSessions) => (
        currentSessions.filter((paymentSession) => paymentSession?.id !== pendingWebsiteQrSession.id)
      ));
      if (pickupQrSession?.id === pendingWebsiteQrSession.id) {
        setPickupQrSession(null);
        setPickupQrOrder(null);
        setPickupQrModalOpen(false);
        setPickupQrError("");
      }
    }

    const result = await markPickupOrderPaidCash({
      order,
      shift,
      cashierName: profile?.name || profile?.email || "POS mobile",
      paymentAmount: cashSummary.paymentAmount,
      cashRoundingDiscount: cashSummary.cashRoundingDiscount,
      cashRoundingUnit: cashSummary.cashRoundingUnit,
      cashReceived: normalizedReceived,
      cashChange,
      paymentReference: `${order?.fulfillmentType === "delivery" ? "CASH-DELIVERY" : "CASH-PICKUP"}-${Date.now()}`
    });
    setPickupOrdersLoading(false);

    if (!result.ok) {
      setPickupOrdersError(result.message || "Không cập nhật được thanh toán đơn hẹn lấy.");
      return false;
    }

    const printResult = await printPickupCustomerBill({
      order: result.order || order,
      paymentConfirmed: {
        method: "cash",
        amount: cashSummary.paymentAmount,
        originalAmount: cashSummary.originalAmount,
        cashRoundingDiscount: cashSummary.cashRoundingDiscount,
        cashRoundingUnit: cashSummary.cashRoundingUnit,
        received: normalizedReceived,
        change: cashChange,
        reference: result.order?.paymentReference || `${order?.fulfillmentType === "delivery" ? "CASH-DELIVERY" : "CASH-PICKUP"}-${Date.now()}`,
        paidAt: result.order?.paidAt || new Date().toISOString()
      }
    });

    let drawerMessage = "";
    try {
      await openLocalCashDrawer();
      drawerMessage = " Đã gửi lệnh mở két tiền.";
    } catch (error) {
      drawerMessage = ` Chưa mở được két: ${error?.message || "kiểm tra máy in/két tiền."}`;
    }

    setShiftMessage(`${result.message || "Đã thu tiền đơn hẹn lấy."}${printResult.message || ""}${drawerMessage}`.trim());
    if (profile?.branchUuid) {
      await refreshPosRuntime(profile.branchUuid);
    }
    await refreshShiftSummary(shift);
    return true;
  };

  const openPickupOrderQrPayment = async (order = {}) => {
    if (!order?.id) return false;
    if (!profile?.branchUuid || !shift?.id) {
      setPickupOrdersError("Cần đăng nhập và mở ca trước khi tạo QR.");
      return false;
    }

    setPickupQrModalOpen(true);
    setPickupQrLoading(true);
    setPickupQrError("");
    setPickupQrOrder(order);

    const orderIdentity = buildPickupOrderIdentity(order);
    const paymentReference = `${orderIdentity.displayOrderCode || orderIdentity.orderCode || "GHR"}-QR-${Date.now().toString().slice(-6)}`.toUpperCase();
    const result = await createPosPaymentSession({
      source: "web",
      orderId: order.id,
      paymentReference,
      branchUuid: profile.branchUuid,
      posShiftId: shift.id,
      branchName: profile.branchName,
      cashierName: profile?.name || profile?.email || "POS mobile",
      customerName: order.customerName,
      customerPhone: normalizeCustomerPhone(order.customerPhone),
      amountExpected: getWebsiteOrderAmount(order),
      cart: [],
      checkout: {
        orderIdentity,
        existingOrderId: order.id,
        pickupOrderId: order.fulfillmentType === "pickup" ? order.id : "",
        deliveryOrderId: order.fulfillmentType === "delivery" ? order.id : "",
        websiteOrderId: order.id,
        posShiftId: shift.id,
        sourceType: getWebsiteOrderSourceType(order)
      }
    });
    setPickupQrLoading(false);

    if (!result.ok || !result.session?.id) {
      setPickupQrError(result.message || "Không tạo được phiên thanh toán QR cho đơn hẹn lấy.");
      setPickupOrdersError(result.message || "Không tạo được phiên thanh toán QR cho đơn hẹn lấy.");
      return false;
    }

    setPickupOrdersError("");
    setPickupQrSession(result.session);
    setPickupQrOrder(order);
    setPickupQrModalOpen(true);
    setShiftMessage(result.reused
      ? "Đã mở lại QR đang chờ thanh toán cho đơn hẹn lấy."
      : "Đã tạo QR cho đơn hẹn lấy, đang chờ khách chuyển khoản.");
    return true;
  };

  const finalizePickupQrPayment = async (session = {}) => {
    if (!session?.id || !pickupQrOrder?.id) return false;

    setPickupQrLoading(true);
    setPickupQrError("");
    const result = await markPickupOrderPaidQr({
      order: pickupQrOrder,
      shift,
      cashierName: profile?.name || profile?.email || "POS mobile",
      paymentReference: session.paymentReference,
      paidAt: session.paidAt || new Date().toISOString(),
      paymentAmount: session.amountPaid || session.amountExpected || getWebsiteOrderAmount(pickupQrOrder)
    });
    setPickupQrLoading(false);

    if (!result.ok) {
      setPickupQrError(result.message || "Đã nhận QR nhưng chưa cập nhật được đơn hẹn lấy.");
      return false;
    }

    await markPosPaymentSessionConverted(session.id, pickupQrOrder.id);
    const printResult = await printPickupCustomerBill({
      order: result.order || pickupQrOrder,
      paymentConfirmed: {
        method: "bank_qr",
        amount: session.amountPaid || session.amountExpected || getWebsiteOrderAmount(pickupQrOrder),
        reference: session.paymentReference,
        paidAt: session.paidAt || result.order?.paidAt || new Date().toISOString()
      }
    });
    setPickupQrSession(null);
    setPickupQrOrder(null);
    setPickupQrModalOpen(false);
    setPickupQrError("");
    setShiftMessage(`${result.message || "Đã nhận thanh toán QR đơn hẹn lấy."}${printResult.message || ""}`.trim());
    if (profile?.branchUuid) {
      await refreshPosRuntime(profile.branchUuid);
    }
    await refreshShiftSummary(shift);
    return true;
  };

  const cancelPickupOrderQrPayment = async (session = null) => {
    const activeSession = session?.id ? session : pickupQrSession;
    if (!activeSession?.id) {
      setPickupQrSession(null);
      setPickupQrOrder(null);
      setPickupQrModalOpen(false);
      setPickupQrError("");
      return;
    }

    setPickupQrLoading(true);
    setPickupQrError("");
    const result = await cancelPosPaymentSession(activeSession.id, "POS mobile hủy QR đơn hẹn lấy");
    setPickupQrLoading(false);
    if (!result.ok) {
      setPickupQrError(result.message || "Không hủy được QR đơn hẹn lấy.");
      return;
    }

    setPickupQrSession(null);
    setPickupQrOrder(null);
    setPickupQrModalOpen(false);
    setPickupQrError("");
    setShiftMessage("Đã hủy QR của đơn hẹn lấy.");
  };

  const confirmPickupQrPaidManually = async () => {
    if (!pickupQrSession?.id) return;
    if (isPosPaymentSessionPaid(pickupQrSession)) {
      await finalizePickupQrPayment(pickupQrSession);
      return;
    }

    setPickupQrLoading(true);
    setPickupQrError("");
    const result = await confirmPosPaymentSessionManually(pickupQrSession.id);
    setPickupQrLoading(false);
    if (!result.ok) {
      setPickupQrError(result.message || "Không xác nhận được thanh toán QR.");
      return;
    }

    setPickupQrSession(result.session);
    if (isPosPaymentSessionPaid(result.session)) {
      await finalizePickupQrPayment(result.session);
    }
  };

  const printPickupQrReceiptNow = async () => {
    if (!pickupQrSession && !pickupQrOrder) {
      setPickupQrError("Chưa có phiên QR để in.");
      return;
    }

    const identity = pickupQrSession?.orderIdentity || buildPickupOrderIdentity(pickupQrOrder || {});
    const amount = pickupQrSession?.amountExpected || getWebsiteOrderAmount(pickupQrOrder) || 0;
    const qrUrl = buildPosQrImageUrl({
      branch,
      amount,
      orderIdentity: {
        ...identity,
        paymentReference: pickupQrSession?.paymentReference
      }
    });
    if (!qrUrl) {
      setPickupQrError("Chưa tạo được mã QR để in. Kiểm tra cấu hình ngân hàng của chi nhánh.");
      return;
    }

    const receiptText = buildPosQrReceiptText({
      branchName: profile?.branchName,
      amount,
      transferContent: pickupQrSession?.paymentReference || buildPosPaymentReference(identity, branch),
      orderCode: identity.displayOrderCode || identity.orderCode || pickupQrSession?.paymentReference,
      customerName: pickupQrOrder?.customerName || pickupQrSession?.customerName || ""
    });

    setPickupQrPrintBusy(true);
    setPickupQrError("");
    try {
      await printLocalReceipt({
        text: receiptText,
        qrUrl,
        sourceType: getWebsiteOrderQrSourceType(pickupQrOrder)
      });
      setShiftMessage("Đã in phiếu QR cho đơn hẹn lấy.");
    } catch (error) {
      setPickupQrError(error?.message || "Không in được phiếu QR.");
    } finally {
      setPickupQrPrintBusy(false);
    }
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
        setShiftMessage("Đang in phiếu kết ca...");
        const receiptText = buildPosShiftCloseReceiptText({
          shift: {
            ...shift,
            closedAt: result.shift?.closedAt || new Date().toISOString()
          },
          summary: latestSummary || shiftSummary || {},
          closingCashCounted,
          closingCashBreakdown,
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
    setPickupOrders([]);
    setDeliveryOrders([]);
    setPickupQrSession(null);
    setPickupQrOrder(null);
    setPickupQrModalOpen(false);
    setPickupQrError("");
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
    if (createCashOrderInFlightRef.current) {
      setShiftMessage("Đang tạo đơn. Vui lòng chờ trong giây lát.");
      return;
    }

    createCashOrderInFlightRef.current = true;
    setBusy(true);

    try {
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

    const orderIdentity = paymentConfirmed.orderIdentity || createPosOrderIdentity(new Date());
    const requestKey = paymentConfirmed.requestKey || [
      "pos-cash",
      profile.branchUuid || "branch",
      orderIdentity.orderCode
    ].join(":");
    const paymentReference = paymentConfirmed.reference || `CASH-${orderIdentity.orderCode}`;
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
      paymentReference,
      paidAt: paymentConfirmed.paidAt || new Date().toISOString(),
      posShiftId: shift.id,
      paymentMeta: {
        ...(paymentConfirmed.paymentSessionId ? { provider: "sepay", paymentSessionId: paymentConfirmed.paymentSessionId } : {}),
        originalAmount: paymentConfirmed.originalAmount || paymentConfirmed.amount,
        cashRoundingDiscount: paymentConfirmed.cashRoundingDiscount || 0,
        cashRoundingUnit: paymentConfirmed.cashRoundingUnit || 0,
        requestKey
      },
      orderIdentity
    });
    setShiftMessage(result.message || "");
    if (!result.ok) {
      return;
    }
    if (result.offline) {
      await refreshOfflineOrderCount();
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
    if (!result.offline) {
      await refreshPosRuntime(profile.branchUuid);
      await refreshShiftSummary(shift);
    }
    setShiftMessage(`${result.message || ""}${printMessage}`.trim());
    } finally {
      createCashOrderInFlightRef.current = false;
      setBusy(false);
    }
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
    allProducts: pricedProducts,
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
    pickupQrSession,
    pickupQrOrder,
    pickupQrModalOpen,
    setPickupQrModalOpen,
    pickupQrLoading,
    pickupQrError,
    pickupQrPrintBusy,
    branch,
    busyPagers,
    recentOrders,
    pickupOrders,
    deliveryOrders,
    pendingPaymentSessions,
    historyLoading,
    historyError,
    pickupOrdersLoading,
    pickupOrdersError,
    connectionStatus,
    printStationStatus,
    offlineOrderCount,
    offlineSyncBusy,
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
    confirmPickupOrderCashPayment,
    openPickupOrderQrPayment,
    cancelPickupOrderQrPayment,
    confirmPickupQrPaidManually,
    printPickupQrReceiptNow,
    reprintRecentOrder,
    openRecentOrderDetail,
    refreshCurrentPosRuntime,
    checkConnectionNow,
    syncOfflineOrdersNow,
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
