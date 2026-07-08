import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { CustomerButton, CustomerCard, CustomerModalFrame } from "../../components/customer/CustomerUI.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  buildQrOrderPaymentImageUrl,
  createQrOrderPaymentSession,
  findQrOrderPaymentBranch,
  getQrOrderPaymentConfig,
  getQrOrderPaymentReference,
  isQrBankPaymentOrder,
  isQrOrderPaymentExpired,
  isQrOrderPaid,
  readQrOrderPaymentSession
} from "../../services/qrPaymentService.js";

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
  currentPhone = "",
  branches = []
}) {
  const orderId = order?.id || order?.orderCode || "";
  const isQrPaymentOrder = isQrBankPaymentOrder(order);
  const [showSuccessPopup, setShowSuccessPopup] = useState(() => !isQrPaymentOrder);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [qrDownloadBusy, setQrDownloadBusy] = useState(false);
  const orderCode = order?.orderCode || order?.id || "Đơn mới";
  const itemCount = getOrderItemsCount(order);
  const orderTotal = getOrderTotal(order);
  const fulfillmentText = getFulfillmentText(order);
  const branchText = getBranchText(order);
  const paymentBranch = useMemo(() => findQrOrderPaymentBranch(order, branches), [branches, order]);
  const paymentConfig = useMemo(() => getQrOrderPaymentConfig(paymentBranch), [paymentBranch]);
  const paymentReference = getQrOrderPaymentReference(order, paymentSession);
  const qrPaymentImageUrl = buildQrOrderPaymentImageUrl({ order, branch: paymentBranch, session: paymentSession });
  const qrPaymentPaid = isQrOrderPaid(order, paymentSession);
  const qrPaymentExpired = isQrOrderPaymentExpired(order, paymentSession);
  const isQrPaymentWaiting = isQrPaymentOrder && !qrPaymentPaid && !qrPaymentExpired;
  const statusEyebrow = qrPaymentExpired
    ? "Đã quá hạn"
    : isQrPaymentWaiting
      ? "Chờ thanh toán"
      : "Đặt món thành công";
  const statusTitle = qrPaymentExpired
    ? "Đơn đã quá hạn thanh toán"
    : isQrPaymentWaiting
      ? "Quét QR để thanh toán"
      : "Đơn hàng đã được ghi nhận";
  const statusDescription = qrPaymentExpired
    ? "Đơn chưa được thanh toán trong 10 phút nên đã tự hủy. Anh/chị vui lòng đặt lại giúp em."
    : isQrPaymentWaiting
    ? "Quán sẽ bắt đầu làm món sau khi nhận được thanh toán."
    : "Theo dõi đơn để biết khi nào món sẵn sàng. Đăng nhập thành viên để nhận thông báo và ưu đãi cho lần sau.";
  const statusIcon = qrPaymentExpired ? "warning" : isQrPaymentWaiting ? "qr" : "check";
  const statusIconClass = qrPaymentExpired
    ? "bg-red-50 text-red-600"
    : isQrPaymentWaiting
      ? "bg-orange-50 text-orange-600"
      : "bg-green-100 text-green-700";
  const statusTextClass = qrPaymentExpired ? "text-red-600" : isQrPaymentWaiting ? "text-orange-600" : "text-green-700";
  const statusTitleClass = qrPaymentExpired ? "text-red-700" : isQrPaymentWaiting ? "text-orange-700" : "text-green-800";

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

  useEffect(() => {
    if (!isQrPaymentOrder || !orderId || qrPaymentPaid || qrPaymentExpired) return undefined;
    setShowSuccessPopup(false);

    let isActive = true;
    let timerId = null;

    async function syncPaymentSession({ create = false } = {}) {
      if (!isActive) return;
      const result = create
        ? await createQrOrderPaymentSession({ order })
        : await readQrOrderPaymentSession({ order });
      if (!isActive) return;
      if (result.ok && result.session) {
        setPaymentSession(result.session);
        setPaymentMessage("");
      } else if (result.message) {
        setPaymentMessage(result.message);
      }
    }

    syncPaymentSession({ create: true });
    timerId = window.setInterval(() => {
      syncPaymentSession({ create: false });
    }, 3500);

    return () => {
      isActive = false;
      if (timerId) window.clearInterval(timerId);
    };
  }, [isQrPaymentOrder, order, orderId, qrPaymentExpired, qrPaymentPaid]);

  const handleCopyPaymentReference = async () => {
    if (!paymentReference) return;
    try {
      await navigator.clipboard?.writeText(paymentReference);
      setPaymentMessage("Đã sao chép nội dung chuyển khoản.");
    } catch {
      setPaymentMessage("Anh/chị copy nội dung chuyển khoản trên màn hình giúp em nhé.");
    }
  };

  const handleDownloadQrImage = async () => {
    if (!qrPaymentImageUrl || qrDownloadBusy) return;
    setQrDownloadBusy(true);
    try {
      const response = await fetch(qrPaymentImageUrl, { mode: "cors" });
      if (!response.ok) throw new Error("download_failed");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `ma-qr-${paymentReference || orderCode}.png`
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, "-")
        .replace(/-+/g, "-");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setPaymentMessage("Đã tải mã QR về máy.");
    } catch {
      const link = document.createElement("a");
      link.href = qrPaymentImageUrl;
      link.download = `ma-qr-${paymentReference || orderCode}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setPaymentMessage("Đã gửi lệnh tải QR. Nếu trình duyệt chưa tải, anh/chị nhấn giữ hình QR để lưu ảnh.");
    } finally {
      setQrDownloadBusy(false);
    }
  };

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
        <CustomerCard tone={isQrPaymentWaiting ? "default" : "success"} padding="lg" className={`text-center${isQrPaymentWaiting ? " order-success-card--waiting" : ""}`}>
          <div className={`mx-auto grid h-20 w-20 place-items-center rounded-[24px] ${statusIconClass}`}>
            <Icon name={statusIcon} size={30} />
          </div>
          <p className={`mt-5 customer-caption uppercase ${statusTextClass}`}>{statusEyebrow}</p>
          <h1 className={`mt-2 text-2xl font-black leading-tight ${statusTitleClass}`}>
            {statusTitle}
          </h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/70">
            {statusDescription}
          </p>

          {!isQrPaymentOrder ? (
            <div className="success-member-prompt mt-5">
              <div>
                <span>Thành viên GHR</span>
                <strong>Tích điểm, nhận voucher và thông báo khi món hoàn tất.</strong>
              </div>
              <button type="button" onClick={handleMemberAction}>
                {isRegisteredCustomer ? "Xem ngay" : "Tham gia"}
              </button>
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl border border-green-100 bg-white p-4 text-left shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase text-brown/45">Mã đơn</span>
                <strong className="mt-1 block text-2xl font-black text-brown">{orderCode}</strong>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">
                {isQrPaymentWaiting ? "Chờ thanh toán" : "Đơn mới"}
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

          {isQrPaymentOrder ? (
            <div className={`qr-payment-wait-card${qrPaymentPaid ? " is-paid" : ""}`}>
              <div className="qr-payment-wait-card__head">
                <span className="qr-payment-wait-card__icon">
                  <Icon name={qrPaymentPaid ? "check" : "qr"} size={20} />
                </span>
                <div>
                  <small>{qrPaymentPaid ? "Đã nhận thanh toán" : "Thanh toán QR"}</small>
                  <strong>{qrPaymentPaid ? "Quán đã nhận tiền" : "Quét mã bên dưới"}</strong>
                </div>
              </div>

              {qrPaymentExpired ? (
                <p className="qr-payment-wait-card__paid-text">
                  Mã QR của đơn này đã hết hiệu lực. Anh/chị vui lòng đặt lại đơn mới để thanh toán.
                </p>
              ) : !qrPaymentPaid ? (
                <>
                  {qrPaymentImageUrl ? (
                    <div className="qr-payment-wait-card__qr">
                      <img src={qrPaymentImageUrl} alt="QR thanh toán ngân hàng" />
                    </div>
                  ) : (
                    <div className="qr-payment-wait-card__empty">
                      <Icon name="warning" size={20} />
                      <span>Chi nhánh này chưa có cấu hình tài khoản ngân hàng. Anh/chị thanh toán tại quầy giúp em.</span>
                    </div>
                  )}
                  <p className="qr-payment-wait-card__note">
                    Mã QR có hiệu lực trong 10 phút.
                  </p>

                  <div className="qr-payment-wait-card__info">
                    <span>
                      <small>Số tiền</small>
                      <strong>{formatMoney(paymentSession?.amountExpected || orderTotal)}</strong>
                    </span>
                    <span>
                      <small>Nội dung chuyển khoản</small>
                      <strong>{paymentReference}</strong>
                    </span>
                    {paymentConfig.ready ? (
                      <span>
                        <small>Tài khoản nhận</small>
                        <strong>{paymentConfig.bankName} · {paymentConfig.accountNumber}</strong>
                      </span>
                    ) : null}
                  </div>

                  <div className="qr-payment-wait-card__actions">
                    <button type="button" onClick={handleCopyPaymentReference}>Sao chép nội dung</button>
                    {qrPaymentImageUrl ? (
                      <button type="button" onClick={handleDownloadQrImage} disabled={qrDownloadBusy}>
                        {qrDownloadBusy ? "Đang tải..." : "Tải mã QR"}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="qr-payment-wait-card__paid-text">
                  Đơn đã được xác nhận thanh toán. Quán sẽ ưu tiên làm món ngay cho anh/chị.
                </p>
              )}

              {paymentMessage ? <p className="qr-payment-wait-card__message">{paymentMessage}</p> : null}
            </div>
          ) : null}

          {qrPaymentExpired ? (
            <CustomerButton full size="lg" className="mt-5" onClick={() => navigate?.("menu", "menu")}>
              Đặt lại món
            </CustomerButton>
          ) : !isQrPaymentWaiting ? (
            <>
              <CustomerButton full size="lg" className="mt-5" onClick={handleTrackOrder}>
                Theo dõi đúng đơn này
              </CustomerButton>
              <CustomerButton full variant="secondary" className="mt-3" onClick={() => navigate?.("menu", "menu")}>
                Đặt thêm món
              </CustomerButton>
            </>
          ) : null}
        </CustomerCard>

        {!isQrPaymentOrder ? (
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
        ) : null}
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
