import { useEffect, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { loadZaloConfigAsync, renderZaloTemplate, buildZaloLink } from "../../services/zaloService.js";
import { formatMoney } from "../../utils/format.js";

function buildOrderItemsText(orderItems) {
  return orderItems.map((item, index) => {
    const options = [
      item.spice,
      ...(item.toppings || []).map((topping) => topping.name + (topping.quantity ? ` x${topping.quantity}` : ""))
    ].filter(Boolean).join(", ");

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
  const [zaloConfig, setZaloConfig] = useState({ phone: "", template: "" });
  const [isZaloConfigLoading, setIsZaloConfigLoading] = useState(true);
  const [copyPopup, setCopyPopup] = useState({ open: false, title: "", message: "", tone: "success" });

  const effectiveStatus = String(order?.status || orderStatus || "").toLowerCase();
  const isConfirmed = Boolean(order?.zaloSentAt) || ["confirmed", "preparing", "cooking", "delivering", "done", "completed"].includes(effectiveStatus);
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
  const templateWithOrderLink = zaloTemplate.includes("{{order_link}}")
    ? zaloTemplate
    : `${zaloTemplate}\n🔎 Xem lại đơn hàng: {{order_link}}`;

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

  return (
    <section className="grid min-h-[calc(100vh-96px)] place-items-center px-4">
      <div className="w-full rounded-[30px] bg-success p-7 text-center shadow-soft">
        <div className={`mx-auto grid h-24 w-24 place-items-center rounded-[28px] text-3xl font-black ${isConfirmed ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
          {isConfirmed ? "OK" : "..."}
        </div>

        <h1 className={`mt-6 text-2xl font-black ${isConfirmed ? "text-green-700" : "text-orange-700"}`}>
          {isConfirmed ? "Đơn hàng đã được gửi xác nhận" : "Còn 1 Bước Nữa Để Quán Nhận Đơn"}
        </h1>
        <p className="mt-2 text-sm font-bold text-brown/70">
          {isConfirmed ? "Quán đã nhận thông tin đơn của bạn qua Zalo. Bạn có thể theo dõi trạng thái đơn ngay bên dưới." : "Đơn đang chờ xác nhận từ bạn"}
        </p>

        <div className="mt-6 rounded-[24px] bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase text-brown/40">Mã đơn hàng</p>
          <strong className="mt-2 block text-3xl font-black">{order?.orderCode || "GHR-1028"}</strong>
          <p className="mt-4 text-sm font-semibold text-brown/65">
            Thời gian đặt<br />
            {order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")}
          </p>
        </div>

        <div className={`mt-4 rounded-[24px] border bg-white/90 p-4 text-left shadow-soft ${isConfirmed ? "border-green-200" : "border-orange-200"}`}>
          {!isConfirmed && (
            <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-sm font-black text-orange-700">Hướng dẫn gửi đơn</p>
              <div className="mt-3 grid gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">1</span>
                  <p className="text-sm font-semibold text-brown/80">Bấm nút <strong>GỬI XÁC NHẬN ĐƠN</strong> bên dưới.</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">2</span>
                  <p className="text-sm font-semibold text-brown/80">Khi Zalo mở ra, chạm vào ô chat của quán.</p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-orange-100 text-xs font-black text-orange-700">3</span>
                  <p className="text-sm font-semibold text-brown/80">Chọn <strong>Dán</strong> rồi bấm <strong>Gửi</strong> là xong.</p>
                </div>
              </div>
            </div>
          )}

          {isConfirmed ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => copyOrderText(true)} className="rounded-2xl bg-green-50 px-3 py-3 text-xs font-black text-green-700">
                Copy lại nội dung đơn
              </button>
              <a href={zaloUrl} target="_blank" rel="noreferrer" onClick={reopenZalo} className="rounded-2xl bg-orange-50 px-3 py-3 text-center text-xs font-black text-orange-600">
                Mở lại Zalo
              </a>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              {hasOpenedZalo ? (
                <>
                  <button onClick={markZaloSent} className="w-full rounded-2xl border border-green-200 bg-green-50 px-3 py-3 text-xs font-black text-green-700">
                    Tôi đã gửi Zalo rồi
                  </button>
                  <button onClick={() => copyOrderText(true)} className="w-full rounded-2xl border border-orange-100 bg-orange-50 px-3 py-3 text-xs font-black text-orange-600">
                    Copy lại nội dung đơn
                  </button>
                </>
              ) : null}
            </div>
          )}
        </div>

        {!isConfirmed && (
          canOpenZalo ? (
            <a
              href={zaloUrl}
              target="_blank"
              rel="noreferrer"
              onClick={copyOrderForZalo}
              className="mt-5 block w-full rounded-2xl bg-gradient-main py-4 text-center text-sm font-black uppercase tracking-wide text-white shadow-orange"
            >
              GỬI XÁC NHẬN ĐƠN
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 block w-full cursor-wait rounded-2xl bg-brown/30 py-4 text-center text-sm font-black uppercase text-white shadow-orange"
            >
              {isZaloConfigLoading ? "Đang lấy số Zalo..." : "Chưa có số Zalo quán"}
            </button>
          )
        )}

        {isConfirmed && (
          <>
            <button onClick={() => navigate("tracking", "orders")} className="mt-6 w-full rounded-2xl bg-green-600 py-4 text-sm font-black uppercase text-white">
              Theo dõi đơn hàng
            </button>
            <button onClick={() => navigate("menu", "menu")} className="mt-3 w-full rounded-2xl border border-brown/20 bg-white py-4 text-sm font-black uppercase text-brown">
              Mua lại đơn này
            </button>
          </>
        )}
      </div>
      {copyPopup.open && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/35 px-4">
          <div className="w-full max-w-[360px] rounded-[24px] bg-white p-5 shadow-soft">
            <div className={`grid h-12 w-12 place-items-center rounded-2xl ${copyPopup.tone === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
              <Icon name={copyPopup.tone === "error" ? "x" : "check"} size={20} />
            </div>
            <h3 className="mt-3 text-lg font-black text-brown">{copyPopup.title}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-brown/75">{copyPopup.message}</p>
            <button
              type="button"
              onClick={() => setCopyPopup({ open: false, title: "", message: "", tone: "success" })}
              className="mt-5 w-full rounded-2xl bg-gradient-main py-3 text-sm font-black uppercase text-white"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
