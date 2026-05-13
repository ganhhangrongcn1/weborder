import { formatMoney } from "../../../utils/format.js";
import Icon from "../../../components/Icon.js";
import { AdminBadge, AdminButton, AdminInput, AdminPanel, AdminStatCard, AdminTable, AdminTableBody, AdminTableHead, AdminTableRow } from "../ui/index.js";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
function getOrderStatusMeta(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending_zalo" || normalized === "new") return {
    label: "Đơn mới",
    tone: "warning"
  };
  if (normalized === "confirmed") return {
    label: "Đang làm",
    tone: "info"
  };
  if (normalized === "delivering") return {
    label: "Đang giao",
    tone: "info"
  };
  if (normalized === "done" || normalized === "completed") return {
    label: "Hoàn tất",
    tone: "success"
  };
  return {
    label: status || "Đang xử lý",
    tone: "neutral"
  };
}
function formatOrderTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
function getOrderBranch(order) {
  return [order.deliveryBranchName, order.pickupBranchName, order.branchName].map(value => String(value || "").trim()).find(Boolean) || "--";
}
function getOrderChannel(order) {
  return String(order.source || order.channel || order.platform || "").trim();
}
function getOrderSourceMeta(order) {
  const rawSource = getOrderChannel(order);
  const normalized = rawSource.toLowerCase();
  if (normalized.includes("grab")) return {
    label: "Grab",
    tone: "success",
    className: "is-grab"
  };
  if (normalized.includes("shopee")) return {
    label: "Shopee",
    tone: "warning",
    className: "is-shopee"
  };
  if (normalized.includes("xanh")) return {
    label: "Xanh Ngon",
    tone: "info",
    className: "is-xanh-ngon"
  };
  if (normalized.includes("pickup") || normalized.includes("đến lấy") || normalized.includes("den lay")) {
    return {
      label: "Đến lấy",
      tone: "brand",
      className: "is-pickup"
    };
  }
  if (normalized.includes("ship") || normalized.includes("delivery") || normalized.includes("giao")) {
    return {
      label: "Ship",
      tone: "info",
      className: "is-ship"
    };
  }
  if (rawSource) return {
    label: rawSource,
    tone: "neutral",
    className: "is-other"
  };
  const fulfillmentType = String(order.fulfillmentType || "").toLowerCase();
  if (fulfillmentType === "pickup") return {
    label: "Đến lấy",
    tone: "brand",
    className: "is-pickup"
  };
  if (fulfillmentType === "delivery") return {
    label: "Ship",
    tone: "info",
    className: "is-ship"
  };
  return {
    label: "Chưa rõ",
    tone: "neutral",
    className: "is-unknown"
  };
}
function buildTopProducts(orders = []) {
  const map = new Map();
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const key = String(item.id || item.name || "").trim();
      if (!key) return;
      const current = map.get(key) || {
        id: key,
        name: item.name || "Món",
        image: item.image || item.thumbnail || "",
        quantity: 0
      };
      current.quantity += Number(item.quantity || 1);
      map.set(key, current);
    });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
}
function buildChannels(orders = []) {
  const map = new Map();
  orders.forEach(order => {
    const channel = String(order.source || order.channel || order.platform || "").trim();
    if (!channel) return;
    map.set(channel, (map.get(channel) || 0) + 1);
  });
  return [...map.entries()].map(([name, count]) => ({
    name,
    count
  })).sort((a, b) => b.count - a.count);
}
function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatChartDate(date) {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit"
  });
}
function buildRevenueSeries(orders = []) {
  const today = new Date();
  const days = Array.from({
    length: 7
  }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: getDateKey(date),
      label: formatChartDate(date),
      value: 0
    };
  });
  const dayMap = new Map(days.map(day => [day.key, day]));
  orders.forEach(order => {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const bucket = dayMap.get(getDateKey(createdAt));
    if (!bucket) return;
    bucket.value += Number(order.totalAmount || 0);
  });
  return days;
}
function buildSmoothRevenuePath(points = []) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const segments = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[index + 2] || next;
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (nextNext.x - current.x) / 6;
    const cp2y = next.y - (nextNext.y - current.y) / 6;
    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`);
  }
  return segments.join(" ");
}
function buildRevenueChart(series = []) {
  const width = 680;
  const height = 250;
  const padding = {
    top: 24,
    right: 22,
    bottom: 38,
    left: 48
  };
  const maxValue = Math.max(...series.map(item => item.value), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
  const points = series.map((item, index) => {
    const x = padding.left + index * step;
    const y = padding.top + (1 - item.value / maxValue) * plotHeight;
    return {
      ...item,
      x,
      y
    };
  });
  const linePath = buildSmoothRevenuePath(points);
  const areaPath = points.length ? `M ${points[0].x} ${height - padding.bottom} L ${points[0].x} ${points[0].y} ${linePath.replace(/^M\s+[\d.-]+\s+[\d.-]+/, "")} L ${points[points.length - 1].x} ${height - padding.bottom} Z` : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const y = padding.top + ratio * plotHeight;
    const value = Math.round(maxValue * (1 - ratio));
    return {
      y,
      value
    };
  });
  return {
    width,
    height,
    padding,
    points,
    linePath,
    areaPath,
    gridLines
  };
}
export default function AdminDashboardSection({
  dashboardSearch,
  setDashboardSearch,
  openBranches,
  totalBranches,
  ordersTotal,
  ordersNew,
  ordersDoing,
  todayRevenue,
  totalCustomers,
  activeProducts,
  toppingsCount,
  dashboardQuickActions,
  openAdminNav,
  flatAdminNav,
  filteredRecentOrders,
  ordersSnapshot = []
}) {
  const topProducts = buildTopProducts(ordersSnapshot);
  const topProductMax = Math.max(...topProducts.map(item => item.quantity), 1);
  const channels = buildChannels(ordersSnapshot);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.count, 0);
  const averageOrder = ordersTotal ? Math.round(todayRevenue / ordersTotal) : 0;
  const completionCount = ordersSnapshot.filter(order => {
    const status = String(order.status || "").toLowerCase();
    return status === "done" || status === "completed";
  }).length;
  const completionRate = ordersTotal ? Math.round(completionCount / ordersTotal * 100) : 0;
  const revenueSeries = buildRevenueSeries(ordersSnapshot);
  const revenueChart = buildRevenueChart(revenueSeries);
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-dashboard-page",
    children: [/*#__PURE__*/_jsxs("section", {
      className: "admin-dashboard-hero",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsxs(AdminBadge, {
          tone: "warning",
          children: ["Chi nh\xE1nh m\u1EDF: ", openBranches, "/", totalBranches]
        }), /*#__PURE__*/_jsx("h2", {
          children: "Ch\xE0o m\u1EEBng quay tr\u1EDF l\u1EA1i!"
        }), /*#__PURE__*/_jsx("p", {
          children: "T\u1ED5ng quan ho\u1EA1t \u0111\u1ED9ng kinh doanh v\xE0 v\u1EADn h\xE0nh \u0111\u01A1n h\xE0ng h\xF4m nay."
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "admin-dashboard-hero-actions",
        children: dashboardQuickActions.slice(0, 2).map(item => /*#__PURE__*/_jsx(AdminButton, {
          variant: item.id === "orders-main" ? "primary" : "secondary",
          onClick: () => openAdminNav(flatAdminNav.find(navItem => navItem.id === item.id)),
          children: item.label
        }, item.id))
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-dashboard-toolbar",
      children: /*#__PURE__*/_jsxs("label", {
        className: "admin-dashboard-search",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\u2315"
        }), /*#__PURE__*/_jsx(AdminInput, {
          value: dashboardSearch,
          onChange: event => setDashboardSearch(event.target.value),
          placeholder: "T\xECm m\xE3 \u0111\u01A1n, t\xEAn kh\xE1ch, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i..."
        })]
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-stat-grid",
      children: [/*#__PURE__*/_jsx(AdminStatCard, {
        title: "Doanh thu",
        value: formatMoney(todayRevenue),
        subtitle: "Theo d\u1EEF li\u1EC7u \u0111\u01A1n hi\u1EC7n t\u1EA1i",
        icon: /*#__PURE__*/_jsx(Icon, {
          name: "tag",
          size: 22
        }),
        tone: "green"
      }), /*#__PURE__*/_jsx(AdminStatCard, {
        title: "T\u1ED5ng \u0111\u01A1n",
        value: ordersTotal,
        subtitle: `${ordersNew} đơn mới`,
        icon: /*#__PURE__*/_jsx(Icon, {
          name: "bag",
          size: 22
        }),
        tone: "brand"
      }), /*#__PURE__*/_jsx(AdminStatCard, {
        title: "Kh\xE1ch h\xE0ng",
        value: totalCustomers,
        subtitle: "T\u1EEB CRM hi\u1EC7n c\xF3",
        icon: /*#__PURE__*/_jsx(Icon, {
          name: "user",
          size: 22
        }),
        tone: "blue"
      }), /*#__PURE__*/_jsx(AdminStatCard, {
        title: "\u0110\u01A1n trung b\xECnh",
        value: formatMoney(averageOrder),
        subtitle: `${completionRate}% hoàn tất`,
        icon: /*#__PURE__*/_jsx(Icon, {
          name: "star",
          size: 22
        }),
        tone: "amber"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-main-grid",
      children: [/*#__PURE__*/_jsxs(AdminPanel, {
        title: "Doanh thu",
        description: "T\u1ED5ng doanh thu t\u1EEB d\u1EEF li\u1EC7u \u0111\u01A1n hi\u1EC7n t\u1EA1i.",
        className: "admin-dashboard-revenue-card",
        action: /*#__PURE__*/_jsx(AdminBadge, {
          tone: "success",
          children: formatMoney(todayRevenue)
        }),
        children: [/*#__PURE__*/_jsxs("div", {
          className: "admin-dashboard-revenue-visual",
          children: [/*#__PURE__*/_jsx("strong", {
            children: formatMoney(todayRevenue)
          }), /*#__PURE__*/_jsxs("span", {
            children: [ordersTotal, " \u0111\u01A1n \xB7 ", formatMoney(averageOrder), " / \u0111\u01A1n"]
          }), /*#__PURE__*/_jsx("div", {
            className: "admin-dashboard-revenue-chart",
            children: /*#__PURE__*/_jsxs("svg", {
              viewBox: `0 0 ${revenueChart.width} ${revenueChart.height}`,
              role: "img",
              "aria-label": "Revenue chart",
              children: [/*#__PURE__*/_jsx("defs", {
                children: /*#__PURE__*/_jsxs("linearGradient", {
                  id: "adminRevenueArea",
                  x1: "0",
                  x2: "0",
                  y1: "0",
                  y2: "1",
                  children: [/*#__PURE__*/_jsx("stop", {
                    offset: "0%",
                    stopColor: "#fb923c",
                    stopOpacity: "0.28"
                  }), /*#__PURE__*/_jsx("stop", {
                    offset: "100%",
                    stopColor: "#fb923c",
                    stopOpacity: "0.03"
                  })]
                })
              }), revenueChart.gridLines.map(line => /*#__PURE__*/_jsxs("g", {
                children: [/*#__PURE__*/_jsx("line", {
                  x1: revenueChart.padding.left,
                  x2: revenueChart.width - revenueChart.padding.right,
                  y1: line.y,
                  y2: line.y
                }), /*#__PURE__*/_jsx("text", {
                  x: "10",
                  y: line.y + 4,
                  children: formatMoney(line.value)
                })]
              }, line.y)), /*#__PURE__*/_jsx("path", {
                className: "admin-dashboard-revenue-area",
                d: revenueChart.areaPath
              }), /*#__PURE__*/_jsx("path", {
                className: "admin-dashboard-revenue-line",
                d: revenueChart.linePath
              }), revenueChart.points.map(point => /*#__PURE__*/_jsx("circle", {
                cx: point.x,
                cy: point.y,
                r: "5"
              }, point.key)), revenueChart.points.map(point => /*#__PURE__*/_jsx("text", {
                className: "admin-dashboard-revenue-date",
                x: point.x,
                y: revenueChart.height - 10,
                children: point.label
              }, `${point.key}-label`))]
            })
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-dashboard-mini-metrics",
          children: [/*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("b", {
              children: ordersNew
            }), " \u0111\u01A1n m\u1EDBi"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("b", {
              children: ordersDoing
            }), " \u0111ang x\u1EED l\xFD"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("b", {
              children: completionCount
            }), " ho\xE0n t\u1EA5t"]
          })]
        })]
      }), /*#__PURE__*/_jsx(AdminPanel, {
        title: "\u0110\u01A1n h\xE0ng theo k\xEAnh",
        description: "Ch\u1EC9 hi\u1EC3n th\u1ECB khi \u0111\u01A1n c\xF3 d\u1EEF li\u1EC7u k\xEAnh/source.",
        className: "admin-dashboard-channel-card",
        children: channels.length ? /*#__PURE__*/_jsx("div", {
          className: "admin-dashboard-channel-list",
          children: channels.map(channel => {
            const percent = channelTotal ? Math.round(channel.count / channelTotal * 100) : 0;
            return /*#__PURE__*/_jsxs("div", {
              className: "admin-dashboard-channel-row",
              children: [/*#__PURE__*/_jsxs("div", {
                children: [/*#__PURE__*/_jsx("strong", {
                  children: channel.name
                }), /*#__PURE__*/_jsxs("span", {
                  children: [channel.count, " \u0111\u01A1n \xB7 ", percent, "%"]
                })]
              }), /*#__PURE__*/_jsx("em", {
                children: /*#__PURE__*/_jsx("i", {
                  style: {
                    width: `${percent}%`
                  }
                })
              })]
            }, channel.name);
          })
        }) : /*#__PURE__*/_jsx("div", {
          className: "admin-dashboard-empty-note",
          children: "Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u k\xEAnh b\xE1n h\xE0ng trong \u0111\u01A1n."
        })
      }), /*#__PURE__*/_jsx(AdminPanel, {
        title: "Top m\xF3n b\xE1n ch\u1EA1y",
        description: "T\xEDnh t\u1EEB m\xF3n trong c\xE1c \u0111\u01A1n hi\u1EC7n c\xF3.",
        className: "admin-dashboard-top-products",
        children: topProducts.length ? /*#__PURE__*/_jsx("div", {
          className: "admin-dashboard-product-list",
          children: topProducts.map((item, index) => /*#__PURE__*/_jsxs("article", {
            className: "admin-dashboard-product-row",
            children: [/*#__PURE__*/_jsx("span", {
              children: item.image ? /*#__PURE__*/_jsx("img", {
                src: item.image,
                alt: ""
              }) : index + 1
            }), /*#__PURE__*/_jsxs("div", {
              children: [/*#__PURE__*/_jsx("strong", {
                children: item.name
              }), /*#__PURE__*/_jsx("em", {
                children: /*#__PURE__*/_jsx("i", {
                  style: {
                    width: `${Math.max(8, item.quantity / topProductMax * 100)}%`
                  }
                })
              })]
            }), /*#__PURE__*/_jsx("small", {
              children: item.quantity
            })]
          }, item.id))
        }) : /*#__PURE__*/_jsx("div", {
          className: "admin-dashboard-empty-note",
          children: "Ch\u01B0a c\xF3 m\xF3n n\xE0o trong \u0111\u01A1n h\xE0ng."
        })
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-bottom-grid",
      children: [/*#__PURE__*/_jsx(AdminPanel, {
        title: "\u0110\u01A1n h\xE0ng g\u1EA7n \u0111\xE2y",
        description: "Danh s\xE1ch compact theo b\u1ED9 l\u1ECDc t\xECm ki\u1EBFm hi\u1EC7n t\u1EA1i.",
        action: /*#__PURE__*/_jsxs(AdminBadge, {
          tone: "neutral",
          children: [filteredRecentOrders.length, " \u0111\u01A1n"]
        }),
        className: "admin-dashboard-recent-card",
        children: filteredRecentOrders.length ? /*#__PURE__*/_jsxs(AdminTable, {
          className: "admin-dashboard-table",
          children: [/*#__PURE__*/_jsxs(AdminTableHead, {
            children: [/*#__PURE__*/_jsx("span", {
              children: "M\xE3 \u0111\u01A1n"
            }), /*#__PURE__*/_jsx("span", {
              children: "Ngu\u1ED3n"
            }), /*#__PURE__*/_jsx("span", {
              children: "Kh\xE1ch"
            }), /*#__PURE__*/_jsx("span", {
              children: "Gi\u1EDD"
            }), /*#__PURE__*/_jsx("span", {
              children: "Chi nh\xE1nh"
            }), /*#__PURE__*/_jsx("span", {
              children: "T\u1ED5ng"
            }), /*#__PURE__*/_jsx("span", {
              children: "Tr\u1EA1ng th\xE1i"
            })]
          }), /*#__PURE__*/_jsx(AdminTableBody, {
            children: filteredRecentOrders.map(order => {
              const status = getOrderStatusMeta(order.status);
              const source = getOrderSourceMeta(order);
              return /*#__PURE__*/_jsxs(AdminTableRow, {
                children: [/*#__PURE__*/_jsx("span", {
                  className: "admin-dashboard-order-code",
                  children: /*#__PURE__*/_jsx("strong", {
                    children: order.orderCode || order.id
                  })
                }), /*#__PURE__*/_jsx(AdminBadge, {
                  tone: source.tone,
                  className: `admin-dashboard-source-badge ${source.className}`,
                  children: source.label
                }), /*#__PURE__*/_jsx("span", {
                  children: order.orderCustomerName || order.customerName || order.phone || "Khách lẻ"
                }), /*#__PURE__*/_jsx("span", {
                  children: formatOrderTime(order.createdAt)
                }), /*#__PURE__*/_jsx("span", {
                  children: getOrderBranch(order)
                }), /*#__PURE__*/_jsx("strong", {
                  children: formatMoney(Number(order.totalAmount || 0))
                }), /*#__PURE__*/_jsx(AdminBadge, {
                  tone: status.tone,
                  children: status.label
                })]
              }, order.id || order.orderCode);
            })
          })]
        }) : /*#__PURE__*/_jsx("div", {
          className: "admin-order-empty",
          children: /*#__PURE__*/_jsx("strong", {
            children: "Kh\xF4ng t\xECm th\u1EA5y \u0111\u01A1n ph\xF9 h\u1EE3p."
          })
        })
      }), /*#__PURE__*/_jsxs(AdminPanel, {
        title: "L\u1ED1i t\u1EAFt thao t\xE1c",
        description: "C\xE1c khu v\u1EF1c v\u1EADn h\xE0nh th\u01B0\u1EDDng d\xF9ng.",
        className: "admin-dashboard-actions-card",
        children: [/*#__PURE__*/_jsx("div", {
          className: "admin-dashboard-actions",
          children: dashboardQuickActions.map(item => /*#__PURE__*/_jsx(AdminButton, {
            variant: "secondary",
            onClick: () => openAdminNav(flatAdminNav.find(navItem => navItem.id === item.id)),
            children: item.label
          }, item.id))
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-dashboard-ops-summary",
          children: [/*#__PURE__*/_jsxs("span", {
            children: ["M\xF3n \u0111ang b\xE1n ", /*#__PURE__*/_jsx("b", {
              children: activeProducts
            })]
          }), /*#__PURE__*/_jsxs("span", {
            children: ["Topping ", /*#__PURE__*/_jsx("b", {
              children: toppingsCount
            })]
          }), /*#__PURE__*/_jsxs("span", {
            children: ["Chi nh\xE1nh m\u1EDF ", /*#__PURE__*/_jsxs("b", {
              children: [openBranches, "/", totalBranches]
            })]
          })]
        })]
      })]
    })]
  });
}