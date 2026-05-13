import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { getCustomerLoyaltyDetailAsync } from "../../../services/crmService.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}
function getOrderStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "done") return "Hoàn tất";
  if (normalized === "confirmed") return "Đã xác nhận";
  if (normalized === "delivering") return "Đang giao";
  return "Chờ xác nhận";
}
function getInitials(name, phone) {
  const source = String(name || phone || "KH").trim();
  return source.split(/\s+/).slice(-2).map(word => word[0]).join("").toUpperCase();
}
function isVipCustomer(customer) {
  return Number(customer.totalSpent || 0) >= 1000000 || Number(customer.totalOrders || 0) >= 10;
}
function needsCare(customer) {
  return Number(customer.daysSinceLastOrder || 0) >= 30;
}
function getTierTone(tier) {
  const normalized = String(tier || "").toLowerCase();
  if (normalized.includes("kim")) return "diamond";
  if (normalized.includes("vàng")) return "gold";
  if (normalized.includes("bạc")) return "silver";
  return "bronze";
}
function isGuestCustomer(customer) {
  return !customer.registeredCustomer;
}
function getCustomerTypeLabel(customer) {
  return isGuestCustomer(customer) ? "Vãng lai" : "Đã đăng ký";
}
function getCustomerTypeClass(customer) {
  return isGuestCustomer(customer) ? "crm-soft-badge--guest" : "crm-soft-badge--registered";
}
function formatVoucherDiscount(voucher) {
  if (voucher.discountType === "percent") return `${Number(voucher.value || 0)}%`;
  return formatMoney(Number(voucher.value || 0));
}
function getVoucherStatus(voucher) {
  if (voucher.canceled) return {
    label: "Đã hủy",
    className: "crm-status-canceled"
  };
  if (voucher.used) return {
    label: "Đã dùng",
    className: "crm-status-used"
  };
  return {
    label: "Chưa dùng",
    className: "crm-status-active"
  };
}
function getVoucherSortWeight(voucher) {
  if (voucher?.canceled) return 2;
  if (voucher?.used) return 1;
  return 0;
}
function CrmStatCard({
  icon,
  title,
  value,
  subtitle,
  tone
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: `crm-stat-card crm-stat-card--${tone}`,
    children: [/*#__PURE__*/_jsx("span", {
      className: "crm-stat-icon",
      children: /*#__PURE__*/_jsx(Icon, {
        name: icon,
        size: 20
      })
    }), /*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("small", {
        children: title
      }), /*#__PURE__*/_jsx("strong", {
        children: value
      }), /*#__PURE__*/_jsx("em", {
        children: subtitle
      })]
    })]
  });
}
function CustomerIdentity({
  customer,
  compact = false
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: `crm-customer-identity ${compact ? "crm-customer-identity--compact" : ""}`,
    children: [/*#__PURE__*/_jsx("span", {
      className: "crm-avatar",
      children: getInitials(customer.name, customer.phone)
    }), /*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("strong", {
        children: customer.name || "Khách hàng"
      }), /*#__PURE__*/_jsx("small", {
        children: customer.phone || "--"
      })]
    })]
  });
}
export default function CustomerCRM({
  crmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  refreshCrm,
  giftVoucherToCustomer,
  cancelCustomerVoucher,
  showCustomerTier,
  coupons = []
}) {
  const [keyword, setKeyword] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [showAllOrdersByPhone, setShowAllOrdersByPhone] = useState({});
  const [voucherPickerOpen, setVoucherPickerOpen] = useState(false);
  const [loyaltyDetailByPhone, setLoyaltyDetailByPhone] = useState({});
  const filteredCustomers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const phoneKey = getCustomerKey(q);
    const all = crmSnapshot.customers || [];
    const next = all.filter(customer => {
      const name = String(`${customer.name || ""} ${customer.registeredCustomerName || ""} ${customer.orderCustomerName || ""}`).toLowerCase();
      const phone = String(customer.phone || "").toLowerCase();
      const matchKeyword = !q || name.includes(q) || phone.includes(q) || phoneKey && phone.includes(phoneKey);
      const matchFilter = customerFilter === "all" || customerFilter === "vip" && isVipCustomer(customer) || customerFilter === "care" && needsCare(customer);
      return matchKeyword && matchFilter;
    });
    next.sort((a, b) => {
      if (sortBy === "spent") return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
      if (sortBy === "orders") return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
      return new Date(b.lastOrderAt || 0).getTime() - new Date(a.lastOrderAt || 0).getTime();
    });
    return next;
  }, [crmSnapshot.customers, keyword, customerFilter, sortBy]);
  const summary = useMemo(() => {
    const customers = crmSnapshot.customers || [];
    return {
      totalCustomers: customers.length,
      totalRevenue: customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0),
      vipCount: customers.filter(isVipCustomer).length,
      careCount: customers.filter(needsCare).length,
      totalPoints: customers.reduce((sum, customer) => sum + Number(customer.currentPoints || 0), 0)
    };
  }, [crmSnapshot.customers]);
  const selectedCustomer = useMemo(() => (crmSnapshot.customers || []).find(customer => customer.phone === selectedCustomerPhone) || null, [crmSnapshot.customers, selectedCustomerPhone]);
  const loyaltyVouchers = useMemo(() => {
    return (coupons || []).filter(coupon => coupon.active !== false && String(coupon.voucherType || "checkout") === "loyalty").sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  }, [coupons]);
  const selectedOrders = useMemo(() => {
    const orders = Array.isArray(selectedCustomer?.orders) ? selectedCustomer.orders : [];
    return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [selectedCustomer]);
  const visibleDetailOrders = selectedCustomer ? showAllOrdersByPhone[selectedCustomer.phone] ? selectedOrders : selectedOrders.slice(0, 4) : [];
  useEffect(() => {
    let disposed = false;
    const phone = selectedCustomer?.phone ? getCustomerKey(selectedCustomer.phone) : "";
    if (!phone) return () => {
      disposed = true;
    };
    (async () => {
      const result = await getCustomerLoyaltyDetailAsync(phone, {
        limit: 100,
        offset: 0
      });
      if (disposed) return;
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const orderEarn = rows.filter(item => String(item?.type || "").toUpperCase() === "ORDER_EARN").reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const checkin = rows.filter(item => ["CHECKIN", "MILESTONE"].includes(String(item?.type || "").toUpperCase())).reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const spend = Math.abs(rows.filter(item => String(item?.type || "").toUpperCase() === "ORDER_SPEND").reduce((sum, item) => sum + Number(item?.points || 0), 0));
      const total = rows.reduce((sum, item) => sum + Number(item?.points || 0), 0);
      const other = total - orderEarn - checkin + spend;
      setLoyaltyDetailByPhone(current => ({
        ...current,
        [phone]: {
          rows,
          total: Number(result?.total || rows.length),
          orderEarn,
          checkin,
          spend,
          other,
          totalPoints: Math.max(0, total)
        }
      }));
    })();
    return () => {
      disposed = true;
    };
  }, [selectedCustomer?.phone]);
  const selectedLoyaltyDetail = selectedCustomer?.phone ? loyaltyDetailByPhone[getCustomerKey(selectedCustomer.phone)] || null : null;
  const sortedSelectedVouchers = useMemo(() => {
    const vouchers = Array.isArray(selectedCustomer?.vouchers) ? selectedCustomer.vouchers : [];
    return [...vouchers].sort((a, b) => {
      const weightDiff = getVoucherSortWeight(a) - getVoucherSortWeight(b);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [selectedCustomer?.vouchers]);
  const resetFilters = () => {
    setKeyword("");
    setCustomerFilter("all");
    setSortBy("latest");
  };
  return /*#__PURE__*/_jsxs("section", {
    className: "crm-page",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "crm-page-hero",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("p", {
          children: "Qu\u1EA3n l\xFD kh\xE1ch h\xE0ng"
        }), /*#__PURE__*/_jsx("h2", {
          children: "Kh\xE1ch h\xE0ng / CRM"
        }), /*#__PURE__*/_jsx("span", {
          children: "Theo d\xF5i l\u1ECBch s\u1EED mua h\xE0ng, \u0111i\u1EC3m t\xEDch l\u0169y v\xE0 ch\u0103m s\xF3c kh\xE1ch quay l\u1EA1i."
        })]
      }), /*#__PURE__*/_jsxs("button", {
        type: "button",
        className: "crm-refresh-btn",
        onClick: refreshCrm,
        children: [/*#__PURE__*/_jsx(Icon, {
          name: "back",
          size: 16
        }), "T\u1EA3i l\u1EA1i d\u1EEF li\u1EC7u"]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "crm-stat-grid",
      children: [/*#__PURE__*/_jsx(CrmStatCard, {
        icon: "user",
        tone: "orange",
        title: "T\u1ED5ng kh\xE1ch h\xE0ng",
        value: summary.totalCustomers.toLocaleString("vi-VN"),
        subtitle: "T\u1EEB d\u1EEF li\u1EC7u \u0111\u01A1n h\xE0ng"
      }), /*#__PURE__*/_jsx(CrmStatCard, {
        icon: "cart",
        tone: "green",
        title: "Doanh thu t\u1EEB kh\xE1ch",
        value: formatMoney(summary.totalRevenue),
        subtitle: "T\u1ED5ng chi ti\xEAu \u0111\xE3 ghi nh\u1EADn"
      }), /*#__PURE__*/_jsx(CrmStatCard, {
        icon: "star",
        tone: "purple",
        title: "Kh\xE1ch VIP",
        value: summary.vipCount.toLocaleString("vi-VN"),
        subtitle: "Theo ng\u01B0\u1EE1ng hi\u1EC7n t\u1EA1i"
      }), /*#__PURE__*/_jsx(CrmStatCard, {
        icon: "heart",
        tone: "blue",
        title: "C\u1EA7n ch\u0103m s\xF3c",
        value: summary.careCount.toLocaleString("vi-VN"),
        subtitle: "Ch\u01B0a quay l\u1EA1i t\u1EEB 30 ng\xE0y"
      }), /*#__PURE__*/_jsx(CrmStatCard, {
        icon: "gift",
        tone: "amber",
        title: "\u0110i\u1EC3m loyalty",
        value: summary.totalPoints.toLocaleString("vi-VN"),
        subtitle: "T\u1ED5ng \u0111i\u1EC3m hi\u1EC7n t\u1EA1i"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "crm-workspace",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "crm-list-panel",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "crm-filter-bar",
          children: [/*#__PURE__*/_jsxs("label", {
            className: "crm-search",
            children: [/*#__PURE__*/_jsx(Icon, {
              name: "search",
              size: 17
            }), /*#__PURE__*/_jsx("input", {
              placeholder: "T\xECm theo t\xEAn ho\u1EB7c s\u1ED1 \u0111i\u1EC7n tho\u1EA1i...",
              value: keyword,
              onChange: event => setKeyword(event.target.value)
            })]
          }), /*#__PURE__*/_jsxs("select", {
            value: sortBy,
            onChange: event => setSortBy(event.target.value),
            children: [/*#__PURE__*/_jsx("option", {
              value: "latest",
              children: "Mua g\u1EA7n nh\u1EA5t"
            }), /*#__PURE__*/_jsx("option", {
              value: "spent",
              children: "Chi ti\xEAu cao nh\u1EA5t"
            }), /*#__PURE__*/_jsx("option", {
              value: "orders",
              children: "Nhi\u1EC1u \u0111\u01A1n nh\u1EA5t"
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "crm-filter-tabs",
            children: [/*#__PURE__*/_jsx("button", {
              type: "button",
              className: customerFilter === "all" ? "active" : "",
              onClick: () => setCustomerFilter("all"),
              children: "T\u1EA5t c\u1EA3"
            }), /*#__PURE__*/_jsx("button", {
              type: "button",
              className: customerFilter === "vip" ? "active" : "",
              onClick: () => setCustomerFilter("vip"),
              children: "VIP"
            }), /*#__PURE__*/_jsx("button", {
              type: "button",
              className: customerFilter === "care" ? "active" : "",
              onClick: () => setCustomerFilter("care"),
              children: "C\u1EA7n ch\u0103m s\xF3c"
            })]
          }), /*#__PURE__*/_jsx("button", {
            type: "button",
            className: "crm-reset-btn",
            onClick: resetFilters,
            children: "X\xF3a l\u1ECDc"
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "crm-table",
          children: [/*#__PURE__*/_jsxs("div", {
            className: "crm-table-head",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Kh\xE1ch h\xE0ng"
            }), /*#__PURE__*/_jsx("span", {
              children: "Nh\xF3m"
            }), /*#__PURE__*/_jsx("span", {
              children: "T\u1ED5ng \u0111\u01A1n"
            }), /*#__PURE__*/_jsx("span", {
              children: "T\u1ED5ng chi ti\xEAu"
            }), /*#__PURE__*/_jsx("span", {
              children: "L\u1EA7n mua cu\u1ED1i"
            }), /*#__PURE__*/_jsx("span", {
              children: "\u0110i\u1EC3m"
            })]
          }), /*#__PURE__*/_jsx("div", {
            className: "crm-table-body",
            children: filteredCustomers.map(customer => {
              const isSelected = selectedCustomerPhone === customer.phone;
              return /*#__PURE__*/_jsxs("button", {
                type: "button",
                className: `crm-table-row ${isSelected ? "is-selected" : ""}`,
                onClick: () => setSelectedCustomerPhone(isSelected ? "" : customer.phone),
                children: [/*#__PURE__*/_jsx(CustomerIdentity, {
                  customer: customer
                }), /*#__PURE__*/_jsx("span", {
                  children: /*#__PURE__*/_jsxs("span", {
                    className: "crm-badge-stack",
                    children: [/*#__PURE__*/_jsx("em", {
                      className: `crm-soft-badge ${getCustomerTypeClass(customer)}`,
                      children: getCustomerTypeLabel(customer)
                    }), customer.nameMismatch ? /*#__PURE__*/_jsx("em", {
                      className: "crm-soft-badge crm-soft-badge--care",
                      children: "Kh\xE1c t\xEAn"
                    }) : null, showCustomerTier ? /*#__PURE__*/_jsx("em", {
                      className: `crm-tier-badge crm-tier-badge--${getTierTone(customer.tier)}`,
                      children: customer.tier
                    }) : null]
                  })
                }), /*#__PURE__*/_jsx("strong", {
                  children: Number(customer.totalOrders || 0).toLocaleString("vi-VN")
                }), /*#__PURE__*/_jsx("strong", {
                  children: formatMoney(customer.totalSpent)
                }), /*#__PURE__*/_jsx("small", {
                  children: formatDateTime(customer.lastOrderAt)
                }), /*#__PURE__*/_jsx("strong", {
                  children: Number(customer.currentPoints || 0).toLocaleString("vi-VN")
                })]
              }, customer.phone);
            })
          })]
        }), filteredCustomers.length === 0 && /*#__PURE__*/_jsxs("div", {
          className: "crm-empty-state",
          children: [/*#__PURE__*/_jsx(Icon, {
            name: "user",
            size: 28
          }), /*#__PURE__*/_jsx("p", {
            children: "Ch\u01B0a c\xF3 kh\xE1ch h\xE0ng ph\xF9 h\u1EE3p v\u1EDBi b\u1ED9 l\u1ECDc."
          })]
        })]
      }), /*#__PURE__*/_jsx("aside", {
        className: `crm-detail-panel ${selectedCustomer ? "is-open" : ""}`,
        children: selectedCustomer ? /*#__PURE__*/_jsxs(_Fragment, {
          children: [/*#__PURE__*/_jsxs("div", {
            className: "crm-detail-head",
            children: [/*#__PURE__*/_jsx("button", {
              type: "button",
              className: "crm-detail-close",
              onClick: () => setSelectedCustomerPhone(""),
              children: "\xD7"
            }), /*#__PURE__*/_jsx(CustomerIdentity, {
              customer: selectedCustomer,
              compact: true
            }), /*#__PURE__*/_jsxs("div", {
              className: "crm-detail-badges",
              children: [showCustomerTier ? /*#__PURE__*/_jsx("em", {
                className: `crm-tier-badge crm-tier-badge--${getTierTone(selectedCustomer.tier)}`,
                children: selectedCustomer.tier
              }) : null, /*#__PURE__*/_jsx("em", {
                className: `crm-soft-badge ${getCustomerTypeClass(selectedCustomer)}`,
                children: getCustomerTypeLabel(selectedCustomer)
              }), selectedCustomer.nameMismatch ? /*#__PURE__*/_jsx("em", {
                className: "crm-soft-badge crm-soft-badge--care",
                children: "T\xEAn \u0111\u1EB7t \u0111\u01A1n kh\xE1c t\xE0i kho\u1EA3n"
              }) : null, isVipCustomer(selectedCustomer) ? /*#__PURE__*/_jsx("em", {
                className: "crm-soft-badge",
                children: "VIP"
              }) : null, needsCare(selectedCustomer) ? /*#__PURE__*/_jsx("em", {
                className: "crm-soft-badge crm-soft-badge--care",
                children: "C\u1EA7n ch\u0103m s\xF3c"
              }) : null]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "crm-detail-scroll",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "crm-detail-metrics",
              children: [/*#__PURE__*/_jsxs("article", {
                children: [/*#__PURE__*/_jsx("small", {
                  children: "T\u1ED5ng \u0111\u01A1n h\xE0ng"
                }), /*#__PURE__*/_jsx("strong", {
                  children: Number(selectedCustomer.totalOrders || 0).toLocaleString("vi-VN")
                })]
              }), /*#__PURE__*/_jsxs("article", {
                children: [/*#__PURE__*/_jsx("small", {
                  children: "T\u1ED5ng chi ti\xEAu"
                }), /*#__PURE__*/_jsx("strong", {
                  children: formatMoney(selectedCustomer.totalSpent)
                })]
              }), /*#__PURE__*/_jsxs("article", {
                children: [/*#__PURE__*/_jsx("small", {
                  children: "L\u1EA7n mua cu\u1ED1i"
                }), /*#__PURE__*/_jsx("strong", {
                  children: formatDateTime(selectedCustomer.lastOrderAt)
                })]
              }), /*#__PURE__*/_jsxs("article", {
                children: [/*#__PURE__*/_jsx("small", {
                  children: "Ch\u01B0a quay l\u1EA1i"
                }), /*#__PURE__*/_jsxs("strong", {
                  children: [selectedCustomer.daysSinceLastOrder ?? "--", " ng\xE0y"]
                })]
              })]
            }), /*#__PURE__*/_jsxs("section", {
              className: "crm-detail-card crm-loyalty-card",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "crm-card-title",
                children: [/*#__PURE__*/_jsx(Icon, {
                  name: "gift",
                  size: 17
                }), /*#__PURE__*/_jsx("h3", {
                  children: "Loyalty"
                })]
              }), selectedCustomer.registeredCustomerName && selectedCustomer.orderCustomerName ? /*#__PURE__*/_jsxs("div", {
                className: "crm-points-grid",
                children: [/*#__PURE__*/_jsxs("span", {
                  children: ["T\xEAn t\xE0i kho\u1EA3n: ", selectedCustomer.registeredCustomerName]
                }), /*#__PURE__*/_jsxs("span", {
                  children: ["T\xEAn \u0111\u01A1n g\u1EA7n nh\u1EA5t: ", selectedCustomer.orderCustomerName]
                })]
              }) : null, /*#__PURE__*/_jsxs("div", {
                className: "crm-points-line",
                children: [/*#__PURE__*/_jsx("span", {
                  children: "\u0110i\u1EC3m hi\u1EC7n t\u1EA1i"
                }), /*#__PURE__*/_jsx("strong", {
                  children: Number((selectedLoyaltyDetail?.totalPoints ?? selectedCustomer.currentPoints) || 0).toLocaleString("vi-VN")
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "crm-points-grid",
                children: [/*#__PURE__*/_jsxs("span", {
                  children: ["T\u1EEB \u0111\u01A1n h\xE0ng: ", Number((selectedLoyaltyDetail?.orderEarn ?? selectedCustomer.autoPoints) || 0).toLocaleString("vi-VN")]
                }), /*#__PURE__*/_jsxs("span", {
                  children: ["\u0110i\u1EC3m danh/th\u01B0\u1EDFng: ", Number((selectedLoyaltyDetail?.checkin ?? selectedCustomer.checkinAndRewardPoints) || 0).toLocaleString("vi-VN")]
                }), /*#__PURE__*/_jsxs("span", {
                  children: ["\u0110\xE3 d\xF9ng \u0111i\u1EC3m: -", Number((selectedLoyaltyDetail?.spend ?? selectedCustomer.spentPoints) || 0).toLocaleString("vi-VN")]
                }), /*#__PURE__*/_jsxs("span", {
                  children: ["\u0110i\u1EC1u ch\u1EC9nh kh\xE1c: ", Number((selectedLoyaltyDetail?.other ?? selectedCustomer.otherAdjustPoints) || 0).toLocaleString("vi-VN")]
                })]
              })]
            }), /*#__PURE__*/_jsxs("section", {
              className: "crm-detail-card",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "crm-card-title",
                children: [/*#__PURE__*/_jsx(Icon, {
                  name: "bag",
                  size: 17
                }), /*#__PURE__*/_jsx("h3", {
                  children: "L\u1ECBch s\u1EED \u0111\u01A1n g\u1EA7n \u0111\xE2y"
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "crm-mini-list",
                children: [visibleDetailOrders.map(order => /*#__PURE__*/_jsxs("article", {
                  children: [/*#__PURE__*/_jsxs("div", {
                    children: [/*#__PURE__*/_jsx("strong", {
                      children: order.orderCode || order.id
                    }), /*#__PURE__*/_jsx("small", {
                      children: formatDateTime(order.createdAt)
                    })]
                  }), /*#__PURE__*/_jsxs("div", {
                    children: [/*#__PURE__*/_jsx("strong", {
                      children: formatMoney(Number(order.totalAmount || order.total || 0))
                    }), /*#__PURE__*/_jsx("em", {
                      children: getOrderStatusLabel(order.status)
                    })]
                  })]
                }, order.id || order.orderCode)), selectedOrders.length === 0 && /*#__PURE__*/_jsx("p", {
                  children: "Ch\u01B0a c\xF3 \u0111\u01A1n h\xE0ng."
                })]
              }), selectedOrders.length > 4 && /*#__PURE__*/_jsx("button", {
                type: "button",
                className: "crm-link-btn",
                onClick: () => setShowAllOrdersByPhone(current => ({
                  ...current,
                  [selectedCustomer.phone]: !current[selectedCustomer.phone]
                })),
                children: showAllOrdersByPhone[selectedCustomer.phone] ? "Thu gọn đơn hàng" : `Xem thêm ${selectedOrders.length - 4} đơn`
              })]
            }), /*#__PURE__*/_jsxs("section", {
              className: "crm-detail-card",
              children: [/*#__PURE__*/_jsxs("div", {
                className: "crm-card-title",
                children: [/*#__PURE__*/_jsx(Icon, {
                  name: "tag",
                  size: 17
                }), /*#__PURE__*/_jsx("h3", {
                  children: "Voucher \u0111\xE3 t\u1EB7ng"
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "crm-mini-list",
                children: [sortedSelectedVouchers.map(voucher => {
                  const status = getVoucherStatus(voucher);
                  return /*#__PURE__*/_jsxs("article", {
                    children: [/*#__PURE__*/_jsxs("div", {
                      children: [/*#__PURE__*/_jsx("strong", {
                        children: voucher.code ? `${voucher.code} - ${voucher.title}` : voucher.title
                      }), /*#__PURE__*/_jsxs("small", {
                        children: ["HSD: ", voucher.expiredAt || "--"]
                      })]
                    }), /*#__PURE__*/_jsxs("div", {
                      className: "crm-voucher-row-actions",
                      children: [/*#__PURE__*/_jsx("em", {
                        className: status.className,
                        children: status.label
                      }), !voucher.used && !voucher.canceled ? /*#__PURE__*/_jsx("button", {
                        type: "button",
                        onClick: async () => {
                          await cancelCustomerVoucher?.(selectedCustomer.phone, voucher);
                        },
                        children: "H\u1EE7y"
                      }) : null]
                    })]
                  }, voucher.id);
                }), sortedSelectedVouchers.length === 0 && /*#__PURE__*/_jsx("p", {
                  children: "Ch\u01B0a c\xF3 voucher."
                })]
              })]
            })]
          }), /*#__PURE__*/_jsx("div", {
            className: "crm-detail-actions",
            children: /*#__PURE__*/_jsx("button", {
              type: "button",
              onClick: () => setVoucherPickerOpen(true),
              children: "T\u1EB7ng voucher"
            })
          }), voucherPickerOpen ? /*#__PURE__*/_jsx("div", {
            className: "crm-voucher-picker-backdrop",
            role: "presentation",
            onClick: () => setVoucherPickerOpen(false),
            children: /*#__PURE__*/_jsxs("section", {
              className: "crm-voucher-picker",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": "Ch\u1ECDn voucher loyalty",
              onClick: event => event.stopPropagation(),
              children: [/*#__PURE__*/_jsxs("div", {
                className: "crm-voucher-picker-head",
                children: [/*#__PURE__*/_jsxs("div", {
                  children: [/*#__PURE__*/_jsx("h3", {
                    children: "Ch\u1ECDn voucher loyalty"
                  }), /*#__PURE__*/_jsx("p", {
                    children: "T\u1EB7ng voucher \u0111\xE3 t\u1EA1o trong Khuy\u1EBFn m\xE3i / M\xE3 gi\u1EA3m gi\xE1."
                  })]
                }), /*#__PURE__*/_jsx("button", {
                  type: "button",
                  onClick: () => setVoucherPickerOpen(false),
                  children: "\xD7"
                })]
              }), /*#__PURE__*/_jsxs("div", {
                className: "crm-voucher-picker-list",
                children: [loyaltyVouchers.map(voucher => /*#__PURE__*/_jsxs("button", {
                  type: "button",
                  onClick: async () => {
                    await giftVoucherToCustomer(selectedCustomer.phone, voucher);
                    setVoucherPickerOpen(false);
                  },
                  children: [/*#__PURE__*/_jsxs("span", {
                    children: [/*#__PURE__*/_jsx("strong", {
                      children: voucher.code
                    }), /*#__PURE__*/_jsx("small", {
                      children: voucher.name || "Voucher loyalty"
                    })]
                  }), /*#__PURE__*/_jsx("em", {
                    children: formatVoucherDiscount(voucher)
                  })]
                }, voucher.id || voucher.code)), !loyaltyVouchers.length ? /*#__PURE__*/_jsx("p", {
                  children: "Ch\u01B0a c\xF3 voucher loyalty. B\u1EA1n t\u1EA1o trong Khuy\u1EBFn m\xE3i / M\xE3 gi\u1EA3m gi\xE1 / Voucher loyalty tr\u01B0\u1EDBc nh\xE9."
                }) : null]
              })]
            })
          }) : null]
        }) : /*#__PURE__*/_jsxs("div", {
          className: "crm-detail-empty",
          children: [/*#__PURE__*/_jsx(Icon, {
            name: "user",
            size: 34
          }), /*#__PURE__*/_jsx("h3", {
            children: "Ch\u1ECDn m\u1ED9t kh\xE1ch h\xE0ng"
          }), /*#__PURE__*/_jsx("p", {
            children: "Th\xF4ng tin chi ti\u1EBFt, loyalty, voucher v\xE0 l\u1ECBch s\u1EED \u0111\u01A1n s\u1EBD hi\u1EC3n th\u1ECB t\u1EA1i \u0111\xE2y."
          })]
        })
      })]
    })]
  });
}