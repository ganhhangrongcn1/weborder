import { useState } from "react";
import { AdminButton, AdminInput, AdminPanel } from "../ui/index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function updateLoyaltyConfig(setCrmSnapshot, patch) {
  setCrmSnapshot(current => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      ...patch
    }
  }));
}
function updateStreakReward(setCrmSnapshot, day, value) {
  setCrmSnapshot(current => ({
    ...current,
    loyaltyConfig: {
      ...(current?.loyaltyConfig || {}),
      streakRewards: {
        ...(current?.loyaltyConfig?.streakRewards || {}),
        [day]: Math.max(1, Number(value || 1))
      }
    }
  }));
}
export default function LoyaltySettings({
  crmSnapshot,
  setCrmSnapshot,
  onSave
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const config = crmSnapshot?.loyaltyConfig || {};
  const currencyPerPoint = Math.max(1, Number(config.currencyPerPoint || 10));
  const pointPerUnit = Math.max(1, Number(config.pointPerUnit || 1));
  const checkinDailyPoints = Math.max(1, Number(config.checkinDailyPoints || 1000));
  const streakRewards = config.streakRewards || {};
  const reward7 = Math.max(1, Number(streakRewards[7] || streakRewards["7"] || 1200));
  const reward14 = Math.max(1, Number(streakRewards[14] || streakRewards["14"] || 1500));
  const reward30 = Math.max(1, Number(streakRewards[30] || streakRewards["30"] || 2000));
  const redeemPointUnit = Math.max(1, Number(config.redeemPointUnit || 1));
  const redeemValue = Math.max(1, Number(config.redeemValue || 1));
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveMessage("");
    const payload = {
      ...(crmSnapshot?.loyaltyConfig || {}),
      currencyPerPoint,
      pointPerUnit,
      checkinDailyPoints,
      streakRewards: {
        7: reward7,
        14: reward14,
        30: reward30
      },
      redeemPointUnit,
      redeemValue
    };
    try {
      setCrmSnapshot(current => ({
        ...current,
        loyaltyConfig: payload
      }));
      await Promise.resolve(onSave?.(payload));
      setSaveMessage("Đã lưu cấu hình tích điểm.");
    } catch (_error) {
      setSaveMessage("Lưu cấu hình tích điểm thất bại. Kiểm tra kết nối/Pilot policy.");
    } finally {
      setIsSaving(false);
    }
  };
  return /*#__PURE__*/_jsxs("section", {
    className: "admin-stack admin-loyalty-settings",
    children: [/*#__PURE__*/_jsx(AdminPanel, {
      title: "Qu\u1EA3n l\xFD t\xEDch \u0111i\u1EC3m kh\xE1ch h\xE0ng",
      action: /*#__PURE__*/_jsx(AdminButton, {
        onClick: handleSave,
        disabled: isSaving,
        children: isSaving ? "Đang lưu..." : "Lưu cấu hình"
      })
    }), saveMessage ? /*#__PURE__*/_jsx("p", {
      className: "text-sm text-slate-600",
      children: saveMessage
    }) : null, /*#__PURE__*/_jsxs(AdminPanel, {
      title: "Ki\u1EBFm \u0111i\u1EC3m t\u1EEB \u0111\u01A1n h\xE0ng",
      className: "admin-loyalty-card",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-mini-grid admin-ui-panel-body",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx("span", {
            children: "S\u1ED1 ti\u1EC1n chi ti\xEAu (\u0111)"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            value: currencyPerPoint,
            onChange: event => updateLoyaltyConfig(setCrmSnapshot, {
              currencyPerPoint: Math.max(1, Number(event.target.value || 1))
            })
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\u0110i\u1EC3m nh\u1EADn \u0111\u01B0\u1EE3c"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            value: pointPerUnit,
            onChange: event => updateLoyaltyConfig(setCrmSnapshot, {
              pointPerUnit: Math.max(1, Number(event.target.value || 1))
            })
          })]
        })]
      }), /*#__PURE__*/_jsxs("small", {
        className: "admin-loyalty-note",
        children: ["Kh\xE1ch h\xE0ng s\u1EBD nh\u1EADn \u0111\u01B0\u1EE3c ", /*#__PURE__*/_jsxs("strong", {
          children: [pointPerUnit, " \u0111i\u1EC3m"]
        }), " cho m\u1ED7i ", /*#__PURE__*/_jsxs("strong", {
          children: [currencyPerPoint.toLocaleString("vi-VN"), "\u0111"]
        }), " chi ti\xEAu."]
      })]
    }), /*#__PURE__*/_jsx(AdminPanel, {
      title: "\u0110i\u1EC3m danh h\xE0ng ng\xE0y",
      className: "admin-loyalty-card",
      children: /*#__PURE__*/_jsxs("div", {
        className: "admin-ui-panel-body admin-loyalty-form-stack",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\u0110i\u1EC3m danh m\u1ED7i ng\xE0y"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            value: checkinDailyPoints,
            onChange: event => updateLoyaltyConfig(setCrmSnapshot, {
              checkinDailyPoints: Math.max(1, Number(event.target.value || 1))
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-mini-grid",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "admin-mini-card",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Th\u01B0\u1EDFng chu\u1ED7i 7 ng\xE0y"
            }), /*#__PURE__*/_jsx(AdminInput, {
              type: "number",
              value: reward7,
              onChange: event => updateStreakReward(setCrmSnapshot, 7, event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "admin-mini-card",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Th\u01B0\u1EDFng chu\u1ED7i 14 ng\xE0y"
            }), /*#__PURE__*/_jsx(AdminInput, {
              type: "number",
              value: reward14,
              onChange: event => updateStreakReward(setCrmSnapshot, 14, event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("label", {
            className: "admin-mini-card",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Th\u01B0\u1EDFng chu\u1ED7i 30 ng\xE0y"
            }), /*#__PURE__*/_jsx(AdminInput, {
              type: "number",
              value: reward30,
              onChange: event => updateStreakReward(setCrmSnapshot, 30, event.target.value)
            })]
          })]
        })]
      })
    }), /*#__PURE__*/_jsxs(AdminPanel, {
      title: "S\u1EED d\u1EE5ng \u0111i\u1EC3m",
      className: "admin-loyalty-card",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-mini-grid admin-ui-panel-body",
        children: [/*#__PURE__*/_jsxs("label", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx("span", {
            children: "S\u1ED1 \u0111i\u1EC3m \u0111\u1ED5i"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            value: redeemPointUnit,
            onChange: event => updateLoyaltyConfig(setCrmSnapshot, {
              redeemPointUnit: Math.max(1, Number(event.target.value || 1))
            })
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-mini-card",
          children: [/*#__PURE__*/_jsx("span", {
            children: "Gi\xE1 tr\u1ECB (\u0111)"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "number",
            value: redeemValue,
            onChange: event => updateLoyaltyConfig(setCrmSnapshot, {
              redeemValue: Math.max(1, Number(event.target.value || 1))
            })
          })]
        })]
      }), /*#__PURE__*/_jsxs("small", {
        className: "admin-loyalty-note",
        children: ["Kh\xE1ch h\xE0ng c\xF3 th\u1EC3 d\xF9ng ", /*#__PURE__*/_jsxs("strong", {
          children: [redeemPointUnit, " \u0111i\u1EC3m"]
        }), " \u0111\u1EC3 gi\u1EA3m ", /*#__PURE__*/_jsxs("strong", {
          children: [redeemValue.toLocaleString("vi-VN"), "\u0111"]
        }), " khi thanh to\xE1n."]
      })]
    })]
  });
}