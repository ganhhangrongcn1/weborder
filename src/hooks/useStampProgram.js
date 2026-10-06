import { useCallback, useEffect, useRef, useState } from "react";
import { readStampSummary, readStampHistory } from "../services/stampProgramService.js";

export default function useStampProgram(phone = "", detailed = false) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const historyVersion = useRef(0);
  useEffect(() => {
    let active = true;
    historyVersion.current += 1;
    setState({ data: null, loading: true, error: "" });
    setHistory([]);
    setHistoryError("");
    setHasMore(false);
    readStampSummary(phone).then((data) => { if (active) setState({ data, loading: false, error: "" }); })
      .catch(() => { if (active) setState({ data: null, loading: false, error: "Chưa tải được thẻ tem. Vui lòng thử lại sau." }); });
    return () => { active = false; historyVersion.current += 1; };
  }, [phone]);
  useEffect(() => {
    if (!detailed || !phone || !state.data?.enabled) return undefined;
    let active = true;
    readStampHistory(phone).then((rows) => { if (active) { setHistory(rows); setHasMore(rows.length === 20); } })
      .catch(() => { if (active) setHistoryError("Chưa tải được lịch sử tem."); });
    return () => { active = false; };
  }, [detailed, phone, state.data?.enabled]);
  const loadMore = useCallback(async () => {
    const version = historyVersion.current;
    try {
      const rows = await readStampHistory(phone, history.at(-1)?.id);
      if (version !== historyVersion.current) return;
      setHistory((old) => [...new Map([...old, ...rows].map((row) => [row.id, row])).values()]);
      setHasMore(rows.length === 20);
    } catch { if (version === historyVersion.current) setHistoryError("Chưa tải được lịch sử tem."); }
  }, [phone, history]);
  return { ...state, history, historyError, hasMore, loadMore };
}
