import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { defaultUserDemo } from "../../../data/defaultData.js";
import { processUploadImage } from "../../../utils/imageUpload.js";

export default function ProfileModal({
  user,
  onSave,
  onChangePassword,
  onClose
}) {
  const [draft, setDraft] = useState({
    ...defaultUserDemo,
    ...user
  });
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [message, setMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const update = (field, value) => setDraft((current) => ({
    ...current,
    [field]: value
  }));

  const updatePassword = (field, value) => {
    setPasswordMessage("");
    setPasswordDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

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
    onSave({
      name: draft.name || "",
      avatarUrl: draft.avatarUrl || ""
    });
  }

  async function handleChangePassword() {
    if (!onChangePassword) return;
    setIsChangingPassword(true);
    setPasswordMessage("");
    try {
      const result = await onChangePassword(passwordDraft);
      if (!result?.ok) {
        setPasswordMessage(result?.message || "Không thể đổi mật khẩu lúc này.");
        return;
      }
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setPasswordMessage("Đã đổi mật khẩu thành công.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <CustomerBottomSheet
      title="Chỉnh sửa hồ sơ"
      subtitle="Số điện thoại là mã định danh chính và không thể thay đổi."
      ariaLabel="Chỉnh sửa hồ sơ"
      onClose={onClose}
      className="promo-sheet"
      footer={<CustomerButton full onClick={handleSave}>Lưu hồ sơ</CustomerButton>}
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

        <CustomerCard padding="sm">
          <h3 className="text-sm font-black text-brown">Đổi mật khẩu</h3>
          <div className="mt-3 space-y-3">
            <label className="address-field">
              <span>Mật khẩu hiện tại</span>
              <input type="password" value={passwordDraft.currentPassword} onChange={(event) => updatePassword("currentPassword", event.target.value)} />
            </label>
            <label className="address-field">
              <span>Mật khẩu mới</span>
              <input type="password" value={passwordDraft.newPassword} onChange={(event) => updatePassword("newPassword", event.target.value)} />
            </label>
            <label className="address-field">
              <span>Nhập lại mật khẩu mới</span>
              <input type="password" value={passwordDraft.confirmPassword} onChange={(event) => updatePassword("confirmPassword", event.target.value)} />
            </label>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={isChangingPassword}
              className="w-full rounded-2xl bg-orange-50 px-4 py-3 text-xs font-black text-orange-700 disabled:opacity-60"
            >
              {isChangingPassword ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
            </button>
            {passwordMessage && (
              <p className={`rounded-2xl px-3 py-2 text-xs font-bold ${passwordMessage.includes("thành công") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {passwordMessage}
              </p>
            )}
          </div>
        </CustomerCard>

        {message && <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{message}</p>}
      </div>
    </CustomerBottomSheet>
  );
}
