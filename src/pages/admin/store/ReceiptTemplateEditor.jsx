import { useMemo, useState } from "react";
import { AdminButton, AdminInput } from "../ui/index.js";
import { buildReceiptText } from "../../../services/printerService.js";
import { renderReceiptTemplateBody, RECEIPT_TEMPLATE_CSS } from "../../../services/receiptTemplateHtml.js";
import { createReceiptSample, RECEIPT_SAMPLE_TYPES } from "../../../data/receiptTemplateSamples.js";
import "../../../styles/admin/receipt-template.css";

const FIELDS = [
  ["brand", "Tên thương hiệu"], ["slogan", "Dòng giới thiệu dưới tên"],
  ["customerTitle", "Tiêu đề bill khách"], ["kitchenTitle", "Tiêu đề bill món"],
  ["website", "Website ở cuối bill"], ["hotline", "Hotline"],
  ["thanks", "Lời cảm ơn"], ["kitchenReminder", "Lời nhắc cuối bill món"]
];
const OPTIONS = [
  ["showBranch", "Thông tin chi nhánh"], ["showCashier", "Tên thu ngân"],
  ["showCustomer", "Thông tin khách hàng"], ["showLoyalty", "QR xem / nhận điểm trên bill khách"],
  ["showStamps", "Tem hiện có khi đã tra cứu được"]
];

export default function ReceiptTemplateEditor({ draft, update, loading, saving, loaded, notice, save, reset, previewOnly = false }) {
  const [type, setType] = useState("pos");
  const [paid, setPaid] = useState(true);
  const [hasPhone, setHasPhone] = useState(false);
  const [width, setWidth] = useState(80);
  const html = useMemo(() => {
    const sample = createReceiptSample(type, paid, hasPhone);
    const text = buildReceiptText(sample, {
      receiptWidthMm: width, receiptTemplate: { ...draft, enabled: true }
    });
    return renderReceiptTemplateBody(text);
  }, [draft, type, paid, hasPhone, width]);

  return (
    <section className="admin-stack receipt-template-settings">
      <style>{RECEIPT_TEMPLATE_CSS}</style>
      <header>
        <h2>Mẫu in bill</h2>
        <p>Một bố cục chung cho bill khách tại POS, website và đối tác. Bill món tập trung vào thao tác bếp.</p>
      </header>
      <div className="receipt-template-note">
        <strong>{previewOnly ? "Bản xem thử riêng, không lưu cấu hình hay gửi lệnh in." : draft.enabled ? "Đang dùng mẫu chung trên các phiên bản hỗ trợ." : "Đang xem thử, chưa áp dụng mẫu chung."}</strong>
        <p>Thay đổi bên dưới chỉ có hiệu lực sau khi bấm Lưu và áp dụng. POS cần bản cập nhật hỗ trợ mẫu chung; bản 0.4.30 chưa có phần này.</p>
      </div>
      <div className="receipt-template-layout">
        <div className="receipt-template-controls admin-stack">
          <div className="receipt-template-card admin-stack">
            <h3>Nội dung chung</h3>
            {FIELDS.map(([key, label]) => (
              <label key={key}><span>{label}</span>
                <AdminInput maxLength={100} value={draft[key]} onValueChange={(value) => update(key, value)} disabled={loading || saving} />
              </label>
            ))}
          </div>
          <div className="receipt-template-card admin-stack">
            <h3>Thông tin hiển thị</h3>
            {OPTIONS.map(([key, label]) => (
              <label key={key} className="receipt-template-check">
                <input type="checkbox" checked={draft[key]} onChange={(event) => update(key, event.target.checked)} disabled={loading || saving} />
                <span>{label}</span>
              </label>
            ))}
            <p>Mã đơn, món, topping, ghi chú và trạng thái thanh toán luôn được giữ. Số tiền lấy từ đơn thật; bill đối tác tiếp tục không in tiền đối soát nội bộ.</p>
          </div>
          <div className="receipt-template-actions">
            <AdminButton onClick={save} disabled={loading || saving || !loaded}>{saving ? "Đang lưu…" : "Lưu và áp dụng"}</AdminButton>
            <AdminButton variant="secondary" onClick={reset} disabled={loading || saving}>Xem mẫu mặc định</AdminButton>
          </div>
          {notice && <p role="status">{notice}</p>}
        </div>
        <div className="receipt-template-preview-panel">
          <div className="receipt-template-card admin-stack">
            <h3>Xem trước bill</h3>
            <div className="receipt-template-tabs" role="group" aria-label="Loại bill">
              {RECEIPT_SAMPLE_TYPES.map((item) => <button type="button" key={item.id} aria-pressed={type === item.id}
                onClick={() => setType(item.id)}>{item.label}</button>)}
            </div>
            <div className="receipt-template-preview-options">
              <label>Khổ xem trước <select value={width} onChange={(event) => setWidth(Number(event.target.value))}>
                <option value={80}>80 mm</option><option value={58}>58 mm</option>
              </select></label>
              {type !== "kitchen" && type !== "partner" && <label className="receipt-template-check">
                <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> Đã thanh toán
              </label>}
              {type !== "kitchen" && <label className="receipt-template-check">
                <input type="checkbox" checked={hasPhone} onChange={(event) => setHasPhone(event.target.checked)} /> Có SĐT
              </label>}
            </div>
            <p className="receipt-template-caption">Dữ liệu minh họa · không gửi lệnh in, không phát sinh điểm/tem. Khổ giấy thực tế vẫn theo cấu hình máy in.</p>
          </div>
          <div className="receipt-template-paper-wrap">
            <div className="receipt-paper" style={{ width: width === 58 ? 260 : 340 }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <p className="receipt-template-caption">Giấy in có thể chênh nhẹ theo font và máy in. Bill chưa thanh toán chỉ in phiếu làm món, không có QR nhận điểm.</p>
        </div>
      </div>
    </section>
  );
}
