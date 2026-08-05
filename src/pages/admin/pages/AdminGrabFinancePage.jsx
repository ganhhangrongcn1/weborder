import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";
import { getGrabFinanceReport } from "../../../services/grabFinanceReportService.js";
import { addDaysToVietnamDateInput, toVietnamDateInputValue } from "../../../utils/adminDateRange.js";
import { formatMoney } from "../../../utils/format.js";
import { AdminInput, AdminSelect } from "../ui/index.js";
import "../../../styles/admin/grab-finance.css";

const money = (value) => formatMoney(Math.round(Number(value || 0)));
const deductionMoney = (value) => money(Number(value || 0) > 0 ? -Number(value) : Number(value || 0));
const dateLabel = (value) => new Date(`${value}T12:00:00+07:00`).toLocaleDateString("vi-VN");

function buildPresetRange(preset, today) {
  if (preset === "today") return [today, today];
  if (preset === "yesterday") {
    const yesterday = addDaysToVietnamDateInput(today, -1);
    return [yesterday, yesterday];
  }
  if (preset === "week") {
    const weekday = new Date(`${today}T12:00:00+07:00`).getUTCDay();
    return [addDaysToVietnamDateInput(today, -(weekday === 0 ? 6 : weekday - 1)), today];
  }
  if (preset === "month") return [`${today.slice(0, 7)}-01`, today];
  return [addDaysToVietnamDateInput(today, -29), today];
}

