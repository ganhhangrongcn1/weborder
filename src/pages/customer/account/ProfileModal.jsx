import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { defaultUserDemo } from "../../../data/defaultData.js";
import { processUploadImage } from "../../../utils/imageUpload.js";

export default function ProfileModal({
  user,
  onSave,
  onClose
}) {
  const [draft, setDraft] = useState({
    ...defaultUserDemo,
    ...user
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const update = (field, value) => setDraft((current) => ({
    ...current,
    [field]: value
  }));

  async function handleAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await processUploadImage(file, {
        maxWidth: 960,
        quality: 0.62
      });
      update("avatarUrl", result.dataUrl);
    } catch (error) {
      setMessage(error?.message || "Không thể xử lý ảnh đại diện.");
    } finally {
      event.target.value = "";
    }
  }

  function handleSave() {
    const wantsPasswordChange = currentPassword || newPassword || confirmPassword;
    if (wantsPasswordChange) {
      if ((draft.passwordDemo || "") !== currentPassword) {
        setMessage("Mật khẩu hiện tại không đúng.");
        return;
      }
      if (newPassword.length < 6) {
        setMessage("Mật khẩu mới tối thiểu 6 ký tự.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setMessage("Nhập lại mật khẩu mới chưa khớp.");
        return;
      }
      onSave({
        name: draft.name || "",
        avatarUrl: draft.avatarUrl || "",
        passwordDemo: newPassword
      });
      alert("Đã cập nhật mật khẩu");
      return;
    }
    onSave({
      name: draft.name || "",
      avatarUrl: draft.avatarUrl || ""
    });
  }

  return (
    <CustomerBottomSheet
      title="Chỉnh sửa hồ sơ"
      subtitle="Số điện thoại là mã định danh chính và không thể thay đổi."
      ariaLabel="Chỉnh sửa hồ sơ"
      onClose={onClose}
      className="promo-sheet"
    >
      <div className="space-y-3">
        <label className="mx-auto grid h-24 w-24 cursor-pointer place-items-center overflow-hidden rounded-full border-4 border-orange-50 bg-white text-orange-600 shadow-soft">
          {draft.avatarUrl ? (
            <img src={draft.avatarUrl} alt={draft.name || "Khách hàng"} className="h-full w-full object-cover" />
          ) : (
            <Icon name="star" size={30} />
          )}
          <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </label>
        <p className="text-center text-xs font-bold text-brown/50">Bấm avatar để tải ảnh mới</p>
        <label className="address-field">
          <span>Họ và tên</span>
          <input value={draft.name || ""} onChange={(event) => update("name", event.target.value)} placeholder="Khách hàng" />
        </label>
        <label className="address-field">
          <span>Số điện thoại</span>
          <input value={draft.phone || ""} disabled />
        </label>
        <p className="-mt-2 text-xs font-bold text-brown/45">Số điện thoại không thể thay đổi.</p>
        <div className="rounded-[22px] border border-orange-100 bg-white p-3">
          <h3 className="text-sm font-black text-brown">Đổi mật khẩu</h3>
          <div className="mt-3 space-y-3">
            <label className="address-field">
              <span>Mật khẩu hiện tại</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
            </label>
            <label className="address-field">
              <span>Mật khẩu mới</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </label>
            <label className="address-field">
              <span>Nhập lại mật khẩu mới</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </div>
        </div>
        {message && <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{message}</p>}
        <button onClick={handleSave} className="cta w-full">Lưu hồ sơ</button>
      </div>
    </CustomerBottomSheet>
  );
}
