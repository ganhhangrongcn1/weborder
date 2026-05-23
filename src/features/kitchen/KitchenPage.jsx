import { useEffect, useMemo, useRef, useState } from "react";
import useKitchenAuth from "../../hooks/useKitchenAuth.js";
import useKitchenNewOrderAlert from "../../hooks/useKitchenNewOrderAlert.js";
import useKitchenOrders, { getTodayDateKey } from "../../hooks/useKitchenOrders.js";
import KitchenDishSummaryPanel from "./KitchenDishSummaryPanel.jsx";
import KitchenOrderCard from "./KitchenOrderCard.jsx";
import KitchenOrderStrip from "./KitchenOrderStrip.jsx";
import {
  getPrinterConfig,
  hasAndroidPrinterBridge,
  printCustomerBill,
  printXprinterTestBill,
  testPrinterConnection
} from "../../services/printerService.js";
import {
  DEFAULT_PRINTER_KEY,
  claimPrintJob,
  createCustomerBillPrintJob,
  getPrintDeviceId,
  markPrintJobFailed,
  markPrintJobPrinted,
  readPendingPrintJobs,
  subscribePrintJobs
} from "../../services/printJobService.js";
import {
  getKitchenItemGroupKey,
  getKitchenOrderKey,
  orderContainsKitchenItemGroup
} from "./kitchenOrderGrouping.js";

