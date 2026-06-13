import { useEffect, useState } from "react";
import { lookupPosCustomerByPhone } from "../services/posCustomerService.js";
import { getCustomerKey } from "../services/storageService.js";

export default function usePosCustomerLookup(phone = "") {
  const [state, setState] = useState({
    loading: false,
    result: null,
    error: ""
  });

  useEffect(() => {
    const phoneKey = getCustomerKey(phone);
    if (!phoneKey) {
      setState({
        loading: false,
        result: null,
        error: phone.trim().length >= 8 ? "Số điện thoại chưa hợp lệ." : ""
      });
      return undefined;
    }

    let alive = true;
    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: "" }));
      lookupPosCustomerByPhone(phoneKey)
        .then((result) => {
          if (!alive) return;
          setState({ loading: false, result, error: "" });
        })
        .catch((error) => {
          if (!alive) return;
          setState({
            loading: false,
            result: null,
            error: error?.message || "Không tra được thông tin khách."
          });
        });
    }, 350);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [phone]);

  return state;
}
