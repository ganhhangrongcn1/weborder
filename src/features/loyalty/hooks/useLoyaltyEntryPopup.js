import { useEffect, useMemo, useState } from "react";
import { getCustomerKey } from "../../../services/storageService.js";
import { isVoucherExpired } from "../../../utils/pureHelpers.js";

const SESSION_PREFIX = "ghr_loyalty_entry_popup";
const shownSessionKeys = new Set();

function getVoucherExpiryTime(voucher = {}) {
  const value = String(voucher.expiredAt || voucher.endAt || voucher.expiry || "").trim();
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(`${value.slice(0, 10)}T23:59:59`).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function hasShownInSession(key) {
  if (!key) return true;
  if (shownSessionKeys.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markShownInSession(key) {
  if (!key) return;
  shownSessionKeys.add(key);
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
  }
}

export default function useLoyaltyEntryPopup({
  customerPhone,
  isReady,
  vouchers,
  blocked
}) {
  const [popup, setPopup] = useState(null);
  const customerKey = getCustomerKey(customerPhone);
  const sessionKey = customerKey ? `${SESSION_PREFIX}:${customerKey}` : "";
  const usableVouchers = useMemo(
    () =>
      (Array.isArray(vouchers) ? vouchers : [])
        .filter((voucher) => voucher && !voucher.used && !voucher.canceled && !isVoucherExpired(voucher))
        .sort((a, b) => getVoucherExpiryTime(a) - getVoucherExpiryTime(b)),
    [vouchers]
  );
  const featuredVoucher = usableVouchers[0] || null;
  const featuredVoucherId = String(
    featuredVoucher?.id ||
    featuredVoucher?.code ||
    featuredVoucher?.createdAt ||
    ""
  );

  useEffect(() => {
    setPopup(null);
  }, [sessionKey]);

  useEffect(() => {
    if (!customerKey || !isReady || blocked || popup || hasShownInSession(sessionKey)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      if (hasShownInSession(sessionKey)) return;
      markShownInSession(sessionKey);
      setPopup(
        featuredVoucher
          ? {
              type: "voucher",
              voucher: featuredVoucher,
              voucherCount: usableVouchers.length
            }
          : { type: "points" }
      );
    }, 350);

    return () => window.clearTimeout(timer);
  }, [
    blocked,
    customerKey,
    featuredVoucher,
    featuredVoucherId,
    isReady,
    popup,
    sessionKey,
    usableVouchers.length
  ]);

  return {
    popup,
    closePopup: () => setPopup(null)
  };
}
