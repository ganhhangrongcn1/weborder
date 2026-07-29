import { useCallback, useEffect, useState } from "react";
import { createSupervisorAccount, listSupervisorAccounts, updateSupervisorAccount } from "../../../services/supervisorAccountService.js";
import { AdminBadge, AdminButton, AdminCard, AdminInput } from "../ui/index.js";
import { AdminEmptyState } from "../ui/AdminCommon.jsx";

const EMPTY_FORM = { name: "", phone: "", email: "", password: "", branchUuids: [] };

function branchId(branch) { return String(branch.branch_uuid || branch.id || ""); }

export default function AdminSupervisorAccounts({ branches = [] }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, setState] = useState({ loading: true, saving: false, message: "", error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const result = await listSupervisorAccounts();
    setAccounts(result.ok ? result.accounts || [] : []);
    setState((current) => ({ ...current, loading: false, error: result.ok ? "" : result.message }));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleFormBranch(id) {
    setForm((current) => ({ ...current, branchUuids: current.branchUuids.includes(id) ? current.branchUuids.filter((item) => item !== id) : [...current.branchUuids, id] }));
  }

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, saving: true, message: "", error: "" }));
    const result = await createSupervisorAccount(form);
    setState((current) => ({ ...current, saving: false, message: result.ok ? result.message : "", error: result.ok ? "" : result.message }));
    if (!result.ok) return;
    setForm(EMPTY_FORM);
    await load();
  }

  function changeAccount(authUserId, updater) {
    setAccounts((current) => current.map((account) => account.auth_user_id === authUserId ? updater(account) : account));
  }

  async function saveAccount(account) {
    setState((current) => ({ ...current, saving: true, message: "", error: "" }));
    const result = await updateSupervisorAccount(account);
    setState((current) => ({ ...current, saving: false, message: result.ok ? result.message : "", error: result.ok ? "" : result.message }));
    await load();
  }

  return <div className="supervisor-account-admin">
    <header className="checklist-config-heading"><div><p>Phân quyền vận hành</p><h1>Tài khoản giám sát</h1><span>Tạo tài khoản, phân chi nhánh và khóa quyền truy cập khi cần.</span></div><AdminButton variant="secondary" disabled={state.loading} onClick={load}>{state.loading ? "Đang tải…" : "Làm mới"}</AdminButton></header>
    {state.error ? <p className="checklist-admin-message error">{state.error}</p> : null}
    {state.message ? <p className="checklist-admin-message success">{state.message}</p> : null}
    <AdminCard className="supervisor-account-create"><header><h3>Thêm tài khoản giám sát</h3><p>Mật khẩu tạm tối thiểu 8 ký tự. Giám sát chỉ thấy các chi nhánh được chọn.</p></header><form onSubmit={submit}><div className="supervisor-account-fields"><label><span>Họ và tên <b>*</b></span><AdminInput required value={form.name} placeholder="Nguyễn Văn A" onValueChange={(value) => setForm({ ...form, name: value })} /></label><label><span>Số điện thoại <b>*</b></span><AdminInput required value={form.phone} placeholder="0901234567" onValueChange={(value) => setForm({ ...form, phone: value })} /></label><label><span>Email đăng nhập <b>*</b></span><AdminInput required type="email" value={form.email} placeholder="giamsat@ganhhangrong.vn" onValueChange={(value) => setForm({ ...form, email: value })} /></label><label><span>Mật khẩu tạm <b>*</b></span><AdminInput required type="password" minLength="8" value={form.password} placeholder="Tối thiểu 8 ký tự" onValueChange={(value) => setForm({ ...form, password: value })} /></label></div><fieldset className="supervisor-branch-picker"><legend>Chi nhánh phụ trách <b>*</b></legend>{branches.map((branch) => { const id = branchId(branch); return <label key={id}><input type="checkbox" checked={form.branchUuids.includes(id)} onChange={() => toggleFormBranch(id)} /><span>{branch.name}</span></label>; })}</fieldset><footer><AdminButton type="submit" disabled={state.saving || !form.branchUuids.length}>{state.saving ? "Đang tạo…" : "Tạo tài khoản"}</AdminButton></footer></form></AdminCard>
    <section className="supervisor-account-list"><header><h3>Danh sách giám sát</h3><span>{accounts.length} tài khoản</span></header>{state.loading && !accounts.length ? <AdminCard><AdminEmptyState message="Đang tải tài khoản giám sát…" /></AdminCard> : accounts.length ? accounts.map((account) => <AdminCard key={account.auth_user_id} className="supervisor-account-row"><div className="supervisor-account-identity"><div>{(account.name || account.email || "G").slice(0, 1).toUpperCase()}</div><span><strong>{account.name || "Chưa cập nhật tên"}</strong><small>{account.email} · {account.phone}</small></span><AdminBadge tone={account.status === "active" ? "success" : "neutral"}>{account.status === "active" ? "Đang hoạt động" : "Đã khóa"}</AdminBadge></div><fieldset className="supervisor-branch-picker compact"><legend>Phạm vi chi nhánh</legend>{branches.map((branch) => { const id = branchId(branch); return <label key={id}><input type="checkbox" disabled={account.status !== "active"} checked={(account.branch_uuids || []).includes(id)} onChange={() => changeAccount(account.auth_user_id, (current) => ({ ...current, branch_uuids: current.branch_uuids.includes(id) ? current.branch_uuids.filter((item) => item !== id) : [...current.branch_uuids, id] }))} /><span>{branch.name}</span></label>; })}</fieldset><footer><button type="button" disabled={state.saving} className={account.status === "active" ? "danger" : "secondary"} onClick={() => saveAccount({ ...account, status: account.status === "active" ? "inactive" : "active" })}>{account.status === "active" ? "Khóa tài khoản" : "Mở lại tài khoản"}</button><AdminButton disabled={state.saving || (account.status === "active" && !(account.branch_uuids || []).length)} onClick={() => saveAccount(account)}>Lưu phạm vi</AdminButton></footer></AdminCard>) : <AdminCard><AdminEmptyState message="Chưa có tài khoản giám sát." /></AdminCard>}</section>
  </div>;
}
