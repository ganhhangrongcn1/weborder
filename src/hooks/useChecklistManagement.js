import { useCallback, useEffect, useState } from "react";

export default function useChecklistManagement(loader) {
  const [state, setState] = useState({ data: null, loading: true, saving: false, error: "", message: "" });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await loader();
      setState((current) => ({ ...current, data, loading: false }));
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được dữ liệu." }));
      return null;
    }
  }, [loader]);

  useEffect(() => { reload(); }, [reload]);

  const run = useCallback(async (action, successMessage) => {
    setState((current) => ({ ...current, saving: true, error: "", message: "" }));
    try {
      await action();
      const data = await loader();
      setState((current) => ({ ...current, data, saving: false, message: successMessage }));
      return true;
    } catch (error) {
      setState((current) => ({ ...current, saving: false, error: error.message || "Không thể lưu dữ liệu." }));
      return false;
    }
  }, [loader]);

  return { ...state, reload, run };
}
