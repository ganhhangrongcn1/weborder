import { useRef, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import { defaultUserDemo } from "../../../data/defaultData.js";
import { processUploadImage } from "../../../utils/imageUpload.js";

const PROFILE_FORM_ID = "account-profile-form";
const PASSWORD_FORM_ID = "account-password-form";

function PasswordField({
  id,
  name,
  label,
  value,
  error = "",
  autoComplete,
  inputRef,
  onChange,
  disabled = false
}) {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <label className="address-field" htmlFor={id}>
      <span>{label}</span>
      <div className="account-auth-input-wrap">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          value={value}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className="pr-12"
          onChange={onChange}
        />
        <button
          type="button"
          className={`account-auth-password-toggle${isVisible ? " is-visible" : ""}`}
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={isVisible}
          disabled={disabled}
        >
          <Icon name={isVisible ? "eyeOff" : "eye"} size={18} />
        </button>
      </div>
      {error ? <small id={errorId} className="account-field-error" role="alert">{error}</small> : null}
    </label>
  );
}

export default function ProfileModal({
  user,
  onSave,
  onChangePassword,
  onClose
}) {
  const [mode, setMode] = useState("profile");
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
  const [profileErrors, setProfileErrors] = useState({});
  const [passwordErrors, setPasswordErrors] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const nameRef = useRef(null);
  const passwordRefs = useRef({});

  const update = (field, value) => {
    setMessage("");
    setProfileErrors((current) => current[field] ? { ...current, [field]: "" } : current);
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updatePassword = (field, value) => {
    setPasswordMessage("");
    setPasswordErrors((current) => current[field] ? { ...current, [field]: "" } : current);
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

  async function handleSave(event) {
    event.preventDefault();
    if (isSavingProfile) return;

    if (!String(draft.name || "").trim()) {
      setProfileErrors({ name: "Vui lòng nhập họ và tên." });
      nameRef.current?.focus();
      return;
    }

    setProfileErrors({});
    setMessage("");
    setIsSavingProfile(true);
    try {
      const result = await onSave({
        name: String(draft.name || "").trim(),
        avatarUrl: draft.avatarUrl || ""
      });
      if (result?.ok === false) {
        setMessage(result.message || "Không thể lưu hồ sơ lúc này.");
      }
    } catch {
      setMessage("Không thể lưu hồ sơ lúc này.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    if (!onChangePassword || isChangingPassword) return;

    const nextErrors = {
      currentPassword: !passwordDraft.currentPassword ? "Vui lòng nhập mật khẩu hiện tại." : "",
      newPassword: passwordDraft.newPassword.length < 6 ? "Mật khẩu mới cần tối thiểu 6 ký tự." : "",
      confirmPassword: passwordDraft.newPassword !== passwordDraft.confirmPassword
        ? "Mật khẩu nhập lại chưa khớp."
        : ""
    };
    const firstInvalidField = Object.keys(nextErrors).find((field) => nextErrors[field]);
    if (firstInvalidField) {
      setPasswordErrors(nextErrors);
      passwordRefs.current[firstInvalidField]?.focus();
      return;
    }

    setPasswordErrors({});
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

  const isPasswordMode = mode === "password";

  return (
    <CustomerBottomSheet
      title={isPasswordMode ? "Đổi mật khẩu" : "Chỉnh sửa hồ sơ"}
      subtitle={isPasswordMode
        ? "Nhập mật khẩu hiện tại để bảo vệ tài khoản của bạn."
        : "Số điện thoại là mã định danh chính và không thể thay đổi."}
      ariaLabel={isPasswordMode ? "Đổi mật khẩu" : "Chỉnh sửa hồ sơ"}
      onClose={onClose}
      className="promo-sheet"
      footer={isPasswordMode ? (
        <CustomerButton
          full
          type="submit"
          form={PASSWORD_FORM_ID}
          disabled={isChangingPassword}
          aria-busy={isChangingPassword ? "true" : undefined}
        >
          {isChangingPassword ? "Đang đổi mật khẩu…" : "Lưu mật khẩu mới"}
        </CustomerButton>
      ) : (
        <CustomerButton
          full
          type="submit"
          form={PROFILE_FORM_ID}
          disabled={isSavingProfile}
          aria-busy={isSavingProfile ? "true" : undefined}
        >
          {isSavingProfile ? "Đang lưu…" : "Lưu hồ sơ"}
        </CustomerButton>
      )}
    >
      {isPasswordMode ? (
        <form id={PASSWORD_FORM_ID} className="space-y-3" noValidate onSubmit={handleChangePassword}>
          <button
            type="button"
            onClick={() => {
              setMode("profile");
              setPasswordErrors({});
              setPasswordMessage("");
            }}
            className="account-sheet-back"
          >
            <Icon name="back" size={16} />
            Quay lại hồ sơ
          </button>
          <PasswordField
            id="account-current-password"
            name="current-password"
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            value={passwordDraft.currentPassword}
            error={passwordErrors.currentPassword}
            disabled={isChangingPassword}
            inputRef={(node) => { passwordRefs.current.currentPassword = node; }}
            onChange={(event) => updatePassword("currentPassword", event.target.value)}
          />
          <PasswordField
            id="account-new-password"
            name="new-password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            value={passwordDraft.newPassword}
            error={passwordErrors.newPassword}
            disabled={isChangingPassword}
            inputRef={(node) => { passwordRefs.current.newPassword = node; }}
            onChange={(event) => updatePassword("newPassword", event.target.value)}
          />
          <PasswordField
            id="account-confirm-password"
            name="confirm-password"
            label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            value={passwordDraft.confirmPassword}
            error={passwordErrors.confirmPassword}
            disabled={isChangingPassword}
            inputRef={(node) => { passwordRefs.current.confirmPassword = node; }}
            onChange={(event) => updatePassword("confirmPassword", event.target.value)}
          />
          {passwordMessage ? (
            <p
              className={`account-sheet-message ${passwordMessage.includes("thành công") ? "is-success" : "is-error"}`}
              role="status"
              aria-live="polite"
            >
              {passwordMessage}
            </p>
          ) : null}
        </form>
      ) : (
        <form id={PROFILE_FORM_ID} className="space-y-3" noValidate onSubmit={handleSave}>
          <label className="account-avatar-upload">
            {draft.avatarUrl ? (
              <img
                src={draft.avatarUrl}
                alt={`Ảnh đại diện của ${draft.name || "khách hàng"}`}
                width="96"
                height="96"
              />
            ) : (
              <Icon name="star" size={30} />
            )}
            <input name="avatar" type="file" accept="image/*" onChange={handleAvatar} />
          </label>
          <p className="account-avatar-helper">Bấm ảnh đại diện để tải ảnh mới</p>
          <label className="address-field" htmlFor="account-profile-name">
            <span>Họ và tên</span>
            <input
              ref={nameRef}
              id="account-profile-name"
              name="name"
              autoComplete="name"
              required
              value={draft.name || ""}
              aria-invalid={profileErrors.name ? "true" : undefined}
              aria-describedby={profileErrors.name ? "account-profile-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Nhập họ và tên"
            />
            {profileErrors.name ? (
              <small id="account-profile-name-error" className="account-field-error" role="alert">
                {profileErrors.name}
              </small>
            ) : null}
          </label>
          <label className="address-field" htmlFor="account-profile-phone">
            <span>Số điện thoại</span>
            <input
              id="account-profile-phone"
              name="tel"
              type="tel"
              autoComplete="tel"
              value={draft.phone || ""}
              disabled
            />
          </label>
          <p className="account-field-helper">Số điện thoại không thể thay đổi.</p>
          <CustomerButton
            full
            type="button"
            variant="soft"
            icon="gear"
            onClick={() => {
              setMode("password");
              setMessage("");
            }}
          >
            Đổi mật khẩu
          </CustomerButton>
          {message ? <p className="account-sheet-message is-error" role="alert">{message}</p> : null}
        </form>
      )}
    </CustomerBottomSheet>
  );
}
