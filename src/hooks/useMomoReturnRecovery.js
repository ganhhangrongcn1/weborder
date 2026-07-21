import { useEffect, useState } from "react";
import { recoverMomoReturnOrder } from "../services/qrPaymentService.js";
import { orderRepository } from "../services/repositories/orderRepository.js";

const MOMO_RETURN_TOKEN_PARAM = "momoReturnToken";
const MOMO_RETURN_POLL_DELAY_MS = 2500;
const MOMO_RETURN_MAX_POLL_ATTEMPTS = 24;
const MOMO_RETURN_INITIAL_RETRY_ATTEMPTS = 4;
const TERMINAL_PAYMENT_STATUSES = new Set([
  "paid",
  "converted",
  "expired",
  "cancelled",
  "canceled",
  "failed"
]);

function getMomoReturnToken() {
  if (typeof window === "undefined") return "";
  return String(new URL(window.location.href).searchParams.get(MOMO_RETURN_TOKEN_PARAM) || "").trim();
}

function clearMomoReturnQuery() {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", window.location.pathname || "/success");
}

export default function useMomoReturnRecovery({ enabled = false } = {}) {
  const [recoveredOrder, setRecoveredOrder] = useState(null);
  const [isRecovering, setIsRecovering] = useState(() => enabled && Boolean(getMomoReturnToken()));
  const [recoveryMessage, setRecoveryMessage] = useState("");

  useEffect(() => {
    if (!enabled) return undefined;

    const returnToken = getMomoReturnToken();
    if (!returnToken) {
      setIsRecovering(false);
      return undefined;
    }

    let isActive = true;
    let timerId = null;
    let attempt = 0;
    let hasRecoveredOnce = false;

    const scheduleRetry = () => {
      if (!isActive || attempt >= MOMO_RETURN_MAX_POLL_ATTEMPTS) return;
      timerId = window.setTimeout(recoverOrder, MOMO_RETURN_POLL_DELAY_MS);
    };

    const recoverOrder = async () => {
      attempt += 1;
      const result = await recoverMomoReturnOrder({ returnToken });
      if (!isActive) return;

      if (result.ok && result.order) {
        const nextOrder = orderRepository.hydrateRecoveredOrder(result.order);
        if (nextOrder) {
          setRecoveredOrder(nextOrder);
          setRecoveryMessage("");
        }
        if (!hasRecoveredOnce) {
          hasRecoveredOnce = true;
          setIsRecovering(false);
          clearMomoReturnQuery();
        }

        const paymentStatus = String(result.session?.status || "").trim().toLowerCase();
        if (!TERMINAL_PAYMENT_STATUSES.has(paymentStatus)) scheduleRetry();
        return;
      }

      if (attempt < MOMO_RETURN_INITIAL_RETRY_ATTEMPTS) {
        scheduleRetry();
        return;
      }

      setIsRecovering(false);
      setRecoveryMessage(result.message || "Chưa thể mở lại đơn hàng lúc này.");
    };

    setIsRecovering(true);
    setRecoveryMessage("");
    recoverOrder();

    return () => {
      isActive = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [enabled]);

  return {
    order: recoveredOrder,
    isRecovering,
    message: recoveryMessage
  };
}
