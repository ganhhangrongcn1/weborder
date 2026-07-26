import { useEffect, useMemo, useRef, useState } from "react";
import useKitchenAuth from "../../hooks/useKitchenAuth.js";
import useKitchenOrders, { getTodayDateKey } from "../../hooks/useKitchenOrders.js";
import KitchenDishSummaryPanel from "./KitchenDishSummaryPanel.jsx";
import KitchenOrderCard from "./KitchenOrderCard.jsx";
import KitchenOrderStrip from "./KitchenOrderStrip.jsx";
import {
  getPrinterConfig,
  hasAndroidPrinterBridge,
  printCustomerBill,
  PRINTER_MODE
} from "../../services/printerService.js";
import {
  CUSTOMER_BILL_JOB_TYPE,
  DEFAULT_PRINTER_KEY,
  claimPrintJob,
  createCustomerBillPrintJob,
  getPrintDeviceId,
  markPrintJobFailed,
  markPrintJobPrinted,
  readPendingPrintJobs,
  readRecentPrintJobs,
  subscribePrintJobChanges,
  subscribePrintJobs
} from "../../services/printJobService.js";
import {
  getKitchenItemGroupKey,
  getKitchenOrderKey,
  isKitchenOrderScheduledForLater,
  orderContainsKitchenItemGroup
} from "./kitchenOrderGrouping.js";

const STAT_CARDS = [
  { id: "active", label: "Đang xử lý" },
  { id: "scheduled", label: "Đơn đặt trước" },
  { id: "done", label: "Đã xong" },
  { id: "cancelled", label: "Đã hủy" },
  { id: "website", label: "Website" },
  { id: "partner", label: "Đối tác" }
];

const SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "T\u1ea5t c\u1ea3 ngu\u1ed3n" },
  { value: "website", label: "Website" },
  { value: "qr_counter", label: "QR t\u1ea1i qu\u1ea7y" },
  { value: "pickup", label: "T\u1ef1 l\u1ea5y" },
  { value: "grabfood", label: "GrabFood" },
  { value: "shopeefood", label: "ShopeeFood" },
  { value: "xanhngon", label: "Xanh Ngon" }
];

const PRINTER_SETTINGS_STORAGE_KEY = "ghr:kitchen-printer-settings:v1";
const AUTO_PRINT_REQUESTED_BY = "auto-kitchen";
const AUTO_PRINT_RECENT_GRACE_MS = 2 * 60 * 1000;

function formatUpdatedTime(value = "") {
  if (!value) return "Chưa tải";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa tải";

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getRealtimeToneStyle(tone = "muted") {
  if (tone === "success") {
    return {
      border: "1px solid #bbf7d0",
      background: "#f0fdf4",
      color: "#166534",
      dot: "#16a34a"
    };
  }

  if (tone === "danger") {
    return {
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#991b1b",
      dot: "#dc2626"
    };
  }

  if (tone === "warning") {
    return {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#92400e",
      dot: "#f59e0b"
    };
  }

  return {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#475569",
    dot: "#94a3b8"
  };
}

function FilterButton({ active, badgeCount = 0, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #111827" : "1px solid #d1d5db",
        background: active ? "#111827" : "#ffffff",
        color: active ? "#ffffff" : "#374151",
        borderRadius: 8,
        padding: "7px 8px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        minHeight: 34,
        whiteSpace: "nowrap"
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        {children}
        {badgeCount > 0 ? (
          <span
            style={{
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              display: "inline-grid",
              placeItems: "center",
              padding: "0 6px",
              background: active ? "#f97316" : "#ffedd5",
              color: active ? "#ffffff" : "#c2410c",
              border: active ? "1px solid #fb923c" : "1px solid #fdba74",
              fontSize: 11,
              fontWeight: 950,
              lineHeight: 1,
              boxSizing: "border-box"
            }}
          >
            {badgeCount}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ToolbarIcon({ name, size = 15 }) {
  const map = {
    calendar: "◷",
    refresh: "↻",
    printer: "⎙",
    logout: "⇥",
    more: "..."
  };

  return <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>{map[name] || "•"}</span>;
}

function SourceFilterSelect({ value, onChange }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 112,
        height: 34
      }}
    >
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: "100%",
          height: "100%",
          appearance: "none",
          border: "1px solid #d1d5db",
          background: "#ffffff",
          color: "#374151",
          borderRadius: 8,
          padding: "0 28px 0 9px",
          fontSize: 12,
          fontWeight: 800,
          lineHeight: "34px",
          cursor: "pointer",
          boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)",
          outline: "none"
        }}
      >
        {SOURCE_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 10,
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "6px solid #475569",
          pointerEvents: "none"
        }}
      />
    </label>
  );
}

