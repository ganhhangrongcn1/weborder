import Icon from "../../components/Icon.jsx";
import { loadZaloConfig, renderZaloTemplate, buildZaloLink } from "../../services/zaloService.js";
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
  const zaloConfig = loadZaloConfig(rawZaloPhone);
  const zaloTemplate = String(zaloConfig.template || "");
  const templateWithOrderLink = zaloTemplate.includes("{{order_link}}")
    ? zaloTemplate
    : `${zaloTemplate}\n\uD83D\uDD0E Xem l\u1EA1i \u0111\u01A1n h\u00E0ng: {{order_link}}`;
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
  const zaloUrl = buildZaloLink(zaloConfig.phone || rawZaloPhone, orderMessage);

  async function copyOrderText(showAlert = false) {
    try {
      await navigator.clipboard.writeText(orderMessage);
      if (showAlert) alert("Đã copy lại nội dung đơn. Bạn mở Zalo và dán vào khung chat quán nhé.");
    } catch {
      if (showAlert) alert("Trình duyệt không cho copy tự động. Bạn hãy mở lại trang đơn và thử lại nhé.");
    }
  }

  async function copyOrderForZalo() {
    await copyOrderText(false);
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
          {isConfirmed ? "Đơn hàng đã được gửi xác nhận" : "Đơn hàng đang chờ xác nhận"}
        </h1>
        <p className="mt-2 text-sm font-bold text-brown/70">
          {isConfirmed ? "Bạn đã mở Zalo để gửi thông tin đơn cho quán." : "Bước cuối: gửi thông tin đơn qua Zalo để quán xác nhận và bắt đầu chuẩn bị món."}
        </p>

        <div className="mt-6 rounded-[24px] bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase text-brown/40">Mã đơn hàng</p>
          <strong className="mt-2 block text-3xl font-black">{order?.orderCode || "GHR-1028"}</strong>
          <p className="mt-4 text-sm font-semibold text-brown/65">
            Thời gian đặt<br />
            {order?.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : new Date().toLocaleString("vi-VN")}
          </p>
        </div>

        <div className={`mt-4 rounded-[24px] border bg-white/85 p-4 text-left shadow-soft ${isConfirmed ? "border-green-200" : "border-orange-200"}`}>
          {!isConfirmed && (
            <p className="mb-3 rounded-2xl bg-orange-50 px-3 py-2 text-xs text-orange-700">
              Quán chỉ bắt đầu chuẩn bị món sau khi nhận được tin nhắn xác nhận trên Zalo.
            </p>
          )}

          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${isConfirmed ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
              <Icon name="share" size={18} />
            </span>
            <div>
              <h2 className="text-sm font-black text-brown">
                {isConfirmed ? "Đã mở Zalo xác nhận đơn" : "Gửi Zalo để quán xác nhận đơn"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-brown/60">
                {isConfirmed
                  ? "Nếu bạn chưa gửi tin nhắn trong Zalo hoặc đã lỡ copy nội dung khác, hãy copy lại nội dung đơn rồi dán vào khung chat quán."
                  : "Bấm nút bên dưới để mở Zalo quán. Nội dung đơn đã được copy sẵn, bạn chỉ cần dán và gửi cho quán."}
              </p>
            </div>
          </div>

          {isConfirmed ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => copyOrderText(true)} className="rounded-2xl bg-green-50 px-3 py-3 text-xs font-black text-green-700">
                Copy lại nội dung đơn
              </button>
              <a href={zaloUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-orange-50 px-3 py-3 text-center text-xs font-black text-orange-600">
                Mở lại Zalo
              </a>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <a
                href={zaloUrl}
                target="_blank"
                rel="noreferrer"
                onClick={copyOrderForZalo}
                className="block w-full rounded-2xl bg-gradient-main py-4 text-center text-sm font-black uppercase text-white shadow-orange"
              >
                Mở Zalo và copy nội dung đơn
              </a>
              <button onClick={markZaloSent} className="w-full rounded-2xl border border-green-200 bg-green-50 px-3 py-3 text-xs font-black text-green-700">
                Tôi đã gửi tin nhắn Zalo
              </button>
            </div>
          )}
        </div>

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
    </section>
  );
}
