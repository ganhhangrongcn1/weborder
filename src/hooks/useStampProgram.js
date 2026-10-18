import { useCallback, useEffect, useRef, useState } from "react";
import { readStampSummary, readStampHistory } from "../services/stampProgramService.js";

export default function useStampProgram(phone = "", detailed = false, { admin = false } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const historyVersion = useRef(0);
  useEffect(() => {
    let active = true;
    historyVersion.current += 1;
    setState({ data: null, loading: true, error: "" });
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(false);
    setHasMore(false);
    readStampSummary(phone, { admin }).then((data) => { if (active) setState({ data, loading: false, error: "" }); })
      .catch(() => { if (active) setState({ data: null, loading: false, error: "Chưa tải được thẻ tem. Vui lòng thử lại sau." }); });
    return () => { active = false; historyVersion.current += 1; };
  }, [phone, admin]);
  useEffect(() => {
    if (!detailed || !phone || !state.data || (!admin && !state.data.enabled)) return undefined;
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    readStampHistory(phone, null, { admin }).then((rows) => { if (active) { setHistory(rows); setHasMore(rows.length === 20); } })
      .catch(() => { if (active) setHistoryError("Chưa tải được lịch sử tem."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [detailed, phone, state.data, admin]);
  const loadMore = useCallback(async () => {
    const version = historyVersion.current;
    try {
      const rows = await readStampHistory(phone, history.at(-1)?.id, { admin });
      if (version !== historyVersion.current) return;
      setHistory((old) => [...new Map([...old, ...rows].map((row) => [row.id, row])).values()]);
      setHasMore(rows.length === 20);
    } catch { if (version === historyVersion.current) setHistoryError("Chưa tải được lịch sử tem."); }
  }, [phone, history, admin]);
  return { ...state, history, historyError, historyLoading, hasMore, loadMore };
}