export default function AdminGrabFinancePage({
  branches = [],
  selectedBranchFilter = "all",
  setSelectedBranchFilter
}) {
  const today = toVietnamDateInputValue();
  const initialRange = buildPresetRange("month", today);
  const [preset, setPreset] = useState("month");
  const [fromDate, setFromDate] = useState(initialRange[0]);
  const [toDate, setToDate] = useState(initialRange[1]);
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("all");
  const [selectedDay, setSelectedDay] = useState("");
  const branchOptions = useMemo(() => buildBranchFilterOptions(branches), [branches]);
  const selectedBranchOption = branchOptions.find((item) => item.value === selectedBranchFilter) || null;

  useEffect(() => {
    let disposed = false;
    setStatus("loading");
    setError("");
    getGrabFinanceReport({ fromDate, toDate, branchOption: selectedBranchOption })
      .then((nextReport) => {
        if (disposed) return;
        setReport(nextReport);
        setStatus("ready");
        setSelectedSourceId((current) => nextReport?.accounts?.some((item) => item.sourceId === current) ? current : "all");
        setSelectedDay("");
      })
      .catch((loadError) => {
        if (disposed) return;
        console.error("[admin][grab-finance] failed to load report", loadError);
        setReport(null);
        setStatus("error");
        setError("Chưa tải được báo cáo tài chính Grab. Anh thử tải lại sau ít phút.");
      });
    return () => { disposed = true; };
  }, [fromDate, toDate, selectedBranchFilter]);

  const selectedAccount = report?.accounts?.find((item) => item.sourceId === selectedSourceId) || null;
  const activeReport = selectedAccount || report || {};
  const dailyTotals = selectedAccount?.dailyTotals || report?.dailyTotals || [];
  const activeDay = dailyTotals.find((item) => item.date === selectedDay) || null;
  const display = activeDay || activeReport;
  const hasDetails = Number(display.detailedTransactionCount || 0) > 0;
  const grossSales = Number((hasDetails ? display.orderValueAmount : display.grossSalesAmount) || display.netRevenueAmount || 0);
  const netSales = Number(display.netRevenueAmount || 0);
  const netIncome = Number(display.netIncomeAmount || 0);
  const deliveryDiscount = Number(display.deliveryDiscountAmount || 0);
  const advertisingCost = Number(display.advertisingAmount || 0);
  const commission = Number(display.serviceFeeAmount || 0);
  const vat = Number(display.vatAmount || display.commissionTaxAmount || 0);
  const withholdingTax = Number(display.withholdingTaxAmount || 0);
  const orderNetIncome = netIncome - advertisingCost;
  const receiptRate = grossSales > 0 ? (netIncome / grossSales) * 100 : null;
  const lastSync = report?.lastSyncedAt
    ? new Date(report.lastSyncedAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
    : "--";

  const choosePreset = (nextPreset) => {
    setPreset(nextPreset);
    if (nextPreset === "custom") return;
    const range = buildPresetRange(nextPreset, today);
    setFromDate(range[0]);
    setToDate(range[1]);
  };

  return (
    <div className="grab-finance-page">
      <header className="grab-finance-header">
        <div><span className="grab-finance-title-icon"><Icon name="wallet" size={24} /></span><div><h1>Tài chính Grab</h1><p>Báo cáo doanh thu và thực nhận của 4 quán Grab.</p></div></div>
        <small>Đồng bộ gần nhất: {lastSync}</small>
      </header>

      <section className="grab-finance-filters">
        <label><span>Chi nhánh</span><AdminSelect value={selectedBranchFilter} onChange={(event) => setSelectedBranchFilter?.(event.target.value)} options={[{ value: "all", label: "Tất cả quán" }, ...branchOptions]} /></label>
        <label><span>Thời gian</span><AdminSelect value={preset} onChange={(event) => choosePreset(event.target.value)} options={[{ value: "today", label: "Hôm nay" }, { value: "yesterday", label: "Hôm qua" }, { value: "week", label: "Tuần này" }, { value: "month", label: "Tháng này" }, { value: "30d", label: "30 ngày gần nhất" }, { value: "custom", label: "Tùy chọn ngày" }]} /></label>
        <label><span>Từ ngày</span><AdminInput type="date" value={fromDate} max={toDate || today} onChange={(event) => { setFromDate(event.target.value); setPreset("custom"); }} /></label>
        <label><span>Đến ngày</span><AdminInput type="date" value={toDate} min={fromDate} max={today} onChange={(event) => { setToDate(event.target.value); setPreset("custom"); }} /></label>
      </section>

      {status === "error" ? <div className="grab-finance-message is-error">{error}</div> : null}
      {status === "loading" ? <div className="grab-finance-message">Đang tải số liệu Grab đã đồng bộ...</div> : null}

      {status === "ready" ? (
        <>
          <section className="grab-finance-store-list" aria-label="Chọn quán Grab">
            <button type="button" className={selectedSourceId === "all" ? "is-active" : ""} onClick={() => { setSelectedSourceId("all"); setSelectedDay(""); }}><span>Tất cả quán</span><strong>{money(report?.netIncomeAmount)}</strong><small>{report?.accountCount || 0} quán</small></button>
            {(report?.accounts || []).map((account) => <button type="button" key={account.sourceId} className={selectedSourceId === account.sourceId ? "is-active" : ""} onClick={() => { setSelectedSourceId(account.sourceId); setSelectedDay(""); }}><span>{account.displayName || account.branchCode || "Quán Grab"}</span><strong>{money(account.netIncomeAmount)}</strong><small>{account.totalOrders || 0} đơn</small></button>)}
          </section>

          <div className="grab-finance-content">
            <section className="grab-finance-report-card">
              <div className="grab-finance-report-title"><span><Icon name="wallet" size={22} /></span><h2>DOANH THU</h2></div>
              <div className="grab-finance-hero"><small>Thực nhận</small><strong>{money(netIncome)}</strong><span>{activeDay ? `Ngày ${dateLabel(activeDay.date)}` : `${fromDate === toDate ? dateLabel(fromDate) : `${dateLabel(fromDate)} - ${dateLabel(toDate)}`}`}</span></div>
              <div className="grab-finance-breakdown">
                <div><span><i>▤</i>Doanh thu tổng</span><strong>{money(grossSales)}</strong></div>
                <div><span><i>◇</i>Giảm giá do quán tài trợ</span><strong className="is-negative">{hasDetails ? deductionMoney(display.merchantDiscountAmount) : "--"}</strong></div>
                <div><span><i>◇</i>Giảm phí giao hàng quán tài trợ</span><strong className="is-negative">{hasDetails ? deductionMoney(deliveryDiscount) : "--"}</strong></div>
                <div className="is-subtotal"><span><i>▤</i>Doanh thu ròng</span><strong>{money(netSales)}</strong></div>
                <div><span><i>▣</i>Chiết khấu kênh bán hàng</span><strong className="is-negative">{hasDetails ? deductionMoney(commission) : "--"}</strong></div>
                <div><span><i>％</i>Thuế GTGT</span><strong className="is-negative">{hasDetails ? deductionMoney(vat) : "--"}</strong></div>
                <div><span><i>％</i>Thuế TNCN</span><strong className="is-negative">{hasDetails ? deductionMoney(withholdingTax) : "--"}</strong></div>
                <div className="is-subtotal"><span><i>▤</i>Thu nhập ròng</span><strong>{money(orderNetIncome)}</strong></div>
                <div><span><i>▥</i>Phí quảng cáo</span><strong className="is-negative">{hasDetails ? deductionMoney(advertisingCost) : "--"}</strong></div>
                <div className="is-subtotal"><span><i>▤</i>Thực nhận</span><strong>{money(netIncome)}</strong></div>
                <div><span><i>％</i>Tỷ lệ thực nhận / doanh thu tổng</span><strong>{receiptRate === null ? "--" : `${receiptRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`}</strong></div>
              </div>
              {!hasDetails ? <p className="grab-finance-detail-note">Chi tiết khoản trừ đang được đồng bộ dần; tổng thực nhận vẫn lấy từ API Grab.</p> : null}
              <div className="grab-finance-total"><span>Thực nhận</span><strong>{money(netIncome)}</strong></div>
            </section>

            <section className="grab-finance-history">
              <div><h2>Lịch sử theo ngày</h2><p>Bấm một ngày để xem báo cáo chi tiết.</p></div>
              <button type="button" className={!selectedDay ? "is-active" : ""} onClick={() => setSelectedDay("")}><span>Cả khoảng đã chọn</span><small>Doanh thu thuần {money(activeReport.netRevenueAmount)}</small><strong>{money(activeReport.netIncomeAmount)}</strong></button>
              {dailyTotals.map((day) => <button type="button" key={day.date} className={selectedDay === day.date ? "is-active" : ""} onClick={() => setSelectedDay(day.date)}><span>{dateLabel(day.date)}</span><small>Doanh thu thuần {money(day.netRevenueAmount)}</small><strong>{money(day.netIncomeAmount)}</strong></button>)}
              {!dailyTotals.length ? <div className="grab-finance-empty">Chưa có dữ liệu trong khoảng ngày này.</div> : null}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
