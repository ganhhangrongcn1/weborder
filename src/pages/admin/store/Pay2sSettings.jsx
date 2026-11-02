import { useState } from "react";
import { AdminButton, AdminInput } from "../ui/index.js";
import { hashPay2sTestPhones } from "../../../services/pay2sTestPhoneService.js";

export default function Pay2sSettings({ branchId, settings, onChange }) {
  const mode = settings.pay2sMode || "off";
  const [phones, setPhones] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const applyPhones = async () => {
    setSaving(true);
    try {
      onChange("pay2sTestPhoneHashes", await hashPay2sTestPhones(phones));
      setPhones("");
      setMessage("Đã cập nhật danh sách thử. Bấm Lưu thay đổi chi nhánh để áp dụng.");
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <strong className="text-sm text-brown">Pay2S cho website và POS</strong>
      <label className="block space-y-1 text-xs text-brown/80">
        <span>Chế độ Pay2S</span>
        <select className="admin-input w-full" value={mode} onChange={(event) => onChange("pay2sMode", event.target.value)}>
          <option value="off">Tắt Pay2S — giữ SePay</option>
          <option value="test">Thử theo số điện thoại — khách khác vẫn dùng SePay</option>
          <option value="live">Dùng Pay2S cho đơn QR mới</option>
        </select>
      </label>
      {mode === "test" ? (
        <div className="space-y-2 text-xs text-brown/80">
          <label htmlFor={`pay2s-test-phones-${branchId}`}>Số điện thoại được thử Pay2S</label>
          <AdminInput name={`pay2s-test-phones-${branchId}`} className="admin-input" autoComplete="off"
            id={`pay2s-test-phones-${branchId}`}
            placeholder="Nhập số điện thoại, cách nhau bằng dấu phẩy"
            value={phones} onChange={(event) => setPhones(event.target.value)} />
          <p>Đã cấu hình {settings.pay2sTestPhoneHashes?.length || 0} số thử. Danh sách mới sẽ thay thế danh sách cũ.</p>
          <AdminButton variant="secondary" disabled={saving} onClick={applyPhones}>{saving ? "Đang cập nhật…" : "Cập nhật danh sách thử"}</AdminButton>
          {message ? <p role="status">{message}</p> : null}
        </div>
      ) : null}
      <p className="text-xs text-brown/70">
        Dùng tài khoản ngân hàng và QR của chi nhánh ở phía trên. Cần liên kết tài khoản này với Pay2S và cấu hình webhook trước khi thử.
        Trong chế độ thử, nhập đúng số điện thoại thử khi đặt đơn website hoặc tạo bill POS.
        Đơn đã tạo giữ nguyên nhà cung cấp thanh toán.
      </p>
      {mode === "live" ? <p className="text-xs font-semibold text-amber-800">Chỉ lưu chế độ này sau khi đã thử nhận tiền, gửi bếp và in bill thành công.</p> : null}
    </div>
  );
}
