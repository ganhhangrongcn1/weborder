import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";
import { CustomerButton, CustomerCard } from "../../components/customer/CustomerUI.jsx";
import CustomerOrderActionPanel from "../../components/customer/CustomerOrderActionPanel.jsx";
import { formatMoney } from "../../utils/format.js";
import {
  cancelCustomerUnpaidOrder,
  prepareOrderForPaymentResume
} from "../../services/customerOrderActionService.js";
import {
  buildMomoPaymentQrImageUrl,
  buildQrOrderPaymentImageUrl,
  createQrOrderPaymentSession,
  findQrOrderPaymentBranch,
  getFallbackMomoPaymentUrl,
  getMomoPaymentLinks,
  getPreferredMomoPaymentUrl,
  getQrOrderPaymentConfig,
  getQrOrderPaymentReference,
  isZaloInAppBrowser,
  isMomoPaymentOrder,
  isQrCounterPrepaidOrder,
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
  order: initialOrder,
  setCurrentOrder,
  onReorder,
  isRegisteredCustomer = false,
  currentPhone = "",
  branches = [],
  isOrderRestoring = false
}) {
  const [orderOverride, setOrderOverride] = useState(null);
  const order = orderOverride || initialOrder;
  const orderId = order?.id || order?.orderCode || "";
  const isQrPaymentOrder = isQrCounterPrepaidOrder(order);
  const isMomoPayment = isMomoPaymentOrder(order);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [momoQrImageUrl, setMomoQrImageUrl] = useState("");
  const [momoLaunchAttempted, setMomoLaunchAttempted] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [cancelOrderMessage, setCancelOrderMessage] = useState("");
  const [isOrderRecoveryGraceActive, setIsOrderRecoveryGraceActive] = useState(() => !order);
  const orderCode = order?.orderCode || order?.id || "Đơn mới";
  const itemCount = getOrderItemsCount(order);
  const orderTotal = getOrderTotal(order);
  const fulfillmentText = getFulfillmentText(order);
  const branchText = getBranchText(order);
  const paymentBranch = useMemo(() => findQrOrderPaymentBranch(order, branches), [branches, order]);
  const paymentConfig = useMemo(() => getQrOrderPaymentConfig(paymentBranch), [paymentBranch]);
  const paymentReference = getQrOrderPaymentReference(order, paymentSession);
  const momoPaymentLinks = getMomoPaymentLinks(paymentSession);
  const momoQrPayload = momoPaymentLinks.qrCodeUrl;
  const isZaloBrowser = useMemo(() => isZaloInAppBrowser(), []);
  const momoDirectPaymentUrl = getPreferredMomoPaymentUrl(paymentSession);
  const momoFallbackPaymentUrl = getFallbackMomoPaymentUrl(paymentSession);
  const bankQrPaymentImageUrl = buildQrOrderPaymentImageUrl({ order, branch: paymentBranch, session: paymentSession });
  const qrPaymentImageUrl = isMomoPayment ? momoQrImageUrl : bankQrPaymentImageUrl;
  const qrPaymentPaid = isQrPaymentOrder && isQrOrderPaid(order, paymentSession);
  const orderMetadata = order?.metadata && typeof order.metadata === "object" ? order.metadata : order || {};
  const qrPaymentCancelled = isQrPaymentOrder &&
    String(order?.status || orderMetadata?.status || "").toLowerCase() === "cancelled" &&
    String(orderMetadata?.cancelledBy || orderMetadata?.cancelled_by || "").toLowerCase() === "customer";
  const qrPaymentExpired = isQrPaymentOrder && isQrOrderPaymentExpired(order, paymentSession);
  const isQrPaymentWaiting = isQrPaymentOrder && !qrPaymentPaid && !qrPaymentExpired;
  const isMomoAppHandoff = isQrPaymentWaiting && isMomoPayment && !qrPaymentImageUrl;
  const isPickup = String(order?.fulfillmentType || "").toLowerCase() === "pickup";
  const paymentText = isQrPaymentOrder
    ? qrPaymentPaid
      ? isMomoPayment ? "Đã thanh toán MoMo" : "Đã thanh toán QR"
      : qrPaymentExpired
        ? qrPaymentCancelled ? "Đã hủy" : "QR đã hết hạn"
        : isMomoPayment ? "Ví MoMo" : "QR ngân hàng"
    : "Tiền mặt khi nhận món";
  const statusEyebrow = qrPaymentCancelled
    ? "Đã hủy"
    : qrPaymentExpired
      ? "Đã quá hạn"
    : isQrPaymentWaiting
      ? "Chờ thanh toán"
      : "Đặt món thành công";
  const statusTitle = qrPaymentCancelled
    ? "Đơn đã được hủy"
    : qrPaymentExpired
      ? "Đơn đã quá hạn thanh toán"
    : isQrPaymentWaiting
      ? isMomoPayment
        ? "Xác nhận thanh toán trên MoMo"
        : "Quét QR để Gánh lên món"
      : "Gánh nhận được đơn rồi nha";
  const statusDescription = qrPaymentCancelled
    ? "Đơn chưa thanh toán đã được hủy và không gửi vào bếp."
    : qrPaymentExpired
      ? "Đơn chưa được thanh toán trong 10 phút nên đã tự hủy. Bạn đặt lại món giúp Gánh nha."
    : isQrPaymentWaiting
      ? isMomoPayment
        ? "Mở MoMo và xác nhận giao dịch."
        : "Gánh sẽ bắt đầu chuẩn bị ngay khi hệ thống xác nhận thanh toán."
      : isQrPaymentOrder && qrPaymentPaid
        ? "Gánh đã nhận tiền và bắt đầu lên món. Bạn theo dõi hành trình để biết khi nào món sẵn sàng nha."
        : isPickup
          ? "Bếp sẽ cập nhật hành trình. Khi món sẵn sàng, bạn ghé quầy rước món thôi."
          : "Bếp sẽ cập nhật hành trình. Khi bàn giao shipper, bạn để ý điện thoại giúp Gánh nha.";
  const statusIcon = qrPaymentExpired ? "warning" : isQrPaymentWaiting ? "qr" : "check";
  const statusIconClass = qrPaymentExpired
    ? "bg-red-50 text-red-600"
    : isQrPaymentWaiting
      ? "bg-orange-50 text-orange-600"
      : "bg-green-100 text-green-700";
  const statusTextClass = qrPaymentExpired ? "text-red-600" : isQrPaymentWaiting ? "text-orange-600" : "text-green-700";
  const statusTitleClass = qrPaymentExpired ? "text-red-700" : isQrPaymentWaiting ? "text-orange-700" : "text-green-800";

  useEffect(() => {
    setOrderOverride(null);
    setCancelOrderMessage("");
  }, [initialOrder?.id, initialOrder?.orderCode]);

  useEffect(() => {
    if (order) {
      setIsOrderRecoveryGraceActive(false);
      return undefined;
    }

    setIsOrderRecoveryGraceActive(true);
    const timerId = window.setTimeout(() => setIsOrderRecoveryGraceActive(false), 10000);
    return () => window.clearTimeout(timerId);
  }, [order]);

  useEffect(() => {
    if (!isQrPaymentOrder || !orderId || qrPaymentPaid) return undefined;

    let isActive = true;
    let timerId = null;

    async function syncPaymentSession({ create = false } = {}) {
      if (!isActive) return;
      const result = create
        ? await createQrOrderPaymentSession({ order })
        : await readQrOrderPaymentSession({ order });
      if (!isActive) return;
      const returnedSessionStatus = String(result.session?.status || "").toLowerCase();
      const returnedOrderStatus = String(result.order?.status || result.order?.orderStatus || "").toLowerCase();
      const currentOrderStatus = String(order?.status || order?.orderStatus || "").toLowerCase();
      if (
        result.order &&
        ["expired", "cancelled", "canceled", "failed"].includes(returnedSessionStatus) &&
        returnedOrderStatus !== currentOrderStatus
      ) {
        setOrderOverride(result.order);
        setCurrentOrder?.(result.order);
      }
      if (result.ok && result.session) {
        setPaymentSession(result.session);
        setPaymentMessage("");
      } else {
        if (result.session) setPaymentSession(result.session);
        if (result.message) setPaymentMessage(result.message);
      }
    }

    syncPaymentSession({ create: !qrPaymentExpired });
    if (!qrPaymentExpired) {
      timerId = window.setInterval(() => {
        syncPaymentSession({ create: false });
      }, 3500);
    }

    return () => {
      isActive = false;
      if (timerId) window.clearInterval(timerId);
    };
  }, [isQrPaymentOrder, order, orderId, qrPaymentExpired, qrPaymentPaid]);

  useEffect(() => {
    if (!isMomoPayment || !momoQrPayload) {
      setMomoQrImageUrl("");
      return undefined;
    }

    let isActive = true;
    buildMomoPaymentQrImageUrl({ providerPayload: { qrCodeUrl: momoQrPayload } })
      .then((imageUrl) => {
        if (isActive) setMomoQrImageUrl(imageUrl);
      })
      .catch(() => {
        if (isActive) setMomoQrImageUrl("");
      });

    return () => {
      isActive = false;
    };
  }, [isMomoPayment, momoQrPayload]);

  const handleCopyPaymentReference = async () => {
    if (!paymentReference) return;
    try {
      await navigator.clipboard?.writeText(paymentReference);
      setPaymentMessage("Đã sao chép nội dung chuyển khoản.");
    } catch {
      setPaymentMessage("Anh/chị copy nội dung chuyển khoản trên màn hình giúp em nhé.");
    }
  };

  const handleShowQrSaveGuide = () => {
    setPaymentMessage("Nhấn giữ hình QR rồi chọn Lưu ảnh. Nếu Zalo không hiện nút lưu, anh/chị mở bằng Chrome rồi lưu lại giúp em nhé.");
  };

  const handleMomoLaunch = () => {
    setMomoLaunchAttempted(true);
  };

  const handleCancelUnpaidOrder = async () => {
    if (!order || isCancellingOrder) return;
    setIsCancellingOrder(true);
    setCancelOrderMessage("");
    try {
      const result = await cancelCustomerUnpaidOrder(order);
      if (!result.ok) {
        setCancelOrderMessage(result.message || "Chưa thể hủy đơn lúc này.");
        return;
      }
      const nextOrder = prepareOrderForPaymentResume(result.order || {
        ...order,
        status: "cancelled",
        kitchenStatus: "cancelled",
        paymentStatus: "cancelled"
      });
      setOrderOverride(nextOrder);
      setCurrentOrder?.(nextOrder);
      setPaymentSession(result.session || paymentSession);
      setPaymentMessage("");
    } catch (error) {
      setCancelOrderMessage(error?.message || "Chưa thể hủy đơn lúc này.");
    } finally {
      setIsCancellingOrder(false);
    }
  };

  const handleReorder = () => {
    if (typeof onReorder === "function") {
      onReorder(order);
      return;
    }
    navigate?.("menu", "menu");
  };

  const handleTrackOrder = () => openTrackingRoute(orderCode, navigate);
  const handleMemberAction = () => {
    navigate?.(isRegisteredCustomer ? "loyalty" : "account", isRegisteredCustomer ? "rewards" : "account");
  };
  const memberActionText = isRegisteredCustomer
    ? "Xem điểm & ưu đãi"
    : currentPhone
      ? "Đăng nhập xem điểm"
      : "Tham gia thành viên";
  const memberPromptTitle = isRegisteredCustomer
    ? "Ăn ngon rồi, điểm cũng tự về"
    : "Gom điểm cho những lần ăn sau";
  const memberPromptText = isRegisteredCustomer
    ? "Đơn hoàn tất là điểm được cộng theo hạng thành viên của bạn."
    : "Đăng nhập để theo dõi điểm và nhận ưu đãi dành riêng cho bạn.";

  if (!order && (isOrderRestoring || isOrderRecoveryGraceActive)) {
    return (
      <section className="order-success-page grid min-h-[calc(100vh-96px)] place-items-center px-4 py-6">
        <CustomerCard padding="lg" className="text-center">
          <div className="order-success-loading-icon mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-orange-50 text-orange-600">
            <Icon name="bag" size={24} />
          </div>
          <h1 className="mt-4 text-2xl font-black leading-tight text-brown">Đang mở đơn hàng</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/65">
            Gánh đang kiểm tra thanh toán, bạn chờ một chút nhé.
          </p>
        </CustomerCard>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="order-success-page grid min-h-[calc(100vh-96px)] place-items-center px-4 py-6">
        <CustomerCard padding="lg" className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-orange-50 text-orange-600">
            <Icon name="bag" size={24} />
          </div>
          <h1 className="mt-4 text-2xl font-black leading-tight text-brown">Đang kiểm tra đơn hàng</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/65">
            Nếu bạn vừa thanh toán, đơn sẽ tự hiển thị ngay khi Gánh nhận được xác nhận.
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
        <CustomerCard
          tone={isQrPaymentWaiting || qrPaymentExpired ? "default" : "success"}
          padding="lg"
          className={`text-center${isQrPaymentWaiting ? " order-success-card--waiting" : ""}${qrPaymentExpired ? " order-success-card--expired" : ""}`}
        >
          <div className={`order-success-status-icon mx-auto grid h-20 w-20 place-items-center rounded-[24px] ${statusIconClass}`} aria-hidden="true">
            <Icon name={statusIcon} size={30} />
          </div>
          <p className={`mt-5 customer-caption uppercase ${statusTextClass}`}>{statusEyebrow}</p>
          <h1 className={`mt-2 text-2xl font-black leading-tight ${statusTitleClass}`}>
            {statusTitle}
          </h1>
          <p className="mt-2 text-sm font-bold leading-6 text-brown/70">
            {statusDescription}
          </p>

          <div className={`order-success-order-card mt-5 rounded-3xl border bg-white p-4 text-left shadow-soft${isQrPaymentWaiting ? " is-waiting" : ""}${qrPaymentExpired ? " is-expired" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-black uppercase text-brown/45">Mã đơn</span>
                <strong className="mt-1 block break-words text-2xl font-black text-brown" translate="no">{orderCode}</strong>
                <small className="mt-1 block text-xs font-bold text-brown/50">{itemCount} món</small>
              </div>
              <span className="order-success-state-badge rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600">
                {qrPaymentExpired ? "Đã hủy" : isQrPaymentWaiting ? "Chờ thanh toán" : "Đã tiếp nhận"}
              </span>
            </div>

            <div className="order-success-summary-grid mt-4">
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Tổng tiền</span>
                <strong className="mt-1 block text-base font-black text-orange-600">{formatMoney(orderTotal)}</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Thanh toán</span>
                <strong className="mt-1 block text-sm font-black leading-5 text-brown">{paymentText}</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Hình thức</span>
                <strong className="mt-1 block text-base font-black text-brown">{fulfillmentText}</strong>
              </div>
              <div className="rounded-2xl bg-cream px-3 py-3">
                <span className="block text-[11px] font-black uppercase text-brown/45">Chi nhánh</span>
                <strong className="mt-1 block break-words text-sm font-black leading-5 text-brown">{branchText}</strong>
              </div>
            </div>
          </div>

          {!qrPaymentExpired && !isMomoAppHandoff ? (
            <div className={`order-success-next-step mt-4 text-left${isQrPaymentWaiting ? " is-waiting" : ""}`}>
              <span aria-hidden="true"><Icon name={isPickup ? "bag" : "bike"} size={18} /></span>
              <div>
                <small>Bước tiếp theo</small>
                <strong>
                  {isQrPaymentWaiting
                    ? isMomoPayment
                      ? `Mở MoMo và xác nhận ${formatMoney(paymentSession?.amountExpected || orderTotal)}`
                      : "Thanh toán QR để quán bắt đầu làm món"
                    : isPickup
                      ? "Theo dõi đến khi món sẵn sàng nhận"
                      : "Theo dõi lúc quán bàn giao cho shipper"}
                </strong>
              </div>
            </div>
          ) : null}

          {isQrPaymentOrder ? (
            <div className={`qr-payment-wait-card${qrPaymentPaid ? " is-paid" : ""}${isMomoAppHandoff ? " is-momo-app" : ""}`}>
              {!isMomoAppHandoff ? <div className="qr-payment-wait-card__head">
                <span className="qr-payment-wait-card__icon">
                  <Icon name={qrPaymentPaid ? "check" : "qr"} size={20} />
                </span>
                <div>
                  <small>{qrPaymentPaid ? "Đã nhận thanh toán" : isMomoPayment ? "Thanh toán MoMo" : "Thanh toán QR"}</small>
                  <strong>
                    {qrPaymentPaid
                      ? "Quán đã nhận tiền"
                      : isMomoPayment
                        ? qrPaymentImageUrl ? "Quét mã hoặc mở MoMo" : "Xác nhận trong ứng dụng MoMo"
                        : "Quét mã bên dưới"}
                  </strong>
                </div>
              </div> : null}

              {qrPaymentExpired ? (
                <p className="qr-payment-wait-card__paid-text">
                  {qrPaymentCancelled
                    ? "Đơn đã được hủy. Mã thanh toán không còn hiệu lực."
                    : "Mã QR của đơn này đã hết hiệu lực. Anh/chị vui lòng đặt lại đơn mới để thanh toán."}
                </p>
              ) : !qrPaymentPaid ? (
                isMomoPayment && !qrPaymentImageUrl ? (
                  <div className="momo-app-payment">
                    <div className="momo-app-payment__header">
                      <img
                        className="momo-app-payment__brand"
                        src="/brand/momo-logo-app.png"
                        alt=""
                        width="52"
                        height="52"
                        decoding="async"
                      />
                      <div className="momo-app-payment__copy">
                        <small>Phương thức thanh toán</small>
                        <strong>Ứng dụng MoMo</strong>
                      </div>
                      <span className="momo-app-payment__selected" aria-label="Đã chọn">
                        <Icon name="check" size={15} />
                      </span>
                    </div>
                    {momoDirectPaymentUrl ? (
                      <a
                        className="momo-app-payment__primary"
                        href={momoDirectPaymentUrl}
                        rel="noreferrer"
                        onClick={handleMomoLaunch}
                      >
                        {isZaloBrowser ? "Tiếp tục thanh toán MoMo" : "Mở ứng dụng MoMo"}
                      </a>
                    ) : (
                      <button className="momo-app-payment__primary" type="button" disabled>
                        Đang chuẩn bị giao dịch...
                      </button>
                    )}

                    {momoLaunchAttempted ? (
                      <p className="momo-app-payment__return-note" role="status" aria-live="polite">
                        Đang chờ xác nhận thanh toán…
                      </p>
                    ) : null}

                    {!momoLaunchAttempted ? (
                      <p className="momo-app-payment__trust">
                        <Icon name="check" size={14} />
                        <span>Chỉ xác nhận đơn khi thanh toán thành công</span>
                      </p>
                    ) : null}

                    {momoFallbackPaymentUrl ? (
                      <a
                        className="momo-app-payment__fallback"
                        href={momoFallbackPaymentUrl}
                        rel="noreferrer"
                        onClick={handleMomoLaunch}
                      >
                        {isZaloBrowser
                          ? "Mở trực tiếp ứng dụng MoMo"
                          : "Không mở được? Thanh toán trên trình duyệt"}
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {qrPaymentImageUrl ? (
                    <>
                      <div className="qr-payment-wait-card__qr">
                        <img
                          src={qrPaymentImageUrl}
                          alt={isMomoPayment ? "QR thanh toán MoMo" : "QR thanh toán ngân hàng"}
                          width="210"
                          height="210"
                        />
                      </div>
                      <p className="qr-payment-wait-card__save-hint">
                        {isMomoPayment
                          ? "Mở ứng dụng MoMo và chọn Quét mã, hoặc bấm Mở MoMo trên điện thoại này."
                          : "Muốn lưu mã QR: nhấn giữ ảnh QR rồi chọn Lưu ảnh."}
                      </p>
                    </>
                  ) : (
                    <div className="qr-payment-wait-card__empty">
                      <Icon name="warning" size={20} />
                      <span>
                        {isMomoPayment
                          ? "MoMo chưa bật QR trực tiếp cho tài khoản này. Anh/chị bấm Mở MoMo để vào thẳng bước xác nhận thanh toán."
                          : "Chi nhánh này chưa có cấu hình tài khoản ngân hàng. Anh/chị thanh toán tại quầy giúp em."}
                      </span>
                    </div>
                  )}
                  <p className="qr-payment-wait-card__note">
                    {isMomoPayment ? "Giao dịch có hiệu lực trong 10 phút." : "Mã QR có hiệu lực trong 10 phút."}
                  </p>

                  <div className="qr-payment-wait-card__info">
                    <span>
                      <small>Số tiền</small>
                      <strong>{formatMoney(paymentSession?.amountExpected || orderTotal)}</strong>
                    </span>
                    {!isMomoPayment ? (
                      <span>
                        <small>Nội dung chuyển khoản</small>
                        <strong>{paymentReference}</strong>
                      </span>
                    ) : null}
                    {!isMomoPayment && paymentConfig.ready ? (
                      <span>
                        <small>Tài khoản nhận</small>
                        <strong>{paymentConfig.bankName} · {paymentConfig.accountNumber}</strong>
                      </span>
                    ) : null}
                  </div>

                  <div className="qr-payment-wait-card__actions">
                    {isMomoPayment && momoDirectPaymentUrl ? (
                      <a href={momoDirectPaymentUrl} rel="noreferrer" onClick={handleMomoLaunch}>
                        Mở MoMo để thanh toán
                      </a>
                    ) : (
                      <button type="button" onClick={handleCopyPaymentReference}>Sao chép nội dung</button>
                    )}
                    {!isMomoPayment && qrPaymentImageUrl ? (
                      <button type="button" onClick={handleShowQrSaveGuide}>
                        Cách lưu QR
                      </button>
                    ) : null}
                    {isMomoPayment && momoFallbackPaymentUrl ? (
                      <a href={momoFallbackPaymentUrl} rel="noreferrer" onClick={handleMomoLaunch}>
                        {isZaloBrowser ? "Mở ứng dụng MoMo" : "Mở cổng thanh toán MoMo"}
                      </a>
                    ) : null}
                  </div>
                  </>
                )
              ) : (
                <p className="qr-payment-wait-card__paid-text">
                  Đơn đã được xác nhận thanh toán. Quán sẽ ưu tiên làm món ngay cho anh/chị.
                </p>
              )}

              {paymentMessage ? <p className="qr-payment-wait-card__message" role="status" aria-live="polite">{paymentMessage}</p> : null}
            </div>
          ) : null}

          {isQrPaymentWaiting ? (
            <CustomerOrderActionPanel
              onCancel={handleCancelUnpaidOrder}
              isCancelling={isCancellingOrder}
              message={cancelOrderMessage}
            />
          ) : qrPaymentPaid ? (
            <CustomerOrderActionPanel mode="paid" />
          ) : null}

          {qrPaymentExpired ? (
            <CustomerButton full size="lg" className="mt-5" onClick={handleReorder}>
              Đặt lại đơn
            </CustomerButton>
          ) : !isQrPaymentWaiting ? (
            <>
              <CustomerButton full size="lg" className="mt-5" onClick={handleTrackOrder}>
                Xem hành trình đơn
              </CustomerButton>
              <CustomerButton full variant="secondary" className="mt-3" onClick={() => navigate?.("home", "home")}>
                Về trang chủ
              </CustomerButton>
            </>
          ) : null}

          {!isQrPaymentWaiting && !qrPaymentExpired ? (
            <button type="button" className="success-member-prompt mt-4" onClick={handleMemberAction}>
              <span className="success-member-prompt__icon" aria-hidden="true">
                <Icon name={isRegisteredCustomer ? "star" : "gift"} size={18} />
              </span>
              <span className="success-member-prompt__copy">
                <strong>{memberPromptTitle}</strong>
                <small>{memberPromptText}</small>
              </span>
              <span className="success-member-prompt__action">{memberActionText}</span>
            </button>
          ) : null}
        </CustomerCard>
      </div>
    </section>
  );
}
