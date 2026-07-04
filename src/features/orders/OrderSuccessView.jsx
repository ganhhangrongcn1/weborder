import { useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { CustomerButton, CustomerCard, CustomerModalFrame } from "../../components/customer/CustomerUI.jsx";
import { formatMoney } from "../../utils/format.js";

function buildOrderTrackingPath(orderCode = "") {
  const code = String(orderCode || "").trim();
  const query = code ? `?orderCode=${encodeURIComponent(code)}` : "";
  return `/orders${query}`;
}

function getOrderTotal(order = {}) {
  return Number(order?.totalAmount || order?.total || 0);
}

function getOrderItemsCount(order = {}) {
  return (Array.isArray(order?.items) ? order.items : []).reduce(
    (sum, item) => sum + Number(item?.quantity || 0),
    0
  );
}

function getFulfillmentText(order = {}) {
  return String(order?.fulfillmentType || "").toLowerCase() === "pickup"
    ? "Tự đến lấy"
    : "Giao tận nơi";
}

function getBranchText(order = {}) {
  const isPickup = String(order?.fulfillmentType || "").toLowerCase() === "pickup";
  return isPickup
    ? order?.pickupBranchName || order?.branchName || "Gánh Hàng Rong"
    : order?.deliveryBranchName || order?.branchName || "Chi nhánh gần nhất";
}

function openTrackingRoute(orderCode, navigate) {
  const path = buildOrderTrackingPath(orderCode);
  if (typeof window === "undefined") {
    navigate?.("tracking", "orders");
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function OrderSuccess({
  navigate,
  order,
  isRegisteredCustomer = false,
  currentPhone = ""
}) {
  const [showSuccessPopup, setShowSuccessPopup] = useState(true);
  const orderCode = order?.orderCode || order?.id || "Đơn mới";
  const itemCount = getOrderItemsCount(order);
  const orderTotal = getOrderTotal(order);
  const fulfillmentText = getFulfillmentText(order);
  const branchText = getBranchText(order);

  const memberBenefits = useMemo(() => ([
    {
      icon: "star",
      title: "Tích điểm từ đơn đầu",
      text: "Mỗi đơn hợp lệ đều được cộng điểm để đổi ưu đãi lần sau."
    },
    {
      icon: "gift",
      title: "Nhận voucher thành viên",
      text: "Ưu đãi mở theo hạng và lịch sử mua hàng của bạn."
    },
    {
      icon: "clock",
      title: "Nhận thông báo khi món xong",
      text: "Đăng nhập để theo dõi trạng thái và nhận nhắc hoàn tất."
    }
  ]), []);

  const handleTrackOrder = () => openTrackingRoute(orderCode, navigate);
  const handleMemberAction = () => {
    setShowSuccessPopup(false);
    navigate?.(isRegisteredCustomer ? "loyalty" : "account", isRegisteredCustomer ? "rewards" : "account");
  };
  const memberActionText = isRegisteredCustomer
    ? "Xem ưu đãi thành viên"
    : currentPhone
      ? "Đăng nhập nhận thông báo"
      : "Đăng ký nhận ưu đãi";

  if (!order) {
    return (
      <section className="order-success-page grid min-h-[calc(100vh-96px)] place-items-center px-4 py-6">
        <CustomerCard padding="lg" className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-orange-50 text-orange-600">
            <Icon name="bag" size={24} />
          </div>
          <h1 className="mt-4 text-2xl font-black leading-tight text-brown">Chưa tìm thấy đơn hàng</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/65">
            Bạn có thể vào mục theo dõi đơn để kiểm tra lại lịch sử đặt món.
          </p>
          <CustomerButton full size="lg" className="mt-5" onClick={() => navigate?.("tracking", "orders")}>
            Theo dõi đơn hàng
          </CustomerButton>
        </CustomerCard>
      </section>
    );
  }

  return (
    <section className="order-success-page px-4 py-5">
      <div className="mx-auto grid w-full max-w-[430px] gap-4">
        <CustomerCard tone="success" padding="lg" className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[24px] bg-green-100 text-green-700">
            <Icon name="check" size={30} />
          </div>
          <p className="mt-5 customer-caption uppercase text-green-700">Đặt món thành công</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-green-800">
            Đơn hàng đã được ghi nhận
          </h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/70">
            Theo dõi đơn để biết khi nào món sẵn sàng. Đăng nhập thành viên để nhận thông báo và ưu đãi cho lần sau.
          </p>

          <div className="success-member-prompt mt-5">
            <div>
              <span>Thành viên GHR</span>
              <strong>Tích điểm, nhận voucher và thông báo khi món hoàn tất.</strong>
            </div>
            <button type="button" onClick={handleMemberAction}>
              {isRegisteredCustomer ? "Xem ngay" : "Tham gia"}
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-green-100 bg-white p-4 text-left shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-brown/45">Mã đơn</span>
                <strong className="mt-1 block text-2xl font-black text-brown">{orderCode}</strong>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">
                Đơn mới
              </span>
            </div>

            <div className="order-success-summary-grid mt-4">
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Tổng tiền</span>
                <strong className="mt-1 block text-base font-black text-orange-600">{formatMoney(orderTotal)}</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Món đã đặt</span>
                <strong className="mt-1 block text-base font-black text-brown">{itemCount} món</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Hình thức</span>
                <strong className="mt-1 block text-base font-black text-brown">{fulfillmentText}</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Chi nhánh</span>
                <strong className="mt-1 block truncate text-base font-black text-brown">{branchText}</strong>
              </div>
            </div>
          </div>

          <CustomerButton full size="lg" className="mt-5" onClick={handleTrackOrder}>
            Theo dõi đúng đơn này
          </CustomerButton>
          <CustomerButton full variant="secondary" className="mt-3" onClick={() => navigate?.("menu", "menu")}>
            Đặt thêm món
          </CustomerButton>
        </CustomerCard>

        <CustomerCard padding="lg" className="member-benefit-card">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <Icon name="bag" size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-brown/55">Thành viên GHR</p>
              <h2 className="text-lg font-black leading-tight text-brown">Quyền lợi khi quay lại</h2>
            </div>
          </div>

          <div className="mt-4 divide-y divide-orange-100">
            {memberBenefits.map((benefit) => (
              <div key={benefit.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                  <Icon name={benefit.icon} size={18} />
                </span>
                <div className="min-w-0">
                  <strong className="block text-sm font-black text-brown">{benefit.title}</strong>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-brown/60">{benefit.text}</span>
                </div>
              </div>
            ))}
          </div>

          <CustomerButton full variant={isRegisteredCustomer ? "soft" : "primary"} className="mt-5" onClick={handleMemberAction}>
            {memberActionText}
          </CustomerButton>
        </CustomerCard>
      </div>

      {showSuccessPopup && (
        <CustomerModalFrame className="text-center order-success-modal">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-green-100 text-green-700">
            <Icon name="check" size={28} />
          </div>
          <p className="mt-4 customer-caption uppercase text-green-700">Đặt món thành công</p>
          <h3 className="mt-2 customer-title-lg">Đơn {orderCode} đã được ghi nhận</h3>
          <p className="mt-2 customer-body">
            Theo dõi đơn để biết khi nào món sẵn sàng.
          </p>

          <button type="button" className="success-member-banner" onClick={handleMemberAction}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-600">
              <Icon name="star" size={18} />
            </span>
            <span>
              <strong>{isRegisteredCustomer ? "Ưu đãi thành viên đang chờ bạn" : "Đăng nhập để nhận thông báo khi món xong"}</strong>
              <small>Tích điểm và nhận voucher cho những lần đặt tiếp theo.</small>
            </span>
          </button>

          <CustomerButton full size="lg" className="mt-4" onClick={handleTrackOrder}>
            Theo dõi đơn
          </CustomerButton>
          <CustomerButton full variant="secondary" className="mt-3" onClick={handleMemberAction}>
            {memberActionText}
          </CustomerButton>
          <button type="button" className="success-popup-link" onClick={() => setShowSuccessPopup(false)}>
            Xem chi tiết đơn hàng
          </button>
        </CustomerModalFrame>
      )}
    </section>
  );
}
