import { useCallback, useEffect, useState } from "react";
import { loadCorrectiveWorkspace, updateCorrectiveAction } from "../services/supervisionCorrectiveService.js";

export default function useSupervisionCorrectiveActions() {
  const [data, setData] = useState({ actions: [], employees: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await loadCorrectiveWorkspace()); }
    catch (nextError) { setError(nextError?.message || "Không tải được danh sách khắc phục."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  async function save(payload) {
    setSavingId(payload.id); setError("");
    try { await updateCorrectiveAction(payload); await reload(); return true; }
    catch (nextError) { setError(nextError?.message || "Không lưu được cập nhật."); return false; }
    finally { setSavingId(""); }
  }
  return { ...data, loading, savingId, error, reload, save };
}
