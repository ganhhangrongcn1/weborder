import { useEffect, useState } from "react";
import { getReceiptTemplate, loadReceiptTemplate, saveReceiptTemplate } from "../services/receiptTemplateService.js";
import { DEFAULT_RECEIPT_TEMPLATE } from "../../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js";

export default function useReceiptTemplateSettings() {
  const [draft, setDraft] = useState(getReceiptTemplate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    loadReceiptTemplate({ force: true }).then((value) => {
      if (active) { setDraft(value); setLoaded(true); }
    }).catch(() => { if (active) setNotice("Không tải được mẫu đã lưu. Anh vẫn có thể xem thử; hãy mở lại mục này để tải trước khi lưu."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setNotice(""); };
  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const next = await saveReceiptTemplate({ ...draft, enabled: true });
      setDraft(next);
      setNotice("Đã lưu lên máy chủ. Web và POS hỗ trợ mẫu chung sẽ nhận cấu hình trong khoảng 1 phút.");
    } catch { setNotice("Chưa lưu được. Anh kiểm tra kết nối và quyền tài khoản rồi thử lại."); }
    finally { setSaving(false); }
  }
  return { draft, update, loading, saving, loaded, notice, save,
    reset: () => { setDraft({ ...DEFAULT_RECEIPT_TEMPLATE }); setNotice("Đang xem mẫu mặc định, chưa lưu."); } };
}
