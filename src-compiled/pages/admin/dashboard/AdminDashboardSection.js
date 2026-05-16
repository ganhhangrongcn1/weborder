import { formatMoney } from "../../../utils/format.js";
import Icon from "../../../components/Icon.js";
import { getSettlement } from "../orders/orderManager.utils.js";
import { AdminBadge, AdminInput, AdminPanel, AdminSelect, AdminStatCard, AdminTable, AdminTableBody, AdminTableHead, AdminTableRow } from "../ui/index.js";
import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
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
  const dayMap = new Map();
  orders.forEach(order => {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const key = getDateKey(createdAt);
    if (!dayMap.has(key)) {
      dayMap.set(key, {
        key,
        label: formatChartDate(createdAt),
        value: 0,
        date: new Date(createdAt)
      });
    }
    const totalAmount = Number(order.totalAmount || order.total || 0);
    const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
    dayMap.get(key).value += Math.max(totalAmount - shippingFee, 0);
  });
  return [...dayMap.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).map(item => ({
    key: item.key,
    label: item.label,
    value: item.value
  }));
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
  const safeSeries = series.length ? series : [{
    key: "empty",
    label: "--",
    value: 0
  }];
  const width = 680;
  const height = 250;
  const padding = {
    top: 24,
    right: 22,
    bottom: 38,
    left: 48
  };
  const maxValue = Math.max(...safeSeries.map(item => item.value), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const step = safeSeries.length > 1 ? plotWidth / (safeSeries.length - 1) : plotWidth;
  const points = safeSeries.map((item, index) => ({
    ...item,
    x: padding.left + index * step,
    y: padding.top + (1 - item.value / maxValue) * plotHeight
  }));
  const linePath = buildSmoothRevenuePath(points);
  const areaPath = points.length ? `M ${points[0].x} ${height - padding.bottom} L ${points[0].x} ${points[0].y} ${linePath.replace(/^M\s+[\d.-]+\s+[\d.-]+/, "")} L ${points[points.length - 1].x} ${height - padding.bottom} Z` : "";
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: padding.top + ratio * plotHeight,
    value: Math.round(maxValue * (1 - ratio))
  }));
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
  dashboardDateFrom,
  setDashboardDateFrom,
  dashboardDateTo,
  setDashboardDateTo,
  dashboardDatePreset,
  setDashboardDatePreset,
  openBranches,
  totalBranches,
  ordersTotal,
  ordersNew,
  ordersDoing,
  todayRevenue,
  totalCustomers,
  filteredRecentOrders,
  ordersSnapshot = [],
  chartOrdersSnapshot = [],
  dashboardChartPreset,
  setDashboardChartPreset
}) {
  const topProducts = buildTopProducts(ordersSnapshot);
  const topProductMax = Math.max(...topProducts.map(item => item.quantity), 1);
  const channels = buildChannels(ordersSnapshot);
  const channelTotal = channels.reduce((sum, channel) => sum + channel.count, 0);
  const averageOrder = ordersTotal ? Math.round(todayRevenue / ordersTotal) : 0;
  const completionCount = ordersSnapshot.filter(order => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const completionRate = ordersTotal ? Math.round(completionCount / ordersTotal * 100) : 0;
  const chartOrdersTotal = chartOrdersSnapshot.length;
  const chartRevenueTotal = chartOrdersSnapshot.reduce((sum, order) => {
    const totalAmount = Number(order.totalAmount || order.total || 0);
    const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
    return sum + Math.max(totalAmount - shippingFee, 0);
  }, 0);
  const chartAverageOrder = chartOrdersTotal ? Math.round(chartRevenueTotal / chartOrdersTotal) : 0;
  const chartCompletionCount = chartOrdersSnapshot.filter(order => ["done", "completed"].includes(String(order.status || "").toLowerCase())).length;
  const chartOrdersNew = chartOrdersSnapshot.filter(order => String(order.status || "").toLowerCase() === "pending_zalo").length;
  const chartOrdersDoing = chartOrdersSnapshot.filter(order => {
    const status = String(order.status || "").toLowerCase();
    return status === "confirmed" || status === "delivering";
  }).length;
  const revenueSeries = buildRevenueSeries(chartOrdersSnapshot);
  const revenueChart = buildRevenueChart(revenueSeries);
  const todayText = new Date().toISOString().slice(0, 10);
  const applyPreset = preset => {
    const now = new Date();
    const toDateText = date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    if (preset === "today") {
      const today = toDateText(now);
      setDashboardDateFrom(today);
      setDashboardDateTo(today);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const text = toDateText(yesterday);
      setDashboardDateFrom(text);
      setDashboardDateTo(text);
    }
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      setDashboardDateFrom(toDateText(monday));
      setDashboardDateTo(toDateText(now));
    }
    if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDashboardDateFrom(toDateText(firstDay));
      setDashboardDateTo(toDateText(now));
    }
    setDashboardDatePreset(preset);
  };
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-dashboard-page",
    children: [/*#__PURE__*/_jsx("section", {
      className: "admin-dashboard-hero",
      children: /*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsxs(AdminBadge, {
          tone: "warning",
          children: ["Chi nh\xE1nh m\u1EDF: ", openBranches, "/", totalBranches]
        }), /*#__PURE__*/_jsx("h2", {
          children: "Ch\xE0o m\u1EEBng quay tr\u1EDF l\u1EA1i!"
        }), /*#__PURE__*/_jsx("p", {
          children: "T\u1ED5ng quan ho\u1EA1t \u0111\u1ED9ng kinh doanh v\xE0 v\u1EADn h\xE0nh \u0111\u01A1n h\xE0ng h\xF4m nay."
        })]
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-toolbar",
      children: [/*#__PURE__*/_jsxs("label", {
        className: "admin-dashboard-search",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\u2315"
        }), /*#__PURE__*/_jsx(AdminInput, {
          value: dashboardSearch,
          onChange: event => setDashboardSearch(event.target.value),
          placeholder: "T\xECm m\xE3 \u0111\u01A1n, t\xEAn kh\xE1ch, s\u1ED1 \u0111i\u1EC7n tho\u1EA1i..."
        })]
      }), /*#__PURE__*/_jsxs("label", {
        className: "admin-dashboard-search admin-dashboard-preset",
        children: [/*#__PURE__*/_jsx("span", {
          children: "\uD83D\uDDC2"
        }), /*#__PURE__*/_jsx(AdminSelect, {
          value: dashboardDatePreset || "today",
          onChange: event => {
            const nextPreset = event.target.value;
            if (nextPreset === "custom") {
              setDashboardDatePreset("custom");
              return;
            }
            applyPreset(nextPreset);
          },
          options: [{
            value: "today",
            label: "Hôm nay"
          }, {
            value: "yesterday",
            label: "Hôm qua"
          }, {
            value: "week",
            label: "Tuần này"
          }, {
            value: "month",
            label: "Tháng này"
          }, {
            value: "custom",
            label: "Tùy chỉnh..."
          }]
        })]
      }), dashboardDatePreset === "custom" ? /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsxs("label", {
          className: "admin-dashboard-search",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\uD83D\uDCC5"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "date",
            value: dashboardDateFrom || "",
            max: dashboardDateTo || todayText,
            onChange: event => {
              setDashboardDateFrom(event.target.value);
              setDashboardDatePreset("custom");
            },
            placeholder: "T\u1EEB ng\xE0y"
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "admin-dashboard-search",
          children: [/*#__PURE__*/_jsx("span", {
            children: "\uD83D\uDCC5"
          }), /*#__PURE__*/_jsx(AdminInput, {
            type: "date",
            value: dashboardDateTo || "",
            min: dashboardDateFrom || "",
            max: todayText,
            onChange: event => {
              setDashboardDateTo(event.target.value);
              setDashboardDatePreset("custom");
            },
            placeholder: "\u0110\u1EBFn ng\xE0y"
          })]
        })]
      }) : null]
    }), /*#__PURE__*/_jsxs("div", {
      className: "admin-dashboard-stat-grid",
      children: [/*#__PURE__*/_jsx(AdminStatCard, {
        title: "Doanh thu th\u1EF1c nh\u1EADn",
        value: formatMoney(todayRevenue),
        subtitle: "\u0110\xE3 lo\u1EA1i ph\xED ship",
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
        title: "Doanh thu th\u1EF1c nh\u1EADn",
        description: "T\u1ED5ng ti\u1EC1n m\xF3n \u0111\xE3 thu, kh\xF4ng t\xEDnh ph\xED ship.",
        className: "admin-dashboard-revenue-card",
        action: /*#__PURE__*/_jsx(AdminSelect, {
          value: dashboardChartPreset || "7d",
          onChange: event => setDashboardChartPreset(event.target.value),
          options: [{
            value: "7d",
            label: "7 ngày gần nhất"
          }, {
            value: "month",
            label: "Tháng này"
          }, {
            value: "30d",
            label: "30 ngày gần nhất"
          }]
        }),
        children: [/*#__PURE__*/_jsxs("div", {
          className: "admin-dashboard-revenue-visual",
          children: [/*#__PURE__*/_jsx("strong", {
            children: formatMoney(chartRevenueTotal)
          }), /*#__PURE__*/_jsxs("span", {
            children: [chartOrdersTotal, " \u0111\u01A1n \xB7 ", formatMoney(chartAverageOrder), " / \u0111\u01A1n"]
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
              children: chartOrdersNew
            }), " \u0111\u01A1n m\u1EDBi"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("b", {
              children: chartOrdersDoing
            }), " \u0111ang x\u1EED l\xFD"]
          }), /*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("b", {
              children: chartCompletionCount
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
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-dashboard-bottom-grid",
      children: /*#__PURE__*/_jsx(AdminPanel, {
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
              children: "Doanh thu th\u1EF1c nh\u1EADn"
            }), /*#__PURE__*/_jsx("span", {
              children: "Tr\u1EA1ng th\xE1i"
            })]
          }), /*#__PURE__*/_jsx(AdminTableBody, {
            children: filteredRecentOrders.map(order => {
              const status = getOrderStatusMeta(order.status);
              const source = getOrderSourceMeta(order);
              const settlement = getSettlement(order);
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
                  children: formatMoney(Number(settlement?.netRevenue || 0))
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
      })
    })]
  });
}