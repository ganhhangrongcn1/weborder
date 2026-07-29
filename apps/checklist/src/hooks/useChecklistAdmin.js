import { useCallback, useEffect, useState } from "react";
import { addChecklistItem, createDraft, loadChecklistWorkspace, publishVersion, saveChecklistItem } from "../repositories/checklistAdminRepository.js";

export function useChecklistAdmin() {
  const [state, setState] = useState({ data: null, loading: true, working: false, error: "", message: "" });

  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await loadChecklistWorkspace();
      setState((current) => ({ ...current, data, loading: false }));
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message || "Không tải được checklist." }));
      return null;
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const run = useCallback(async (action, successMessage) => {
    setState((current) => ({ ...current, working: true, error: "", message: "" }));
    try {
      await action();
      const data = await loadChecklistWorkspace();
      setState((current) => ({ ...current, data, working: false, message: successMessage }));
      return true;
    } catch (error) {
      setState((current) => ({ ...current, working: false, error: error.message || "Không thể thực hiện thao tác." }));
      return false;
    }
  }, []);

  return {
    ...state,
    reload,
    createDraft: (templateId) => run(() => createDraft(templateId), "Đã tạo bản nháp để chỉnh sửa."),
    publish: (versionId) => run(() => publishVersion(versionId), "Đã công bố phiên bản checklist mới."),
    saveItem: (item) => run(() => saveChecklistItem(item), "Đã cập nhật tiêu chí."),
    addItem: (item) => run(() => addChecklistItem(item), "Đã thêm tiêu chí mới.")
  };
}
