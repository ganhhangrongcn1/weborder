// Isolated visual review: no auth, repositories, print jobs or production writes.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ReceiptTemplateEditor from "../src/pages/admin/store/ReceiptTemplateEditor.jsx";
import { DEFAULT_RECEIPT_TEMPLATE } from "../ghr-pos-mobile-native/src/services/pos/receiptTemplate.js";

function Preview() {
  const [draft, setDraft] = useState({ ...DEFAULT_RECEIPT_TEMPLATE });
  return <ReceiptTemplateEditor draft={draft} loading={false} saving={false} loaded={false} previewOnly
    update={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
    reset={() => setDraft({ ...DEFAULT_RECEIPT_TEMPLATE })} save={() => {}}
    notice="Bản xem thử không lưu. Sau khi phát hành, anh vào Admin → Thiết lập hệ thống → Mẫu in bill để lưu mẫu thật." />;
}
createRoot(document.getElementById("root")).render(<Preview />);
