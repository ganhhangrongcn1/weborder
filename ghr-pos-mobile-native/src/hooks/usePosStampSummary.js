import { useEffect, useState } from "react";
import { normalizeCustomerPhone } from "../services/pos/posCustomerService";
import { readPosStamps, subscribePosStampInvalidation } from "../services/pos/posStampService";

export default function usePosStampSummary(phone, identity = "") {
  const normalized = normalizeCustomerPhone(phone);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ phone: "", identity, data: null, error: "", loading: false });
  useEffect(() => subscribePosStampInvalidation(() => setRevision((value) => value + 1)), []);
  useEffect(() => {
    let active = true;
    if (!/^0[35789]\d{8}$/.test(normalized)) {
      setState({ phone: normalized, identity, data: null, error: "", loading: false });
      return undefined;
    }
    setState({ phone: normalized, identity, data: null, error: "", loading: true });
    const timer = setTimeout(() => {
      readPosStamps(normalized).then((data) => {
        if (active) setState({ phone: normalized, identity, data, error: "", loading: false });
      }).catch(() => {
        if (active) setState({ phone: normalized, identity, data: null, error: "Chưa tải được số tem. Không đổi quà khi mất kết nối.", loading: false });
      });
    }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [normalized, revision, identity]);
  // Never display the preceding customer's balance while a new phone renders.
  return state.phone === normalized && state.identity === identity ? state : { phone: normalized, identity, data: null, error: "", loading: true };
}
