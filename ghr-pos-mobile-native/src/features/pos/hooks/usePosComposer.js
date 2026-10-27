import { mergePosHistoryOrders } from "../../../services/pos/posHistoryDisplayService";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import createPosReadCoalescer from "../../../utils/posReadCoalescer";
import usePosPagerSettings from "./usePosPagerSettings";
import usePosWebsiteOrderSync from "./usePosWebsiteOrderSync";
import { readWebsitePaidReceiptStatus } from "../../../services/pos/posWebsiteReceiptService";
import usePosOfflineAutoSync from "./usePosOfflineAutoSync";
import usePosPointInputLimit from "./usePosPointInputLimit";
import { syncPosOfflineOrders } from "../../../services/pos/posOfflineSyncService";

import {
  restorePosSession,
  signInPosOperator,
  signOutPosOperator,
  subscribePosAuthState
} from "../../../services/auth/posAuthService";
import {
  isValidVietnamMobilePhone,
  lookupPosCustomerByPhone,
  normalizeCustomerPhone
} from "../../../services/pos/posCustomerService";
import { createPosTakeawayOrderMobile } from "../../../services/pos/posOrderService";
import { getPosOrderPayableAmount, isZeroPosOrder } from "../../../services/pos/posZeroOrderPolicy";
import { invalidatePosStamps } from "../../../services/pos/posStampService";
import { getWebsiteOrderAlertChanges, isWebsiteOrderPaid, playPosOrderAlert } from "../../../services/pos/posOrderAlertService";
import { readPhoneCustomerBillStatus } from "../../../services/pos/posPhoneOrderService";
import {
  buildPosCustomerBillText,
  buildPosPreparationBillText,
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
  markPickupOrderPaidCash,
  markPickupOrderPaidQr
} from "../../../services/pos/posPickupOrderService";
import { buildPosPaymentReference, buildPosQrImageUrl } from "../../../services/pos/posPaymentService";
import {
  attachPosPaymentSessionOrder,
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
  refreshPosPaymentAuthSession,
  rememberPosPaymentSession,
  subscribePosPaymentSessions
} from "../../../services/pos/posPaymentSessionService";
import { fetchPosCatalogConfig } from "../../../services/pos/posCatalogConfigService";
import { startPosPrintStation } from "../../../services/pos/posPrintStationService";
import {
  checkPosSupabaseConnection,
  getPosOfflineOrderCount
} from "../../../services/pos/posOfflineOrderQueueService";
import { fetchPosProducts, isPosProductAvailableForBranch } from "../../../services/pos/posProductService";
import {
  closePosShift,
  fetchActivePosShift,
  fetchPosShiftSummary,
  fetchRecentClosedPosShifts,
  openPosShift
} from "../../../services/pos/posShiftService";
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
import { makePosStampGift, withPosStampSummary } from "../../../services/pos/posStampService";
import { applyPosPricePromotionToProduct, buildPosPromotionHints, syncAutoGiftItems } from "../../../shared/pos/posPromotions";

const POS_PAYMENT_POLL_FALLBACK_MS = 5000;
const POS_RUNTIME_REFRESH_MS = 30000;

function mergeRealtimePaymentSession(currentSessions = [], nextSession = {}) {
  const sessions = Array.isArray(currentSessions) ? currentSessions : [];
  if (!nextSession?.id) return sessions;
  if (isPosPaymentSessionTerminal(nextSession)) {
    return sessions.filter((session) => session?.id !== nextSession.id);
  }

  const existingIndex = sessions.findIndex((session) => session?.id === nextSession.id);
  if (existingIndex < 0) return [nextSession, ...sessions];

  return sessions.map((session, index) => (
    index === existingIndex ? nextSession : session
  ));
}

