import { MagnifyingGlass, PencilSimple, Plus, UsersThree } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import Modal from "../components/ui/Modal.jsx";
import { useBranches } from "../hooks/useBranches.js";
import { useEmployees } from "../hooks/useEmployees.js";

const EMPTY_FORM = {
  id: "", employeeCode: "", fullName: "", phone: "", positionName: "Nhân viên",
  employmentStatus: "active", startedOn: "", branchUuids: []
};

const STATUS_LABELS = { active: "Đang làm", inactive: "Tạm nghỉ", left: "Đã nghỉ" };

function toForm(employee) {
  if (!employee) return EMPTY_FORM;
  return {
    id: employee.id,
    employeeCode: employee.employee_code,
    fullName: employee.full_name,
    phone: employee.phone || "",
    positionName: employee.position_name || "Nhân viên",
    employmentStatus: employee.employment_status,
    startedOn: employee.started_on || "",
    branchUuids: employee.branchAssignments.map((assignment) => assignment.branch_uuid)
  };
}

export default function PeopleManagementPage() {
  const branches = useBranches();
  const employees = useEmployees();
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [form, setForm] = useState(null);

  const branchMap = useMemo(
    () => new Map(branches.data.map((branch) => [branch.branch_uuid, branch.name])),
    [branches.data]
  );

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return employees.data.filter((employee) => {
      const matchesQuery = !normalizedQuery || [employee.full_name, employee.employee_code, employee.phone, employee.position_name]
        .some((value) => String(value || "").toLocaleLowerCase("vi").includes(normalizedQuery));
      const matchesBranch = branchFilter === "all" || employee.branchAssignments.some((item) => item.branch_uuid === branchFilter);
      return matchesQuery && matchesBranch;
    });
  }, [branchFilter, employees.data, query]);

  function toggleBranch(branchUuid) {
    setForm((current) => ({
      ...current,
      branchUuids: current.branchUuids.includes(branchUuid)
        ? current.branchUuids.filter((id) => id !== branchUuid)
        : [...current.branchUuids, branchUuid]
    }));
  }

  async function handleSave(event) {
    event.preventDefault();
    const saved = await employees.submit(form);
    if (saved) setForm(null);
  }

  return (
    <div className="management-page">
      <header className="management-heading">
        <div>
          <p className="eyebrow">Hồ sơ nền tảng</p>
          <h1>Quản lý nhân sự</h1>
          <p>Danh sách nhân viên theo chi nhánh. Sau này có thể nối thêm hợp đồng, chấm công, lương và đánh giá tháng.</p>
        </div>
        <button type="button" className="primary-action" onClick={() => setForm({ ...EMPTY_FORM })}>
          <Plus weight="bold" /> Thêm nhân viên
        </button>
      </header>

      <section className="summary-strip">
        <div><UsersThree weight="fill" /><span>Tổng nhân sự</span><strong>{employees.data.length}</strong></div>
        <div><span>Đang làm</span><strong>{employees.data.filter((item) => item.employment_status === "active").length}</strong></div>
        <div><span>Chưa gán chi nhánh</span><strong>{employees.data.filter((item) => item.branchAssignments.length === 0).length}</strong></div>
      </section>

      <section className="data-panel">
        <div className="table-toolbar">
          <label className="search-control"><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã hoặc số điện thoại" /></label>
          <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} aria-label="Lọc theo chi nhánh">
            <option value="all">Tất cả chi nhánh</option>
            {branches.data.map((branch) => <option key={branch.branch_uuid} value={branch.branch_uuid}>{branch.name}</option>)}
          </select>
        </div>

        {employees.error ? <p className="inline-message inline-message--error">{employees.error}</p> : null}
        {employees.message ? <p className="inline-message inline-message--success">{employees.message}</p> : null}

        <div className="table-scroll">
          <table className="management-table">
            <thead><tr><th>Nhân viên</th><th>Vị trí</th><th>Chi nhánh</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {employees.loading ? <tr><td colSpan="5" className="empty-cell">Đang tải danh sách…</td></tr> : null}
              {!employees.loading && filteredEmployees.length === 0 ? <tr><td colSpan="5" className="empty-cell">Chưa có nhân viên phù hợp.</td></tr> : null}
              {filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td><strong>{employee.full_name}</strong><small>{employee.employee_code}{employee.phone ? ` · ${employee.phone}` : ""}</small></td>
                  <td>{employee.position_name}</td>
                  <td><div className="tag-list">{employee.branchAssignments.length ? employee.branchAssignments.map((assignment) => <span className="soft-tag" key={assignment.branch_uuid}>{branchMap.get(assignment.branch_uuid) || "Chi nhánh"}</span>) : <span className="muted-text">Chưa gán</span>}</div></td>
                  <td><span className={`status-pill status-pill--${employee.employment_status}`}>{STATUS_LABELS[employee.employment_status]}</span></td>
                  <td><button type="button" className="table-action" onClick={() => setForm(toForm(employee))}><PencilSimple /> Sửa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {form ? (
        <Modal title={form.id ? "Cập nhật nhân viên" : "Thêm nhân viên"} description="Có thể chọn nhiều chi nhánh. Chi nhánh chọn đầu tiên là nơi làm việc chính." onClose={() => setForm(null)}>
          <form className="editor-form" onSubmit={handleSave}>
            <div className="form-grid">
              <label><span>Mã nhân viên *</span><input required value={form.employeeCode} onChange={(event) => setForm({ ...form, employeeCode: event.target.value })} placeholder="VD: NV001" /></label>
              <label><span>Họ và tên *</span><input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
              <label><span>Số điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" /></label>
              <label><span>Vị trí</span><input value={form.positionName} onChange={(event) => setForm({ ...form, positionName: event.target.value })} /></label>
              <label><span>Ngày bắt đầu</span><input type="date" value={form.startedOn} onChange={(event) => setForm({ ...form, startedOn: event.target.value })} /></label>
              <label><span>Trạng thái</span><select value={form.employmentStatus} onChange={(event) => setForm({ ...form, employmentStatus: event.target.value })}><option value="active">Đang làm</option><option value="inactive">Tạm nghỉ</option><option value="left">Đã nghỉ</option></select></label>
            </div>
            <fieldset className="branch-picker"><legend>Chi nhánh làm việc</legend>{branches.data.map((branch) => <label key={branch.branch_uuid}><input type="checkbox" checked={form.branchUuids.includes(branch.branch_uuid)} onChange={() => toggleBranch(branch.branch_uuid)} /><span>{branch.name}<small>{branch.address || branch.branch_code}</small></span></label>)}</fieldset>
            {employees.error ? <p className="inline-message inline-message--error">{employees.error}</p> : null}
            <footer className="form-actions"><button type="button" className="secondary-action" onClick={() => setForm(null)}>Hủy</button><button className="primary-action" disabled={employees.saving}>{employees.saving ? "Đang lưu…" : "Lưu nhân viên"}</button></footer>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
