import { useEffect, useMemo, useState } from "react";
import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
const VOUCHER_TYPES = [{
  value: "checkout",
  label: "Voucher thanh toán"
}, {
  value: "loyalty",
  label: "Voucher loyalty"
}];
function getCouponId(coupon = {}) {
  return String(coupon.id || coupon.code || `coupon-${Date.now()}`);
}
function normalizeCoupon(coupon = {}) {
  const endAt = String(coupon.endAt || coupon.expiry || "");
  return {
    id: getCouponId(coupon),
    code: String(coupon.code || "SALE10").toUpperCase(),
    name: String(coupon.name || "Mã giảm giá mới"),
    discountType: coupon.discountType === "percent" ? "percent" : "fixed",
    value: Number(coupon.value || 0),
    maxDiscount: Number(coupon.maxDiscount || 0),
    minOrder: Number(coupon.minOrder || 0),
    startAt: String(coupon.startAt || ""),
    endAt,
    customerType: String(coupon.customerType || "all"),
    usageLimit: Number(coupon.usageLimit || 0),
    perUserLimit: Number(coupon.perUserLimit || 1),
    totalUsed: Number(coupon.totalUsed || 0),
    voucherType: String(coupon.voucherType || "checkout"),
    fulfillmentType: String(coupon.fulfillmentType || "all"),
    scopeType: String(coupon.scopeType || "all"),
    scopeValues: String(coupon.scopeValues || ""),
    stackable: Boolean(coupon.stackable),
    active: coupon.active !== false,
    expiry: endAt
  };
}
function formatDiscountValue(coupon) {
  if (coupon.discountType === "percent") return `${Number(coupon.value || 0)}%`;
  return `${Number(coupon.value || 0).toLocaleString("vi-VN")}đ`;
}
function formatDateShort(dateText) {
  if (!dateText) return "Không giới hạn";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return date.toLocaleDateString("vi-VN");
}
function getCouponStatus(coupon) {
  if (!coupon.active) return {
    label: "Tạm tắt",
    className: "bg-slate-100 text-slate-600"
  };
  if (!coupon.endAt) return {
    label: "Đang chạy",
    className: "bg-emerald-100 text-emerald-700"
  };
  const now = new Date();
  const endDate = new Date(`${coupon.endAt}T23:59:59`);
  if (Number.isNaN(endDate.getTime())) return {
    label: "Đang chạy",
    className: "bg-emerald-100 text-emerald-700"
  };
  if (endDate.getTime() < now.getTime()) return {
    label: "Hết hạn",
    className: "bg-slate-100 text-slate-600"
  };
  const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 3) return {
    label: "Sắp hết hạn",
    className: "bg-orange-100 text-orange-700"
  };
  return {
    label: "Đang chạy",
    className: "bg-emerald-100 text-emerald-700"
  };
}
function buildPreviewLines(coupon) {
  const main = coupon.discountType === "percent" ? `Giảm ${Number(coupon.value || 0)}%` : `Giảm ${Number(coupon.value || 0).toLocaleString("vi-VN")}đ`;
  const condition = Number(coupon.minOrder || 0) ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ` : "Áp dụng mọi đơn";
  const expiry = `Hết hạn: ${formatDateShort(coupon.endAt)}`;
  return {
    main,
    condition,
    expiry
  };
}
function inputClassName(isImportant = false) {
  const baseClass = "admin-input mt-1 w-full rounded-xl border border-slate-200 bg-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100";
  const sizeClass = isImportant ? "px-4 py-3 text-base font-semibold text-slate-900" : "px-3 py-2.5 text-sm font-medium text-slate-800";
  return `${baseClass} ${sizeClass}`;
}
function FieldLabel({
  label,
  children
}) {
  return /*#__PURE__*/_jsxs("label", {
    className: "text-[12px] font-semibold text-slate-500",
    children: [label, children]
  });
}
export default function CouponManager({
  coupons = [],
  setCoupons
}) {
  const safeCoupons = useMemo(() => coupons.map(coupon => normalizeCoupon(coupon)), [coupons]);
  const [voucherTypeFilter, setVoucherTypeFilter] = useState("checkout");
  const visibleCoupons = safeCoupons.filter(coupon => String(coupon.voucherType || "checkout") === voucherTypeFilter);
  const [selectedCouponId, setSelectedCouponId] = useState("");
  useEffect(() => {
    if (!visibleCoupons.length) {
      setSelectedCouponId("");
      return;
    }
    const selectedStillVisible = visibleCoupons.some(coupon => coupon.id === selectedCouponId);
    if (!selectedStillVisible) setSelectedCouponId(visibleCoupons[0].id);
  }, [selectedCouponId, visibleCoupons]);
  const selectedCoupon = visibleCoupons.find(item => item.id === selectedCouponId) || null;
  const preview = selectedCoupon ? buildPreviewLines(selectedCoupon) : null;
  const patchCoupon = (couponId, patch) => {
    setCoupons(current => (current || []).map(item => {
      const currentId = getCouponId(item);
      if (currentId !== couponId) return item;
      const next = normalizeCoupon({
        ...item,
        ...patch,
        id: currentId
      });
      return {
        ...next,
        expiry: next.endAt || ""
      };
    }));
  };
  const addCoupon = () => {
    const seed = normalizeCoupon({
      id: `coupon-${Date.now()}`,
      code: voucherTypeFilter === "loyalty" ? "LOYAL10" : "NEW10",
      name: voucherTypeFilter === "loyalty" ? "Voucher loyalty mới" : "Mã giảm giá mới",
      discountType: "fixed",
      value: 10000,
      minOrder: 0,
      endAt: "",
      voucherType: voucherTypeFilter,
      active: true
    });
    setCoupons(current => [seed, ...(current || [])]);
    setSelectedCouponId(seed.id);
  };
  const removeCoupon = couponId => {
    setCoupons(current => (current || []).filter(item => getCouponId(item) !== couponId));
  };
  return /*#__PURE__*/_jsxs("section", {
    className: "admin-promo-split grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]",
    children: [/*#__PURE__*/_jsxs("aside", {
      className: "admin-promo-side rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "mb-3 flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("strong", {
          className: "text-sm font-black text-slate-800",
          children: "Danh s\xE1ch voucher"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-cta",
          onClick: addCoupon,
          children: "+ T\u1EA1o m\u1EDBi"
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "admin-menu-tabs admin-gap-12 mb-3",
        children: VOUCHER_TYPES.map(type => /*#__PURE__*/_jsx("button", {
          type: "button",
          className: voucherTypeFilter === type.value ? "active" : "",
          onClick: () => setVoucherTypeFilter(type.value),
          children: type.label
        }, type.value))
      }), /*#__PURE__*/_jsxs("div", {
        className: "max-h-[68vh] space-y-2 overflow-y-auto pr-1",
        children: [visibleCoupons.map(coupon => {
          const status = getCouponStatus(coupon);
          const isSelected = selectedCoupon?.id === coupon.id;
          return /*#__PURE__*/_jsxs("button", {
            type: "button",
            onClick: () => setSelectedCouponId(coupon.id),
            className: `w-full rounded-[14px] border bg-white p-3 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md active:scale-[0.995] ${isSelected ? "border-orange-300 ring-2 ring-orange-200" : "border-slate-200"}`,
            children: [/*#__PURE__*/_jsxs("div", {
              className: "mb-2 flex items-start justify-between gap-2",
              children: [/*#__PURE__*/_jsx("p", {
                className: "text-lg font-black tracking-wide text-slate-900",
                children: coupon.code || "---"
              }), /*#__PURE__*/_jsx("span", {
                className: `rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`,
                children: status.label
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "text-xl font-black text-orange-600",
              children: formatDiscountValue(coupon)
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-2 flex items-center justify-between text-[11px] text-slate-500",
              children: [/*#__PURE__*/_jsx("span", {
                children: Number(coupon.minOrder || 0) ? `Đơn từ ${Number(coupon.minOrder || 0).toLocaleString("vi-VN")}đ` : "Mọi đơn"
              }), /*#__PURE__*/_jsx("span", {
                children: formatDateShort(coupon.endAt)
              })]
            })]
          }, coupon.id);
        }), !visibleCoupons.length ? /*#__PURE__*/_jsx("p", {
          className: "rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500",
          children: "Ch\u01B0a c\xF3 voucher"
        }) : null]
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-promo-editor rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
      children: !selectedCoupon ? /*#__PURE__*/_jsx("p", {
        className: "py-8 text-center text-sm text-slate-500",
        children: "Ch\u1ECDn voucher \u0111\u1EC3 ch\u1EC9nh s\u1EEDa."
      }) : /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs("div", {
          className: "mb-4 rounded-[14px] border border-orange-200 bg-orange-50 px-4 py-3",
          children: [/*#__PURE__*/_jsx("p", {
            className: "text-2xl font-black leading-tight text-orange-600",
            children: preview?.main
          }), /*#__PURE__*/_jsx("p", {
            className: "mt-1 text-sm font-semibold text-slate-700",
            children: preview?.condition
          }), /*#__PURE__*/_jsx("p", {
            className: "mt-1 text-xs text-slate-500",
            children: preview?.expiry
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "space-y-4",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "1. Th\xF4ng tin ch\xEDnh"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsx(FieldLabel, {
                label: "M\xE3 voucher",
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(true),
                  value: selectedCoupon.code,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    code: String(event.target.value || "").toUpperCase().replace(/\s+/g, "")
                  })
                })
              }), /*#__PURE__*/_jsx(FieldLabel, {
                label: "T\xEAn hi\u1EC3n th\u1ECB",
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(),
                  value: selectedCoupon.name,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    name: event.target.value
                  })
                })
              }), /*#__PURE__*/_jsx(FieldLabel, {
                label: "Lo\u1EA1i voucher",
                children: /*#__PURE__*/_jsx("select", {
                  className: inputClassName(),
                  value: selectedCoupon.voucherType,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    voucherType: event.target.value
                  }),
                  children: VOUCHER_TYPES.map(type => /*#__PURE__*/_jsx("option", {
                    value: type.value,
                    children: type.label
                  }, type.value))
                })
              }), /*#__PURE__*/_jsx(FieldLabel, {
                label: "Ng\xE0y h\u1EBFt h\u1EA1n",
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(),
                  type: "date",
                  value: selectedCoupon.endAt,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    endAt: event.target.value,
                    expiry: event.target.value
                  })
                })
              })]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("h4", {
              className: "mb-3 text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "2. Gi\xE1 tr\u1ECB & \u0111i\u1EC1u ki\u1EC7n"
            }), /*#__PURE__*/_jsxs("div", {
              className: "grid grid-cols-1 gap-3 md:grid-cols-2",
              children: [/*#__PURE__*/_jsx(FieldLabel, {
                label: "Lo\u1EA1i gi\u1EA3m",
                children: /*#__PURE__*/_jsxs("select", {
                  className: inputClassName(true),
                  value: selectedCoupon.discountType,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    discountType: event.target.value,
                    maxDiscount: event.target.value === "percent" ? selectedCoupon.maxDiscount : 0
                  }),
                  children: [/*#__PURE__*/_jsx("option", {
                    value: "fixed",
                    children: "Gi\u1EA3m s\u1ED1 ti\u1EC1n"
                  }), /*#__PURE__*/_jsx("option", {
                    value: "percent",
                    children: "Gi\u1EA3m theo %"
                  })]
                })
              }), /*#__PURE__*/_jsx(FieldLabel, {
                label: `Giá trị giảm (${selectedCoupon.discountType === "percent" ? "%" : "đ"})`,
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(true),
                  type: "number",
                  min: "0",
                  value: selectedCoupon.value,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    value: Number(event.target.value || 0)
                  })
                })
              }), selectedCoupon.discountType === "percent" ? /*#__PURE__*/_jsx(FieldLabel, {
                label: "Gi\u1EA3m t\u1ED1i \u0111a (\u0111)",
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(),
                  type: "number",
                  min: "0",
                  value: selectedCoupon.maxDiscount,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    maxDiscount: Number(event.target.value || 0)
                  })
                })
              }) : null, /*#__PURE__*/_jsx(FieldLabel, {
                label: "\u0110\u01A1n t\u1ED1i thi\u1EC3u (\u0111)",
                children: /*#__PURE__*/_jsx("input", {
                  className: inputClassName(),
                  type: "number",
                  min: "0",
                  value: selectedCoupon.minOrder,
                  onChange: event => patchCoupon(selectedCoupon.id, {
                    minOrder: Number(event.target.value || 0)
                  })
                })
              })]
            })]
          }), /*#__PURE__*/_jsxs("details", {
            className: "rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm",
            children: [/*#__PURE__*/_jsx("summary", {
              className: "cursor-pointer text-[13px] font-black uppercase tracking-wide text-slate-700",
              children: "T\xF9y ch\u1ECDn n\xE2ng cao"
            }), /*#__PURE__*/_jsxs("div", {
              className: "mt-4 space-y-4",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "grid grid-cols-1 gap-3 md:grid-cols-3",
                children: [/*#__PURE__*/_jsx(FieldLabel, {
                  label: "Gi\u1EDBi h\u1EA1n d\xF9ng to\xE0n b\u1ED9",
                  children: /*#__PURE__*/_jsx("input", {
                    className: inputClassName(),
                    type: "number",
                    min: "0",
                    value: selectedCoupon.usageLimit,
                    onChange: event => patchCoupon(selectedCoupon.id, {
                      usageLimit: Number(event.target.value || 0)
                    })
                  })
                }), /*#__PURE__*/_jsx(FieldLabel, {
                  label: "T\u1ED1i \u0111a m\u1ED7i kh\xE1ch",
                  children: /*#__PURE__*/_jsx("input", {
                    className: inputClassName(),
                    type: "number",
                    min: "1",
                    value: selectedCoupon.perUserLimit,
                    onChange: event => patchCoupon(selectedCoupon.id, {
                      perUserLimit: Number(event.target.value || 1)
                    })
                  })
                }), /*#__PURE__*/_jsx(FieldLabel, {
                  label: "\u0110\xE3 d\xF9ng",
                  children: /*#__PURE__*/_jsx("input", {
                    className: inputClassName(),
                    type: "number",
                    min: "0",
                    value: selectedCoupon.totalUsed,
                    onChange: event => patchCoupon(selectedCoupon.id, {
                      totalUsed: Number(event.target.value || 0)
                    })
                  })
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3",
                children: [/*#__PURE__*/_jsxs("div", {
                  children: [/*#__PURE__*/_jsx("strong", {
                    className: "block text-sm font-black text-slate-800",
                    children: "B\u1EADt voucher"
                  }), /*#__PURE__*/_jsx("span", {
                    className: "text-xs font-semibold text-slate-500",
                    children: "T\u1EAFt \u0111\u1EC3 \u1EA9n kh\u1ECFi checkout/CRM nh\u01B0ng v\u1EABn gi\u1EEF d\u1EEF li\u1EC7u."
                  })]
                }), /*#__PURE__*/_jsxs("label", {
                  className: "admin-switch",
                  children: [/*#__PURE__*/_jsx("input", {
                    type: "checkbox",
                    checked: selectedCoupon.active,
                    onChange: event => patchCoupon(selectedCoupon.id, {
                      active: event.target.checked
                    })
                  }), /*#__PURE__*/_jsx("span", {})]
                })]
              })]
            })]
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "mt-4 flex items-center justify-end",
          children: /*#__PURE__*/_jsx("button", {
            type: "button",
            className: "admin-danger",
            onClick: () => removeCoupon(selectedCoupon.id),
            children: "X\xF3a voucher n\xE0y"
          })
        })]
      })
    })]
  });
}