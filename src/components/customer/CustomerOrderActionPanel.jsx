import { useState } from "react";
import Icon from "../Icon.jsx";
import {
  CUSTOMER_SUPPORT_ZALO_PHONE,
  CUSTOMER_SUPPORT_ZALO_URL
} from "../../services/customerOrderActionService.js";
import { CustomerButton } from "./CustomerUI.jsx";

export default function CustomerOrderActionPanel({
  mode = "unpaid",
  onContinuePayment,
  onCancel,
  isCancelling = false,
  message = ""
}) {
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);

  if (mode === "paid") {
    return (
      <div className="mt-4 rounded-2xl bg-orange-50 p-3 text-left">
        <strong className="block text-sm font-black text-brown">Cần thay đổi hoặc hủy đơn?</strong>
        <p className="mt-1 text-xs font-semibold leading-5 text-brown/65">
          Đơn đã thanh toán, Gánh sẽ kiểm tra và hỗ trợ trực tiếp qua Zalo.
        </p>
        <CustomerButton
          as="a"
          href={CUSTOMER_SUPPORT_ZALO_URL}
          target="_blank"
          rel="noreferrer"
          full
          variant="secondary"
          icon="phone"
          className="mt-3"
        >
          Liên hệ Zalo {CUSTOMER_SUPPORT_ZALO_PHONE}
        </CustomerButton>
      </div>
    );
  }

  if (isConfirmingCancel) {
    return (
      <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-left" role="alertdialog" aria-label="Xác nhận hủy đơn chưa thanh toán">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-red-600" aria-hidden="true">
            <Icon name="warning" size={18} />
          </span>
          <div>
            <strong className="block text-sm font-black text-red-700">Hủy đơn chưa thanh toán?</strong>
            <p className="mt-1 text-xs font-semibold leading-5 text-red-700/75">
              Đơn sẽ không được gửi vào bếp và mã thanh toán sẽ hết hiệu lực.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-2xl border border-red-100 bg-white px-3 py-3 text-sm font-black text-brown"
            disabled={isCancelling}
            onClick={() => setIsConfirmingCancel(false)}
          >
            Tiếp tục thanh toán
          </button>
          <button
            type="button"
            className="rounded-2xl bg-red-600 px-3 py-3 text-sm font-black text-white disabled:opacity-60"
            disabled={isCancelling}
            onClick={onCancel}
          >
            {isCancelling ? "Đang hủy…" : "Xác nhận hủy"}
          </button>
        </div>
        {message ? <p className="mt-3 text-xs font-bold leading-5 text-red-700" role="status">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-2">
      {typeof onContinuePayment === "function" ? (
        <CustomerButton full size="lg" onClick={onContinuePayment}>
          Tiếp tục thanh toán
        </CustomerButton>
      ) : null}
      <button
        type="button"
        className="mx-auto px-4 py-2 text-sm font-black text-red-600 underline decoration-red-200 underline-offset-4"
        onClick={() => setIsConfirmingCancel(true)}
      >
        Hủy đơn
      </button>
      {message ? <p className="text-center text-xs font-bold leading-5 text-red-600" role="status">{message}</p> : null}
    </div>
  );
}
