import { useEffect, useState } from "react";
import Icon from "../../../../components/Icon.jsx";
import { getAdminBusinessAnalyticsRpc } from "../../../../services/adminBusinessAnalyticsService.js";
import { addDaysToVietnamDateInput, buildVietnamDateRange, toVietnamDateInputValue } from "../../../../utils/adminDateRange.js";
import { formatMoney } from "../../../../utils/format.js";

export default function MenuPerformancePanel() {
  const [state, setState] = useState({ status: "loading", rows: [], error: "" });

  useEffect(() => {
    let disposed = false;
    const loadPerformance = async () => {
      const today = toVietnamDateInputValue();
      try {
        const analytics = await getAdminBusinessAnalyticsRpc(
          buildVietnamDateRange(addDaysToVietnamDateInput(today, -29), today)
        );
        if (disposed) return;
        setState({ status: "ready", rows: Array.isArray(analytics?.slowProducts) ? analytics.slowProducts : [], error: "" });
      } catch {
        if (disposed) return;
        setState({ status: "error", rows: [], error: "Không thể tải hiệu quả món bán lúc này." });
      }
    };

    loadPerformance();
    return () => { disposed = true; };
  }, []);

  const maxQuantity = Math.max(...state.rows.map((item) => Number(item.quantity || 0)), 1);

  return (
    <section className="admin-menu-performance" aria-labelledby="menu-performance-title">
      <header>
        <div>
          <span>30 ngày gần nhất</span>
          <h2 id="menu-performance-title">Hiệu quả món bán</h2>
          <p>Dùng để rà soát menu định kỳ, không phải cảnh báo vận hành hằng ngày.</p>
        </div>
        <div className="admin-menu-performance-note">
          <Icon name="warning" size={17} />
          <span>Món bán ít chưa chắc cần loại bỏ. Hãy kiểm tra thời gian mở bán, mùa vụ và lợi nhuận trước khi quyết định.</span>
        </div>
      </header>

      {state.status === "loading" ? (
        <div className="admin-menu-performance-empty">Đang tổng hợp dữ liệu món bán...</div>
      ) : state.status === "error" ? (
        <div className="admin-menu-performance-empty is-error">{state.error}</div>
      ) : state.rows.length ? (
        <div className="admin-menu-performance-list">
          {state.rows.map((item, index) => (
            <article key={`${item.name}-${index}`}>
              <b>{index + 1}</b>
              <div>
                <strong>{item.name}</strong>
                <em><i style={{ width: `${Math.max(6, (Number(item.quantity || 0) / maxQuantity) * 100)}%` }} /></em>
                <small>{formatMoney(item.revenue)} doanh thu</small>
              </div>
              <span>{Number(item.quantity || 0)} món</span>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-menu-performance-empty">Chưa có dữ liệu món bán trong 30 ngày gần nhất.</div>
      )}
    </section>
  );
}
