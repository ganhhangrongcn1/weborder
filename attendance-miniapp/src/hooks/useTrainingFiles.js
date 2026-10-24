import { useCallback, useEffect, useRef, useState } from "react";
import { loadTrainingMaterial } from "../services/trainingMaterialService.js";

export default function useTrainingFiles() {
  const [files, setFiles] = useState({});
  const resources = useRef(new Map());
  const controllers = useRef(new Map());
  const alive = useRef(false);
  const load = useCallback(async (id) => {
    controllers.current.get(id)?.abort();
    const controller = new AbortController(); controllers.current.set(id, controller);
    const timer = setTimeout(() => controller.abort(), 20000);
    setFiles((current) => ({ ...current, [id]: { ...current[id], loading: true, error: "" } }));
    try {
      const file = await loadTrainingMaterial(id, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (resources.current.has(id)) URL.revokeObjectURL(resources.current.get(id));
      const url = URL.createObjectURL(file.blob); resources.current.set(id, url);
      setFiles((current) => ({ ...current, [id]: { ...file, url, loading: false, error: "" } }));
    } catch {
      if (alive.current && controllers.current.get(id) === controller) setFiles((current) => ({ ...current, [id]: { loading: false, error: "Chưa tải được tệp. Kiểm tra mạng rồi thử lại." } }));
    } finally { clearTimeout(timer); }
  }, []);
  useEffect(() => {
    alive.current = true; load("guide"); load("video");
    const pending = controllers.current; const urls = resources.current;
    return () => { alive.current = false; pending.forEach((controller) => controller.abort()); urls.forEach((url) => URL.revokeObjectURL(url)); urls.clear(); };
  }, [load]);
  return { files, reload: load };
}
