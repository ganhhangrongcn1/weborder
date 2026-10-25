import { useCallback, useEffect, useRef, useState } from "react";
import { claimReceiptLoyalty, normalizeReceiptPhone, readReceiptLoyalty, readReceiptPointSummary } from "../services/receiptLoyaltyService.js";

export default function useReceiptLoyalty(token) {
  const [receipt, setReceipt] = useState(null);
  const [phone, setPhone] = useState("");
  const [summaryPhone, setSummaryPhone] = useState("");
  const [summary, setSummary] = useState(null);
  const [confirmPhone, setConfirmPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(0);
  const submitting = useRef(false);

  const refresh = useCallback(async () => {
    const request = ++active.current;
    setLoading(true); setError("");
    try {
      const data = await readReceiptLoyalty(token);
      if (request === active.current) setReceipt(data);
    } catch (failure) {
      if (request === active.current) setError(failure.message);
    } finally {
      if (request === active.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setReceipt(null); setConfirmPhone(""); setPhone("");
    refresh();
    return () => { active.current += 1; };
  }, [refresh]);

  function review(event) {
    event.preventDefault(); setError("");
    try { setConfirmPhone(normalizeReceiptPhone(phone)); }
    catch (failure) { setError(failure.message); }
  }

  async function claim() {
    if (submitting.current || !confirmPhone) return;
    const request = active.current;
    submitting.current = true; setBusy(true); setError("");
    try {
      const data = await claimReceiptLoyalty(token, confirmPhone);
      if (request === active.current) { setReceipt(data); setConfirmPhone(""); }
    } catch (failure) {
      if (request === active.current) setError(failure.message);
    } finally { submitting.current = false; setBusy(false); }
  }

  async function lookup(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(""); setSummary(null);
    try { setSummary(await readReceiptPointSummary(summaryPhone)); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }

  return { receipt, phone, setPhone, summaryPhone, setSummaryPhone, summary, confirmPhone,
    setConfirmPhone, loading, busy, error, refresh, review, claim, lookup };
}
