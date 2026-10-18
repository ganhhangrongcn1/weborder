import { useCallback, useEffect, useRef, useState } from 'react';
import { ganhReplyRequest, GANH_ENABLED, readReplyImage } from '../../services/ganhReplyService.js';

export default function useGanhReply() {
  const running = useRef(false);
  const [tab, setTab] = useState('compose');
  const [access, setAccess] = useState(null);
  const [branches, setBranches] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ comment: '', facts: '', platform: 'tiktok', branch_uuid: '' });
  const [imageConfirmed, setImageConfirmed] = useState(true);
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState('A');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState({ rows: [], count: 0, page: 0 });
  const [filters, setFilters] = useState({ search: '', platform: '', branch_uuid: '', category: '', feedback_type: '', status: '' });
  const [brain, setBrain] = useState({ documents: [], rules: [], examples: [] });
  const [stats, setStats] = useState(null);
  const run = useCallback(async (task) => {
    if (running.current) return null;
    running.current = true;
    setBusy(true); setMessage('');
    try { return await task(); }
    catch (error) { setMessage(error.message || 'Thao tác chưa hoàn tất.'); return null; }
    finally { running.current = false; setBusy(false); }
  }, []);
  const apply = (data) => {
    setCurrent(data);
    const key = data.suggestion?.result?.recommended || 'A';
    setSelected(key); setText(data.feedback.final_text || data.suggestion?.result?.options?.[key] || '');
    setForm({ comment: data.feedback.comment, facts: data.feedback.facts, platform: data.feedback.platform, branch_uuid: data.feedback.branch_uuid || '' });
    setReason(''); setImageConfirmed(true);
  };
  const bootstrap = useCallback(() => run(async () => {
    const data = await ganhReplyRequest('bootstrap');
    setAccess(data.access); setBranches(data.branches);
    setForm(f => ({ ...f, branch_uuid: data.access.branch || '' }));
  }), [run]);
  useEffect(() => { if (GANH_ENABLED) bootstrap(); }, [bootstrap]);
  const loadHistory = (page = 0) => run(async () => setHistory(await ganhReplyRequest('history', { ...filters, page })));
  const loadBrain = () => run(async () => setBrain(await ganhReplyRequest('list_brain')));
  const loadStats = () => run(async () => setStats(await ganhReplyRequest('stats')));
  const changeTab = (next) => { setTab(next); if (next === 'history') loadHistory(); if (next === 'brain') loadBrain(); if (next === 'stats') loadStats(); };
  const analyze = () => run(async () => {
    if (!imageConfirmed) throw new Error('Hãy kiểm tra và xác nhận văn bản trích xuất trước.');
    const data = await ganhReplyRequest('analyze', form); apply(data);
  });
  const extract = (file) => run(async () => {
    const image = await readReplyImage(file);
    const data = await ganhReplyRequest('extract', { image });
    setCurrent(null); setForm(f => ({ ...f, comment: data.comment })); setImageConfirmed(false);
    setMessage('Đã trích xuất. Kiểm tra văn bản và xác nhận trước khi phân tích.');
  });
  const choose = (key) => { setSelected(key); setText(current.suggestion.result.options[key]); };
  const save = (approve = false, example = false) => run(async () => {
    const data = await ganhReplyRequest('save', { feedback_id: current.feedback.id, suggestion_id: current.suggestion.id,
      version: current.feedback.version, text, selected_option: selected, reason, approve, example });
    apply(data); setMessage(approve ? 'Đã duyệt và lưu phiên bản cuối.' : 'Đã lưu phiên bản, chờ Manager/Admin duyệt.');
  });
  const rewrite = (instructions) => run(async () => {
    const rewriteReason = typeof instructions === 'string' ? instructions : reason;
    if (!rewriteReason.trim()) throw new Error('Chọn hoặc nhập lý do cần viết lại.');
    // Preserve the editor revision and reason before generating again.
    const saved = await ganhReplyRequest('save', { feedback_id: current.feedback.id, suggestion_id: current.suggestion.id,
      version: current.feedback.version, text, selected_option: selected, reason: rewriteReason, approve: false });
    setCurrent(saved);
    const data = await ganhReplyRequest('rewrite', { feedback_id: saved.feedback.id, previous_text: text, reason: rewriteReason });
    apply(data);
  });
  const open = (id) => run(async () => { apply(await ganhReplyRequest('detail', { feedback_id: id })); setTab('compose'); });
  const copy = () => run(async () => {
    if (text !== current.feedback.final_text) throw new Error('Hãy lưu hoặc duyệt phiên bản vừa chỉnh trước khi sao chép.');
    const data = await ganhReplyRequest('copy', { feedback_id: current.feedback.id });
    await navigator.clipboard.writeText(data.text); setMessage('Đã sao chép câu trả lời đã lưu.');
  });
  const saveAndCopy = (example = false) => run(async () => {
    const feedback = current.feedback;
    const unchanged = text === feedback.final_text && Boolean(feedback.final_text);
    const reviewed = feedback.status === 'approved' && feedback.approved_version === feedback.version;
    let saved = current;
    if (!unchanged || (feedback.requires_review && !reviewed) || example) {
      saved = await ganhReplyRequest('save', {
        feedback_id: feedback.id, suggestion_id: current.suggestion.id, version: feedback.version,
        text, selected_option: selected, reason, approve: access.approve === true, example
      });
      apply(saved);
    }
    if (saved.feedback.requires_review &&
        (saved.feedback.status !== 'approved' || saved.feedback.approved_version !== saved.feedback.version)) {
      setMessage('Đã gửi quản lý duyệt. Sau khi được duyệt, anh/chị mở lại để sao chép.');
      return;
    }
    const data = await ganhReplyRequest('copy', { feedback_id: saved.feedback.id });
    try { await navigator.clipboard.writeText(data.text); }
    catch { throw new Error('Câu trả lời đã lưu. Trình duyệt chưa cho sao chép; hãy bấm sao chép lại.'); }
    setMessage('Đã lưu và sao chép. Anh/chị có thể dán trả lời khách ngay.');
  });
  const newDraft = () => { setCurrent(null); setText(''); setReason(''); setForm({ comment: '', facts: '', platform: 'tiktok', branch_uuid: access?.branch || '' }); setImageConfirmed(true); };
  const saveBrain = (doc) => run(async () => { await ganhReplyRequest('save_brain', doc); setBrain(await ganhReplyRequest('list_brain')); setMessage('Đã lưu Gánh Brain.'); return true; });
  const deleteBrain = (doc) => run(async () => { await ganhReplyRequest('delete_brain', doc); setBrain(await ganhReplyRequest('list_brain')); });
  const deleteExample = (id) => run(async () => { await ganhReplyRequest('delete_example', { id }); setBrain(await ganhReplyRequest('list_brain')); });
  const grantAccess = (grant) => run(async () => { await ganhReplyRequest('grant_access', grant); setMessage('Đã cập nhật quyền module.'); });
  return { tab, changeTab, access, branches, busy, message, form, setForm, imageConfirmed, setImageConfirmed,
    current, selected, text, setText, reason, setReason, history, filters, setFilters, brain, stats,
    bootstrap, analyze, extract, choose, save, rewrite, open, copy, saveAndCopy, newDraft, loadHistory, loadStats, saveBrain, deleteBrain, deleteExample, grantAccess };
}
