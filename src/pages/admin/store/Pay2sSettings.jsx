import { useState } from "react";
import { AdminButton, AdminInput } from "../ui/index.js";
import { hashPay2sTestPhones } from "../../../services/pay2sTestPhoneService.js";

export default function Pay2sSettings({ branchId, settings, bankOptions = [], onChange }) {
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
    <section className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-base font-bold text-brown">Ngân hàng nhận tiền QR</h3>
          <p className="mt-1 text-xs text-brown/70">Chọn dịch vụ cho các đơn mới tại chi nhánh này.</p></div>
        <span className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brown">
          {mode === "live" ? "Pay2S đang hoạt động" : mode === "test" ? "Pay2S đang thử riêng" : "Đang dùng SePay"}
        </span>
      </div>
      <div role="group" aria-label="Dịch vụ nhận tiền QR" className="grid gap-2 md:grid-cols-3">
        {[
          ["live", `Pay2S · ${bankOptions.find(bank => bank.bin === settings.pay2sBankBin)?.name || "Ngân hàng"}`, "Nhận tự động cho mọi khách"],
          ["test", "Thử riêng Pay2S", "Chỉ dùng cho số điện thoại thử"],
          ["off", "SePay dự phòng", "Dùng lại tài khoản SePay cũ"]
        ].map(([value, title, hint]) => <button key={value} type="button" aria-pressed={mode === value}
          onClick={() => onChange("pay2sMode", value)}
          className={`rounded-xl border p-3 text-left transition ${mode === value ? "border-orange-500 bg-white ring-1 ring-orange-400" : "border-brown/10 bg-white/60 hover:bg-white"}`}>
          <strong className="block text-sm text-brown">{title}</strong><small className="mt-1 block text-xs text-brown/65">{hint}</small>
        </button>)}
      </div>
      <div className="rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm text-brown">
        <strong>{bankOptions.find(bank => bank.bin === settings.pay2sBankBin)?.name || "Chưa chọn ngân hàng Pay2S"}</strong>
        <span className="ml-2 font-mono">{settings.pay2sAccountNumber || "Chưa nhập số tài khoản"}</span>
        <p className="mt-1 text-xs text-brown/70">{settings.pay2sAccountName || "Chưa nhập tên chủ tài khoản"}</p>
      </div>
      <details className="rounded-xl border border-brown/10 bg-white p-3">
        <summary className="cursor-pointer text-sm font-semibold text-brown">Sửa tài khoản Pay2S nhận tiền</summary>
        <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-brown/80">
          <span>Ngân hàng riêng cho Pay2S</span>
          <select className="admin-input w-full" value={settings.pay2sBankBin || ""} onChange={(event) => onChange("pay2sBankBin", event.target.value)}>
            <option value="">Chọn ngân hàng nhận tiền</option>
            {bankOptions.map((bank) => <option key={bank.bin} value={bank.bin}>{bank.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-brown/80">
          <span>Số tài khoản nhận tiền Pay2S</span>
          <AdminInput className="admin-input" autoComplete="off" inputMode="numeric" value={settings.pay2sAccountNumber || ""}
            placeholder="Số tài khoản/VA do Pay2S cung cấp" onChange={(event) => onChange("pay2sAccountNumber", event.target.value.replace(/\s/g, ""))} />
        </label>
        <label className="space-y-1 text-xs text-brown/80">
          <span>Tên chủ tài khoản Pay2S</span>
          <AdminInput className="admin-input" autoComplete="off" value={settings.pay2sAccountName || ""}
            placeholder="Tên chủ tài khoản" onChange={(event) => onChange("pay2sAccountName", event.target.value)} />
        </label>
      </div>
        </div>
      </details>
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
      <p className="text-xs leading-relaxed text-brown/70">
        Website và POS từ 0.4.33 dùng tài khoản Pay2S này khi bật. POS cũ tiếp tục SePay đến khi được cập nhật.
        Đơn đã tạo giữ nguyên tài khoản và dịch vụ ban đầu. Bấm “Lưu thay đổi chi nhánh” để áp dụng lựa chọn.
      </p>
      {mode === "live" ? <p className="text-xs font-semibold text-amber-800">Chỉ lưu chế độ này sau khi đã thử nhận tiền, gửi bếp và in bill thành công.</p> : null}
    </section>
  );
}
