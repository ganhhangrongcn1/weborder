import { useEffect, useState } from "react";
import { readStampSummary, saveStampProgram } from "../../../services/stampProgramService.js";

export default function StampProgramSettings({ products = [] }) {
  const [enabled, setEnabled] = useState(false);
  const [ids, setIds] = useState(["", "", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    readStampSummary("", { admin: true }).then((data) => {
      if (!active) return;
      setEnabled(data.enabled);
      setIds(Array.from({ length: 3 }, (_, index) => data.giftIds?.[index] || data.gifts[index]?.id || ""));
    }).catch(() => { if (active) setMessage("Chưa kết nối được chương trình tem. Cần cập nhật máy chủ trước khi cấu hình."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save() {
    const selected = ids.filter(Boolean);
    if (enabled && new Set(selected).size !== 3) { setMessage("Chọn đúng 3 món khác nhau trước khi bật."); return; }
    setSaving(true);
    try { await saveStampProgram(enabled, selected); setMessage("Đã lưu chương trình tích tem."); }
    catch (error) { setMessage(error.message || "Chưa lưu được chương trình."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-xl border border-orange-100 bg-white p-4">
    <h3 className="font-bold">Tích 10 tem — chọn 1 món quà</h3>
    <p className="my-3 text-sm text-slate-600">Một số điện thoại tối đa 1 tem/ngày. Chỉ tích đơn mới có trả tiền từ lúc bật. Quà nhận tại quán; điểm thưởng theo hạng giữ nguyên.</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} disabled={loading || saving} onChange={(event) => setEnabled(event.target.checked)} />Bật chương trình</label>
    <div className="my-4 grid gap-3">{ids.map((id, index) => <label key={index}>Món quà {index + 1}
      <select className="admin-input mt-1" value={id} disabled={loading || saving} onChange={(event) => setIds((current) => current.map((value, i) => i === index ? event.target.value : value))}>
        <option value="">Chọn món từ menu</option>{id && !products.some((p) => p.id === id && p.active !== false && p.visible !== false) && <option value={id}>Món đã ngừng bán — chọn món khác để bật</option>}{products.filter((p) => p.active !== false && p.visible !== false).map((p) => <option key={p.id} value={p.id} disabled={ids.includes(p.id) && p.id !== id}>{p.name}</option>)}
      </select></label>)}</div>
    <p className="mb-3 text-sm text-slate-600">Món quà là phần cơ bản, không kèm topping. Khách được chọn 1 trong 3 món; món hết bán không thể đổi.</p>
    <button className="admin-cta" type="button" disabled={loading || saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu chương trình tem"}</button>
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
  </section>;
}
