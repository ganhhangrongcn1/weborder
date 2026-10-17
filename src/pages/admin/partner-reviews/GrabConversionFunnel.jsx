import useGrabConversionFunnel from '../../../hooks/useGrabConversionFunnel.js';
import { AdminInput, AdminButton } from '../ui/index.js';
import '../../../styles/admin/grab-funnel.css';

const number = value => Number(value || 0).toLocaleString('vi-VN');
const rate = value => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const date = value => value ? new Date(value).toLocaleDateString('vi-VN') : '—';

export default function GrabConversionFunnel({ branchUuid = '', sourceId = 'all' }) {
  const state = useGrabConversionFunnel({ branchUuid, sourceId });
  const { report, status } = state;
  const summary = report?.summary;
  const hasData = Boolean(report?.coveredDays);
  const steps = [['reach', 'Xem trang quán'], ['visits', 'Xem thực đơn'], ['baskets', 'Tới giỏ hàng'], ['checkouts', 'Checkout']];
  return (
    <section className="grab-funnel" aria-label="Phễu chuyển đổi Grab">
      <header className="grab-funnel-header">
        <div><span className="grab-funnel-eyebrow">GrabFood · {report?.displayName || 'Các gian hàng'}</span><h2>Phễu khách hàng</h2><p>Từ lượt xem quán đến bước thanh toán.</p></div>
        <div className="grab-funnel-actions"><span className="grab-funnel-sync">Đồng bộ mỗi giờ</span><AdminButton variant="secondary" onClick={state.refresh} disabled={status === 'loading'}>{status === 'loading' ? 'Đang tải…' : 'Làm mới'}</AdminButton></div>
      </header>
      <div className="grab-funnel-filters">
        <label>Từ ngày<AdminInput type="date" value={state.fromDate} max={state.toDate} onChange={event => state.setFromDate(event.target.value)} /></label>
        <label>Đến ngày<AdminInput type="date" value={state.toDate} min={state.fromDate} max={state.yesterday} onChange={event => state.setToDate(event.target.value)} /></label>
        <small>{report?.lastSyncedAt ? `Cập nhật: ${new Date(report.lastSyncedAt).toLocaleString('vi-VN')}` : 'Chưa có thời điểm cập nhật'}</small>
      </div>
      {state.error ? <p role="alert" className="grab-funnel-warning">{state.error}</p> : null}
      {status === 'loading' ? <p role="status">Đang tải phễu đã đồng bộ...</p> : null}
      {report?.available === false ? <p>Chi nhánh hoặc gian hàng đang chọn chưa có nguồn phễu Grab được cấu hình.</p> : null}
      {report?.available ? <>
        {report.syncOk === false || report.stale ? <p role="status" className="grab-funnel-warning">Dữ liệu chưa được cập nhật gần đây. Bên dưới là số liệu đã lưu thành công gần nhất.</p> : null}
        {report.coveredStoreDays < report.expectedStoreDays ? <p className="grab-funnel-warning">Đã có {report.coveredStoreDays}/{report.expectedStoreDays} lượt báo cáo ngày của {report.sourceCount} gian hàng. Phần còn thiếu chưa được tính vào tổng.</p> : null}
        {!hasData ? <p>Chưa có dữ liệu phễu trong khoảng ngày này. Hãy chọn khoảng ngày khác hoặc làm mới sau lượt đồng bộ.</p> : <>
          <div className="grab-funnel-body"><figure className="grab-funnel-journey"><figcaption><h3>Hành trình chuyển đổi</h3><p>{report.sourceCount} gian hàng · {report.coveredDays} ngày có dữ liệu</p></figcaption><ol className="grab-funnel-infographic">{steps.map(([key, label], index) => <li key={key} className={`grab-funnel-band grab-funnel-band--${index + 1}`}>
            <span>{label}</span><strong>{number(summary[key])}<small> lượt</small></strong>
          </li>)}</ol><p className="grab-funnel-scale-note">Độ rộng minh họa trình tự các bước; tỷ lệ thực tế ở bên cạnh.</p>
          </figure><aside className="grab-funnel-rates" aria-label="Tỷ lệ chuyển đổi"><h3>Tỷ lệ chuyển đổi</h3>
            <article><span>Trang quán → thực đơn</span><strong>{rate(summary.listingToMenuRate)}</strong></article>
            <article><span>Thực đơn → checkout</span><strong>{rate(summary.menuToCheckoutRate)}</strong></article>
            <article><span>Chuyển đổi toàn phễu</span><strong>{rate(summary.overallRate)}</strong></article>
          </aside></div>
          <p className="grab-funnel-note">Dữ liệu đến hết hôm qua. Số lượt có thể gồm khách quay lại; checkout là bước thanh toán, chưa phải đơn hoàn tất. Tỷ lệ tính từ tổng lượt của các ngày có dữ liệu.</p>
          <details><summary>Chi tiết {report.coveredDays} ngày</summary><div className="grab-funnel-table"><table>
            <thead><tr><th>Ngày</th>{steps.map(([key, label]) => <th key={key}>{label}</th>)}<th>Chuyển đổi</th><th>Gian hàng</th></tr></thead>
            <tbody>{report.daily.map(day => <tr key={day.date}><td>{date(day.date)}</td>{steps.map(([key]) => <td key={key}>{number(day[key])}</td>)}<td>{rate(day.overallRate)}</td><td>{day.sourceCount}/{report.sourceCount}</td></tr>)}</tbody>
          </table></div></details>
        </>}
      </> : null}
    </section>
  );
}
