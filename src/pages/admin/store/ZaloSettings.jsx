import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ZALO_TEMPLATE, renderZaloTemplate } from "../../../services/zaloService.js";
import { AdminButton, AdminInput, AdminPanel } from "../ui/index.js";

const PREVIEW_MESSAGE = renderZaloTemplate(DEFAULT_ZALO_TEMPLATE, {
  customer_name: "Khách ví dụ",
  phone: "09xx xxx xxx",
  items: "- Bánh tráng trộn ví dụ x1: 35.000đ",
  total: "54.000đ",
  address: "Địa chỉ giao hàng ví dụ",
  note: "Ghi chú ví dụ",
  order_code: "GHR-0000",
  order_time: "01/01/2026 12:00",
  fulfillment_type: "Giao tận nơi",
  map_link: "https://maps.google.com/...",
  shipping_fee: "19.000đ",
  order_link: "https://ganhhangrong.vn/orders?orderCode=GHR-0000"
});

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export default function ZaloSettings({ zaloConfig, setZaloConfig, onSave }) {
  const [draftPhone, setDraftPhone] = useState(() => normalizePhone(zaloConfig?.phone));

  useEffect(() => {
    setDraftPhone(normalizePhone(zaloConfig?.phone));
  }, [zaloConfig?.phone]);

  const savedPhone = normalizePhone(zaloConfig?.phone);
  const hasChanges = useMemo(() => draftPhone !== savedPhone, [draftPhone, savedPhone]);

  const handleSave = () => {
    const nextConfig = {
      phone: draftPhone,
      template: DEFAULT_ZALO_TEMPLATE
    };
    setZaloConfig(nextConfig);
    onSave(nextConfig);
  };

  return (
    <AdminPanel
      className="admin-store-panel"
      title="Cấu hình Zalo nhận đơn"
      action={(
        <AdminButton
          variant={hasChanges ? "primary" : "secondary"}
          className={!hasChanges ? "opacity-70 cursor-not-allowed" : ""}
          disabled={!hasChanges}
          onClick={handleSave}
        >
          Lưu thay đổi
        </AdminButton>
      )}
    >
      <div className="admin-mini-grid admin-ui-panel-body">
        <div className="admin-mini-card">
          <label>Số điện thoại Zalo nhận đơn</label>
          <AdminInput
            value={draftPhone}
            onChange={(event) => setDraftPhone(normalizePhone(event.target.value))}
            placeholder="Ví dụ: 0788422424"
          />
          <small>Dùng số dạng 09... hoặc 03... không nhập khoảng trắng.</small>
        </div>

        <div className="admin-mini-card">
          <label>Xem trước tin nhắn khách sẽ gửi</label>
          <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            {PREVIEW_MESSAGE}
          </pre>
          <small>Thông tin khách trong khung này đã được che. Nội dung thật sẽ tự tạo theo đơn hàng, admin không cần chỉnh mẫu.</small>
        </div>
      </div>
    </AdminPanel>
  );
}
