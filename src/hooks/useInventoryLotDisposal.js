import { useRef, useState } from "react";
import { createLotDisposalDraft } from "../services/inventoryLotDisposalService.js";

export default function useInventoryLotDisposal() {
  const [selection, setSelection] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const inFlight = useRef(false);
  const requestId = useRef("");
  const open = (lot) => {
    requestId.current = crypto.randomUUID();
    setSelection(lot);
    setQuantity(String(lot.remainingQuantity));
    setReason(lot.expiresOn && lot.expiresOn < new Date().toLocaleDateString("sv-SE") ? "Hết hạn sử dụng" : "Hư hỏng");
    setError(""); setResult(null);
  };
  const close = () => { if (!inFlight.current) setSelection(null); };
  const save = async (event) => {
    event.preventDefault();
    if (inFlight.current || result) return;
    inFlight.current = true; setBusy(true); setError("");
    try { setResult(await createLotDisposalDraft({ lot: selection, quantity, reason, requestId: requestId.current })); }
    catch (failure) { setError(failure.message || "Không tạo được phiếu hủy."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return { selection, quantity, setQuantity, reason, setReason, busy, error, result, open, close, save };
}