function readPrinterSettings() {
  const defaults = getPrinterConfig();
  try {
    const saved = JSON.parse(window.localStorage.getItem(PRINTER_SETTINGS_STORAGE_KEY) || "{}");
    return {
      mode: saved.mode || defaults.mode || "webPrint",
      bridgeUrl: saved.bridgeUrl || defaults.bridgeUrl || "",
      printerName: saved.printerName || defaults.printerName || "Xprinter",
      receiptWidthMm: String(saved.receiptWidthMm || defaults.receiptWidthMm || 80),
      storeName: saved.storeName || defaults.storeName || "Gánh Hàng Rong"
    };
  } catch {
    return {
      mode: defaults.mode || "webPrint",
      bridgeUrl: defaults.bridgeUrl || "",
      printerName: defaults.printerName || "Xprinter",
      receiptWidthMm: String(defaults.receiptWidthMm || 80),
      storeName: defaults.storeName || "Gánh Hàng Rong"
    };
  }
}

function toText(value = "") {
  return String(value || "").trim();
}

function getPrintJobTimeValue(job = {}) {
  const value = job.printed_at || job.failed_at || job.updated_at || job.claimed_at || job.requested_at || job.created_at;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function getPrintJobOrderKeys(job = {}) {
  return [
    job.order_id,
    job.order_code
  ].map(toText).filter(Boolean);
}

function getOrderPrintKeys(order = {}) {
  return [
    order.id,
    order.orderCode,
    order.order_code,
    order.displayOrderCode,
    order.display_order_code
  ].map(toText).filter(Boolean);
}

function getOrderAutoPrintKey(order = {}) {
  return toText(
    order.stableKey ||
      order.raw?.stable_key ||
      order.raw?.nexpos_order_id ||
      order.raw?.id ||
      order.id ||
      order.displayOrderCode ||
      order.orderCode
  );
}

function getOrderAutoPrintTimeValue(order = {}) {
  const value = toText(
    order.createdAt ||
      order.orderTime ||
      order.updatedAt ||
      order.raw?.created_at ||
      order.raw?.order_time
  );
  const timeValue = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timeValue) ? timeValue : 0;
}

function isAutoPrintableOrder(order = {}) {
  const kitchenStatus = toText(order.kitchenStatus || order.status).toLowerCase();
  const orderStatus = toText(order.status).toLowerCase();
  const metadata = order.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const sourceText = [
    order.source,
    order.sourceType,
    order.orderSource,
    order.channel,
    order.platform,
    order.partnerSource,
    metadata.source,
    metadata.sourceType,
    metadata.orderSource,
    metadata.channel,
    metadata.platform,
    metadata.partnerSource
  ].map((value) => toText(value).toLowerCase()).filter(Boolean);
  if (!getOrderAutoPrintKey(order)) return false;
  if (sourceText.includes("pos") || sourceText.includes("pos_mobile")) return false;
  if (["done", "completed", "ready", "cancelled", "canceled", "preorder"].includes(kitchenStatus)) return false;
  if (["done", "completed", "cancelled", "canceled", "preorder"].includes(orderStatus)) return false;
  if (isKitchenOrderScheduledForLater(order)) return false;
  return true;
}

function getOrderPrintState(order = {}, jobsByOrderKey = {}, printingOrderKey = "") {
  const orderKeys = getOrderPrintKeys(order);
  const orderKey = getKitchenOrderKey(order);
  const jobs = orderKeys.map((key) => jobsByOrderKey[key]).filter(Boolean);
  const latestJob = jobs.sort((first, second) => getPrintJobTimeValue(second) - getPrintJobTimeValue(first))[0] || null;

  if (printingOrderKey && printingOrderKey === orderKey) {
    return {
      status: "submitting",
      job: latestJob
    };
  }

  return {
    status: toText(latestJob?.status),
    job: latestJob
  };
}

function isBlockingAutoPrintStatus(status = "") {
  return ["pending", "printing", "printed", "submitting"].includes(toText(status).toLowerCase());
}

function upsertPrintJobIntoMap(currentMap = {}, job = {}) {
  const keys = getPrintJobOrderKeys(job);
  if (!keys.length) return currentMap;

  const nextMap = { ...currentMap };
  keys.forEach((key) => {
    const currentJob = nextMap[key];
    if (!currentJob || getPrintJobTimeValue(job) >= getPrintJobTimeValue(currentJob)) {
      nextMap[key] = job;
    }
  });
  return nextMap;
}

