import { useMemo, useState } from "react";
import { formatMoney } from "../../../utils/format.js";
import { getCustomerKey } from "../../../services/storageService.js";
import { toAdminStatus, formatOrderTime, getWaitingMinutes, getSettlement, buildShipperInfoText } from "./orderManager.utils.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STATUS_META = {
  all: {
    label: "Tất cả",
    className: "admin-order-status-all"
  },
  new: {
    label: "Đơn mới",
    className: "admin-order-status-new"
  },
  doing: {
    label: "Đang làm",
    className: "admin-order-status-doing"
  },
  delivering: {
    label: "Đang giao",
    className: "admin-order-status-delivering"
  },
  done: {
    label: "Hoàn thành",
    className: "admin-order-status-done"
  }
};
function getOrderId(order) {
  return order.id || order.orderCode;
}
function getFulfillmentType(order) {
  return String(order.fulfillmentType || "").toLowerCase() === "pickup" ? "pickup" : "delivery";
}
function getOrderBranchName(order) {
  return [order.deliveryBranchName, order.pickupBranchName, order.branchName].map(value => String(value || "").trim()).find(Boolean) || "";
}
function normalizeName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function getRegisteredCustomer(order, registeredCustomersByPhone) {
  const phone = getCustomerKey(order.customerPhone || order.phone || order.customerPhoneKey);
  return phone ? registeredCustomersByPhone?.[phone] || null : null;
}
function hasOrderNameMismatch(order, registeredCustomersByPhone) {
  const registered = getRegisteredCustomer(order, registeredCustomersByPhone);
  const registeredName = registered?.name || "";
  const orderName = order.orderCustomerName || order.customerName || "";
  return Boolean(registeredName && orderName && normalizeName(registeredName) !== normalizeName(orderName));
}
function normalizeBranchKey(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ganh\s*hang\s*rong/g, "").replace(/[^a-z0-9]+/g, "").trim();
}
function getOrderBranchCandidates(order) {
  return [order.deliveryBranchId, order.pickupBranchId, order.branchId, order.deliveryBranchName, order.pickupBranchName, order.branchName].flatMap(value => {
    const raw = String(value || "").trim();
    const normalized = normalizeBranchKey(raw);
    return [raw, normalized].filter(Boolean);
  });
}
function getBranchFilterValue(branch, index) {
  return String(branch?.id || branch?.name || `branch-${index}`);
}
function buildBranchOptions(branches = []) {
  return (branches || []).map((branch, index) => {
    const label = String(branch?.name || "").trim();
    if (!label) return null;
    return {
      value: getBranchFilterValue(branch, index),
      label,
      aliases: [getBranchFilterValue(branch, index), branch?.id, branch?.name, branch?.address].flatMap(value => {
        const raw = String(value || "").trim();
        const normalized = normalizeBranchKey(raw);
        return [raw, normalized].filter(Boolean);
      })
    };
  }).filter(Boolean);
}
function matchOrderBranch(order, branchOption) {
  if (!branchOption) return true;
  const candidates = getOrderBranchCandidates(order);
  return branchOption.aliases.some(alias => candidates.includes(alias));
}
function getDisplayStatus(order) {
  const rawStatus = toAdminStatus(order.status);
  return getFulfillmentType(order) === "pickup" && rawStatus === "delivering" ? "done" : rawStatus;
}
function getStatusLabel(status) {
  return STATUS_META[status]?.label || STATUS_META.doing.label;
}
function getStatusClass(status) {
  return STATUS_META[status]?.className || STATUS_META.doing.className;
}
function OrderStatusBadge({
  status
}) {
  return /*#__PURE__*/_jsx("span", {
    className: `admin-order-status-badge ${getStatusClass(status)}`,
    children: getStatusLabel(status)
  });
}
function FulfillmentBadge({
  type
}) {
  const isPickup = type === "pickup";
  return /*#__PURE__*/_jsx("span", {
    className: `admin-order-type-badge ${isPickup ? "is-pickup" : "is-delivery"}`,
    children: isPickup ? "Tại quầy" : "Ship"
  });
}
function OrderStatsCards({
  stats
}) {
  const cards = [{
    key: "total",
    label: "Tổng đơn",
    value: stats.total,
    hint: "Theo bộ lọc hiện tại",
    tone: "orange",
    icon: "🧾"
  }, {
    key: "new",
    label: "Đơn mới",
    value: stats.new,
    hint: "Chờ xử lý",
    tone: "amber",
    icon: "⏱"
  }, {
    key: "doing",
    label: "Đang vận hành",
    value: stats.doing + stats.delivering,
    hint: "Đang làm / đang giao",
    tone: "blue",
    icon: "👨‍🍳"
  }, {
    key: "done",
    label: "Hoàn thành",
    value: stats.done,
    hint: "Đã xử lý xong",
    tone: "green",
    icon: "✓"
  }, {
    key: "overdue",
    label: "Quá 15 phút",
    value: stats.overdue,
    hint: "Cần ưu tiên kiểm tra",
    tone: stats.overdue > 0 ? "red" : "slate",
    icon: "!"
  }];
  return /*#__PURE__*/_jsx("div", {
    className: "admin-order-stats-grid",
    children: cards.map(card => /*#__PURE__*/_jsxs("article", {
      className: `admin-order-stat-card tone-${card.tone}`,
      children: [/*#__PURE__*/_jsx("span", {
        className: "admin-order-stat-icon",
        children: card.icon
      }), /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("p", {
          children: card.label
        }), /*#__PURE__*/_jsx("strong", {
          children: card.value
        }), /*#__PURE__*/_jsx("small", {
          children: card.hint
        })]
      })]
    }, card.key))
  });
}
function OrderTabs({
  activeStatus,
  statusCounts,
  onChange
}) {
  const tabs = ["all", "new", "doing", "delivering", "done"].filter(status => status === "all" || statusCounts[status] > 0);
  return /*#__PURE__*/_jsx("div", {
    className: "admin-order-tabs",
    role: "tablist",
    "aria-label": "L\u1ECDc tr\u1EA1ng th\xE1i \u0111\u01A1n",
    children: tabs.map(status => /*#__PURE__*/_jsxs("button", {
      type: "button",
      className: activeStatus === status ? "active" : "",
      onClick: () => onChange(status),
      children: [getStatusLabel(status), /*#__PURE__*/_jsx("span", {
        children: statusCounts[status] || 0
      })]
    }, status))
  });
}
function OrderFilterBar({
  keyword,
  setKeyword,
  fulfillmentFilter,
  setFulfillmentFilter,
  branchFilter,
  setBranchFilter,
  branchOptions,
  paymentFilter,
  setPaymentFilter,
  onReset
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-order-filter-bar",
    children: [/*#__PURE__*/_jsxs("label", {
      className: "admin-order-search",
      children: [/*#__PURE__*/_jsx("span", {
        children: "\uD83D\uDD0E"
      }), /*#__PURE__*/_jsx("input", {
        value: keyword,
        onChange: event => setKeyword(event.target.value),
        placeholder: "T\xECm m\xE3 \u0111\u01A1n, t\xEAn kh\xE1ch, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i..."
      })]
    }), /*#__PURE__*/_jsxs("select", {
      value: fulfillmentFilter,
      onChange: event => setFulfillmentFilter(event.target.value),
      children: [/*#__PURE__*/_jsx("option", {
        value: "all",
        children: "T\u1EA5t c\u1EA3 h\xECnh th\u1EE9c"
      }), /*#__PURE__*/_jsx("option", {
        value: "delivery",
        children: "Giao h\xE0ng"
      }), /*#__PURE__*/_jsx("option", {
        value: "pickup",
        children: "T\u1EF1 \u0111\u1EBFn l\u1EA5y"
      })]
    }), branchOptions.length ? /*#__PURE__*/_jsxs("select", {
      value: branchFilter,
      onChange: event => setBranchFilter(event.target.value),
      children: [/*#__PURE__*/_jsx("option", {
        value: "all",
        children: "T\u1EA5t c\u1EA3 chi nh\xE1nh"
      }), branchOptions.map(branch => /*#__PURE__*/_jsx("option", {
        value: branch.value,
        children: branch.label
      }, branch.value))]
    }) : null, /*#__PURE__*/_jsxs("select", {
      value: paymentFilter,
      onChange: event => setPaymentFilter(event.target.value),
      children: [/*#__PURE__*/_jsx("option", {
        value: "all",
        children: "T\u1EA5t c\u1EA3 thanh to\xE1n"
      }), /*#__PURE__*/_jsx("option", {
        value: "cod",
        children: "COD"
      }), /*#__PURE__*/_jsx("option", {
        value: "paid",
        children: "\u0110\xE3 tr\u1EA3 tr\u01B0\u1EDBc"
      })]
    }), /*#__PURE__*/_jsx("button", {
      type: "button",
      onClick: onReset,
      children: "X\xF3a l\u1ECDc"
    })]
  });
}
function OrderStatusSelect({
  order,
  status,
  updateOrderStatus
}) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  return /*#__PURE__*/_jsxs("select", {
    value: status,
    onClick: event => event.stopPropagation(),
    onChange: event => updateOrderStatus(orderId, event.target.value),
    className: "admin-order-status-select",
    children: [/*#__PURE__*/_jsx("option", {
      value: "new",
      children: "\u0110\u01A1n m\u1EDBi"
    }), /*#__PURE__*/_jsx("option", {
      value: "doing",
      children: "\u0110ang l\xE0m"
    }), fulfillmentType === "delivery" ? /*#__PURE__*/_jsx("option", {
      value: "delivering",
      children: "\u0110ang giao"
    }) : null, /*#__PURE__*/_jsx("option", {
      value: "done",
      children: fulfillmentType === "pickup" ? "Đã làm xong" : "Hoàn thành"
    })]
  });
}
function OrderQuickActions({
  order,
  status,
  updateOrderStatus
}) {
  const orderId = getOrderId(order);
  const fulfillmentType = getFulfillmentType(order);
  const quickActions = fulfillmentType === "delivery" ? [{
    value: "new",
    label: "Mới"
  }, {
    value: "doing",
    label: "Làm"
  }, {
    value: "delivering",
    label: "Giao"
  }, {
    value: "done",
    label: "Xong"
  }] : [{
    value: "new",
    label: "Mới"
  }, {
    value: "doing",
    label: "Làm"
  }, {
    value: "done",
    label: "Xong"
  }];
  return /*#__PURE__*/_jsx("div", {
    className: "admin-order-quick-actions",
    children: quickActions.map(action => /*#__PURE__*/_jsx("button", {
      type: "button",
      onClick: event => {
        event.stopPropagation();
        updateOrderStatus(orderId, action.value);
      },
      className: status === action.value ? "active" : "",
      children: action.label
    }, action.value))
  });
}
function OrderList({
  orders,
  activeOrderId,
  onSelectOrder,
  onOpenDetail,
  updateOrderStatus,
  registeredCustomersByPhone
}) {
  if (!orders.length) {
    return /*#__PURE__*/_jsxs("div", {
      className: "admin-order-empty",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "Ch\u01B0a c\xF3 \u0111\u01A1n ph\xF9 h\u1EE3p"
      }), /*#__PURE__*/_jsx("span", {
        children: "Th\u1EED \u0111\u1ED5i t\u1EEB kh\xF3a t\xECm ki\u1EBFm ho\u1EB7c b\u1ED9 l\u1ECDc hi\u1EC7n t\u1EA1i."
      })]
    });
  }
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-order-table-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-order-table-head",
      children: [/*#__PURE__*/_jsx("span", {
        children: "M\xE3 \u0111\u01A1n"
      }), /*#__PURE__*/_jsx("span", {
        children: "Kh\xE1ch h\xE0ng"
      }), /*#__PURE__*/_jsx("span", {
        children: "H\xECnh th\u1EE9c"
      }), /*#__PURE__*/_jsx("span", {
        children: "Th\u1EDDi gian"
      }), /*#__PURE__*/_jsx("span", {
        children: "Tr\u1EA1ng th\xE1i"
      }), /*#__PURE__*/_jsx("span", {
        children: "T\u1ED5ng ti\u1EC1n"
      }), /*#__PURE__*/_jsx("span", {
        children: "Thao t\xE1c"
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-order-table-body",
      children: orders.map(order => {
        const orderId = getOrderId(order);
        const status = getDisplayStatus(order);
        const fulfillmentType = getFulfillmentType(order);
        const branchName = getOrderBranchName(order);
        const waitingMinutes = getWaitingMinutes(order.createdAt);
        const isActive = String(activeOrderId) === String(orderId);
        const nameMismatch = hasOrderNameMismatch(order, registeredCustomersByPhone);
        return /*#__PURE__*/_jsxs("article", {
          className: `admin-order-row ${isActive ? "is-selected" : ""}`,
          onClick: () => onSelectOrder(order),
          children: [/*#__PURE__*/_jsxs("div", {
            className: "admin-order-cell admin-order-code-cell",
            children: [/*#__PURE__*/_jsx("strong", {
              children: order.orderCode || order.id
            }), /*#__PURE__*/_jsxs("small", {
              children: [waitingMinutes, " ph\xFAt"]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "admin-order-cell",
            children: [/*#__PURE__*/_jsx("strong", {
              children: order.customerName || "Khách lẻ"
            }), /*#__PURE__*/_jsx("small", {
              children: order.customerPhone || order.phone || "--"
            }), nameMismatch ? /*#__PURE__*/_jsx("span", {
              className: "admin-order-name-mismatch-badge",
              children: "T\xEAn \u0111\u1EB7t kh\xE1c t\xEAn t\xE0i kho\u1EA3n"
            }) : null]
          }), /*#__PURE__*/_jsxs("div", {
            className: "admin-order-cell",
            children: [/*#__PURE__*/_jsx(FulfillmentBadge, {
              type: fulfillmentType
            }), branchName ? /*#__PURE__*/_jsx("small", {
              className: "admin-order-branch-name",
              children: branchName
            }) : null, /*#__PURE__*/_jsx("small", {
              children: String(order.paymentMethod || "COD").toUpperCase()
            })]
          }), /*#__PURE__*/_jsx("div", {
            className: "admin-order-cell",
            children: /*#__PURE__*/_jsx("span", {
              children: formatOrderTime(order.createdAt)
            })
          }), /*#__PURE__*/_jsx("div", {
            className: "admin-order-cell",
            children: /*#__PURE__*/_jsx(OrderStatusBadge, {
              status: status
            })
          }), /*#__PURE__*/_jsx("div", {
            className: "admin-order-cell admin-order-money",
            children: /*#__PURE__*/_jsx("strong", {
              children: formatMoney(Number(order.totalAmount || order.total || 0))
            })
          }), /*#__PURE__*/_jsxs("div", {
            className: "admin-order-cell admin-order-row-actions",
            children: [/*#__PURE__*/_jsx("button", {
              type: "button",
              onClick: event => {
                event.stopPropagation();
                onOpenDetail(order);
              },
              children: "Xem"
            }), /*#__PURE__*/_jsx(OrderStatusSelect, {
              order: order,
              status: status,
              updateOrderStatus: updateOrderStatus
            })]
          })]
        }, orderId);
      })
    })]
  });
}
function OrderDetailPanel({
  order,
  updateOrderStatus,
  shipperText,
  copied,
  onCopyShipper,
  onClose,
  isOpen,
  registeredCustomersByPhone
}) {
  if (!order) {
    return /*#__PURE__*/_jsxs("aside", {
      className: "admin-order-detail-panel is-empty",
      children: [/*#__PURE__*/_jsx("strong", {
        children: "Ch\u1ECDn m\u1ED9t \u0111\u01A1n \u0111\u1EC3 xem chi ti\u1EBFt"
      }), /*#__PURE__*/_jsx("span", {
        children: "Th\xF4ng tin \u0111\u01A1n, m\xF3n v\xE0 thao t\xE1c s\u1EBD hi\u1EC3n th\u1ECB \u1EDF \u0111\xE2y."
      })]
    });
  }
  const items = order.items || [];
  const orderId = getOrderId(order);
  const status = getDisplayStatus(order);
  const fulfillmentType = getFulfillmentType(order);
  const subtotalValue = Number(order.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = fulfillmentType === "pickup" ? 0 : Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupport = fulfillmentType === "pickup" ? 0 : Number(order.shippingSupportDiscount || 0);
  const promoDiscount = Number(order.promoDiscount || 0);
  const pointsDiscount = Number(order.pointsDiscount || 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const settlement = getSettlement(order);
  const branchName = getOrderBranchName(order);
  const registeredCustomer = getRegisteredCustomer(order, registeredCustomersByPhone);
  const orderCustomerName = order.orderCustomerName || order.customerName || "";
  const nameMismatch = hasOrderNameMismatch(order, registeredCustomersByPhone);
  const addressText = fulfillmentType === "pickup" ? [order.branchName || order.pickupBranchName, order.branchAddress || order.pickupBranchAddress].filter(Boolean).join(" - ") : order.deliveryAddress;
  const note = order.note || order.customerNote || order.orderNote || "";
  return /*#__PURE__*/_jsxs("aside", {
    className: `admin-order-detail-panel ${isOpen ? "is-open" : ""}`,
    children: [/*#__PURE__*/_jsxs("div", {
      className: "admin-order-detail-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("span", {
          children: "Chi ti\u1EBFt \u0111\u01A1n h\xE0ng"
        }), /*#__PURE__*/_jsx("h3", {
          children: order.orderCode || order.id
        }), /*#__PURE__*/_jsx("small", {
          children: formatOrderTime(order.createdAt)
        })]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: onClose,
        children: "\xD7"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-order-detail-scroll",
      children: [/*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "Tr\u1EA1ng th\xE1i"
          }), /*#__PURE__*/_jsx(OrderStatusBadge, {
            status: status
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "H\xECnh th\u1EE9c"
          }), /*#__PURE__*/_jsx(FulfillmentBadge, {
            type: fulfillmentType
          })]
        }), branchName ? /*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "Chi nh\xE1nh x\u1EED l\xFD"
          }), /*#__PURE__*/_jsx("strong", {
            children: branchName
          })]
        }) : null, /*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "Thanh to\xE1n"
          }), /*#__PURE__*/_jsx("strong", {
            children: String(order.paymentMethod || "COD").toUpperCase()
          })]
        })]
      }), /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Th\xF4ng tin kh\xE1ch h\xE0ng"
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-order-customer-box",
          children: [/*#__PURE__*/_jsx("strong", {
            children: orderCustomerName || "Khách lẻ"
          }), /*#__PURE__*/_jsx("span", {
            children: order.customerPhone || order.phone || "--"
          }), addressText ? /*#__PURE__*/_jsx("small", {
            children: addressText
          }) : null]
        }), registeredCustomer ? /*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "T\xE0i kho\u1EA3n"
          }), /*#__PURE__*/_jsx("strong", {
            children: registeredCustomer.name || registeredCustomer.phone
          })]
        }) : null, nameMismatch ? /*#__PURE__*/_jsxs("div", {
          className: "admin-order-detail-row",
          children: [/*#__PURE__*/_jsx("span", {
            children: "L\u01B0u \xFD"
          }), /*#__PURE__*/_jsx("strong", {
            children: /*#__PURE__*/_jsx("span", {
              className: "admin-order-name-mismatch-badge",
              children: "T\xEAn \u0111\u1EB7t kh\xE1c t\xEAn t\xE0i kho\u1EA3n"
            })
          })]
        }) : null]
      }), /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Danh s\xE1ch m\xF3n"
        }), /*#__PURE__*/_jsx("div", {
          className: "admin-order-item-list",
          children: items.map((item, index) => {
            const lineTotal = Number(item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1));
            const options = [item.spice, ...(item.toppings || []).map(topping => `${topping.name}${topping.quantity ? ` x${topping.quantity}` : ""}`), item.note ? `Ghi chú: ${item.note}` : ""].filter(Boolean);
            return /*#__PURE__*/_jsxs("div", {
              className: "admin-order-detail-item",
              children: [/*#__PURE__*/_jsxs("div", {
                children: [/*#__PURE__*/_jsx("strong", {
                  children: item.name
                }), options.length ? /*#__PURE__*/_jsx("small", {
                  children: options.join(" · ")
                }) : null]
              }), /*#__PURE__*/_jsxs("span", {
                children: ["x", item.quantity || 1]
              }), /*#__PURE__*/_jsx("em", {
                children: formatMoney(lineTotal)
              })]
            }, `${item.id || item.name}-${index}`);
          })
        })]
      }), /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Thanh to\xE1n"
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-order-total-lines",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "T\u1EA1m t\xEDnh"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(subtotalValue)
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Ph\xED giao h\xE0ng"
            }), /*#__PURE__*/_jsx("strong", {
              children: fulfillmentType === "pickup" ? "0đ (Tự đến lấy)" : formatMoney(shippingFee)
            })]
          }), shippingSupport > 0 ? /*#__PURE__*/_jsxs("div", {
            className: "discount",
            children: [/*#__PURE__*/_jsx("span", {
              children: "GHR h\u1ED7 tr\u1EE3 ship"
            }), /*#__PURE__*/_jsxs("strong", {
              children: ["-", formatMoney(shippingSupport)]
            })]
          }) : null, promoDiscount > 0 ? /*#__PURE__*/_jsxs("div", {
            className: "discount",
            children: [/*#__PURE__*/_jsxs("span", {
              children: ["M\xE3 gi\u1EA3m gi\xE1 ", order.promoCode || ""]
            }), /*#__PURE__*/_jsxs("strong", {
              children: ["-", formatMoney(promoDiscount)]
            })]
          }) : null, pointsDiscount > 0 ? /*#__PURE__*/_jsxs("div", {
            className: "discount",
            children: [/*#__PURE__*/_jsx("span", {
              children: "D\xF9ng \u0111i\u1EC3m th\u01B0\u1EDFng"
            }), /*#__PURE__*/_jsxs("strong", {
              children: ["-", formatMoney(pointsDiscount)]
            })]
          }) : null, /*#__PURE__*/_jsxs("div", {
            className: "grand",
            children: [/*#__PURE__*/_jsx("span", {
              children: "T\u1ED5ng c\u1ED9ng"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(totalValue)
            })]
          })]
        })]
      }), fulfillmentType === "delivery" ? /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card admin-order-settlement-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "\u0110\u1ED1i so\xE1t shipper"
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-order-total-lines",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Kh\xE1ch tr\u1EA3 khi nh\u1EADn"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(settlement.customerNeedPayWhenReceive)
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Kh\xE1ch tr\u1EA3 ph\xED ship"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(settlement.shippingFeeCustomer)
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Qu\xE1n h\u1ED7 tr\u1EE3 ship"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(settlement.shippingSupport)
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "grand",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Shipper n\u1ED9p l\u1EA1i qu\xE1n"
            }), /*#__PURE__*/_jsx("strong", {
              children: formatMoney(settlement.shipperPayBackStore)
            })]
          })]
        })]
      }) : null, note ? /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Ghi ch\xFA"
        }), /*#__PURE__*/_jsx("p", {
          className: "admin-order-note",
          children: note
        })]
      }) : null, fulfillmentType === "delivery" ? /*#__PURE__*/_jsxs("section", {
        className: "admin-order-detail-card",
        children: [/*#__PURE__*/_jsx("h4", {
          children: "Th\xF4ng tin g\u1EEDi shipper"
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          className: "admin-order-copy-btn",
          onClick: () => onCopyShipper(orderId),
          children: copied ? "Đã copy" : "Copy info shipper"
        }), /*#__PURE__*/_jsx("textarea", {
          readOnly: true,
          value: shipperText || ""
        })]
      }) : null]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-order-detail-actions",
      children: [/*#__PURE__*/_jsx(OrderStatusSelect, {
        order: order,
        status: status,
        updateOrderStatus: updateOrderStatus
      }), /*#__PURE__*/_jsx(OrderQuickActions, {
        order: order,
        status: status,
        updateOrderStatus: updateOrderStatus
      })]
    })]
  });
}
export default function OrderManager({
  ordersSnapshot,
  updateOrderStatus,
  onOpenDetail,
  branches = [],
  registeredCustomersByPhone = {}
}) {
  const [activeOrderId, setActiveOrderId] = useState("");
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const branchOptions = useMemo(() => buildBranchOptions(branches), [branches]);
  const selectedBranchOption = useMemo(() => branchOptions.find(branch => branch.value === branchFilter) || null, [branchOptions, branchFilter]);
  const searchedOrders = useMemo(() => (ordersSnapshot || []).filter(order => {
    const key = keyword.trim().toLowerCase();
    const orderCode = String(order.orderCode || order.id || "").toLowerCase();
    const customerName = String(`${order.customerName || ""} ${order.orderCustomerName || ""}`).toLowerCase();
    const customerPhone = String(`${order.customerPhone || ""} ${order.phone || ""} ${order.customerPhoneKey || ""}`).toLowerCase();
    const normalizedSearchPhone = getCustomerKey(key);
    const fulfillmentType = getFulfillmentType(order);
    const paymentMethod = String(order.paymentMethod || "COD").toUpperCase();
    const matchKeyword = !key || orderCode.includes(key) || customerName.includes(key) || customerPhone.includes(key) || normalizedSearchPhone && customerPhone.includes(normalizedSearchPhone);
    const matchFulfillment = fulfillmentFilter === "all" || fulfillmentFilter === fulfillmentType;
    const matchBranch = branchFilter === "all" || matchOrderBranch(order, selectedBranchOption);
    const matchPayment = paymentFilter === "all" || (paymentFilter === "cod" ? paymentMethod.includes("COD") : !paymentMethod.includes("COD"));
    return matchKeyword && matchFulfillment && matchBranch && matchPayment;
  }), [ordersSnapshot, keyword, fulfillmentFilter, branchFilter, selectedBranchOption, paymentFilter]);
  const statusCounts = useMemo(() => searchedOrders.reduce((counts, order) => {
    const status = getDisplayStatus(order);
    counts.all += 1;
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {
    all: 0,
    new: 0,
    doing: 0,
    delivering: 0,
    done: 0
  }), [searchedOrders]);
  const visibleOrders = useMemo(() => {
    if (statusFilter === "all") return searchedOrders;
    return searchedOrders.filter(order => getDisplayStatus(order) === statusFilter);
  }, [searchedOrders, statusFilter]);
  const orderStats = useMemo(() => {
    const overdue = searchedOrders.filter(order => getWaitingMinutes(order.createdAt) > 15).length;
    const deliveryCount = searchedOrders.filter(order => getFulfillmentType(order) === "delivery").length;
    const pickupCount = searchedOrders.length - deliveryCount;
    return {
      total: searchedOrders.length,
      new: statusCounts.new,
      doing: statusCounts.doing,
      delivering: statusCounts.delivering,
      done: statusCounts.done,
      overdue,
      deliveryCount,
      pickupCount
    };
  }, [searchedOrders, statusCounts]);
  const shipperInfoByOrderId = useMemo(() => {
    const result = {};
    (ordersSnapshot || []).forEach(order => {
      result[getOrderId(order)] = buildShipperInfoText(order, formatMoney);
    });
    return result;
  }, [ordersSnapshot]);
  const activeOrder = useMemo(() => {
    if (!visibleOrders.length) return null;
    return visibleOrders.find(order => String(getOrderId(order)) === String(activeOrderId)) || visibleOrders[0];
  }, [visibleOrders, activeOrderId]);
  const handleSelectOrder = order => {
    setActiveOrderId(getOrderId(order));
    if (onOpenDetail) onOpenDetail(order);
  };
  const handleOpenDetail = order => {
    handleSelectOrder(order);
    setDetailPanelOpen(true);
  };
  const copyShipperInfo = async orderId => {
    const text = shipperInfoByOrderId[orderId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOrderId(orderId);
      setTimeout(() => {
        setCopiedOrderId(current => current === orderId ? "" : current);
      }, 1500);
    } catch (error) {
      console.error(error);
      alert("Không thể copy tự động. Bạn vui lòng copy thủ công trong thẻ thông tin shipper.");
    }
  };
  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
    setFulfillmentFilter("all");
    setBranchFilter("all");
    setPaymentFilter("all");
  };
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-orders-dashboard",
    children: [/*#__PURE__*/_jsxs("section", {
      className: "admin-orders-main",
      children: [/*#__PURE__*/_jsxs("header", {
        className: "admin-orders-hero",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("p", {
            children: "V\u1EADn h\xE0nh nh\xE0 h\xE0ng"
          }), /*#__PURE__*/_jsx("h2", {
            children: "\u0110\u01A1n h\xE0ng"
          }), /*#__PURE__*/_jsx("span", {
            children: "Qu\u1EA3n l\xFD \u0111\u01A1n m\u1EDBi, \u0111\u01A1n \u0111ang l\xE0m v\xE0 \u0111\u01A1n \u0111\xE3 ho\xE0n th\xE0nh."
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-orders-hero-meta",
          children: [/*#__PURE__*/_jsx("strong", {
            children: orderStats.total
          }), /*#__PURE__*/_jsx("span", {
            children: "\u0111\u01A1n trong b\u1ED9 l\u1ECDc"
          })]
        })]
      }), /*#__PURE__*/_jsx(OrderTabs, {
        activeStatus: statusFilter,
        statusCounts: statusCounts,
        onChange: setStatusFilter
      }), /*#__PURE__*/_jsx(OrderStatsCards, {
        stats: orderStats
      }), /*#__PURE__*/_jsx(OrderFilterBar, {
        keyword: keyword,
        setKeyword: setKeyword,
        fulfillmentFilter: fulfillmentFilter,
        setFulfillmentFilter: setFulfillmentFilter,
        branchFilter: branchFilter,
        setBranchFilter: setBranchFilter,
        branchOptions: branchOptions,
        paymentFilter: paymentFilter,
        setPaymentFilter: setPaymentFilter,
        onReset: resetFilters
      }), /*#__PURE__*/_jsx(OrderList, {
        orders: visibleOrders,
        activeOrderId: activeOrder ? getOrderId(activeOrder) : activeOrderId,
        onSelectOrder: handleSelectOrder,
        onOpenDetail: handleOpenDetail,
        updateOrderStatus: updateOrderStatus,
        registeredCustomersByPhone: registeredCustomersByPhone
      })]
    }), /*#__PURE__*/_jsx(OrderDetailPanel, {
      order: activeOrder,
      updateOrderStatus: updateOrderStatus,
      shipperText: activeOrder ? shipperInfoByOrderId[getOrderId(activeOrder)] : "",
      copied: activeOrder ? copiedOrderId === getOrderId(activeOrder) : false,
      onCopyShipper: copyShipperInfo,
      onClose: () => setDetailPanelOpen(false),
      isOpen: detailPanelOpen,
      registeredCustomersByPhone: registeredCustomersByPhone
    })]
  });
}