export default function usePosComposer({ historyVisible = false, deviceMode = "cashier" } = {}) {
  const phoneOrderRequestRef = useRef(null);
  const phoneQrOpenInFlightRef = useRef(false);
  const announcedQrPaymentIdsRef = useRef(new Set());
  const runtimeRefreshInFlightRef = useRef(false);
  const historyVisibleRef = useRef(historyVisible);
  historyVisibleRef.current = historyVisible;
  const coalesceShiftSummaryRef = useRef(null);
  if (!coalesceShiftSummaryRef.current) coalesceShiftSummaryRef.current = createPosReadCoalescer();
  const shiftSummaryRequestIdRef = useRef(0);
  const createCashOrderInFlightRef = useRef(false);
  const pickupPaymentInFlightRef = useRef(false);
  const connectionRecoveryInFlightRef = useRef(false);
  const benefitChangeInFlightRef = useRef(false);
  const offlineSyncInFlightRef = useRef(false);
  const offlineSyncBranchRef = useRef("");
  const customerLookupPhoneRef = useRef("");
  const knownWebsiteOrderIdsRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  offlineSyncBranchRef.current = deviceMode === "cashier" && session?.user?.id ? profile?.branchUuid || "" : "";
  const [shift, setShift] = useState(null);
  const [openingCash, setOpeningCash] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [shiftMessage, setShiftMessage] = useState("");
  const [shiftSummary, setShiftSummary] = useState(null);
  const [shiftSummaryError, setShiftSummaryError] = useState("");
  const [lastClosedShift, setLastClosedShift] = useState(null);
  const [recentClosedShifts, setRecentClosedShifts] = useState([]);
  const [closedShiftsLoading, setClosedShiftsLoading] = useState(false);
  const [closedShiftsError, setClosedShiftsError] = useState("");
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
  const refreshWebsiteOrders = usePosWebsiteOrderSync({
    branchUuid: profile?.branchUuid, userId: session?.user?.id,
    setPickupOrders, setDeliveryOrders,
    setLoading: setPickupOrdersLoading, setError: setPickupOrdersError
  });
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
    () => buildPosCatalog({
      products: rawProducts.filter((product) => isPosProductAvailableForBranch(product, profile?.branchUuid)),
      categories: rawCategories
    }),
    [profile?.branchUuid, rawCategories, rawProducts]
  );

  const defaultCategory = useMemo(
    () => catalog.categories.find((category) => category !== ALL_CATEGORY) || ALL_CATEGORY,
    [catalog.categories]
  );

  const effectiveCategory = catalog.categories.includes(activeCategory) ? activeCategory : defaultCategory;

  const pricedProducts = useMemo(
    () => catalog.products.map((product) => applyPosPricePromotionToProduct(product, rawSmartPromotions, new Date(promotionNowTick), profile?.branchUuid)),
    [catalog.products, profile?.branchUuid, promotionNowTick, rawSmartPromotions]
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
      branchId: profile?.branchUuid || "",
      selectedVoucherId,
      pointsInput
    }),
    [baseTotals.subtotal, customerLookup.result, pointsInput, profile?.branchUuid, rawCoupons, selectedVoucherId]
  );
  usePosPointInputLimit({
    usablePoints: loyaltyBenefit.usablePoints,
    pointSpendStep: loyaltyBenefit.pointSpendStep,
    setPointsInput
  });
  const totals = useMemo(() => ({
    ...baseTotals,
    voucherDiscount: loyaltyBenefit.voucherDiscount,
    pointsDiscount: loyaltyBenefit.pointsDiscount,
    total: Math.max(0, baseTotals.subtotal - loyaltyBenefit.voucherDiscount - loyaltyBenefit.pointsDiscount)
  }), [baseTotals, loyaltyBenefit.pointsDiscount, loyaltyBenefit.voucherDiscount]);

  const buildTotalsWithBenefit = (benefit = loyaltyBenefit) => ({
    ...baseTotals,
    voucherDiscount: Number(benefit?.voucherDiscount || 0),
    pointsDiscount: Number(benefit?.pointsDiscount || 0),
    total: Math.max(
      0,
      Number(baseTotals.subtotal || 0)
        - Number(benefit?.voucherDiscount || 0)
        - Number(benefit?.pointsDiscount || 0)
    )
  });

  const { pagerEnabled: branchPagerEnabled, pagerSettingsReady: branchPagerSettingsReady, pagerSettingsSaving, changePagerEnabled } = usePosPagerSettings({
    branchUuid: profile?.branchUuid, phoneMode: deviceMode !== "cashier",
    locked: busy || qrLoading || Boolean(qrSession) || Boolean(paymentConfirmed),
    onMessage: setShiftMessage, onClearPager: () => setPagerNumber("")
  });
  const pagerEnabled = qrSession ? qrSession.checkoutSnapshot?.pagerEnabled !== false : branchPagerEnabled;
  const pagerSettingsReady = Boolean(qrSession) || branchPagerSettingsReady;
  const normalizedPager = useMemo(() => pagerEnabled ? normalizePagerNumber(pagerNumber) : "", [pagerNumber, pagerEnabled]);
  const pagerBusy = Boolean(normalizedPager && busyPagers.includes(normalizedPager));
  const branch = profile?.branch || {
    branchUuid: profile?.branchUuid,
    name: profile?.branchName
  };
  const promotionHints = useMemo(
    () => buildPosPromotionHints({
      smartPromotions: rawSmartPromotions,
      branchUuid: profile?.branchUuid,
      products: pricedProducts,
      subtotal: baseTotals.subtotal
    }),
    [baseTotals.subtotal, pricedProducts, profile?.branchUuid, rawSmartPromotions]
  );

  useEffect(() => {
    const websiteOrders = [...pickupOrders, ...deliveryOrders];
    const { next, events } = getWebsiteOrderAlertChanges(websiteOrders, knownWebsiteOrderIdsRef.current);
    knownWebsiteOrderIdsRef.current = next;
    if (deviceMode !== "phone") events.forEach((order) => {
      playPosOrderAlert(order.id, isWebsiteOrderPaid(order) ? "paid" : "website").catch(() => {});
    });
  }, [deliveryOrders, pickupOrders, deviceMode]);

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
    order.metadata?.deviceMode === "phone" ? "pos_mobile" : order?.fulfillmentType === "delivery" ? "website_delivery" : "website_pickup"
  );

  const getWebsiteOrderAmount = (order = {}) => (
    getPosOrderPayableAmount(order)
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

  const mergeRecentHistoryOrders = mergePosHistoryOrders;

  const printCounterOrderBills = async (billData = {}) => {
    billData = { ...billData, order: await withPosStampSummary(billData.order, billData.customerPhone, { force: true }) };
    const failures = [];
    try {
      await printLocalReceipt({
        text: buildPosPreparationBillText(billData),
        sourceType: "preparation_ticket"
      });
    } catch (error) {
      failures.push(`bill làm món: ${error?.message || "Lỗi máy in."}`);
    }

    try {
      await printLocalReceipt({
        text: buildPosCustomerBillText(billData),
        sourceType: "customer_bill",
        customerPhone: billData.customerPhone
      });
    } catch (error) {
      failures.push(`bill khách: ${error?.message || "Lỗi máy in."}`);
    }

    if (failures.length) {
      throw new Error(failures.join("; "));
    }
  };

  const printPickupCustomerBill = async ({ order = {}, paymentConfirmed = null } = {}) => {
    if (!order?.id) {
      return { ok: false, message: " Thiếu mã đơn để in bill." };
    }
    if (order.metadata?.deviceMode === "phone") {
      return readPhoneCustomerBillStatus(order, profile?.branchUuid);
    }
    if (["bank_qr", "momo"].includes(order.paymentMethod || order.payment_method)) {
      const queuedReceipt = await readWebsitePaidReceiptStatus(order.id, profile?.branchUuid);
      if (queuedReceipt) return queuedReceipt;
    }

    const result = await readPosOrderForPrint(order.id);
    if (!result.ok || !result.printableOrder) {
      return {
        ok: false,
        message: ` Chưa in được bill: ${result.message || "không đọc được dữ liệu đơn."}`
      };
    }

    const printableOrder = await withPosStampSummary(result.printableOrder, "", { force: true });
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
        sourceType: "customer_bill",
        customerPhone: printableOrder.customerPhone
      });
      return { ok: true, message: " Đã in bill tại máy POS." };
    } catch (error) {
      return {
        ok: false,
        message: ` Chưa in được bill: ${error?.message || "lỗi máy in."}`
      };
    }
  };

  const resetCompletedSale = async () => {
    setCart([]);
    setPaymentConfirmed(null);
    setOrderNote("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerLookup({ loading: false, result: null, error: "" });
    customerLookupPhoneRef.current = "";
    setSelectedVoucherId("");
    setPointsInput("");
    setPagerNumber("");
    setQrSession(null);
    setQrPreviewIdentity(null);
    setQrModalOpen(false);
    setQrError("");
    if (profile?.branchUuid) {
      await forgetPosPaymentSession(profile.branchUuid);
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
    const websiteTask = includeRecentOrders ? refreshWebsiteOrders({ silent }) : Promise.resolve(null);
    if (runtimeRefreshInFlightRef.current) return websiteTask;
    runtimeRefreshInFlightRef.current = true;
    if (includeRecentOrders && !silent) {
      setHistoryLoading(true);
      setHistoryError("");
    }
    try {
      const [nextBusyPagers, nextRecentOrders, , nextWebsiteHistoryOrders, nextPaymentSessions] = await Promise.all([
        getBusyPosPagerNumbers({ branchUuid }),
        includeRecentOrders ? getPosRecentOrders({ branchUuid, shiftId: shift?.id || "", limit: 120 }) : Promise.resolve(null),
        websiteTask,
        includeRecentOrders && historyVisibleRef.current
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
        setRecentOrders(mergeRecentHistoryOrders(nextRecentOrders, nextWebsiteHistoryOrders, 160));
      }
      setPendingPaymentSessions(activePaymentSessions);
    } catch (error) {
      setHistoryError(error?.message || "Không tải được lịch sử POS.");
    } finally {
      runtimeRefreshInFlightRef.current = false;
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!historyVisible || !profile?.branchUuid) return undefined;
    let cancelled = false;
    let timer;
    const loadHistory = () => {
      if (cancelled) return;
      if (runtimeRefreshInFlightRef.current) {
        timer = globalThis.setTimeout(loadHistory, 250);
        return;
      }
      void refreshPosRuntime(profile.branchUuid, { includeRecentOrders: true });
    };
    loadHistory();
    return () => { cancelled = true; globalThis.clearTimeout(timer); };
  }, [historyVisible, profile?.branchUuid]);

  const refreshShiftSummary = async (targetShift = shift, { fresh = true } = {}) => {
    const requestId = ++shiftSummaryRequestIdRef.current;
    if (!targetShift?.id) {
      setShiftSummary(null);
      setShiftSummaryError("");
      return null;
    }

    const key = [session?.user?.id, profile?.branchUuid, targetShift.id, targetShift.openingCash].join(":");
    const result = await coalesceShiftSummaryRef.current(key, () => fetchPosShiftSummary({
      shiftId: targetShift.id,
      openingCash: targetShift.openingCash
    }), { fresh });
    if (requestId !== shiftSummaryRequestIdRef.current) return result.ok ? result.summary : null;

    if (result.ok) {
      setShiftSummary(result.summary);
      setShiftSummaryError("");
      return result.summary;
    }

    setShiftSummary(result.summary || null);
    setShiftSummaryError(result.message || "Không tải được tổng quan ca POS.");
    return result.summary || null;
  };

  const syncShiftBeforeClose = async () => {
    const branchUuid = String(profile?.branchUuid || "").trim();
    if (!branchUuid) {
      return {
        ok: false,
        shift: null,
        summary: null,
        activeSessions: [],
        message: "Không xác định được chi nhánh POS. Vui lòng đăng nhập lại."
      };
    }

    const latestShiftResult = await fetchActivePosShift({ branchUuid });
    if (!latestShiftResult.ok) {
      return {
        ok: false,
        shift: null,
        summary: null,
        activeSessions: [],
        message: `${latestShiftResult.message || "Không đồng bộ được ca POS."} Kiểm tra mạng rồi thử lại.`
      };
    }

    const latestShift = latestShiftResult.shift;
    if (!latestShift?.id) {
      setShift(null);
      setShiftSummary(null);
      setPendingPaymentSessions([]);
      return {
        ok: false,
        shift: null,
        summary: null,
        activeSessions: [],
        message: "Ca này không còn mở trên máy chủ. App đã làm mới dữ liệu; kiểm tra mục ca đã kết hoặc mở ca mới."
      };
    }

    let latestSessions = [];
    try {
      latestSessions = await listPosPaymentSessions(branchUuid);
    } catch (error) {
      return {
        ok: false,
        shift: latestShift,
        summary: null,
        activeSessions: [],
        message: `${error?.message || "Không tải được phiên QR."} Kiểm tra mạng rồi thử lại.`
      };
    }

    const activeSessions = await cleanupExpiredPaymentSessions(branchUuid, latestSessions);
    const activeQrSession = activeSessions.find((item) => item?.id === qrSession?.id) || null;
    setShift(latestShift);
    setPendingPaymentSessions(activeSessions);
    if (qrSession?.id && !activeQrSession) {
      setQrSession(null);
      setQrPreviewIdentity(null);
      setQrModalOpen(false);
      await forgetPosPaymentSession(branchUuid);
    }

    const summary = await refreshShiftSummary(latestShift, { fresh: true });
    if (!summary) {
      return {
        ok: false,
        shift: latestShift,
        summary: null,
        activeSessions,
        message: "Không tải được tổng quan ca mới nhất. Kiểm tra mạng rồi thử lại."
      };
    }

    return {
      ok: true,
      shift: latestShift,
      summary,
      activeSessions,
      message: ""
    };
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

  const recoverPosConnection = async ({ silent = true } = {}) => {
    if (connectionRecoveryInFlightRef.current) return false;
    connectionRecoveryInFlightRef.current = true;
    try {
      const authResult = await refreshPosPaymentAuthSession();
      if (!authResult.ok) {
        setConnectionStatus({
          checking: false,
          online: false,
          warning: true,
          message: authResult.message,
          lastCheckedAt: new Date().toISOString()
        });
        if (!silent) setShiftMessage(authResult.message);
        return false;
      }

      const connection = await checkConnectionNow();
      if (!connection.online) return false;

      const branchUuid = String(profile?.branchUuid || "").trim();
      if (branchUuid) {
        const latestShiftResult = await fetchActivePosShift({ branchUuid });
        if (latestShiftResult.ok) {
          setShift(latestShiftResult.shift);
          await refreshShiftSummary(latestShiftResult.shift);
        }
        await refreshPosRuntime(branchUuid, { includeRecentOrders: true, silent: true });
      }
      if (!silent && authResult.refreshed) {
        setShiftMessage("Đã tự làm mới kết nối POS.");
      }
      return true;
    } catch (error) {
      const message = error?.message || "Chưa thể tự kết nối lại POS.";
      setConnectionStatus({
        checking: false,
        online: false,
        warning: true,
        message,
        lastCheckedAt: new Date().toISOString()
      });
      if (!silent) setShiftMessage(message);
      return false;
    } finally {
      connectionRecoveryInFlightRef.current = false;
    }
  };

  const syncOfflineOrdersNow = async ({ silent = false, onlyWhenQueued = false } = {}) => {
    const branchUuid = offlineSyncBranchRef.current;
    if (!branchUuid || offlineSyncInFlightRef.current) {
      return { ok: false, synced: 0, remaining: offlineOrderCount };
    }
    offlineSyncInFlightRef.current = true;
    try {
      const queuedCount = await refreshOfflineOrderCount();
      if (onlyWhenQueued && !queuedCount) return { ok: true, synced: 0, remaining: 0 };
      setOfflineSyncBusy(true);
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

      if (!queuedCount) {
        setOfflineOrderCount(0);
        if (!silent) setShiftMessage("Không có đơn offline cần đồng bộ.");
        return { ok: true, synced: 0, remaining: 0 };
      }

      const { synced } = await syncPosOfflineOrders(branchUuid, () => offlineSyncBranchRef.current === branchUuid);

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
    } catch (error) {
      if (!silent) setShiftMessage(error?.message || "Chưa đồng bộ được đơn lưu tạm. App sẽ tự thử lại.");
      return { ok: false, synced: 0, remaining: offlineOrderCount };
    } finally {
      offlineSyncInFlightRef.current = false;
      setOfflineSyncBusy(false);
    }
  };

  usePosOfflineAutoSync({ enabled: Boolean(session?.user?.id && profile?.branchUuid), sync: syncOfflineOrdersNow });

  const applyPaymentSessionState = (session) => {
    if (!session?.id) return;
    setQrSession(session);
    setQrPreviewIdentity(session.orderIdentity || null);
    if (Array.isArray(session.cartSnapshot) && session.cartSnapshot.length) {
      setCart(session.cartSnapshot);
    }
    setPagerNumber(session.pagerNumber || "");
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
        method: session.provider === "momo" ? "momo" : "bank_qr",
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
    if (session.source === "qr_order" && session.orderId) {
      await resetCompletedSale();
      await refreshPosRuntime(profile?.branchUuid, { silent: true });
      setShiftMessage("Đã nhận thanh toán QR. Máy chủ đã tự chốt đơn và gửi xuống bếp.");
      return true;
    }
    const paymentMethod = session.provider === "momo" ? "momo" : "bank_qr";

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
      method: paymentMethod,
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
      pagerNumber: session.pagerNumber || "",
      pagerEnabled: checkout.pagerEnabled !== false,
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
      paymentMethod,
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
      const billData = {
        order: result.order,
        cart: Array.isArray(session.cartSnapshot) && session.cartSnapshot.length ? session.cartSnapshot : cart,
        totals: sessionTotals,
        customerName: session.customerName || customerName || customerLookup.result?.customerName || "",
        customerPhone: normalizeCustomerPhone(session.customerPhone || customerPhone),
        pagerNumber: session.pagerNumber || "",
      pagerEnabled: checkout.pagerEnabled !== false,
        branchName: profile.branchName,
        cashierName: session.cashierName || profile.name || profile.email,
        orderNote,
        paymentConfirmed: qrPaymentConfirmed
      };
      await printCounterOrderBills(billData);
      printMessage = " Đã tự động in bill làm món và bill khách tại máy POS.";
    } catch (printError) {
      printMessage = ` Đã nhận chuyển khoản nhưng chưa in được bill: ${printError?.message || "Lỗi máy in."}`;
    }

    await markPosPaymentSessionConverted(
      session.id,
      result.order?.id || result.order?.orderCode
    );

    await resetCompletedSale();
    if (!result.offline) {
      await refreshPosRuntime(profile.branchUuid);
      await refreshShiftSummary(shift);
    }
    setShiftMessage(`Đã chuyển khoản thành công.${printMessage}`.trim());
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
      const closedShiftsResult = await fetchRecentClosedPosShifts({
        branchUuid: restored.profile.branchUuid,
        registerKey: "main",
        days: 7
      });
      if (active) {
        setRecentClosedShifts(closedShiftsResult.shifts || []);
        setClosedShiftsError(closedShiftsResult.ok ? "" : closedShiftsResult.message);
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
        shiftSummaryRequestIdRef.current += 1;
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
    if (!profile?.branchUuid || !session?.user?.id) return undefined;

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void recoverPosConnection({ silent: true });
      }
    });

    return () => subscription.remove();
  }, [profile?.branchUuid, session?.user?.id]);

  useEffect(() => {
    const branchUuid = String(profile?.branchUuid || "").trim();
    const userId = String(session?.user?.id || "").trim();
    if (deviceMode !== "cashier" || !branchUuid || !userId) {
      setPrintStationStatus({
        running: false,
        tone: "idle",
        message: deviceMode === "phone" ? "Điện thoại gửi lệnh về trạm in tại quán." : "Đăng nhập POS để khởi động trạm in."
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
        pollFallback: false,
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
  }, [profile?.branchName, profile?.branchUuid, session?.user?.id, deviceMode]);


  useEffect(() => {
    const branchUuid = String(profile?.branchUuid || "").trim();
    if (!branchUuid) return undefined;

    return subscribePosPaymentSessions(branchUuid, (nextSession) => {
      setPendingPaymentSessions((currentSessions) => (
        mergeRealtimePaymentSession(currentSessions, nextSession)
      ));

      if (nextSession.id === qrSession?.id) {
        setQrSession(nextSession);
      }
      if (nextSession.id === pickupQrSession?.id) {
        setPickupQrSession(nextSession);
      }
    });
  }, [pickupQrSession?.id, profile?.branchUuid, qrSession?.id]);

  useEffect(() => {
    const phoneDigits = String(customerPhone || "").replace(/\D+/g, "");
    const phoneKey = normalizeCustomerPhone(phoneDigits);
    if (customerLookupPhoneRef.current !== phoneKey) {
      customerLookupPhoneRef.current = phoneKey;
      setSelectedVoucherId("");
      setPointsInput("");
      setPaymentConfirmed(null);
    }
    if (!phoneDigits) {
      setCustomerLookup({
        loading: false,
        result: null,
        error: ""
      });
      return undefined;
    }

    if (!isValidVietnamMobilePhone(phoneDigits)) {
      setCustomerLookup({
        loading: false,
        result: null,
        error: "Số điện thoại không hợp lệ, vui lòng nhập lại."
      });
      return undefined;
    }

    let alive = true;
    setCustomerLookup({ loading: true, result: null, error: "" });
    const timer = globalThis.setTimeout(() => {
      lookupPosCustomerByPhone(phoneKey)
        .then((result) => {
          if (!alive) return;
          if (!result?.ok) {
            setCustomerLookup({
              loading: false,
              result: null,
              error: result?.message || "Không tra được thông tin khách."
            });
            return;
          }
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
    let checking = false;
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
        const terminalStatus = String(session?.status || "").trim().toLowerCase();
        if (terminalStatus === "converted" && session?.orderId) {
          await resetCompletedSale();
          if (profile?.branchUuid) {
            await refreshPosRuntime(profile.branchUuid, { silent: true });
          }
          setShiftMessage("Đã thanh toán QR và tạo đơn thành công. Bill mới đã sẵn sàng.");
          return;
        }
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
      if (!active || checking || finalizing) return;
      checking = true;
      try {
        const session = await readPosPaymentSession(qrSession.id);
        await handleSession(session);
      } catch (error) {
        setQrError(error?.message || "Không kiểm tra được phiên QR.");
      } finally {
        checking = false;
      }
    };

    checkPaymentSession();
    const timer = globalThis.setInterval(checkPaymentSession, POS_PAYMENT_POLL_FALLBACK_MS);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void checkPaymentSession();
    });
    return () => {
      active = false;
      globalThis.clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [qrSession?.id, qrSession?.isPaymentSession, qrSession?.status, qrSession?.updatedAt]);

  useEffect(() => {
    if (!pickupQrSession?.id || !pickupQrSession.isPaymentSession) return undefined;

    let active = true;
    let finalizing = false;
    let checking = false;
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
      if (!active || checking || finalizing) return;
      checking = true;
      try {
        const session = await readPosPaymentSession(pickupQrSession.id);
        await handleSession(session);
      } catch (error) {
        setPickupQrError(error?.message || "Không kiểm tra được phiên QR đơn hẹn lấy.");
      } finally {
        checking = false;
      }
    };

    checkPaymentSession();
    const timer = globalThis.setInterval(checkPaymentSession, POS_PAYMENT_POLL_FALLBACK_MS);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void checkPaymentSession();
    });
    return () => {
      active = false;
      globalThis.clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [
    pickupQrOrder?.id,
    pickupQrSession?.id,
    pickupQrSession?.isPaymentSession,
    pickupQrSession?.status,
    pickupQrSession?.updatedAt
  ]);

  useEffect(() => {
    if (!profile?.branchUuid || !shift?.id) return undefined;

    const timer = globalThis.setInterval(() => {
      if (AppState.currentState !== "active") return;
      refreshPosRuntime(profile.branchUuid, { includeRecentOrders: true, silent: true });
      refreshShiftSummary(shift, { fresh: false });
    }, POS_RUNTIME_REFRESH_MS);

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
    return matched || applyPosPricePromotionToProduct(product, rawSmartPromotions, new Date(promotionNowTick), profile?.branchUuid);
  };

  const changePosBenefit = async (setter, value) => {
    if (benefitChangeInFlightRef.current || qrLoading || busy || paymentConfirmed) return;
    benefitChangeInFlightRef.current = true;
    try {
      if (qrSession?.id) {
        const cancelled = await cancelPendingQrForBillChange("POS mobile đổi ưu đãi trước khi thanh toán");
        if (!cancelled) return;
      }
      setter(value);
    } catch (error) {
      setShiftMessage(error?.message || "Chưa cập nhật được ưu đãi. Vui lòng thử lại.");
    } finally {
      benefitChangeInFlightRef.current = false;
    }
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
      if (!cancelled) return false;
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
    return true;
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
          if (item.stampGift) return delta < 0 ? null : item;
          const nextQuantity = Number(item.quantity || 1) + delta;
          return nextQuantity <= 0 ? null : updatePosCartItemQuantity(item, nextQuantity);
        })
        .filter((item) => item && item.quantity > 0)
    );
    setPaymentConfirmed(null);
  };

  const updateCartItem = async (cartId, product, config = {}) => {
    if (!cartId || cart.some((item) => item.cartId === cartId && item.stampGift)) return false;
    if (qrSession?.id) {
      const cancelled = await cancelPendingQrForBillChange("POS mobile sửa món làm thay đổi bill trước khi thanh toán");
      if (!cancelled) return false;
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
    return true;
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
    setPagerNumber("");
    setSelectedVoucherId("");
    setPointsInput("");
    if (profile?.branchUuid) {
      void forgetPosPaymentSession(profile.branchUuid);
    }
  };

  const validateLiveLoyaltySelection = async () => {
    const normalizedPhone = normalizeCustomerPhone(customerPhone);
    const selectedVoucher = loyaltyBenefit.selectedVoucher;
    const requestedPoints = Math.max(
      0,
      Math.floor(Number(String(pointsInput || "").replace(/\D+/g, "")) || 0)
    );
    const usesPoints = requestedPoints > 0;
    const usesLoyaltyVoucher = Boolean(selectedVoucher) && String(selectedVoucher?.source || "").toLowerCase() === "loyalty";

    if (!usesPoints && !usesLoyaltyVoucher) {
      return { ok: true, customer: customerLookup.result, benefit: loyaltyBenefit };
    }
    if (!normalizedPhone) {
      return { ok: false, message: "Vui lòng nhập số điện thoại để sử dụng điểm hoặc voucher loyalty." };
    }
    if (customerLookup.loading) {
      return { ok: false, message: "Điểm khách hàng đang được tải. Vui lòng chờ trong giây lát." };
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

      const liveBenefit = buildPosLoyaltyBenefit({
        subtotal: baseTotals.subtotal,
        customer: latestCustomer,
        coupons: rawCoupons,
        branchId: profile?.branchUuid || "",
        selectedVoucherId,
        pointsInput
      });

      const latestPoints = Math.max(0, Math.floor(Number(latestCustomer?.loyalty?.totalPoints || 0)));
      const displayedPoints = Number(loyaltyBenefit.pointsSpent || 0);
      const livePoints = Number(liveBenefit.pointsSpent || 0);
      if (usesPoints && requestedPoints !== livePoints) setPointsInput(livePoints > 0 ? String(livePoints) : "");
      if (usesPoints && displayedPoints > latestPoints) {
        return {
          ok: false,
          customer: latestCustomer,
          message: `Điểm loyalty vừa thay đổi. Khách hiện còn ${latestPoints.toLocaleString("vi-VN")} điểm.`
        };
      }

      if (usesPoints && livePoints !== displayedPoints) {
        return {
          ok: false,
          customer: latestCustomer,
          benefit: liveBenefit,
          message: `Số điểm hợp lệ hiện tại là ${Number(liveBenefit.pointsSpent || 0).toLocaleString("vi-VN")} điểm. Vui lòng kiểm tra và xác nhận lại.`
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

      return { ok: true, customer: latestCustomer, benefit: liveBenefit };
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
    setLastClosedShift(null);
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
    if (deviceMode !== "cashier") { setShiftMessage("Thu ngân mở ca trên máy POS tại quán."); return false; }
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
    if (!cart.length) {
      setShiftMessage("Chưa có món trong bill.");
      return false;
    }

    if (!pagerSettingsReady || pagerSettingsSaving || (pagerEnabled && !normalizedPager)) {
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

    const confirmation = {
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
    };
    setPaymentConfirmed(confirmation);
    if (cashSummary.paymentAmount === 0) {
      setShiftMessage("Đã xác nhận đơn 0đ tại quầy, không thu tiền.");
      return confirmation;
    }
    setShiftMessage("Đã xác nhận thanh toán tiền mặt. Đang mở két tiền...");
    void openLocalCashDrawer()
      .then(() => {
        setShiftMessage("Đã xác nhận thanh toán tiền mặt. Đã gửi lệnh mở két tiền.");
      })
      .catch((error) => {
        setShiftMessage(`Đã xác nhận thanh toán tiền mặt. Chưa mở được két: ${error?.message || "kiểm tra máy in/két tiền."}`);
      });
    return confirmation;
  };
  const openQrPayment = async (provider = "sepay") => {
    if (deviceMode !== "cashier") { setShiftMessage("Tạo đơn rồi chọn Tiền mặt hoặc QR để thanh toán."); return false; }
    const paymentProvider = provider === "momo" ? "momo" : "sepay";
    if (!profile || !shift?.id) {
      setShiftMessage("Cần đăng nhập và mở ca trước khi tạo QR.");
      return false;
    }
    if (!totals.total) {
      setShiftMessage("Bill hiện chưa có số tiền để tạo QR thanh toán.");
      return false;
    }
    if (!pagerSettingsReady || pagerSettingsSaving || (pagerEnabled && !normalizedPager)) {
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
    if (qrLoading) {
      setQrModalOpen(true);
      return;
    }

    setQrModalOpen(true);
    setQrLoading(true);
    setQrError("");
    setShiftMessage("Đang tạo mã QR thanh toán...");

    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) {
      const validationMessage = loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.";
      setQrLoading(false);
      setQrError(validationMessage);
      setShiftMessage(validationMessage);
      return;
    }

    const liveBenefit = loyaltyValidation.benefit || loyaltyBenefit;
    const liveTotals = buildTotalsWithBenefit(liveBenefit);
    const orderIdentity = createPosOrderIdentity(new Date());
    setQrPreviewIdentity(orderIdentity);
    const paymentReference = buildPosPaymentReference(orderIdentity, branch);
    const requestKey = `pos:${paymentProvider}:${profile.branchUuid}:${orderIdentity.orderCode}`;
    const checkout = {
      pagerEnabled,
      orderIdentity,
      posShiftId: shift.id,
      shift,
      totals: liveTotals,
      promoDiscount: liveBenefit.voucherDiscount,
      promoCode: String(liveBenefit.selectedVoucher?.code || "").trim().toUpperCase(),
      promoSource: String(liveBenefit.selectedVoucher?.source || ""),
      promoVoucherId: String(liveBenefit.selectedVoucher?.id || "").trim(),
      selectedVoucherKey: liveBenefit.selectedVoucherKey,
      pointsDiscount: liveBenefit.pointsSpent,
      pointsDiscountAmount: liveBenefit.pointsDiscount,
      pointRedeemRule: liveBenefit.loyaltyRule,
      customerLookup: loyaltyValidation.customer || customerLookup.result,
      customerName: customerName || customerLookup.result?.customerName || "",
      customerPhone: normalizeCustomerPhone(customerPhone)
    };
    const result = await createPosPaymentSession({
      requestKey,
      paymentReference,
      provider: paymentProvider,
      branchUuid: profile.branchUuid,
      posShiftId: shift.id,
      branchName: profile.branchName,
      cashierName: profile.name || profile.email,
      customerName,
      customerPhone: normalizeCustomerPhone(customerPhone),
      pagerNumber: normalizedPager,
      pagerEnabled,
      amountExpected: liveTotals.total,
      cart,
      orderIdentity,
      checkout
    }).catch((error) => ({
      ok: false,
      message: error?.message || "Không kết nối được máy chủ để tạo QR. Vui lòng thử lại."
    }));

    if (!result.ok) {
      setQrLoading(false);
      setQrError(result.message || "Không tạo được phiên thanh toán QR.");
      setShiftMessage(result.message || "Không tạo được phiên thanh toán QR.");
      setQrModalOpen(true);
      return;
    }

    const pendingOrderResult = await createPosTakeawayOrderMobile({
      cart,
      totals: liveTotals,
      pagerNumber: normalizedPager,
      pagerEnabled,
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
      promoDiscount: liveBenefit.voucherDiscount,
      promoCode: checkout.promoCode,
      promoSource: checkout.promoSource,
      promoVoucherId: checkout.promoVoucherId,
      pointsDiscount: liveBenefit.pointsSpent,
      pointsDiscountAmount: liveBenefit.pointsDiscount,
      pointRedeemRule: liveBenefit.loyaltyRule,
      paymentMethod: paymentProvider === "momo" ? "momo" : "bank_qr",
      paymentStatus: "pending_payment",
      paymentAmount: liveTotals.total,
      paymentReference,
      posShiftId: shift.id,
      paymentMeta: {
        paymentSessionId: result.session.id,
        requestKey
      },
      orderIdentity
    });
    if (!pendingOrderResult.ok || pendingOrderResult.offline) {
      await cancelPosPaymentSession(result.session.id, "Không tạo được đơn chờ thanh toán QR");
      const message = pendingOrderResult.message || "Không tạo được đơn chờ thanh toán QR.";
      setQrLoading(false);
      setQrError(message);
      setShiftMessage(message);
      setQrModalOpen(true);
      return;
    }

    const attached = await attachPosPaymentSessionOrder(result.session.id, pendingOrderResult.order?.id || orderIdentity.orderCode);
    if (!attached.ok || !attached.session?.id) {
      await cancelPosPaymentSession(result.session.id, "Không gắn được đơn chờ thanh toán vào QR");
      const message = attached.message || "Không gắn được đơn chờ thanh toán vào QR.";
      setQrLoading(false);
      setQrError(message);
      setShiftMessage(message);
      setQrModalOpen(true);
      return;
    }

    setQrSession(attached.session);
    await rememberPosPaymentSession(profile.branchUuid, attached.session.id);
    setQrLoading(false);
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
    if (deviceMode === "phone" && profile?.branchUuid) {
      const activeShift = await fetchActivePosShift({ branchUuid: profile.branchUuid, registerKey: "main" });
      if (activeShift.ok) setShift(activeShift.shift || null);
    }
    await checkConnectionNow();
    await syncOfflineOrdersNow({ silent: true });
    const catalogConfigResult = await fetchPosCatalogConfig();
    if (catalogConfigResult.ok) {
      setRawCoupons(Array.isArray(catalogConfigResult.coupons) ? catalogConfigResult.coupons : []);
      setRawSmartPromotions(Array.isArray(catalogConfigResult.smartPromotions) ? catalogConfigResult.smartPromotions : []);
    }
    await refreshPosRuntime(profile?.branchUuid);
    await refreshShiftSummary(shift);
    await refreshRecentClosedShifts();
  };

  const refreshRecentClosedShifts = async () => {
    const branchUuid = String(profile?.branchUuid || "").trim();
    if (!branchUuid) return;
    setClosedShiftsLoading(true);
    const result = await fetchRecentClosedPosShifts({ branchUuid, registerKey: "main", days: 7 });
    setRecentClosedShifts(result.shifts || []);
    setClosedShiftsError(result.ok ? "" : result.message || "Không tải được lịch sử ca POS.");
    setClosedShiftsLoading(false);
  };

  const printQrReceiptNow = async () => {
    if (!qrSession && !qrPreviewIdentity) {
      setQrError("Chưa có phiên QR để in.");
      return;
    }

    const expiresAtMs = Date.parse(qrSession?.expiresAt || "");
    if (qrSession?.provider === "momo" && Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      setQrError("Mã MoMo đã hết hạn. Hãy hủy mã này và tạo mã MoMo mới.");
      return;
    }

    const identity = qrSession?.orderIdentity || qrPreviewIdentity || {};
    const qrUrl = qrSession?.provider === "momo"
      ? qrSession?.momoQrValue
      : qrSession?.qrImageUrl || buildPosQrImageUrl({
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
        sourceType: qrSession?.provider === "momo" ? "pos_payment_momo_qr" : "pos_payment_qr"
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
    if (pickupPaymentInFlightRef.current || order.paymentStatus === "paid") return false;
    if (!shift?.id) {
      setPickupOrdersError("Cần mở ca POS trước khi thu tiền đơn hẹn lấy.");
      return false;
    }

    pickupPaymentInFlightRef.current = true;
    try {
    const amount = getWebsiteOrderAmount(order);
    if (!Number.isFinite(amount) || amount < 0) { setPickupOrdersError("Chưa xác định được số tiền đơn. Vui lòng tải lại."); return false; }
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
        method: isZeroPosOrder(order) ? "counter" : "cash",
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
      if (deviceMode === "cashier" && !isZeroPosOrder(order)) await openLocalCashDrawer();
      drawerMessage = deviceMode === "cashier" && !isZeroPosOrder(order) ? " Đã gửi lệnh mở két tiền." : "";
    } catch (error) {
      drawerMessage = ` Chưa mở được két: ${error?.message || "kiểm tra máy in/két tiền."}`;
    }

    setShiftMessage(`${result.message || "Đã thu tiền đơn hẹn lấy."}${printResult.message || ""}${drawerMessage}`.trim());
    if (profile?.branchUuid) {
      await refreshPosRuntime(profile.branchUuid);
    }
    await refreshShiftSummary(shift);
    invalidatePosStamps();
    return true;
    } finally { pickupPaymentInFlightRef.current = false; setPickupOrdersLoading(false); }
  };

  const openPickupOrderQrPayment = async (order = {}) => {
    if (isZeroPosOrder(order)) { setPickupOrdersError("Đơn 0đ không cần QR. Vui lòng xác nhận đơn 0đ."); return false; }
    if (!order?.id) return false;
    const phoneOrder = order.metadata?.deviceMode === "phone";
    if (phoneOrder && phoneQrOpenInFlightRef.current) return false;
    if (phoneOrder) phoneQrOpenInFlightRef.current = true;
    try {
    if (!profile?.branchUuid || !shift?.id) {
      setPickupOrdersError("Cần đăng nhập và mở ca trước khi tạo QR.");
      return false;
    }

    setPickupQrModalOpen(true);
    setPickupQrLoading(true);
    setPickupQrError("");
    setPickupQrOrder(order);

    if (order.metadata?.deviceMode === "phone") {
      setPickupQrSession(null);
      const remembered = findPendingWebsiteQrSession(order);
      if (remembered?.id) {
        try {
          const current = await readPosPaymentSession(remembered.id);
          if (current && (isPosPaymentSessionPaid(current) || (!isPosPaymentSessionExpired(current) && !isPosPaymentSessionTerminal(current)))) {
            setPickupQrSession(current);
            setPickupQrLoading(false);
            setShiftMessage("Đã mở lại QR của đơn chờ thanh toán.");
            return true;
          }
          if (current && isPosPaymentSessionExpired(current)) {
            const expired = await cancelPosPaymentSession(current.id, "Đóng QR điện thoại hết hạn trước khi tạo mã mới");
            if (!expired.ok) throw new Error(expired.message || "Chưa đóng được QR hết hạn.");
          }
        } catch (error) {
          setPickupQrLoading(false);
          setPickupQrError(error?.message || "Chưa kiểm tra được QR cũ. Vui lòng thử lại.");
          return false;
        }
      }
    }
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
    setShiftMessage(order.metadata?.deviceMode === "phone"
      ? (result.reused ? "Đã mở lại QR của đơn chờ thanh toán." : "Đang chờ khách chuyển khoản. Chưa gửi bếp.")
      : result.reused ? "Đã mở lại QR đang chờ thanh toán cho đơn hẹn lấy." : "Đã tạo QR cho đơn hẹn lấy, đang chờ khách chuyển khoản.");
    return true;
    } catch (error) {
      setPickupQrLoading(false);
      setPickupQrError(error?.message || "Chưa mở được mã QR. Vui lòng thử lại.");
      return false;
    } finally {
      if (phoneOrder) phoneQrOpenInFlightRef.current = false;
    }
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
    if (isPosPaymentSessionPaid(pickupQrSession) && pickupQrOrder?.metadata?.deviceMode !== "phone") {
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

      const printableOrder = await withPosStampSummary(result.printableOrder, "", { force: true });
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
          method: printableOrder.paymentMethod === "momo"
            ? "momo"
            : printableOrder.paymentMethod === "bank_qr"
              ? "bank_qr"
              : "cash",
          reference: printableOrder.paymentReference,
          paidAt: printableOrder.paidAt || printableOrder.createdAt
        }
      });

      await printLocalReceipt({
        text: receiptText,
        sourceType: "customer_bill_reprint",
        customerPhone: printableOrder.customerPhone
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
    if (deviceMode !== "cashier") return false;
    const {
      closingCashCounted = closingCash,
      closingCashBreakdown = null,
      closingNote: nextClosingNote = closingNote,
      printReceipt = true
    } = payload || {};

    if (cart.length) {
      setShiftMessage("Còn bill đang mở. Hoàn tất hoặc xóa bill này trước khi kết ca.");
      return false;
    }

    if (closingCashBreakdown == null) {
      setShiftMessage("Vui lòng kiểm tiền theo mệnh giá trước khi kết ca.");
      return false;
    }

    setBusy(true);
    setShiftMessage("");
    const latestState = await syncShiftBeforeClose();
    if (!latestState.ok) {
      setBusy(false);
      setShiftMessage(latestState.message);
      return false;
    }

    const activePendingSessions = latestState.activeSessions;
    if (activePendingSessions.length) {
      setBusy(false);
      const hasPendingPayment = activePendingSessions.some((item) => (
        String(item?.status || "").trim().toLowerCase() === "pending_payment"
      ));
      setShiftMessage(
        hasPendingPayment
          ? "Còn QR chờ thanh toán. Nếu khách không chuyển khoản, bấm Hủy QR; nếu đã chuyển, chờ ngân hàng báo tiền vào rồi thử lại."
          : "Có QR đang được máy chủ chốt. Chờ ít giây để hoàn tất rồi bấm kết ca lại."
      );
      return false;
    }
    const latestSummary = latestState.summary;
    if (Number(latestSummary?.pendingQrCount || 0) > 0) {
      setBusy(false);
      setShiftMessage("Còn QR chờ thanh toán trong ca. Kiểm tra QR và bấm Hủy QR nếu khách đã đổi ý.");
      return false;
    }
    const result = await closePosShift({
      shift: latestState.shift,
      summary: latestSummary || shiftSummary,
      closingCashCounted,
      closingCashBreakdown,
      closingNote: nextClosingNote,
      authUserId: session?.user?.id
    });
    setBusy(false);
    setShiftMessage(result.message || "");
    if (!result.ok) {
      if (latestState.shift?.id) {
        await refreshShiftSummary(latestState.shift);
      }
      return false;
    }

    const closedShift = result.shift || {
      ...latestState.shift,
      status: "closed",
      closedAt: new Date().toISOString(),
      closingCashCounted,
      closingCashBreakdown,
      closingNote: nextClosingNote
    };
    const closedSummary = closedShift.closingSummary || latestSummary || shiftSummary || {};
    const receiptText = buildPosShiftCloseReceiptText({
      shift: closedShift,
      summary: closedSummary,
      closingCashCounted,
      closingCashBreakdown,
      closingNote: nextClosingNote
    });
    let closePrintMessage = "";
    let printStatus = printReceipt ? "failed" : "skipped";
    if (printReceipt) {
      try {
        setShiftMessage("Đang in phiếu kết ca...");
        await printLocalReceipt({
          text: receiptText,
          sourceType: "pos_shift_close"
        });
        printStatus = "printed";
        closePrintMessage = " Đã in phiếu kết ca.";
      } catch (printError) {
        closePrintMessage = ` Đã kết ca nhưng chưa in được phiếu: ${printError?.message || "Lỗi máy in."}`;
      }
    }

    setLastClosedShift({
      shift: closedShift,
      summary: closedSummary,
      receiptText,
      printStatus,
      printMessage: closePrintMessage.trim()
    });
    setRecentClosedShifts((current) => [closedShift, ...current.filter((item) => item.id !== closedShift.id)]);
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

  const reprintLastClosedShift = async () => {
    if (!lastClosedShift?.receiptText) {
      setShiftMessage("Không còn dữ liệu phiếu kết ca để in lại.");
      return false;
    }

    setBusy(true);
    setLastClosedShift((current) => current ? {
      ...current,
      printMessage: "Đang gửi lại phiếu đến máy in..."
    } : current);
    try {
      await printLocalReceipt({
        text: lastClosedShift.receiptText,
        sourceType: "pos_shift_close"
      });
      setLastClosedShift((current) => current ? {
        ...current,
        printStatus: "printed",
        printMessage: "Đã in lại phiếu kết ca."
      } : current);
      setBusy(false);
      return true;
    } catch (printError) {
      setLastClosedShift((current) => current ? {
        ...current,
        printStatus: "failed",
        printMessage: printError?.message || "Lỗi máy in."
      } : current);
      setBusy(false);
      return false;
    }
  };

  const reprintClosedShift = async (closedShift = null) => {
    if (!closedShift?.id) {
      setClosedShiftsError("Không tìm thấy dữ liệu ca cần in lại.");
      return false;
    }
    const summary = closedShift.closingSummary || {};
    const receiptText = buildPosShiftCloseReceiptText({
      shift: closedShift,
      summary,
      closingCashCounted: closedShift.closingCashCounted,
      closingCashBreakdown: closedShift.closingCashBreakdown,
      closingNote: closedShift.closingNote
    });
    setBusy(true);
    setClosedShiftsError("");
    try {
      await printLocalReceipt({ text: receiptText, sourceType: "pos_shift_close" });
      setShiftMessage(`Đã in lại phiếu ca ${String(closedShift.id).slice(0, 8).toUpperCase()}.`);
      setBusy(false);
      return true;
    } catch (printError) {
      setClosedShiftsError(printError?.message || "Không in lại được phiếu kết ca.");
      setBusy(false);
      return false;
    }
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

  const createCashOrder = async (paymentOverride = null) => {
    if (deviceMode !== "cashier") return false;
    if (createCashOrderInFlightRef.current) {
      setShiftMessage("Đang tạo đơn. Vui lòng chờ trong giây lát.");
      return false;
    }

    createCashOrderInFlightRef.current = true;
    setBusy(true);

    try {
    const confirmedPayment = paymentOverride?.method ? paymentOverride : paymentConfirmed;
    if (!confirmedPayment || !profile || !shift?.id) {
      setShiftMessage("Cần đăng nhập và mở ca trước khi tạo đơn.");
      return false;
    }

    if (pagerBusy) {
      setShiftMessage(`Thẻ rung ${normalizedPager} đang có đơn chưa hoàn tất.`);
      return false;
    }

    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) {
      setShiftMessage(loyaltyValidation.message || "Không áp dụng được ưu đãi loyalty hiện tại.");
      return false;
    }

    const liveBenefit = loyaltyValidation.benefit || loyaltyBenefit;
    const liveTotals = buildTotalsWithBenefit(liveBenefit);
    const liveCashSummary = getCashPaymentSummary(liveTotals.total);
    if (confirmedPayment.method === "cash" && Number(confirmedPayment.amount || 0) !== liveCashSummary.paymentAmount) {
      setPaymentConfirmed(null);
      setShiftMessage("Tổng tiền vừa thay đổi sau khi tải lại điểm. Vui lòng xác nhận tiền mặt lại.");
      return false;
    }

    const orderIdentity = confirmedPayment.orderIdentity || createPosOrderIdentity(new Date());
    const requestKey = confirmedPayment.requestKey || [
      "pos-cash",
      profile.branchUuid || "branch",
      orderIdentity.orderCode
    ].join(":");
    const paymentReference = confirmedPayment.reference || `CASH-${orderIdentity.orderCode}`;
    const result = await createPosTakeawayOrderMobile({
      cart,
      totals: liveTotals,
      pagerNumber: normalizedPager,
      pagerEnabled,
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
      promoDiscount: liveBenefit.voucherDiscount,
      promoCode: String(liveBenefit.selectedVoucher?.code || "").trim().toUpperCase(),
      promoSource: String(liveBenefit.selectedVoucher?.source || ""),
      promoVoucherId: String(liveBenefit.selectedVoucher?.id || "").trim(),
      pointsDiscount: liveBenefit.pointsSpent,
      pointsDiscountAmount: liveBenefit.pointsDiscount,
      pointRedeemRule: liveBenefit.loyaltyRule,
      paymentMethod: confirmedPayment.method,
      paymentStatus: "paid",
      paymentAmount: confirmedPayment.amount,
      paymentReference,
      paidAt: confirmedPayment.paidAt || new Date().toISOString(),
      posShiftId: shift.id,
      paymentMeta: {
        ...(confirmedPayment.paymentSessionId ? { provider: "sepay", paymentSessionId: confirmedPayment.paymentSessionId } : {}),
        originalAmount: confirmedPayment.originalAmount || confirmedPayment.amount,
        cashRoundingDiscount: confirmedPayment.cashRoundingDiscount || 0,
        cashRoundingUnit: confirmedPayment.cashRoundingUnit || 0,
        requestKey
      },
      orderIdentity
    });
    setShiftMessage(result.message || "");
    if (!result.ok) {
      return false;
    }
    if (result.offline) {
      await refreshOfflineOrderCount();
    }

    let printMessage = "";
    try {
      const billData = {
        order: result.order,
        cart,
        totals: liveTotals,
        customerName: customerName || customerLookup.result?.customerName || "",
        customerPhone: normalizeCustomerPhone(customerPhone),
        pagerNumber: normalizedPager,
      pagerEnabled,
        branchName: profile.branchName,
        cashierName: profile.name || profile.email,
        orderNote,
        paymentConfirmed: confirmedPayment
      };
      await printCounterOrderBills(billData);
      printMessage = " Đã in bill làm món và bill khách tại máy POS.";
    } catch (printError) {
      printMessage = ` Đã tạo đơn nhưng chưa in được bill: ${printError?.message || "Lỗi máy in."}`;
    }

    if (confirmedPayment.paymentSessionId) {
      await markPosPaymentSessionConverted(
        confirmedPayment.paymentSessionId,
        result.order?.id || result.order?.orderCode
      );
    }
    await resetCompletedSale();
    if (!result.offline) {
      await refreshPosRuntime(profile.branchUuid);
      await refreshShiftSummary(shift);
    }
    setShiftMessage(`${result.message || ""}${printMessage}`.trim());
    return true;
    } finally {
      createCashOrderInFlightRef.current = false;
      setBusy(false);
    }
  };

  const sendPhoneOrder = async () => {
    if (deviceMode !== "phone" || createCashOrderInFlightRef.current) return false;
    if (!profile || !shift?.id || !cart.length || !normalizedPager || pagerBusy) {
      setShiftMessage("Cần ca đang mở, món và thẻ rung sẵn sàng để tạo đơn."); return false;
    }
    const loyaltyValidation = await validateLiveLoyaltySelection();
    if (!loyaltyValidation.ok) { setShiftMessage(loyaltyValidation.message); return false; }
    if (createCashOrderInFlightRef.current) return false;
    const liveBenefit = loyaltyValidation.benefit || loyaltyBenefit;
    const liveTotals = buildTotalsWithBenefit(liveBenefit);
    const key = JSON.stringify({ cart, customerPhone, customerName, orderNote, normalizedPager, totals: liveTotals, voucher: liveBenefit.selectedVoucher?.id, points: liveBenefit.pointsSpent, branch: profile.branchUuid, shift: shift.id });
    if (phoneOrderRequestRef.current?.key !== key) phoneOrderRequestRef.current = { key, identity: createPosOrderIdentity(new Date()) };
    createCashOrderInFlightRef.current = true;
    setBusy(true);
    try {
      const result = await createPosTakeawayOrderMobile({ cart, totals: liveTotals, pagerNumber: normalizedPager,
        customerName: customerName || customerLookup.result?.customerName || "", customerPhone: normalizeCustomerPhone(customerPhone),
        branch: { branchUuid: profile.branchUuid, branchName: profile.branchName }, orderNote, shift,
        cashierName: profile.name || profile.email, paymentMethod: "cash", paymentStatus: "unpaid",
        customerLookup: loyaltyValidation.customer || customerLookup.result,
        promoDiscount: liveBenefit.voucherDiscount, promoCode: liveBenefit.selectedVoucher?.code || "",
        promoSource: liveBenefit.selectedVoucher?.source || "", promoVoucherId: liveBenefit.selectedVoucher?.id || "",
        pointsDiscount: liveBenefit.pointsSpent, pointsDiscountAmount: liveBenefit.pointsDiscount,
        pointRedeemRule: liveBenefit.loyaltyRule,
        phoneOrder: true, skipOfflineQueue: true, orderIdentity: phoneOrderRequestRef.current.identity });
      setShiftMessage(result.message || "");
      if (!result.ok) return false;
      await resetCompletedSale();
      phoneOrderRequestRef.current = null;
      if (result.order?.id) {
        setPickupOrders(current => [result.order, ...current.filter(order => order.id !== result.order.id)]);
        setRecentOrders(current => mergePosHistoryOrders([result.order], current));
      }
      refreshPosRuntime(profile.branchUuid, { silent: true }).catch(() => {});
      setShiftMessage(`Đã tạo ${result.order?.displayOrderCode || "đơn"} chờ thanh toán. Bếp nhận sau khi thanh toán.`);
      return result.order || false;
    } catch (error) { setShiftMessage(error?.message || "Chưa gửi được đơn. Giữ giỏ và thử lại."); return false; }
    finally { createCashOrderInFlightRef.current = false; setBusy(false); }
  };

  const addStampGift = async (product) => {
    if (!product || busy || paymentConfirmed || !/^0[35789]\d{8}$/.test(normalizeCustomerPhone(customerPhone))) return false;
    if (qrSession?.id && !await cancelPendingQrForBillChange("Đổi món quà tích tem")) return false;
    setCart((items) => [...items.filter((item) => !item.stampGift), makePosStampGift(product, customerPhone)]);
    setPaymentConfirmed(null);
    setShiftMessage("Đã thêm món quà 0đ. Tem được kiểm tra lại khi xác nhận đơn.");
    return true;
  };

  return {
    profile,
    sendPhoneOrder,
    addStampGift,
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
    lastClosedShift,
    recentClosedShifts,
    closedShiftsLoading,
    closedShiftsError,
    closingCash,
    setClosingCash,
    closingNote,
    setClosingNote,
    openingCash,
    setOpeningCash,
    pagerEnabled,
    pagerSettingsReady,
    pagerSettingsSaving,
    changePagerEnabled,
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
    setSelectedVoucherId: (value) => changePosBenefit(setSelectedVoucherId, value),
    pointsInput,
    setPointsInput: (value) => changePosBenefit(setPointsInput, value),
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
    refreshRecentClosedShifts,
    checkConnectionNow,
    recoverPosConnection,
    syncOfflineOrdersNow,
    confirmQrPaidManually,
    printQrReceiptNow,
    createCashOrder,
    signIn,
    signOut,
    openShiftNow,
    closeShiftNow,
    reprintLastClosedShift,
    reprintClosedShift,
    dismissLastClosedShift: () => setLastClosedShift(null),
    hasOpenShift: Boolean(shift?.id)
  };
}