function KitchenRequestAuditBadge({ audit, onReset }) {
  const total60m = Number(audit?.total60m || 0);
  const total5m = Number(audit?.total5m || 0);
  const labelMap = {
    orders: "orders",
    order_items: "order_items",
    partner_orders: "partner_orders",
    partner_order_items: "partner_order_items",
    profiles: "khách hàng",
    monthly_customer_gifts: "quà tháng",
    "read website orders": "đơn web/QR",
    "read website items": "món web/QR",
    "read partner orders": "đơn app",
    "read partner items": "món app",
    "gift monthly website orders": "quà: đơn web tháng",
    "gift monthly partner orders": "quà: đơn app tháng",
    "gift all-time website orders": "quà: lịch sử web",
    "gift all-time partner orders by phone key": "quà: lịch sử app key",
    "gift all-time partner orders by phone": "quà: lịch sử app phone",
    "gift profiles": "khách hàng/profile",
    "gift claims": "quà đã tặng",
    "claim monthly gift": "bấm tặng quà",
    "read existing gift claim": "kiểm tra quà trùng",
    "mark partner done": "xong đơn app",
    "mark website done": "xong đơn web",
    "stamp partner done time": "chốt giờ app"
  };
  const formatAuditRows = (rows = [], limit = 10) => (rows || [])
    .slice(0, limit)
    .map((item) => `${labelMap[item.key] || item.key}: ${item.count}`)
    .join(" - ");
  const tableText = formatAuditRows(audit?.byTable, 8);
  const scopeText = formatAuditRows(audit?.byScope, 12);
  const tooltip = [
    "Chỉ đếm request Supabase phát sinh từ màn hình bếp trên máy này trong 60 phút gần nhất.",
    tableText ? `Theo bảng: ${tableText}` : "",
    scopeText ? `Theo lý do: ${scopeText}` : ""
  ].filter(Boolean).join("\n");

  return (
    <div
      title={tooltip}
      style={{
        marginLeft: "auto",
        display: "grid",
        gridTemplateColumns: "auto auto minmax(260px, 1fr) auto",
        alignItems: "start",
        gap: 8,
        minHeight: 34,
        maxWidth: "100%",
        border: "1px dashed #cbd5e1",
        background: "#f8fafc",
        borderRadius: 8,
        padding: "6px 8px",
        color: "#475569",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1.35
      }}
    >
      <span>Bếp đọc: {total60m} req/60p</span>
      <span style={{ color: "#64748b", fontWeight: 700 }}>5p: {total5m}</span>
      <span
        style={{
          color: "#64748b",
          display: "grid",
          gap: 3,
          fontWeight: 700,
          minWidth: 0,
          whiteSpace: "normal",
          wordBreak: "break-word"
        }}
      >
        {tableText ? <span>Bảng: {tableText}</span> : null}
        {scopeText ? <span>Lý do: {scopeText}</span> : null}
      </span>
      <button
        type="button"
        onClick={onReset}
        style={{
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#475569",
          borderRadius: 6,
          padding: "4px 7px",
          fontSize: 11,
          fontWeight: 900,
          cursor: "pointer"
        }}
      >
        Reset
      </button>
    </div>
  );
}

function KitchenLoginScreen({ error, loading, onLogin, submitting }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin({ email, password });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        color: "#1f2933",
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        display: "grid",
        placeItems: "center",
        padding: 24
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          borderRadius: 8,
          padding: 24,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
          display: "grid",
          gap: 14
        }}
      >
        <div>
          <p style={{ margin: "0 0 6px", color: "#64748b", fontSize: 13, fontWeight: 800 }}>
            Gánh Hàng Rong
          </p>
          <h1 style={{ margin: 0, color: "#111827", fontSize: 28 }}>
            Đăng nhập xử lý đơn
          </h1>
        </div>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#111827" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="lhp@ghr.vn"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "12px 13px",
              fontSize: 14
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontWeight: 800, color: "#111827" }}>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nhập mật khẩu"
            required
            style={{
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "12px 13px",
              fontSize: 14
            }}
          />
        </label>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              padding: 11,
              fontWeight: 700,
              fontSize: 13
            }}
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || submitting}
          style={{
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "#ffffff",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 900,
            cursor: loading || submitting ? "not-allowed" : "pointer",
            opacity: loading || submitting ? 0.75 : 1
          }}
        >
          {loading || submitting ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}

