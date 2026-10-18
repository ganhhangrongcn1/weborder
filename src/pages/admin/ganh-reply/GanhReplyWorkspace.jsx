import { useState } from 'react';
import useGanhReply from '../../../features/ganh-reply/useGanhReply.js';
import { GANH_ENABLED, GANH_PLATFORMS, BRAIN_LABELS } from '../../../services/ganhReplyService.js';
import { AdminButton, AdminCard } from '../ui/AdminCommon.jsx';
import './ganhReply.css';

const statusLabel = { draft: 'Bản nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt' };
const responsibilityLabel = { confirmed_fault: 'Đã xác nhận có lỗi', no_fault: 'Không có lỗi theo dữ kiện', unknown: 'Chưa đủ thông tin' };
const optionLabel = { A: 'Tự nhiên, dễ thương', B: 'Chân thành, gần gũi', C: 'Khéo léo, có lập trường' };
function BranchSelect({ branches, value, onChange, locked, label = 'Chi nhánh' }) {
  return <label>{label}<select value={value} disabled={locked} onChange={e => onChange(e.target.value)}><option value="">Chưa xác định / toàn hệ thống</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>;
}
function PlatformSelect({ value, onChange, all = false }) {
  return <label>Nền tảng<select value={value} onChange={e => onChange(e.target.value)}>{all && <option value="">Tất cả nền tảng</option>}{GANH_PLATFORMS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>;
}
function BrainEditor({ state }) {
  const blank = { kind: 'identity', title: '', content: '' };
  const [doc, setDoc] = useState(blank);
  const [grant, setGrant] = useState({ auth_user_id: '', module_role: 'staff', branch_uuid: '', can_edit_brain: false, is_active: true });
  const editable = state.access.brain && !state.access.branch;
  const edit = row => setDoc({ ...row, kind: row.rule ? 'rule' : row.kind });
  return <div className="gr-grid"><AdminCard><h2>Gánh Brain</h2><p>Kiến thức và ví dụ được truy xuất khi soạn phản hồi. Chỉ ví dụ đã duyệt được dùng làm chuẩn.</p>
    {!state.brain.documents.length && <p>Chưa có tài liệu. Thêm Brand Identity và Brand Voice để bắt đầu. Chỉ nhập chính sách đã xác minh.</p>}
    {[...state.brain.documents, ...state.brain.rules.map(r => ({ ...r, rule: true }))].map(row => <article className="gr-list-row" key={row.id}><div><strong>{row.title}</strong><small>{BRAIN_LABELS[row.rule ? 'rule' : row.kind]} · v{row.version}</small></div><AdminButton variant="secondary" onClick={() => edit(row)}>Mở</AdminButton></article>)}
    <h3>Ví dụ chuẩn ({state.brain.examples.length} gần nhất)</h3>{state.brain.examples.map(row => <details key={row.id}><summary>{row.comment}</summary><p>{row.response}</p>{editable && <AdminButton variant="secondary" disabled={state.busy} onClick={() => state.deleteExample(row.id)}>Bỏ khỏi ví dụ chuẩn</AdminButton>}</details>)}
  </AdminCard><div><AdminCard><h2>{doc.id ? 'Chỉnh sửa tài liệu' : 'Thêm kiến thức'}</h2><form onSubmit={async e => { e.preventDefault(); const saved = await state.saveBrain({ ...doc, rule: doc.kind === 'rule' }); if (saved) setDoc(blank); }}>
    <label>Nhóm kiến thức<select disabled={!editable || state.busy || !!doc.id} value={doc.kind} onChange={e => setDoc({ ...doc, kind: e.target.value })}>{Object.entries(BRAIN_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label>Tiêu đề<input required maxLength={150} disabled={!editable || state.busy} value={doc.title} onChange={e => setDoc({ ...doc, title: e.target.value })}/></label>
    <label>Nội dung<textarea required maxLength={6000} rows={10} disabled={!editable || state.busy} value={doc.content} onChange={e => setDoc({ ...doc, content: e.target.value })}/></label>
    <div className="gr-actions"><AdminButton disabled={!editable || state.busy} type="submit">Lưu Brain</AdminButton><AdminButton type="button" variant="secondary" onClick={() => setDoc(blank)}>Tài liệu mới</AdminButton>{doc.id && <AdminButton disabled={!editable || state.busy} type="button" variant="secondary" onClick={() => state.deleteBrain({ id: doc.id, rule: doc.kind === 'rule' })}>Xóa tài liệu</AdminButton>}</div>
  </form></AdminCard>
  {state.access.role === 'admin' && <AdminCard><h2>Phân quyền module</h2><p>Dùng UUID tài khoản Supabase Auth đang có profile admin/staff hoạt động. Manager có thể duyệt; quyền Brain toàn hệ thống được ủy quyền riêng.</p><form onSubmit={e => { e.preventDefault(); state.grantAccess(grant); }}>
    <label>Auth user UUID<input required value={grant.auth_user_id} onChange={e => setGrant({ ...grant, auth_user_id: e.target.value })}/></label>
    <label>Vai trò<select value={grant.module_role} onChange={e => setGrant({ ...grant, module_role: e.target.value })}><option value="staff">Staff — soạn và gửi duyệt</option><option value="manager">Manager — soạn và duyệt</option></select></label>
    <BranchSelect branches={state.branches} value={grant.branch_uuid} onChange={v => setGrant({ ...grant, branch_uuid: v })}/>
    <label className="gr-check"><input type="checkbox" checked={grant.can_edit_brain} onChange={e => setGrant({ ...grant, can_edit_brain: e.target.checked })}/>Ủy quyền quản lý Brain (Manager toàn hệ thống)</label>
    <label className="gr-check"><input type="checkbox" checked={grant.is_active} onChange={e => setGrant({ ...grant, is_active: e.target.checked })}/>Quyền đang hoạt động (bỏ chọn để thu hồi)</label><AdminButton disabled={state.busy} type="submit">Cập nhật quyền</AdminButton>
  </form></AdminCard>}</div></div>;
}
function Compose({ state: s }) {
  const result = s.current?.suggestion?.result;
  const a = result?.analysis;
  const [example, setExample] = useState(false);
  const owner = s.current?.feedback;
  const canCopy = owner && s.text === owner.final_text && owner.final_text && (!owner.requires_review || (owner.status === 'approved' && owner.approved_version === owner.version));
  return <div className="gr-grid"><div><AdminCard><div className="gr-card-title"><h2>Tình huống khách hàng</h2><AdminButton variant="secondary" disabled={s.busy} onClick={s.newDraft}>Tạo mới</AdminButton></div><p>Nhập đúng dữ kiện. Ẩn địa chỉ và thông tin cá nhân không cần thiết trước khi gửi.</p>
    <form onSubmit={e => { e.preventDefault(); s.analyze(); }}><fieldset disabled={s.busy || !!s.current}>
      <div className="gr-fields"><PlatformSelect value={s.form.platform} onChange={v => s.setForm({ ...s.form, platform: v })}/><BranchSelect branches={s.branches} locked={!!s.access.branch} value={s.form.branch_uuid} onChange={v => s.setForm({ ...s.form, branch_uuid: v })}/></div>
      <label>Ảnh bình luận (không lưu ảnh)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const file = e.target.files?.[0]; if (file) s.extract(file); e.target.value = ''; }}/></label>
      <label>Bình luận<textarea required rows={5} maxLength={6000} placeholder="Dán bình luận của khách tại đây…" value={s.form.comment} onChange={e => s.setForm({ ...s.form, comment: e.target.value })}/></label>
      {!s.imageConfirmed && <label className="gr-check gr-notice"><input type="checkbox" checked={s.imageConfirmed} onChange={e => s.setImageConfirmed(e.target.checked)}/>Tôi đã kiểm tra và sửa đúng văn bản trong ảnh.</label>}
      <label>Thông tin đã xác minh từ cửa hàng<textarea rows={5} maxLength={6000} placeholder="Điều gì đã được xác minh? Điều gì còn chưa rõ? Không nhập số điện thoại/địa chỉ khách." value={s.form.facts} onChange={e => s.setForm({ ...s.form, facts: e.target.value })}/></label>
    </fieldset><AdminButton type="submit" disabled={s.busy || !!s.current || !s.imageConfirmed || !s.form.comment.trim()}>Phân tích & đề xuất</AdminButton></form>
  </AdminCard>{a && <AdminCard><h2>Hiểu tình huống trước khi trả lời</h2><dl className="gr-insight">
    {[['Loại phản hồi',({ complaint: 'Phàn nàn', praise: 'Khen', question: 'Hỏi', sarcasm: 'Mỉa mai', abuse: 'Ngôn ngữ tiêu cực', other: 'Khác' })[a.feedback_type]],['Chủ đề',a.category],['Cảm xúc',a.emotion],['Insight chính',a.insight],['Khách thực sự mong muốn',a.expectation],['Rủi ro công khai',a.public_risk],['Trách nhiệm cửa hàng',responsibilityLabel[a.responsibility]],['Chiến lược',a.strategy],['Mức nhạy cảm',a.sensitivity],['Kênh xử lý',a.channel === 'private' ? 'Chuyển trao đổi riêng' : 'Công khai']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl><h3>Cần xác minh thêm</h3>{a.verify.length ? <ul>{a.verify.map((v,i) => <li key={i}>{v}</li>)}</ul> : <p>AI chưa nêu thông tin cần xác minh thêm. Nhân viên vẫn cần kiểm tra dữ kiện.</p>}</AdminCard>}</div>
    <div>{!result ? <AdminCard><div className="gr-empty"><span aria-hidden="true">✦</span><h2>Mỗi câu trả lời đều giữ uy tín cho Gánh</h2><p>Bắt đầu với bình luận và dữ kiện thật. Gánh Reply sẽ giúp bạn hiểu insight, đánh giá rủi ro và chọn cách phản hồi phù hợp.</p></div></AdminCard> : <>
      <AdminCard><div className="gr-card-title"><h2>Ba cách trả lời</h2><span className="gr-badge">{statusLabel[owner.status]}</span></div><p>{result.reason}</p><div className="gr-options">{Object.entries(optionLabel).map(([key,label]) => <button type="button" aria-pressed={s.selected === key} key={key} className={s.selected === key ? 'is-selected' : ''} disabled={s.busy} onClick={() => s.choose(key)}><strong>{key}. {label} {result.recommended === key ? '· Đề xuất' : ''}</strong><span>{result.options[key]}</span></button>)}</div></AdminCard>
      <AdminCard><h2>Chỉnh câu trả lời cuối</h2>{owner.requires_review && <p className="gr-notice">Tình huống cần Manager/Admin duyệt đúng phiên bản trước khi sao chép.</p>}<label>Nội dung<textarea rows={6} maxLength={1800} disabled={s.busy} value={s.text} onChange={e => s.setText(e.target.value)}/></label>
      <label>Lý do chỉnh sửa / yêu cầu viết lại<select disabled={s.busy} value={['','Chưa đúng insight','Chưa đúng sự thật','Giọng văn chưa tự nhiên','Quá dài','Nhận lỗi khi chưa đủ căn cứ','Cam kết vượt chính sách'].includes(s.reason) ? s.reason : 'custom'} onChange={e => s.setReason(e.target.value === 'custom' ? 'Lý do khác: ' : e.target.value)}><option value="">Chọn lý do…</option>{['Chưa đúng insight','Chưa đúng sự thật','Giọng văn chưa tự nhiên','Quá dài','Nhận lỗi khi chưa đủ căn cứ','Cam kết vượt chính sách'].map(v => <option key={v}>{v}</option>)}<option value="custom">Lý do khác</option></select></label>
      <label>Ghi chú cải thiện<input maxLength={1000} disabled={s.busy} value={s.reason} onChange={e => s.setReason(e.target.value)}/></label>
      {s.access.brain && <label className="gr-check"><input type="checkbox" checked={example} onChange={e => setExample(e.target.checked)}/>Đánh dấu phiên bản được duyệt làm ví dụ chuẩn</label>}
      <div className="gr-actions"><AdminButton disabled={s.busy || !s.text.trim()} onClick={() => s.save(false)}>Lưu & gửi duyệt</AdminButton>{s.access.approve && <AdminButton disabled={s.busy || !s.text.trim()} onClick={() => s.save(true, example)}>Duyệt phiên bản này</AdminButton>}<AdminButton variant="secondary" disabled={s.busy || !s.reason.trim() || owner.created_by !== s.access.user_id} onClick={s.rewrite}>AI viết lại</AdminButton><AdminButton variant="secondary" disabled={s.busy || !canCopy} onClick={s.copy}>Sao chép</AdminButton></div>
      <small>v{owner.version} · Chỉ lưu và sao chép, không tự đăng lên mạng xã hội.</small>
      {!!s.current.revisions?.length && <details><summary>Các phiên bản đã lưu</summary>{s.current.revisions.map(r => <article key={r.id}><strong>v{r.version}</strong><p>{r.text}</p><small>{r.reason}</small></article>)}</details>}
      </AdminCard></>}
    </div></div>;
}
function History({ state: s }) {
  return <AdminCard><h2>Lịch sử phản hồi</h2><form className="gr-filters" onSubmit={e => { e.preventDefault(); s.loadHistory(); }}>
    <label>Tìm bình luận<input maxLength={100} value={s.filters.search} onChange={e => s.setFilters({ ...s.filters, search: e.target.value })}/></label><PlatformSelect all value={s.filters.platform} onChange={v => s.setFilters({ ...s.filters, platform: v })}/><BranchSelect branches={s.branches} locked={!!s.access.branch} value={s.filters.branch_uuid || s.access.branch || ''} onChange={v => s.setFilters({ ...s.filters, branch_uuid: v })}/>
    <label>Loại phản hồi<select value={s.filters.feedback_type} onChange={e => s.setFilters({ ...s.filters, feedback_type: e.target.value })}><option value="">Tất cả loại phản hồi</option>{Object.entries({ complaint:'Phàn nàn', praise:'Khen', question:'Hỏi', sarcasm:'Mỉa mai', abuse:'Ngôn ngữ tiêu cực', other:'Khác' }).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <label>Chủ đề (khớp chính xác)<input maxLength={100} value={s.filters.category} onChange={e => s.setFilters({ ...s.filters, category: e.target.value })}/></label>
    <label>Trạng thái<select value={s.filters.status} onChange={e => s.setFilters({ ...s.filters, status: e.target.value })}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabel).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><AdminButton disabled={s.busy} type="submit">Lọc</AdminButton>
    </form><p>{s.history.count} phản hồi trong phạm vi quyền.</p>{!s.history.rows.length && <p>Chưa có phản hồi phù hợp bộ lọc.</p>}{s.history.rows.map(row => <article className="gr-list-row" key={row.id}><div><strong>{row.comment}</strong><small>{GANH_PLATFORMS.find(x => x[0] === row.platform)?.[1]} · {statusLabel[row.status]} · {new Date(row.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok' })}</small><small>{s.branches.find(b => b.id === row.branch_uuid)?.name || 'Chưa xác định chi nhánh'} · {row.analysis.category}</small></div><AdminButton variant="secondary" disabled={s.busy} onClick={() => s.open(row.id)}>Mở</AdminButton></article>)}<div className="gr-actions"><AdminButton variant="secondary" disabled={s.busy || s.history.page === 0} onClick={() => s.loadHistory(s.history.page - 1)}>Trước</AdminButton><span>Trang {s.history.page + 1}</span><AdminButton variant="secondary" disabled={s.busy || (s.history.page + 1) * 20 >= s.history.count} onClick={() => s.loadHistory(s.history.page + 1)}>Sau</AdminButton></div></AdminCard>;
}
function CountList({ data }) {
  const rows = Object.entries(data || {}).sort((a,b) => b[1] - a[1]);
  return rows.length ? <ul className="gr-counts">{rows.map(([k,v]) => <li key={k}><span>{k}</span><strong>{v}</strong></li>)}</ul> : <p>Chưa có dữ liệu.</p>;
}
function Stats({ state: s }) {
  const d = s.stats;
  if (!d) return <AdminCard><p>Chưa tải được số liệu.</p><AdminButton onClick={s.loadStats} disabled={s.busy}>Tải thống kê</AdminButton></AdminCard>;
  return <><p>30 ngày gần nhất · Dữ liệu trong phạm vi quyền hiện tại. Tỷ lệ duyệt nguyên bản = số phản hồi đã duyệt giữ nguyên một đề xuất AI / số phản hồi đã phân tích.</p><div className="gr-metrics">{[['Đã phân tích',d.total],['Đã duyệt',d.approved],['Duyệt nguyên bản',d.total ? `${Math.round(d.exactApproved/d.total*100)}%` : 'Chưa có dữ liệu']].map(([k,v]) => <AdminCard key={k}><small>{k}</small><strong>{v}</strong></AdminCard>)}</div><div className="gr-grid"><AdminCard><h2>Chủ đề phàn nàn</h2><CountList data={d.categories}/></AdminCard><AdminCard><h2>Cảm xúc khách hàng</h2><CountList data={d.emotions}/></AdminCard></div><AdminCard><h2>Vấn đề lặp lại theo chi nhánh</h2>{Object.entries(d.branches).map(([branch,topics]) => <div key={branch}><h3>{s.branches.find(b => b.id === branch)?.name || 'Chưa xác định chi nhánh'}</h3><CountList data={Object.fromEntries(Object.entries(topics).filter(([,n]) => n > 1))}/></div>)}{!d.total && <p>Chưa có dữ liệu trong 30 ngày gần nhất.</p>}</AdminCard></>;
}
export default function GanhReplyWorkspace() {
  const s = useGanhReply();
  if (!GANH_ENABLED) return <AdminCard><h2>Gánh Reply</h2><p>Module chưa được bật trên môi trường này.</p></AdminCard>;
  return <section className="ganh-reply" aria-busy={s.busy}><header className="gr-hero"><div><span className="gr-eyebrow">GÁNH BRAIN / CUSTOMER INSIGHT</span><h1>Gánh Reply <span>✦</span></h1><p>Hiểu khách trước. Trả lời có duyên, giữ vững niềm tin.</p></div><span className="gr-badge">{s.access?.role || 'Đang kết nối'}</span></header>
    {s.message && <div className="gr-message" role="status">{s.message}</div>}{s.busy && <p role="status">Đang xử lý…</p>}
    {!s.access ? <AdminCard><p>Đăng nhập tài khoản được cấp quyền để sử dụng Gánh Reply.</p><AdminButton disabled={s.busy} onClick={s.bootstrap}>Kết nối lại</AdminButton></AdminCard> : <>
      <nav className="gr-tabs" aria-label="Các mục Gánh Reply">{[['compose','Gánh Reply'],['history','Lịch sử'],...(s.access.brain ? [['brain','Gánh Brain']] : []),['stats','Dashboard']].map(([id,label]) => <button type="button" key={id} disabled={s.busy} aria-current={s.tab === id ? 'page' : undefined} className={s.tab === id ? 'is-active' : ''} onClick={() => s.changeTab(id)}>{label}</button>)}</nav>
      {s.tab === 'compose' && <Compose key={s.current?.feedback.id || 'new'} state={s}/>}{s.tab === 'history' && <History state={s}/>}{s.tab === 'brain' && <BrainEditor state={s}/>}{s.tab === 'stats' && <Stats state={s}/>}
    </>}
  </section>;
}
