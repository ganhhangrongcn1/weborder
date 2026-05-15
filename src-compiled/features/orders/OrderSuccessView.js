import { useEffect, useState } from "react";
import Icon from "../../components/Icon.js";
import { loadZaloConfigAsync, renderZaloTemplate, buildZaloLink } from "../../services/zaloService.js";
import { formatMoney } from "../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
function buildOrderItemsText(orderItems) {
  return orderItems.map((item, index) => {
    const options = [item.spice, ...(item.toppings || []).map(topping => topping.name + (topping.quantity ? ` x${topping.quantity}` : ""))].filter(Boolean).join(", ");
    return `${index + 1}. ${item.name} x${item.quantity}${options ? ` (${options})` : ""} - ${formatMoney(item.lineTotal || 0)}`;
  }).join("\n");
}
function buildOrderLink(orderCode) {
  const code = String(orderCode || "").trim();
  if (!code) return "";
  const path = `/orders?orderCode=${encodeURIComponent(code)}`;
  if (typeof window === "undefined" || !window.location?.origin) return path;
  return `${window.location.origin}${path}`;
}
export default function OrderSuccess({
  navigate,
  order,
  branchPhone,
  orderStatus,
  confirmCurrentOrder
}) {
  const [hasOpenedZalo, setHasOpenedZalo] = useState(false);
  const [zaloConfig, setZaloConfig] = useState({
    phone: "",
    template: ""
  });
  const [isZaloConfigLoading, setIsZaloConfigLoading] = useState(true);
  const [copyPopup, setCopyPopup] = useState({
    open: false,
    title: "",
    message: "",
    tone: "success"
  });
  const effectiveStatus = String(order?.status || orderStatus || "").toLowerCase();
  const isConfirmed = Boolean(order?.zaloSentAt) || ["confirmed", "preparing", "cooking", "delivering", "done", "completed"].includes(effectiveStatus);
  const rawZaloPhone = String(branchPhone || "0788422424").replace(/\D/g, "") || "0788422424";
  const isPickup = order?.fulfillmentType === "pickup";
  const mapLink = order?.lat && order?.lng ? `https://www.google.com/maps?q=${order.lat},${order.lng}` : order?.deliveryAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}` : "";
  const orderItems = order?.items?.length ? order.items : [];
  const subtotalValue = Number(order?.subtotal || orderItems.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0));
  const shippingFeeValue = Number(order?.shippingFee || order?.deliveryFee || 0);
  const totalValue = Number(order?.totalAmount || order?.total || 0);
  const orderCode = order?.orderCode || "GHR-1028";
  const orderLink = buildOrderLink(orderCode);
  const zaloTemplate = String(zaloConfig.template || "");
  const templateWithOrderLink = zaloTemplate.includes("{{order_link}}") ? zaloTemplate : `${zaloTemplate}\n🔎 Xem lại đơn hàng: {{order_link}}`;
  const orderMessage = renderZaloTemplate(templateWithOrderLink, {
    customer_name: order?.customerName || "Khách",
    phone: order?.customerPhone || order?.phone || "",
    items: buildOrderItemsText(orderItems),
    total: formatMoney(totalValue),
    subtotal: formatMoney(subtotalValue),
    shipping_fee: isPickup ? "Không tính phí giao hàng" : formatMoney(shippingFeeValue),
    order_code: orderCode,
    order_time: order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN"),
    fulfillment_type: isPickup ? "Đến lấy" : "Giao tận nơi",
    pickup_branch: [order?.pickupBranchName || order?.branchName || "", order?.pickupBranchAddress || order?.branchAddress || ""].filter(Boolean).join(" - "),
    delivery_branch: [order?.deliveryBranchName || "", order?.deliveryBranchAddress || ""].filter(Boolean).join(" - "),
    payment_method: order?.paymentMethod || "COD",
    map_link: mapLink || "",
    distance_km: !isPickup && order?.distanceKm ? `${Number(order.distanceKm).toFixed(1)}km` : "",
    address: isPickup ? order?.branchAddress || order?.branchName || "" : order?.deliveryAddress || "",
    note: order?.note || "",
    order_link: orderLink
  });
  const effectiveZaloPhone = String(zaloConfig.phone || "").replace(/\D/g, "");
  const canOpenZalo = Boolean(effectiveZaloPhone) && !isZaloConfigLoading;
  const zaloUrl = canOpenZalo ? buildZaloLink(effectiveZaloPhone, orderMessage) : "#";
  useEffect(() => {
    let disposed = false;
    setIsZaloConfigLoading(true);
    loadZaloConfigAsync(rawZaloPhone).then(nextConfig => {
      if (disposed) return;
      setZaloConfig(nextConfig || {
        phone: rawZaloPhone,
        template: ""
      });
    }).catch(() => {
      if (disposed) return;
      setZaloConfig({
        phone: rawZaloPhone,
        template: ""
      });
    }).finally(() => {
      if (!disposed) setIsZaloConfigLoading(false);
    });
    return () => {
      disposed = true;
    };
  }, [rawZaloPhone]);
  useEffect(() => {
    if (isConfirmed || hasOpenedZalo) return undefined;
    const handleBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasOpenedZalo, isConfirmed]);
  async function copyOrderText(showAlert = false) {
    try {
      await navigator.clipboard.writeText(orderMessage);
      if (showAlert) {
        setCopyPopup({
          open: true,
          title: "Đã copy nội dung đơn",
          message: "Bạn mở Zalo, chạm vào ô chat của quán rồi chọn Dán và Gửi.",
          tone: "success"
        });
      }
    } catch {
      if (showAlert) {
        setCopyPopup({
          open: true,
          title: "Không thể copy tự động",
          message: "Bạn thử lại lần nữa hoặc copy thủ công từ màn hình đơn hàng.",
          tone: "error"
        });
      }
    }
  }
  async function copyOrderForZalo() {
    if (!canOpenZalo) return;
    await copyOrderText(false);
    confirmCurrentOrder();
  }
  function reopenZalo() {
    if (!canOpenZalo) return;
    setHasOpenedZalo(true);
    copyOrderText(false);
  }
  function markZaloSent() {
    confirmCurrentOrder();
  }
  return /*#__PURE__*/_jsxs("section", {
    className: "grid min-h-[calc(100vh-96px)] place-items-center px-4",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "w-full rounded-[30px] bg-success p-7 text-center shadow-soft",
      children: [/*#__PURE__*/_jsx("div", {
        className: `mx-auto grid h-24 w-24 place-items-center rounded-[28px] text-3xl font-black ${isConfirmed ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`,
        children: isConfirmed ? "OK" : "..."
      }), /*#__PURE__*/_jsx("h1", {
        className: `mt-6 text-2xl font-black ${isConfirmed ? "text-green-700" : "text-orange-700"}`,
        children: isConfirmed ? "Đơn hàng đã được gửi xác nhận" : "Còn 1 Bước Nữa Để Quán Nhận Đơn"
      }), /*#__PURE__*/_jsx("p", {
        className: "mt-2 text-sm font-bold text-brown/70",
        children: isConfirmed ? "Quán đã nhận thông tin đơn của bạn qua Zalo. Bạn có thể theo dõi trạng thái đơn ngay bên dưới." : "Đơn đang chờ xác nhận từ bạn"
      }), /*#__PURE__*/_jsxs("div", {
        className: "mt-6 rounded-[24px] bg-white p-5 shadow-soft",
        children: [/*#__PURE__*/_jsx("p", {
          className: "text-xs font-bold uppercase text-brown/40",
          children: "M\xE3 \u0111\u01A1n h\xE0ng"
        }), /*#__PURE__*/_jsx("strong", {
          className: "mt-2 block text-3xl font-black",
          children: order?.orderCode || "GHR-1028"
        }), /*#__PURE__*/_jsxs("p", {
          className: "mt-4 text-sm font-semibold text-brown/65",
          children: ["Th\u1EDDi gian \u0111\u1EB7t", /*#__PURE__*/_jsx("br", {}), order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: `mt-4 rounded-[24px] border bg-white/90 p-4 text-left shadow-soft ${isConfirmed ? "border-green-200" : "border-orange-200"}`,
        children: [!isConfirmed && /*#__PURE__*/_jsxs("div", {
          className: "mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3",
          children: [/*#__PURE__*/_jsx("p", {
            className: "text-sm font-black text-orange-700",
            children: "H\u01B0\u1EDBng d\u1EABn g\u1EEDi \u0111\u01A1n"
          }), /*#__PURE__*/_jsxs("div", {
            className: "mt-3 grid gap-2",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2 rounded-xl bg-white px-3 py-2",
              children: [/*#__PURE__*/_jsx("span", {
                className: "grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700",
                children: "1"
              }), /*#__PURE__*/_jsxs("p", {
                className: "text-sm font-semibold text-brown/80",
                children: ["B\u1EA5m n\xFAt ", /*#__PURE__*/_jsx("strong", {
                  children: "G\u1EECI X\xC1C NH\u1EACN \u0110\u01A0N"
                }), " b\xEAn d\u01B0\u1EDBi."]
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2 rounded-xl bg-white px-3 py-2",
              children: [/*#__PURE__*/_jsx("span", {
                className: "grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700",
                children: "2"
              }), /*#__PURE__*/_jsx("p", {
                className: "text-sm font-semibold text-brown/80",
                children: "Khi Zalo m\u1EDF ra, ch\u1EA1m v\xE0o \xF4 chat c\u1EE7a qu\xE1n."
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2 rounded-xl bg-white px-3 py-2",
              children: [/*#__PURE__*/_jsx("span", {
                className: "grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700",
                children: "3"
              }), /*#__PURE__*/_jsxs("p", {
                className: "text-sm font-semibold text-brown/80",
                children: ["Ch\u1ECDn ", /*#__PURE__*/_jsx("strong", {
                  children: "D\xE1n"
                }), " r\u1ED3i b\u1EA5m ", /*#__PURE__*/_jsx("strong", {
                  children: "G\u1EEDi"
                }), " l\xE0 xong."]
              })]
            })]
          })]
        }), isConfirmed ? /*#__PURE__*/_jsxs("div", {
          className: "mt-3 grid grid-cols-2 gap-2",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => copyOrderText(true),
            className: "rounded-2xl bg-green-50 px-3 py-3 text-xs font-black text-green-700",
            children: "Copy l\u1EA1i n\u1ED9i dung \u0111\u01A1n"
          }), /*#__PURE__*/_jsx("a", {
            href: zaloUrl,
            target: "_blank",
            rel: "noreferrer",
            onClick: reopenZalo,
            className: "rounded-2xl bg-orange-50 px-3 py-3 text-center text-xs font-black text-orange-600",
            children: "M\u1EDF l\u1EA1i Zalo"
          })]
        }) : /*#__PURE__*/_jsx("div", {
          className: "mt-3 grid gap-2",
          children: hasOpenedZalo ? /*#__PURE__*/_jsxs(_Fragment, {
            children: [/*#__PURE__*/_jsx("button", {
              onClick: markZaloSent,
              className: "w-full rounded-2xl border border-green-200 bg-green-50 px-3 py-3 text-xs font-black text-green-700",
              children: "T\xF4i \u0111\xE3 g\u1EEDi Zalo r\u1ED3i"
            }), /*#__PURE__*/_jsx("button", {
              onClick: () => copyOrderText(true),
              className: "w-full rounded-2xl border border-orange-100 bg-orange-50 px-3 py-3 text-xs font-black text-orange-600",
              children: "Copy l\u1EA1i n\u1ED9i dung \u0111\u01A1n"
            })]
          }) : null
        })]
      }), !isConfirmed && (canOpenZalo ? /*#__PURE__*/_jsx("a", {
        href: zaloUrl,
        target: "_blank",
        rel: "noreferrer",
        onClick: copyOrderForZalo,
        className: "mt-5 block w-full rounded-2xl bg-gradient-main py-4 text-center text-sm font-black uppercase tracking-wide text-white shadow-orange",
        children: "G\u1EECI X\xC1C NH\u1EACN \u0110\u01A0N"
      }) : /*#__PURE__*/_jsx("button", {
        type: "button",
        disabled: true,
        className: "mt-5 block w-full cursor-wait rounded-2xl bg-brown/30 py-4 text-center text-sm font-black uppercase text-white shadow-orange",
        children: isZaloConfigLoading ? "Đang lấy số Zalo..." : "Chưa có số Zalo quán"
      })), isConfirmed && /*#__PURE__*/_jsxs(_Fragment, {
        children: [/*#__PURE__*/_jsx("button", {
          onClick: () => navigate("tracking", "orders"),
          className: "mt-6 w-full rounded-2xl bg-green-600 py-4 text-sm font-black uppercase text-white",
          children: "Theo d\xF5i \u0111\u01A1n h\xE0ng"
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => navigate("menu", "menu"),
          className: "mt-3 w-full rounded-2xl border border-brown/20 bg-white py-4 text-sm font-black uppercase text-brown",
          children: "Mua l\u1EA1i \u0111\u01A1n n\xE0y"
        })]
      })]
    }), copyPopup.open && /*#__PURE__*/_jsx("div", {
      className: "fixed inset-0 z-[200] grid place-items-center bg-black/35 px-4",
      children: /*#__PURE__*/_jsxs("div", {
        className: "w-full max-w-[360px] rounded-[24px] bg-white p-5 shadow-soft",
        children: [/*#__PURE__*/_jsx("div", {
          className: `grid h-12 w-12 place-items-center rounded-2xl ${copyPopup.tone === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`,
          children: /*#__PURE__*/_jsx(Icon, {
            name: copyPopup.tone === "error" ? "x" : "check",
            size: 20
          })
        }), /*#__PURE__*/_jsx("h3", {
          className: "mt-3 text-lg font-black text-brown",
          children: copyPopup.title
        }), /*#__PURE__*/_jsx("p", {
          className: "mt-2 text-sm font-semibold leading-6 text-brown/75",
          children: copyPopup.message
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          onClick: () => setCopyPopup({
            open: false,
            title: "",
            message: "",
            tone: "success"
          }),
          className: "mt-5 w-full rounded-2xl bg-gradient-main py-3 text-sm font-black uppercase text-white",
          children: "\u0110\xE3 hi\u1EC3u"
        })]
      })
    })]
  });
}