export default function KitchenPage() {
  const [activeDishKey, setActiveDishKey] = useState("");
  const [activeOrderKey, setActiveOrderKey] = useState("");
  const [printerSettings] = useState(() => readPrinterSettings());
  const [printerNotice, setPrinterNotice] = useState("");
  const [printingOrderKey, setPrintingOrderKey] = useState("");
  const [printJobsByOrderKey, setPrintJobsByOrderKey] = useState({});
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const autoPrintBootstrappedRef = useRef(false);
  const autoPrintStartedAtRef = useRef(0);
  const autoPrintedOrderKeysRef = useRef(new Set());
  const autoPrintingOrderKeysRef = useRef(new Set());
  const processingPrintJobsRef = useRef(new Set());
  const moreMenuRef = useRef(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 800 : window.innerHeight
  }));
  const orderRefs = useRef({});
  const {
    session,
    profile,
    loading: authLoading,
    submitting,
    error: authError,
    login,
    logout
  } = useKitchenAuth();

  const kitchenOrderOptions = useMemo(() => ({
    enabled: Boolean(session && profile),
    branchUuid: profile?.branchUuid || "",
    branchName: profile?.branchName || "",
    branchAlias: profile?.branchAlias || ""
  }), [profile, session]);

  const {
    orders,
    filteredOrders,
    canLoadMoreDoneOrders,
    stats,
    loading,
    refreshing,
    error,
    dateFilter,
    setDateFilter,
    sourceFilter,
    setSourceFilter,
    statusFilter,
    setStatusFilter,
    lastUpdatedAt,
    realtimeStatus,
    updatingOrderId,
    updatingItemKey,
    requestAudit,
    resetRequestAudit,
    loadMoreDoneOrders,
    markDone,
    toggleItemDone,
    reload
  } = useKitchenOrders(kitchenOrderOptions);

  useEffect(() => {
    if (!session || !profile) return undefined;

    let stopped = false;
    let unsubscribe = () => {};
    const branchUuid = profile?.branchUuid || "";
    const printerKey = DEFAULT_PRINTER_KEY;
    const deviceId = getPrintDeviceId();

    async function startPrintJobStatusSync() {
      const recentJobs = await readRecentPrintJobs({
        branchUuid,
        printerKey,
        jobType: CUSTOMER_BILL_JOB_TYPE,
        limit: 120
      });

      if (!stopped && recentJobs.length) {
        setPrintJobsByOrderKey((currentMap) => (
          recentJobs.reduce((nextMap, job) => upsertPrintJobIntoMap(nextMap, job), currentMap)
        ));
      }

      unsubscribe = await subscribePrintJobChanges({
        branchUuid,
        printerKey,
        jobType: CUSTOMER_BILL_JOB_TYPE,
        deviceId,
        onJobChange: (job) => {
          setPrintJobsByOrderKey((currentMap) => upsertPrintJobIntoMap(currentMap, job));
          const status = toText(job?.status).toLowerCase();
          const orderCode = toText(job?.order_code || "bill");
          if (status === "printed") {
            setPrinterNotice(`Máy POS đã in ${orderCode}.`);
          } else if (status === "failed") {
            setPrinterNotice(`In ${orderCode} thất bại: ${toText(job?.error_message) || "Máy POS chưa in được."}`);
          }
        }
      });
    }

    startPrintJobStatusSync();

    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [profile, session]);

  useEffect(() => {
    const canAutoPrintWithAndroid = hasAndroidPrinterBridge();
    const canAutoPrintWithBridge = printerSettings.mode === PRINTER_MODE.bridge && String(printerSettings.bridgeUrl || "").trim();
    if (!session || !profile || (!canAutoPrintWithAndroid && !canAutoPrintWithBridge)) return undefined;

    let stopped = false;
    let unsubscribe = () => {};
    const deviceId = getPrintDeviceId();
    const branchUuid = profile?.branchUuid || "";
    const printerKey = DEFAULT_PRINTER_KEY;
    const printerOptions = {
      mode: printerSettings.mode,
      bridgeUrl: String(printerSettings.bridgeUrl || "").trim(),
      printerName: String(printerSettings.printerName || "").trim(),
      receiptWidthMm: Number(printerSettings.receiptWidthMm) === 58 ? 58 : 80,
      storeName: String(printerSettings.storeName || "").trim()
    };

    async function processPrintJob(job = {}) {
      if (!job?.id || stopped || processingPrintJobsRef.current.has(job.id)) return;
      processingPrintJobsRef.current.add(job.id);

      try {
        const claimedJob = await claimPrintJob(job, { deviceId });
        if (!claimedJob || stopped) return;

        const payload = claimedJob.payload || {};
        const order = payload.order || {};
        const result = await printCustomerBill(order, {
          ...printerOptions,
          receiptWidthMm: Number(payload.receiptWidthMm) === 58 ? 58 : printerOptions.receiptWidthMm,
          printerName: payload.printerName || printerOptions.printerName,
          storeName: payload.storeName || printerOptions.storeName
        });

        if (result.ok) {
          await markPrintJobPrinted(claimedJob);
          setPrinterNotice(`POS đã in bill ${claimedJob.order_code || ""}.`.trim());
        } else {
          await markPrintJobFailed(claimedJob, result.message);
          setPrinterNotice(result.message || "POS in bill thất bại.");
        }
      } catch (error) {
        await markPrintJobFailed(job, error?.message || "POS in bill thất bại.");
        setPrinterNotice(error?.message || "POS in bill thất bại.");
      } finally {
        processingPrintJobsRef.current.delete(job.id);
      }
    }

    async function startPrintStation() {
      setPrinterNotice("Máy in đang chờ lệnh in.");

      unsubscribe = await subscribePrintJobs({
        branchUuid,
        printerKey,
        jobType: CUSTOMER_BILL_JOB_TYPE,
        deviceId,
        onPendingJob: processPrintJob
      });

      const pendingJobs = await readPendingPrintJobs({
        branchUuid,
        printerKey,
        jobType: CUSTOMER_BILL_JOB_TYPE
      });
      if (!stopped) {
        pendingJobs.forEach((job) => processPrintJob(job));
      }
    }

    startPrintStation();

    return () => {
      stopped = true;
      unsubscribe();
    };
  }, [profile, printerSettings, session]);

  useEffect(() => {
    function handleResize() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!showMoreMenu || typeof window === "undefined") return undefined;

    function handlePointerDown(event) {
      if (moreMenuRef.current?.contains(event.target)) return;
      setShowMoreMenu(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setShowMoreMenu(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showMoreMenu]);

  useEffect(() => {
    if (!session || !profile || loading) return;

    const activeOrders = orders.filter(isAutoPrintableOrder);
    if (!autoPrintBootstrappedRef.current) {
      autoPrintStartedAtRef.current = Date.now();
      activeOrders.forEach((order) => {
        autoPrintedOrderKeysRef.current.add(getOrderAutoPrintKey(order));
      });
      autoPrintBootstrappedRef.current = true;
      return;
    }

    activeOrders.forEach((order) => {
      const autoPrintKey = getOrderAutoPrintKey(order);
      if (!autoPrintKey) return;
      if (autoPrintedOrderKeysRef.current.has(autoPrintKey)) return;
      if (autoPrintingOrderKeysRef.current.has(autoPrintKey)) return;

      const orderTimeValue = getOrderAutoPrintTimeValue(order);
      if (!orderTimeValue || orderTimeValue < autoPrintStartedAtRef.current - AUTO_PRINT_RECENT_GRACE_MS) {
        autoPrintedOrderKeysRef.current.add(autoPrintKey);
        return;
      }

      const printState = getOrderPrintState(order, printJobsByOrderKey);
      if (isBlockingAutoPrintStatus(printState.status)) {
        autoPrintedOrderKeysRef.current.add(autoPrintKey);
        return;
      }

      autoPrintingOrderKeysRef.current.add(autoPrintKey);
      setPrintingOrderKey(getKitchenOrderKey(order));
      submitPrintJob(order, {
        silent: true,
        requestedBy: `${AUTO_PRINT_REQUESTED_BY}:${profile?.email || profile?.name || "staff"}`
      }).then((result) => {
        if (result.ok) {
          autoPrintedOrderKeysRef.current.add(autoPrintKey);
          setPrinterNotice(`Tự động gửi lệnh in bill ${order.displayOrderCode || order.orderCode || ""}.`.trim());
        }
      }).finally(() => {
        autoPrintingOrderKeysRef.current.delete(autoPrintKey);
        setPrintingOrderKey((currentKey) => (
          currentKey === getKitchenOrderKey(order) ? "" : currentKey
        ));
      });
    });
  }, [loading, orders, printJobsByOrderKey, profile, session]);

  if (authLoading || !session || !profile) {
    return (
      <KitchenLoginScreen
        error={authError}
        loading={authLoading}
        onLogin={login}
        submitting={submitting}
      />
    );
  }

  const displayName = profile.name || profile.email || "Tài khoản bếp";
  const branchLabel = profile.branchName || profile.branchAlias || "Chưa gán chi nhánh";

  function scrollToOrder(orderKey = "") {
    window.requestAnimationFrame(() => {
      orderRefs.current[orderKey]?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function handleSelectOrder(orderKey = "") {
    setActiveOrderKey((currentKey) => {
      const nextKey = currentKey === orderKey ? "" : orderKey;
      if (nextKey) scrollToOrder(nextKey);
      return nextKey;
    });
    setActiveDishKey("");
  }

  function handleFocusOrder(orderKey = "") {
    if (!orderKey) return;
    setActiveOrderKey(orderKey);
    setActiveDishKey("");
  }

  function handleMarkOrderDone(order) {
    const orderKey = getKitchenOrderKey(order);
    setActiveDishKey("");
    setActiveOrderKey((currentKey) => (currentKey === orderKey ? "" : currentKey));
    markDone(order);
  }

  function clearActiveSelection() {
    setActiveDishKey("");
    setActiveOrderKey("");
  }

  function handleDateFilterChange(value = "") {
    clearActiveSelection();
    setDateFilter(value);
  }

  function handleSourceFilterChange(value = "all") {
    clearActiveSelection();
    setSourceFilter(value);
  }

  function handleStatusFilterChange(value = "active") {
    clearActiveSelection();
    setStatusFilter(value);
  }

  function handleReload() {
    clearActiveSelection();
    setStatusFilter("active");
    reload();
  }

  function handleLogout() {
    setShowMoreMenu(false);
    logout();
  }

  function handleSelectDish(dishKey = "") {
    const firstMatchedOrder = filteredOrders.find((order) => orderContainsKitchenItemGroup(order, dishKey));
    if (!firstMatchedOrder) {
      clearActiveSelection();
      return;
    }

    const orderKey = getKitchenOrderKey(firstMatchedOrder);
    setActiveDishKey("");
    setActiveOrderKey((currentKey) => (currentKey === orderKey ? "" : orderKey));
    scrollToOrder(orderKey);
  }

  function getPrinterRuntimeOptions() {
    return {
      mode: printerSettings.mode,
      bridgeUrl: String(printerSettings.bridgeUrl || "").trim(),
      printerName: String(printerSettings.printerName || "").trim(),
      receiptWidthMm: Number(printerSettings.receiptWidthMm) === 58 ? 58 : 80,
      storeName: String(printerSettings.storeName || "").trim()
    };
  }

  async function submitPrintJob(order, options = {}) {
    const orderKey = getKitchenOrderKey(order);
    if (!options.silent) setPrintingOrderKey(orderKey);
    try {
      const result = await createCustomerBillPrintJob(order, {
        branchUuid: profile?.branchUuid || "",
        printerKey: DEFAULT_PRINTER_KEY,
        jobType: CUSTOMER_BILL_JOB_TYPE,
        requestedBy: options.requestedBy || profile?.email || profile?.name || "",
        printerOptions: getPrinterRuntimeOptions()
      });

      if (result.ok) {
        const now = new Date().toISOString();
        const job = result.job || {
          id: `local-${orderKey}-${Date.now()}`,
          order_id: toText(order.id),
          order_code: toText(order.displayOrderCode || order.orderCode || order.id),
          status: "pending",
          requested_at: now,
          created_at: now,
          updated_at: now
        };
        setPrintJobsByOrderKey((currentMap) => upsertPrintJobIntoMap(currentMap, job));
      }

      if (!options.silent || !result.ok) {
        setPrinterNotice(result.message || (result.ok ? "Đã gửi lệnh in bill tới máy POS." : "Gửi lệnh in thất bại."));
      }

      return result;
    } catch (error) {
      const message = error?.message || "Gửi lệnh in thất bại.";
      setPrinterNotice(message);
      return {
        ok: false,
        message
      };
    } finally {
      if (!options.silent) setPrintingOrderKey("");
    }
  }

  async function handlePrintBill(order) {
    await submitPrintJob(order);
  }

  const isMobile = viewport.width <= 900;
  const isTabletBoard = viewport.width > 900 && viewport.width < 1100;
  const boardColumns = isMobile
    ? "1fr"
    : isTabletBoard
      ? "minmax(0, 1fr) minmax(320px, 0.38fr)"
      : "minmax(0, 1fr) minmax(340px, 0.40fr)";
  const realtimeToneStyle = getRealtimeToneStyle(realtimeStatus?.tone);
  const syncStatusText = `${realtimeStatus?.label || "Chưa nối realtime"} · Cập nhật ${formatUpdatedTime(lastUpdatedAt)}`;

  return (
    <main
      style={{
        minHeight: "100dvh",
        height: isMobile ? "auto" : "100dvh",
        background: "#f8fafc",
        color: "#1f2933",
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        padding: isMobile ? 6 : isTabletBoard ? 6 : 8,
        boxSizing: "border-box",
        overflow: isMobile ? "auto" : "hidden"
      }}
    >
      <section
        style={{
          maxWidth: "100%",
          minHeight: isMobile ? "auto" : "100%",
          height: isMobile ? "auto" : "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: isMobile ? 6 : isTabletBoard ? 6 : 8
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? "minmax(118px, 138px) minmax(0, 1fr) auto"
              : "minmax(150px, 190px) minmax(0, 1fr) auto",
            alignItems: "center",
            gap: isMobile ? 6 : 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: isMobile ? 12 : 14,
            padding: isMobile ? 7 : "8px 10px",
            boxShadow: "0 5px 14px rgba(15, 23, 42, 0.045)"
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                color: "#6b7280",
                fontSize: 11,
                fontWeight: 850,
                lineHeight: 1.2,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {branchLabel}
            </p>
            <h1
              style={{
                margin: "2px 0 0",
                color: "#111827",
                fontSize: isMobile ? 17 : 20,
                lineHeight: 1.1,
                whiteSpace: "nowrap"
              }}
            >
              Bếp chi nhánh
            </h1>
          </div>

          <div
            style={{
              gridColumn: 3,
              gridRow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6
            }}
          >
            <button
              type="button"
              onClick={handleReload}
              disabled={refreshing}
              aria-label="Tải lại danh sách đơn"
              title="Tải lại"
              style={{
                border: "1px solid #16a34a",
                background: "#16a34a",
                color: "#ffffff",
                borderRadius: 8,
                padding: 0,
                fontSize: 14,
                fontWeight: 900,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.85 : 1,
                width: 34,
                height: 34
              }}
            >
              <ToolbarIcon name="refresh" size={17} />
            </button>

            <div ref={moreMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowMoreMenu((current) => !current)}
                aria-expanded={showMoreMenu}
                aria-label="Mở thêm tùy chọn"
                title="Thêm"
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  borderRadius: 8,
                  padding: 0,
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                  width: 34,
                  height: 34
                }}
              >
                <ToolbarIcon name="more" size={17} />
              </button>

              {showMoreMenu ? (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: isMobile ? "min(320px, calc(100vw - 20px))" : 330,
                    maxWidth: "calc(100vw - 20px)",
                    maxHeight: "calc(100dvh - 72px)",
                    border: "1px solid #dbe3ef",
                    background: "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
                    padding: isMobile ? 10 : 12,
                    boxSizing: "border-box",
                    overflowY: "auto",
                    overscrollBehavior: "contain",
                    zIndex: 30,
                    display: "grid",
                    gap: isMobile ? 8 : 10
                  }}
                >
                  <div style={{ display: "grid", gap: 3 }}>
                    <strong style={{ color: "#111827", fontSize: 14, lineHeight: 1.25 }}>
                      {displayName}
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 12, fontWeight: 750 }}>
                      {branchLabel}
                    </span>
                  </div>

                  <label
                    style={{
                      display: "grid",
                      gridTemplateColumns: "16px minmax(0, 1fr)",
                      alignItems: "center",
                      gap: 8,
                      border: "1px solid #cbd5e1",
                      borderRadius: 9,
                      padding: "0 11px",
                      height: 38,
                      width: "100%",
                      minWidth: 0,
                      color: "#64748b",
                      boxSizing: "border-box"
                    }}
                  >
                    <ToolbarIcon name="calendar" />
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(event) => handleDateFilterChange(event.target.value)}
                      style={{
                        width: "100%",
                        minWidth: 0,
                        border: "none",
                        outline: "none",
                        fontSize: 13,
                        color: "#334155",
                        background: "transparent",
                        boxSizing: "border-box"
                      }}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", minWidth: 0 }}>
                    <FilterButton active={dateFilter === getTodayDateKey()} onClick={() => handleDateFilterChange(getTodayDateKey())}>
                      Hôm nay
                    </FilterButton>
                    <span
                      title={syncStatusText}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        minHeight: 34,
                        flex: "1 1 auto",
                        minWidth: 0,
                        border: realtimeToneStyle.border,
                        background: realtimeToneStyle.background,
                        color: realtimeToneStyle.color,
                        borderRadius: 8,
                        padding: "7px 9px",
                        fontSize: 12,
                        fontWeight: 850,
                        lineHeight: 1.25,
                        boxSizing: "border-box"
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: realtimeToneStyle.dot,
                          flex: "0 0 auto"
                        }}
                      />
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {syncStatusText}
                      </span>
                    </span>
                  </div>

                  {printerNotice ? (
                    <span style={{ color: "#334155", fontSize: 12, fontWeight: 750, lineHeight: 1.35 }}>
                      {printerNotice}
                    </span>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={submitting}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      color: "#374151",
                      borderRadius: 8,
                      padding: "9px 12px",
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: submitting ? "not-allowed" : "pointer",
                      textAlign: "left",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ToolbarIcon name="logout" />
                      Đăng xuất
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              gridColumn: 2,
              gridRow: 1,
              display: "flex",
              gap: 6,
              flexWrap: "nowrap",
              alignItems: "center",
              minWidth: 0,
              overflowX: "auto",
              scrollbarWidth: "none"
            }}
          >
            <SourceFilterSelect value={sourceFilter} onChange={handleSourceFilterChange} />
            <FilterButton active={statusFilter === "active"} onClick={() => handleStatusFilterChange("active")}>
              Đang xử lý
            </FilterButton>
            <FilterButton
              active={statusFilter === "scheduled"}
              badgeCount={stats.scheduled || 0}
              onClick={() => handleStatusFilterChange("scheduled")}
            >
              Đơn đặt trước
            </FilterButton>
            <FilterButton active={statusFilter === "done"} onClick={() => handleStatusFilterChange("done")}>
              Hoàn thành
            </FilterButton>
            <FilterButton active={statusFilter === "cancelled"} onClick={() => handleStatusFilterChange("cancelled")}>
              Đã hủy
            </FilterButton>
            <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilterChange("all")}>
              Tất cả
            </FilterButton>
            {false ? <KitchenRequestAuditBadge audit={requestAudit} onReset={resetRequestAudit} /> : null}
          </div>
        </header>

        <section
          style={{
            display: "none",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12
          }}
        >
          {STAT_CARDS.map((card) => (
            <div
              key={card.id}
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                borderRadius: 8,
                padding: 14
              }}
            >
              <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                {card.label}
              </div>
              <strong style={{ display: "block", marginTop: 6, fontSize: 26, color: "#111827" }}>
                {stats[card.id] || 0}
              </strong>
            </div>
          ))}
        </section>

        {error ? (
          <div
            style={{
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              color: "#c2410c",
              borderRadius: 8,
              padding: 12,
              fontWeight: 700
            }}
          >
            {error}
          </div>
        ) : null}

        <section
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 8,
            padding: 10,
            display: "none",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap"
          }}
        >
          {printerNotice ? (
            <span style={{ marginLeft: "auto", color: "#334155", fontSize: 13, fontWeight: 700 }}>
              {printerNotice}
            </span>
          ) : null}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: boardColumns,
            gap: isMobile ? 8 : isTabletBoard ? 8 : 10,
            alignItems: "stretch",
            minHeight: 0,
            height: isMobile ? "auto" : "100%",
            overflow: isMobile ? "visible" : "hidden"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateRows: "minmax(0, 1fr) auto",
              gap: isMobile ? 8 : isTabletBoard ? 8 : 10,
              minHeight: 0,
              overflow: isMobile ? "visible" : "hidden"
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                alignContent: "start",
                overflowY: isMobile ? "visible" : "auto",
                minHeight: 0,
                paddingRight: 4,
                paddingBottom: 12
              }}
            >
          {loading ? (
            <div
              style={{
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                borderRadius: 8,
                padding: 18,
                color: "#64748b"
              }}
            >
              Đang tải danh sách đơn chi nhánh...
            </div>
          ) : null}

          {!loading && filteredOrders.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                background: "#ffffff",
                borderRadius: 8,
                padding: 22,
                textAlign: "center",
                color: "#64748b"
              }}
            >
              Chưa có đơn phù hợp với chi nhánh hoặc bộ lọc hiện tại.
            </div>
          ) : null}

            {filteredOrders.map((order) => {
              const orderKey = getKitchenOrderKey(order);
              const highlightedByDish = orderContainsKitchenItemGroup(order, activeDishKey);
              const printBillState = getOrderPrintState(order, printJobsByOrderKey, printingOrderKey);

              return (
                <div
                  key={orderKey}
                  ref={(node) => {
                    if (node) orderRefs.current[orderKey] = node;
                    else delete orderRefs.current[orderKey];
                  }}
                >
                <KitchenOrderCard
                  compact={isMobile}
                  tabletCompact={isTabletBoard}
                  active={activeOrderKey === orderKey}
                  dimmed={Boolean(activeOrderKey && activeOrderKey !== orderKey)}
                  highlightedDishKey={highlightedByDish ? activeDishKey : ""}
                  isItemHighlighted={(item) => activeDishKey && getKitchenItemGroupKey(item) === activeDishKey}
                  onFocusOrder={handleFocusOrder}
                  onSelectOrder={handleSelectOrder}
                  order={order}
                  updating={String(updatingOrderId) === String(order.id)}
                  updatingItemKey={updatingItemKey}
                  printingBill={printingOrderKey === orderKey}
                  printBillState={printBillState}
                  onMarkDone={handleMarkOrderDone}
                  onPrintBill={handlePrintBill}
                  onToggleItemDone={toggleItemDone}
                />
                </div>
              );
            })}
            {!loading && statusFilter === "done" && canLoadMoreDoneOrders ? (
              <button
                type="button"
                onClick={loadMoreDoneOrders}
                disabled={refreshing}
                style={{
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  borderRadius: 10,
                  padding: "13px 16px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: refreshing ? "not-allowed" : "pointer",
                  opacity: refreshing ? 0.72 : 1
                }}
              >
                {refreshing ? "Đang tải thêm..." : "Xem thêm đơn hoàn thành"}
              </button>
            ) : null}
            </div>

            <KitchenOrderStrip
              activeOrderKey={activeOrderKey}
              orders={filteredOrders}
              onSelectOrder={handleSelectOrder}
            />
          </div>

          <KitchenDishSummaryPanel
            activeDishKey={activeDishKey}
            activeOrderKey={activeOrderKey}
            orders={filteredOrders}
            onSelectDish={handleSelectDish}
          />
        </section>
      </section>
    </main>
  );
}






