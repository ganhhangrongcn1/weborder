import { useEffect, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { CustomerButton, CustomerCard, CustomerLoadingState, CustomerModalFrame } from "../../components/customer/CustomerUI.jsx";
import { loadZaloConfigAsync, renderZaloTemplate, buildZaloLink } from "../../services/zaloService.js";
import { formatMoney } from "../../utils/format.js";
import { getOrderItemOptionLabels } from "../../utils/orderItemDisplay.js";
import { getTodayInputDate, parsePickupTimeText } from "../../utils/dateTimeDefaults.js";

const SUCCESS_PREPARING_MS = 2000;

function buildOrderItemsText(orderItems) {
  return orderItems.map((item, index) => {
    const options = getOrderItemOptionLabels(item, { includeQuantity: true, includeNote: false }).join(", ");

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

function placeOrderLinkFirst(template) {
  const lines = String(template || "").split("\n");
  const orderLinkIndex = lines.findIndex((line) => line.includes("{{order_link}}"));
  const orderLinkLine = orderLinkIndex >= 0 ? lines[orderLinkIndex] : "\uD83D\uDD0E Xem l\u1EA1i \u0111\u01A1n h\u00E0ng: {{order_link}}";
  const remainingLines = orderLinkIndex >= 0
    ? lines.filter((_, index) => index !== orderLinkIndex)
    : lines;
  const cleanedRemainingLines = remainingLines[0] === "" ? remainingLines.slice(1) : remainingLines;
  return [orderLinkLine, "", ...cleanedRemainingLines].join("\n");
}

function formatPickupTimeForZalo(value = "") {
  const pickup = parsePickupTimeText(value);
  if (!pickup.scheduled) return String(value || "").trim();
  return pickup.date === getTodayInputDate() ? `${pickup.clock} hôm nay` : `${pickup.clock} - ${pickup.date}`;
}

export default function OrderSuccess({
  navigate,
  order,
  branchPhone,
  orderStatus,
  confirmCurrentOrder
}) {
  const [hasOpenedZalo, setHasOpenedZalo] = useState(false);
  const [zaloConfig, setZaloConfig] = useState({ phone: "", template: "" });
  const [isZaloConfigLoading, setIsZaloConfigLoading] = useState(true);
  const [isPreparingSuccess, setIsPreparingSuccess] = useState(true);
  const [copyPopup, setCopyPopup] = useState({ open: false, title: "", message: "", tone: "success" });
  const [isLocallyConfirmed, setIsLocallyConfirmed] = useState(false);

  const effectiveStatus = String(order?.status || orderStatus || "").toLowerCase();
  const isConfirmed = isLocallyConfirmed || Boolean(order?.zaloSentAt) || ["confirmed", "preparing", "cooking", "ready_for_pickup", "ready_for_delivery", "delivering", "done", "completed"].includes(effectiveStatus);
  const rawZaloPhone = String(branchPhone || "0788422424").replace(/\D/g, "") || "0788422424";
  const isPickup = order?.fulfillmentType === "pickup";

  const mapLink = order?.lat && order?.lng
    ? `https://www.google.com/maps?q=${order.lat},${order.lng}`
    : order?.deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`
      : "";

  const orderItems = order?.items?.length ? order.items : [];
  const subtotalValue = Number(order?.subtotal || orderItems.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0));
  const shippingFeeValue = Number(order?.shippingFee || order?.deliveryFee || 0);
  const totalValue = Number(order?.totalAmount || order?.total || 0);
  const orderCode = order?.orderCode || "GHR-1028";
  const orderLink = buildOrderLink(orderCode);
  const zaloTemplate = String(zaloConfig.template || "");
  const templateWithOrderLink = placeOrderLinkFirst(zaloTemplate);

  const orderMessage = renderZaloTemplate(templateWithOrderLink, {
    customer_name: order?.customerName || "Khách",
    phone: order?.customerPhone || order?.phone || "",
    items: buildOrderItemsText(orderItems),
    total: formatMoney(totalValue),
    subtotal: formatMoney(subtotalValue),
    shipping_fee: isPickup ? "Không tính phí giao hàng" : formatMoney(shippingFeeValue),
    order_code: orderCode,
    order_time: order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN"),
    pickup_time: isPickup ? formatPickupTimeForZalo(order?.pickupTimeText) : "",
    fulfillment_type: isPickup ? "Đến lấy" : "Giao tận nơi",
    pickup_branch: [order?.pickupBranchName || order?.branchName || "", order?.pickupBranchAddress || order?.branchAddress || ""].filter(Boolean).join(" - "),
    delivery_branch: [order?.deliveryBranchName || "", order?.deliveryBranchAddress || ""].filter(Boolean).join(" - "),
    payment_method: order?.paymentMethod || "COD",
    map_link: isPickup ? "" : mapLink || "",
    distance_km: !isPickup && order?.distanceKm ? `${Number(order.distanceKm).toFixed(1)}km` : "",
    address: isPickup ? order?.branchAddress || order?.branchName || "" : order?.deliveryAddress || "",
    note: order?.note || "",
    order_link: orderLink
  });

  const effectiveZaloPhone = String(zaloConfig.phone || "").replace(/\D/g, "");
  const canOpenZalo = Boolean(effectiveZaloPhone) && !isZaloConfigLoading;
  const zaloUrl = canOpenZalo ? buildZaloLink(effectiveZaloPhone, orderMessage) : "#";

  useEffect(() => {
    setIsPreparingSuccess(true);
    const timer = setTimeout(() => {
      setIsPreparingSuccess(false);
    }, SUCCESS_PREPARING_MS);

    return () => clearTimeout(timer);
  }, [order?.id, order?.orderCode]);

  useEffect(() => {
    let disposed = false;
    setIsZaloConfigLoading(true);
    loadZaloConfigAsync(rawZaloPhone)
      .then((nextConfig) => {
        if (disposed) return;
        setZaloConfig(nextConfig || { phone: rawZaloPhone, template: "" });
      })
      .catch(() => {
        if (disposed) return;
        setZaloConfig({ phone: rawZaloPhone, template: "" });
      })
      .finally(() => {
        if (!disposed) setIsZaloConfigLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [rawZaloPhone]);

  useEffect(() => {
    if (isConfirmed || hasOpenedZalo) return undefined;
    const handleBeforeUnload = (event) => {
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
    setHasOpenedZalo(true);
    await copyOrderText(false);
    confirmCurrentOrder();
    setIsLocallyConfirmed(true);
  }

  function reopenZalo() {
    if (!canOpenZalo) return;
    setHasOpenedZalo(true);
    copyOrderText(false);
  }

  function markZaloSent() {
    confirmCurrentOrder();
    setIsLocallyConfirmed(true);
    navigate("tracking", "orders");
  }

  if (isPreparingSuccess) {
    return (
      <section className="order-success-page grid min-h-[calc(100vh-96px)] place-items-center px-4 py-6">
        <CustomerLoadingState
          title="Quán đang chờ xác nhận"
          message="Bạn vui lòng gửi thông tin đơn đã được copy sẵn cho quán để bắt đầu chuẩn bị đơn."
        />
      </section>
    );
  }

  return (
    <section className="order-success-page grid min-h-[calc(100vh-96px)] place-items-center px-4 py-6">
      <CustomerCard tone={isConfirmed ? "success" : "notice"} padding="lg" className="text-center">
        <div className={`mx-auto grid h-20 w-20 place-items-center rounded-[24px] text-xl font-black ${isConfirmed ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
          {isConfirmed ? "OK" : "..."}
        </div>

        <h1 className={`mt-5 text-2xl font-black leading-tight ${isConfirmed ? "text-green-700" : "text-orange-700"}`}>
          {isConfirmed ? "Đơn hàng đã được gửi xác nhận" : "Còn 1 bước nữa để quán nhận đơn"}
        </h1>
        <p className="mt-2 text-sm font-bold leading-6 text-brown/70">
          {isConfirmed
            ? "Quán đã nhận thông tin đơn của bạn qua Zalo. Bạn có thể theo dõi trạng thái đơn ngay bên dưới."
            : "Đơn đang chờ xác nhận từ bạn."}
        </p>

        <CustomerCard className="mt-6 text-center" padding="md">
          <p className="customer-caption uppercase">Mã đơn hàng</p>
          <strong className="mt-2 block text-3xl font-black text-brown">{orderCode}</strong>
          <p className="mt-4 text-sm font-semibold text-brown/65">
            Thời gian đặt<br />
            {order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")}
          </p>
        </CustomerCard>

        <CustomerCard className={`mt-4 text-left ${isConfirmed ? "border-green-200" : "border-orange-200"}`} padding="md">
          {!isConfirmed && (
            <CustomerCard tone="notice" padding="sm" className="mb-4">
              <p className="text-sm font-black text-orange-700">Hướng dẫn gửi đơn</p>
              <div className="mt-3 grid gap-2">
                {[
                  "Bấm nút GỬI XÁC NHẬN ĐƠN bên dưới.",
                  "Khi Zalo mở ra, chạm vào ô chat của quán.",
                  "Chọn Dán rồi bấm Gửi là xong."
                ].map((text, index) => (
                  <div key={text} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">{index + 1}</span>
                    <p className="text-sm font-semibold text-brown/80">{text}</p>
                  </div>
                ))}
              </div>
            </CustomerCard>
          )}

          {isConfirmed ? (
            <div className="order-success-actions mt-1 grid grid-cols-2 gap-2">
              <CustomerButton variant="soft" size="sm" onClick={() => copyOrderText(true)}>
                Copy lại nội dung đơn
              </CustomerButton>
              <CustomerButton as="a" variant="soft" size="sm" href={zaloUrl} target="_blank" rel="noreferrer" onClick={reopenZalo}>
                Mở lại Zalo
              </CustomerButton>
            </div>
          ) : (
            <div className="mt-1 grid gap-2">
              {hasOpenedZalo ? (
                <>
                  <CustomerButton variant="secondary" full onClick={markZaloSent}>
                    Tôi đã gửi Zalo rồi
                  </CustomerButton>
                  <CustomerButton variant="soft" full onClick={() => copyOrderText(true)}>
                    Copy lại nội dung đơn
                  </CustomerButton>
                </>
              ) : null}
            </div>
          )}
        </CustomerCard>

        {!isConfirmed && (
          canOpenZalo ? (
            <CustomerButton
              as="a"
              href={zaloUrl}
              target="_blank"
              rel="noreferrer"
              onClick={copyOrderForZalo}
              full
              size="lg"
              className="mt-5 uppercase"
            >
              Gửi xác nhận đơn
            </CustomerButton>
          ) : (
            <CustomerButton full size="lg" className="mt-5 cursor-wait" disabled>
              {isZaloConfigLoading ? "Đang lấy số Zalo..." : "Chưa có số Zalo quán"}
            </CustomerButton>
          )
        )}

        {isConfirmed && (
          <>
            <CustomerButton full size="lg" variant="primary" className="mt-6" onClick={() => navigate("tracking", "orders")}>
              Theo dõi đơn hàng
            </CustomerButton>
            <CustomerButton full variant="secondary" className="mt-3" onClick={() => navigate("menu", "menu")}>
              Mua lại đơn này
            </CustomerButton>
          </>
        )}
      </CustomerCard>

      {copyPopup.open && (
        <CustomerModalFrame onBackdropClick={() => setCopyPopup({ open: false, title: "", message: "", tone: "success" })}>
          <div className={`grid h-12 w-12 place-items-center rounded-2xl ${copyPopup.tone === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            <Icon name={copyPopup.tone === "error" ? "x" : "check"} size={20} />
          </div>
          <h3 className="mt-3 customer-title-md">{copyPopup.title}</h3>
          <p className="mt-2 customer-body">{copyPopup.message}</p>
          <CustomerButton
            full
            className="mt-5"
            onClick={() => setCopyPopup({ open: false, title: "", message: "", tone: "success" })}
          >
            Đã hiểu
          </CustomerButton>
        </CustomerModalFrame>
      )}

    </section>
  );
}