const STAT_CARDS = [
  { id: "active", label: "Đang xử lý" },
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

function formatUpdatedTime(value = "") {
  if (!value) return "Chưa tải";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa tải";

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid #111827" : "1px solid #d1d5db",
        background: active ? "#111827" : "#ffffff",
        color: active ? "#ffffff" : "#374151",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}

function ToolbarIcon({ name, size = 15 }) {
  const map = {
    search: "⌕",
    calendar: "◷",
    refresh: "↻",
    printer: "⎙",
    bellOff: "🔕",
    logout: "⇥"
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
        minWidth: 172,
        height: 42
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
          padding: "0 34px 0 12px",
          fontSize: 13,
          fontWeight: 800,
          lineHeight: "42px",
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
          right: 12,
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

function savePrinterSettings(settings = {}) {
  try {
    window.localStorage.setItem(PRINTER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage.
  }
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
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [printerSettings, setPrinterSettings] = useState(() => readPrinterSettings());
  const [printerNotice, setPrinterNotice] = useState("");
  const [printerLoading, setPrinterLoading] = useState(false);
  const [printingOrderKey, setPrintingOrderKey] = useState("");
  const processingPrintJobsRef = useRef(new Set());
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
    search,
    setSearch,
    updatingOrderId,
    updatingItemKey,
    claimingGiftOrderId,
    requestAudit,
    resetRequestAudit,
    loadMoreDoneOrders,
    markDone,
    toggleItemDone,
    claimGift,
    reload
  } = useKitchenOrders(kitchenOrderOptions);
  const {
    soundEnabled,
    toggleSound
  } = useKitchenNewOrderAlert(orders, Boolean(session && profile));

  useEffect(() => {
    if (!session || !profile || !hasAndroidPrinterBridge()) return undefined;

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
      setPrinterNotice("POS đang chờ lệnh in từ iPad.");

      unsubscribe = await subscribePrintJobs({
        branchUuid,
        printerKey,
        deviceId,
        onPendingJob: processPrintJob
      });

      const pendingJobs = await readPendingPrintJobs({ branchUuid, printerKey });
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

  function handleSearchChange(value = "") {
    clearActiveSelection();
    setSearch(value);
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

  function handleSelectDish(dishKey = "") {
    setActiveDishKey((currentKey) => {
      const nextKey = currentKey === dishKey ? "" : dishKey;
      if (nextKey) {
        const firstMatchedOrder = filteredOrders.find((order) => orderContainsKitchenItemGroup(order, nextKey));
        if (firstMatchedOrder) scrollToOrder(getKitchenOrderKey(firstMatchedOrder));
      }
      return nextKey;
    });
    setActiveOrderKey("");
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

  function handlePrinterSettingChange(field, value) {
    setPrinterSettings((current) => ({ ...current, [field]: value }));
  }

  function handleSavePrinterSettings() {
    savePrinterSettings(printerSettings);
    setPrinterNotice("Đã lưu cài đặt máy in trên thiết bị này.");
  }

  async function handleTestPrinterConnection() {
    setPrinterLoading(true);
    const result = await testPrinterConnection(getPrinterRuntimeOptions());
    setPrinterNotice(result.message || (result.ok ? "Kết nối máy in thành công." : "Kết nối máy in thất bại."));
    setPrinterLoading(false);
  }

  async function handlePrintTestBill() {
    setPrinterLoading(true);
    const result = await printXprinterTestBill(getPrinterRuntimeOptions());
    setPrinterNotice(result.message || (result.ok ? "Đã gửi lệnh in test." : "In test thất bại."));
    setPrinterLoading(false);
  }

  async function handlePrintBill(order) {
    const orderKey = getKitchenOrderKey(order);
    setPrintingOrderKey(orderKey);
    const result = await createCustomerBillPrintJob(order, {
      branchUuid: profile?.branchUuid || "",
      printerKey: DEFAULT_PRINTER_KEY,
      requestedBy: profile?.email || profile?.name || "",
      printerOptions: getPrinterRuntimeOptions()
    });
    setPrinterNotice(result.message || (result.ok ? "Đã gửi lệnh in bill tới máy POS." : "Gửi lệnh in thất bại."));
    setPrintingOrderKey("");
  }

  const isMobile = viewport.width <= 900;
  const isLandscapeMobile = isMobile && viewport.width > viewport.height;
  const boardColumns = isMobile
    ? (isLandscapeMobile ? "minmax(0, 1fr) minmax(300px, 0.72fr)" : "1fr")
    : "minmax(0, 1fr) minmax(430px, 0.62fr)";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f8fafc",
        color: "#1f2933",
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        padding: isMobile ? 6 : 8,
        boxSizing: "border-box",
        overflow: isMobile ? "auto" : "hidden"
      }}
    >
      <section
        style={{
          maxWidth: "100%",
          minHeight: isMobile ? "auto" : "100%",
          margin: "0 auto",
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: isMobile ? 6 : 8
        }}
      >
        <header
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "320px minmax(0, 1fr)",
            alignItems: "start",
            gap: isMobile ? 10 : "10px 16px",
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: isMobile ? 12 : 18,
            padding: isMobile ? 10 : 12,
            boxShadow: "0 6px 18px rgba(15, 23, 42, 0.05)"
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                color: "#6b7280",
                fontSize: 13,
                fontWeight: 800,
                textTransform: "uppercase"
              }}
            >
              {branchLabel}
            </p>
            <h1
              style={{
                margin: 0,
                color: "#111827",
                fontSize: isMobile ? 22 : 28,
                lineHeight: 1.15
              }}
            >
              Xử lý đơn chi nhánh
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "flex-start" : "flex-end", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#334155", fontSize: 13, fontWeight: 800 }}>
              {displayName}
            </span>
            <label
              style={{
                display: "inline-grid",
                gridTemplateColumns: "16px minmax(0, 1fr)",
                alignItems: "center",
                gap: 8,
                width: isMobile ? "min(100%, 240px)" : 250,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 12px",
                height: 42,
                boxSizing: "border-box",
                color: "#64748b"
              }}
            >
              <ToolbarIcon name="search" />
              <input
                value={search}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Tìm mã đơn, khách, món..."
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "#334155",
                  background: "transparent"
                }}
              />
            </label>
            <label
              style={{
                display: "inline-grid",
                gridTemplateColumns: "16px minmax(0, 1fr)",
                alignItems: "center",
                gap: 8,
                width: isMobile ? "min(100%, 170px)" : 176,
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "0 12px",
                height: 42,
                boxSizing: "border-box",
                color: "#64748b"
              }}
            >
              <ToolbarIcon name="calendar" />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => handleDateFilterChange(event.target.value)}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: "#334155",
                  background: "transparent"
                }}
              />
            </label>
            <FilterButton active={dateFilter === getTodayDateKey()} onClick={() => handleDateFilterChange(getTodayDateKey())}>
              Hôm nay
            </FilterButton>
            <button
              type="button"
              onClick={reload}
              disabled={refreshing}
              style={{
                border: "1px solid #16a34a",
                background: "#16a34a",
                color: "#ffffff",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.85 : 1,
                minWidth: 70
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ToolbarIcon name="refresh" />
                Tải lại
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrinterModalOpen(true)}
              style={{
                border: "1px solid #0f766e",
                background: "#ccfbf1",
                color: "#115e59",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ToolbarIcon name="printer" />
                Máy in
              </span>
            </button>
            <button
              type="button"
              onClick={toggleSound}
              style={{
                border: soundEnabled ? "1px solid #15803d" : "1px solid #d1d5db",
                background: soundEnabled ? "#dcfce7" : "#ffffff",
                color: soundEnabled ? "#166534" : "#374151",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer"
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ToolbarIcon name="bellOff" />
                {soundEnabled ? "Chuông bật" : "Bật chuông"}
              </span>
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={submitting}
              style={{
                border: "1px solid #d1d5db",
                background: "#ffffff",
                color: "#374151",
                borderRadius: 8,
                padding: "10px 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: submitting ? "not-allowed" : "pointer"
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ToolbarIcon name="logout" />
                Đăng xuất
              </span>
            </button>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <SourceFilterSelect value={sourceFilter} onChange={handleSourceFilterChange} />
            <FilterButton active={statusFilter === "active"} onClick={() => handleStatusFilterChange("active")}>
              Đang xử lý
            </FilterButton>
            <FilterButton active={statusFilter === "done"} onClick={() => handleStatusFilterChange("done")}>
              Hoàn thành
            </FilterButton>
            <FilterButton active={statusFilter === "cancelled"} onClick={() => handleStatusFilterChange("cancelled")}>
              Đã hủy
            </FilterButton>
            <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilterChange("all")}>
              Tất cả trạng thái
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

        <section
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: 8,
            padding: 14,
            display: "none",
            gap: 12
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) 170px auto",
              gap: 10,
              alignItems: "center"
            }}
          >
            <input
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Tìm mã đơn, khách, món..."
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "11px 12px",
                fontSize: 14,
                boxSizing: "border-box"
              }}
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => handleDateFilterChange(event.target.value)}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14
              }}
            />
            <FilterButton active={dateFilter === getTodayDateKey()} onClick={() => handleDateFilterChange(getTodayDateKey())}>
              Hôm nay
            </FilterButton>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FilterButton active={statusFilter === "active"} onClick={() => handleStatusFilterChange("active")}>
              Đang xử lý
            </FilterButton>
            <FilterButton active={statusFilter === "done"} onClick={() => handleStatusFilterChange("done")}>
              Đã xong
            </FilterButton>
            <FilterButton active={statusFilter === "cancelled"} onClick={() => handleStatusFilterChange("cancelled")}>
              Đã hủy
            </FilterButton>
            <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilterChange("all")}>
              Tất cả trạng thái
            </FilterButton>
          </div>
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
          <FilterButton active={!isPrinterModalOpen} onClick={() => setIsPrinterModalOpen(false)}>
            Đơn bếp
          </FilterButton>
          <FilterButton active={isPrinterModalOpen} onClick={() => setIsPrinterModalOpen(true)}>
            Máy in
          </FilterButton>
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
            gap: isMobile ? 8 : 10,
            alignItems: "stretch",
            minHeight: 0,
            height: isMobile ? "auto" : "100%"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateRows: "minmax(0, 1fr) auto",
              gap: isMobile ? 8 : 10,
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
                  claimingGift={String(claimingGiftOrderId) === String(order.id)}
                  onMarkDone={handleMarkOrderDone}
                  onPrintBill={handlePrintBill}
                  onToggleItemDone={toggleItemDone}
                  onClaimGift={claimGift}
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
        {isPrinterModalOpen ? (
          <div
            role="presentation"
            onClick={() => setIsPrinterModalOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(15, 23, 42, 0.45)",
              display: "grid",
              placeItems: "center",
              padding: 16
            }}
          >
          <section
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              borderRadius: 12,
              padding: 16,
              display: "grid",
              gap: 14,
              alignContent: "start"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 22, color: "#0f172a" }}>
                Cài đặt máy in
              </h2>
              <button
                type="button"
                onClick={() => setIsPrinterModalOpen(false)}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer"
                }}
              >
                Đóng
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                Chế độ in
                <select
                  value={printerSettings.mode}
                  onChange={(event) => handlePrinterSettingChange("mode", event.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    color: "#0f172a",
                    background: "#ffffff"
                  }}
                >
                  <option value="webPrint">Web print</option>
                  <option value="bridge">Bridge (Xprinter)</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                Tên máy in
                <input
                  value={printerSettings.printerName}
                  onChange={(event) => handlePrinterSettingChange("printerName", event.target.value)}
                  placeholder="Xprinter"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                Khổ giấy
                <select
                  value={printerSettings.receiptWidthMm}
                  onChange={(event) => handlePrinterSettingChange("receiptWidthMm", event.target.value)}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    color: "#0f172a",
                    background: "#ffffff"
                  }}
                >
                  <option value="80">80 mm</option>
                  <option value="58">58 mm</option>
                </select>
              </label>
              <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 }}>
                Tên cửa hàng in trên bill
                <input
                  value={printerSettings.storeName}
                  onChange={(event) => handlePrinterSettingChange("storeName", event.target.value)}
                  placeholder="Gánh Hàng Rong"
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14
                  }}
                />
              </label>
            </div>
            <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 800 }}>
              Bridge URL (chỉ dùng khi chọn Bridge)
              <input
                value={printerSettings.bridgeUrl}
                onChange={(event) => handlePrinterSettingChange("bridgeUrl", event.target.value)}
                placeholder="http://192.168.1.10:3001"
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 14
                }}
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                onClick={handleSavePrinterSettings}
                disabled={printerLoading}
                style={{
                  border: "1px solid #0f766e",
                  background: "#14b8a6",
                  color: "#ffffff",
                  borderRadius: 8,
                  padding: "10px 13px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: printerLoading ? "not-allowed" : "pointer",
                  opacity: printerLoading ? 0.72 : 1
                }}
              >
                Lưu cài đặt
              </button>
              <button
                type="button"
                onClick={handleTestPrinterConnection}
                disabled={printerLoading}
                style={{
                  border: "1px solid #2563eb",
                  background: "#2563eb",
                  color: "#ffffff",
                  borderRadius: 8,
                  padding: "10px 13px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: printerLoading ? "not-allowed" : "pointer",
                  opacity: printerLoading ? 0.72 : 1
                }}
              >
                {printerLoading ? "Đang xử lý..." : "Kiểm tra kết nối"}
              </button>
              <button
                type="button"
                onClick={handlePrintTestBill}
                disabled={printerLoading}
                style={{
                  border: "1px solid #16a34a",
                  background: "#16a34a",
                  color: "#ffffff",
                  borderRadius: 8,
                  padding: "10px 13px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: printerLoading ? "not-allowed" : "pointer",
                  opacity: printerLoading ? 0.72 : 1
                }}
              >
                {printerLoading ? "Đang xử lý..." : "In test"}
              </button>
            </div>
          </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}






