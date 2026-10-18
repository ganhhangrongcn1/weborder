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
  const analysis = result?.analysis;
  const owner = s.current?.feedback;
  const [example, setExample] = useState(false);
  const readyToCopy = owner && s.text === owner.final_text && owner.final_text &&
    (!owner.requires_review || (owner.status === 'approved' && owner.approved_version === owner.version));
  const needsManager = owner?.requires_review && !s.access.approve && !readyToCopy;
  const waitingForManager = needsManager && owner.status === 'pending' && s.text === owner.final_text;
  const primaryLabel = waitingForManager ? 'Đang chờ quản lý duyệt' : readyToCopy && !example ? 'Sao chép câu trả lời'
    : needsManager ? 'Gửi quản lý duyệt'
    : s.access.approve ? 'Duyệt & sao chép' : 'Lưu & sao chép';
  const input = (
    <form onSubmit={e => { e.preventDefault(); s.analyze(); }}>
      <fieldset disabled={s.busy || !!s.current}>
        <label className="gr-comment-label">Bình luận
          <textarea required rows={4} maxLength={6000} placeholder="Dán bình luận của khách tại đây…"
            value={s.form.comment} onChange={e => s.setForm({ ...s.form, comment: e.target.value })}/>
        </label>
        {!s.imageConfirmed && <label className="gr-check gr-notice">
          <input type="checkbox" checked={s.imageConfirmed} onChange={e => s.setImageConfirmed(e.target.checked)}/>
          Tôi đã kiểm tra và sửa đúng văn bản trong ảnh.
        </label>}
        <details className="gr-extra" open={!s.imageConfirmed ? true : undefined}>
          <summary>Thêm thông tin cửa hàng hoặc ảnh</summary>
          <div className="gr-fields">
            <PlatformSelect value={s.form.platform} onChange={v => s.setForm({ ...s.form, platform: v })}/>
            <BranchSelect branches={s.branches} locked={!!s.access.branch} value={s.form.branch_uuid}
              onChange={v => s.setForm({ ...s.form, branch_uuid: v })}/>
          </div>
          <label>Thông tin cửa hàng đã xác minh (nếu có)
            <textarea rows={3} maxLength={6000} placeholder="Ví dụ: Đã kiểm tra và xác nhận đơn thiếu topping. Nếu chưa rõ, cứ để trống."
              value={s.form.facts} onChange={e => s.setForm({ ...s.form, facts: e.target.value })}/>
          </label>
          <label>Hoặc chọn ảnh bình luận
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
              const file = e.target.files?.[0]; if (file) s.extract(file); e.target.value = '';
            }}/>
          </label>
          <small>Ảnh PNG/JPEG/WebP tối đa 1 MB. Ẩn thông tin cá nhân không cần thiết trước khi gửi.</small>
        </details>
      </fieldset>
      {!result && <div className="gr-create-action"><AdminButton type="submit"
        disabled={s.busy || !s.imageConfirmed || !s.form.comment.trim()}>Tạo gợi ý trả lời</AdminButton>
        <small>Chưa đủ thông tin thì Gánh sẽ đề xuất cách xác minh, không tự đoán.</small>
      </div>}
    </form>
  );
  return <div className="gr-simple-compose">
    <AdminCard>
      <div className="gr-card-title"><h2>{result ? 'Bình luận đang trả lời' : 'Dán bình luận của khách'}</h2>
        {result && <AdminButton variant="secondary" disabled={s.busy} onClick={s.newDraft}>Bình luận mới</AdminButton>}
      </div>
      {result ? <details className="gr-original-comment"><summary>{s.form.comment}</summary>{input}</details> : input}
    </AdminCard>
    {result && <AdminCard className="gr-reply-card">
      <div className="gr-card-title"><h2>Gợi ý trả lời</h2><span className="gr-badge">{statusLabel[owner.status]}</span></div>
      <p className="gr-insight-brief"><strong>Gánh hiểu rằng:</strong> {analysis.insight}</p>
      {owner.requires_review && <p className="gr-notice">{s.access.approve
        ? 'Tình huống nhạy cảm. Anh/chị đọc kỹ và duyệt nội dung trước khi sao chép.'
        : readyToCopy ? 'Quản lý đã duyệt phiên bản này.' : 'Tình huống này cần quản lý duyệt trước khi sao chép.'}</p>}
      <label>Câu trả lời — có thể chỉnh trực tiếp
        <textarea aria-label="Câu trả lời" rows={5} maxLength={1800} disabled={s.busy}
          value={s.text} onChange={e => s.setText(e.target.value)}/>
      </label>
      <div className="gr-actions gr-primary-actions">
        <AdminButton disabled={s.busy || !s.text.trim() || waitingForManager} onClick={async () => { await s.saveAndCopy(example); setExample(false); }}>{primaryLabel}</AdminButton>
        <AdminButton variant="secondary" disabled={s.busy || owner.created_by !== s.access.user_id}
          onClick={() => s.rewrite(s.reason.trim() || 'Viết lại tự nhiên và ngắn gọn hơn, giữ nguyên dữ kiện đã cung cấp.')}>
          Viết lại
        </AdminButton>
      </div>
      <details className="gr-extra gr-alternatives"><summary>Đổi cách trả lời</summary>
        <p>{result.reason}</p>
        <div className="gr-options">{Object.entries(optionLabel).map(([key,label]) =>
          <button type="button" aria-pressed={s.selected === key} key={key}
            className={s.selected === key ? 'is-selected' : ''} disabled={s.busy} onClick={() => s.choose(key)}>
            <strong>{key}. {label} {result.recommended === key ? '· Gợi ý phù hợp nhất' : ''}</strong>
            <span>{result.options[key]}</span>
          </button>
        )}</div>
      </details>
      <details className="gr-extra"><summary>Xem phân tích và thông tin cần xác minh</summary>
        <dl className="gr-insight">{[
          ['Loại phản hồi',({ complaint: 'Phàn nàn', praise: 'Khen', question: 'Hỏi', sarcasm: 'Mỉa mai', abuse: 'Ngôn ngữ tiêu cực', other: 'Khác' })[analysis.feedback_type]],
          ['Chủ đề',analysis.category],['Cảm xúc',analysis.emotion],['Khách mong muốn',analysis.expectation],
          ['Rủi ro công khai',analysis.public_risk],['Trách nhiệm cửa hàng',responsibilityLabel[analysis.responsibility]],
          ['Cách xử lý',analysis.strategy],['Kênh xử lý',analysis.channel === 'private' ? 'Chuyển trao đổi riêng' : 'Công khai']
        ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <h3>Cần xác minh thêm</h3>{analysis.verify.length
          ? <ul>{analysis.verify.map((value,i) => <li key={i}>{value}</li>)}</ul>
          : <p>AI chưa nêu thêm thông tin cần xác minh. Nhân viên vẫn cần kiểm tra dữ kiện.</p>}
      </details>
      <details className="gr-extra"><summary>Lưu bản nháp và góp ý cho Gánh</summary>
        <label>Điều cần cải thiện (không bắt buộc)
          <input maxLength={1000} disabled={s.busy} placeholder="Ví dụ: Ngắn hơn, tự nhiên hơn…"
            value={s.reason} onChange={e => s.setReason(e.target.value)}/>
        </label>
        {s.access.brain && <label className="gr-check"><input type="checkbox" checked={example}
          onChange={e => setExample(e.target.checked)}/>Lưu câu được duyệt làm ví dụ tốt cho Gánh</label>}
        <AdminButton variant="secondary" disabled={s.busy || !s.text.trim()} onClick={() => s.save(false)}>Lưu để xử lý sau</AdminButton>
        {!!s.current.revisions?.length && <details><summary>Các phiên bản đã lưu</summary>
          {s.current.revisions.map(r => <article key={r.id}><strong>v{r.version}</strong><p>{r.text}</p><small>{r.reason}</small></article>)}
        </details>}
      </details>
      <small>Chỉ sao chép nội dung; Gánh Reply không tự đăng bình luận.</small>
    </AdminCard>}
  </div>;
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
  return <section className="ganh-reply" aria-busy={s.busy}><header className="gr-hero"><div><h1>Gánh Reply <span>✦</span></h1><p>Dán bình luận, Gánh gợi ý cách trả lời.</p></div><span className="gr-badge">{s.access ? 'Trợ lý trả lời khách' : 'Đang kết nối'}</span></header>
    {s.message && <div className="gr-message" role="status">{s.message}</div>}{s.busy && <p role="status">Đang xử lý…</p>}
    {!s.access ? <AdminCard><p>Đăng nhập tài khoản được cấp quyền để sử dụng Gánh Reply.</p><AdminButton disabled={s.busy} onClick={s.bootstrap}>Kết nối lại</AdminButton></AdminCard> : <>
      <nav className="gr-tabs" aria-label="Các mục Gánh Reply">{[['compose','Trả lời khách'],['history','Lịch sử'],...(s.access.brain ? [['brain','Kiến thức Gánh']] : []),['stats','Thống kê']].map(([id,label]) => <button type="button" key={id} disabled={s.busy} aria-current={s.tab === id ? 'page' : undefined} className={s.tab === id ? 'is-active' : ''} onClick={() => s.changeTab(id)}>{label}</button>)}</nav>
      {s.tab === 'compose' && <Compose key={s.current?.feedback.id || 'new'} state={s}/>}{s.tab === 'history' && <History state={s}/>}{s.tab === 'brain' && <BrainEditor state={s}/>}{s.tab === 'stats' && <Stats state={s}/>}
    </>}
  </section>;
}
