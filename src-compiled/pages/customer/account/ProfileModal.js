import { useState } from "react";
import Icon from "../../../components/Icon.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { defaultUserDemo } from "../../../data/defaultData.js";
import { processUploadImage } from "../../../utils/imageUpload.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
  const update = (field, value) => setDraft(current => ({
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
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: "Ch\u1EC9nh s\u1EEDa h\u1ED3 s\u01A1",
    subtitle: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i l\xE0 m\xE3 \u0111\u1ECBnh danh ch\xEDnh v\xE0 kh\xF4ng th\u1EC3 thay \u0111\u1ED5i.",
    ariaLabel: "Ch\u1EC9nh s\u1EEDa h\u1ED3 s\u01A1",
    onClose: onClose,
    className: "promo-sheet",
    children: /*#__PURE__*/_jsxs("div", {
      className: "space-y-3",
      children: [/*#__PURE__*/_jsxs("label", {
        className: "mx-auto grid h-24 w-24 cursor-pointer place-items-center overflow-hidden rounded-full border-4 border-orange-50 bg-white text-orange-600 shadow-soft",
        children: [draft.avatarUrl ? /*#__PURE__*/_jsx("img", {
          src: draft.avatarUrl,
          alt: draft.name || "Khách hàng",
          className: "h-full w-full object-cover"
        }) : /*#__PURE__*/_jsx(Icon, {
          name: "star",
          size: 30
        }), /*#__PURE__*/_jsx("input", {
          type: "file",
          accept: "image/*",
          onChange: handleAvatar,
          className: "hidden"
        })]
      }), /*#__PURE__*/_jsx("p", {
        className: "text-center text-xs font-bold text-brown/50",
        children: "B\u1EA5m avatar \u0111\u1EC3 t\u1EA3i \u1EA3nh m\u1EDBi"
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "H\u1ECD v\xE0 t\xEAn"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.name || "",
          onChange: event => update("name", event.target.value),
          placeholder: "Kh\xE1ch h\xE0ng"
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "address-field",
        children: [/*#__PURE__*/_jsx("span", {
          children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i"
        }), /*#__PURE__*/_jsx("input", {
          value: draft.phone || "",
          disabled: true
        })]
      }), /*#__PURE__*/_jsx("p", {
        className: "-mt-2 text-xs font-bold text-brown/45",
        children: "S\u1ED1 \u0111i\u1EC7n tho\u1EA1i kh\xF4ng th\u1EC3 thay \u0111\u1ED5i."
      }), /*#__PURE__*/_jsxs("div", {
        className: "rounded-[22px] border border-orange-100 bg-white p-3",
        children: [/*#__PURE__*/_jsx("h3", {
          className: "text-sm font-black text-brown",
          children: "\u0110\u1ED5i m\u1EADt kh\u1EA9u"
        }), /*#__PURE__*/_jsxs("div", {
          className: "mt-3 space-y-3",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "address-field",
            children: [/*#__PURE__*/_jsx("span", {
              children: "M\u1EADt kh\u1EA9u hi\u1EC7n t\u1EA1i"
            }), /*#__PURE__*/_jsx("input", {
              type: "password",
              value: currentPassword,
              onChange: event => setCurrentPassword(event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "address-field",
            children: [/*#__PURE__*/_jsx("span", {
              children: "M\u1EADt kh\u1EA9u m\u1EDBi"
            }), /*#__PURE__*/_jsx("input", {
              type: "password",
              value: newPassword,
              onChange: event => setNewPassword(event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "address-field",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Nh\u1EADp l\u1EA1i m\u1EADt kh\u1EA9u m\u1EDBi"
            }), /*#__PURE__*/_jsx("input", {
              type: "password",
              value: confirmPassword,
              onChange: event => setConfirmPassword(event.target.value)
            })]
          })]
        })]
      }), message && /*#__PURE__*/_jsx("p", {
        className: "rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600",
        children: message
      }), /*#__PURE__*/_jsx("button", {
        onClick: handleSave,
        className: "cta w-full",
        children: "L\u01B0u h\u1ED3 s\u01A1"
      })]
    })
  });
}