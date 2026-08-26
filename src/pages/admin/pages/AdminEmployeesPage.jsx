import { useMemo, useState } from "react";
import useChecklistManagement from "../../../hooks/useChecklistManagement.js";
import { loadChecklistDepartments, loadChecklistEmployees, loadChecklistPositions, saveChecklistEmployee, uploadChecklistEmployeeIdentityImage } from "../../../services/checklistManagementService.js";
import { AdminBadge, AdminButton, AdminCard, AdminSelect } from "../ui/index.js";
import { AdminEmptyState, AdminSearchInput } from "../ui/AdminCommon.jsx";
import AdminEmployeeMonthlyReport from "../checklist/AdminEmployeeMonthlyReport.jsx";
import AdminPositionCatalog from "../checklist/AdminPositionCatalog.jsx";
import AdminEmployeeFormModal from "../checklist/AdminEmployeeFormModal.jsx";
import BranchAccountSettings from "../store/BranchAccountSettings.jsx";

const EMPTY_FORM = {
  id: "", employeeCode: "", fullName: "", familyName: "", givenName: "", email: "", phone: "",
  positionId: "", departmentId: "", employeeType: "official", levelCode: "", baseSalary: "", kpiSalary: "",
  birthDate: "", gender: "", startedOn: "", employmentStatus: "active", addressProvince: "", addressDistrict: "",
  addressLine: "", bankName: "", bankAccountNumber: "", bankAccountHolder: "", nationalIdNumber: "",
  nationalIdIssuedOn: "", nationalIdFrontUrl: "", nationalIdBackUrl: "", payrollMethod: "bank_transfer", branchUuids: []
};
const STATUS_LABELS = { active: "Đang làm", inactive: "Tạm nghỉ", left: "Đã nghỉ" };

function employeeToForm(employee) {
  const nameParts = String(employee.full_name || "").trim().split(/\s+/);
  return {
    ...EMPTY_FORM,
    id: employee.id,
    employeeCode: employee.employee_code,
    fullName: employee.full_name,
    familyName: employee.family_name || nameParts.slice(0, -1).join(" "),
    givenName: employee.given_name || nameParts.at(-1) || "",
    email: employee.email || "",
    phone: employee.phone || "",
    positionId: employee.position_id || "",
    departmentId: employee.department_id || "",
    employeeType: employee.employee_type || "official",
    levelCode: employee.level_code || "",
    baseSalary: employee.base_salary ?? "",
    kpiSalary: employee.kpi_salary ?? "",
    birthDate: employee.birth_date || "",
    gender: employee.gender || "",
    employmentStatus: employee.employment_status,
    startedOn: employee.started_on || "",
    addressProvince: employee.address_province || "",
    addressDistrict: employee.address_district || "",
    addressLine: employee.address_line || "",
    bankName: employee.bank_name || "",
    bankAccountNumber: employee.bank_account_number || "",
    bankAccountHolder: employee.bank_account_holder || "",
    nationalIdNumber: employee.national_id_number || "",
    nationalIdIssuedOn: employee.national_id_issued_on || "",
    nationalIdFrontUrl: employee.national_id_front_url || "",
    nationalIdBackUrl: employee.national_id_back_url || "",
    payrollMethod: employee.payroll_method || "bank_transfer",
    branchUuids: employee.branchAssignments.map((assignment) => assignment.branch_uuid)
  };
}

export default function AdminEmployeesPage({ branches = [] }) {
  const employees = useChecklistManagement(loadChecklistEmployees);
  const positions = useChecklistManagement(loadChecklistPositions);
  const departments = useChecklistManagement(loadChecklistDepartments);
  const [activeTab, setActiveTab] = useState("list");
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState({ front: null, back: null });
  const employeeRows = employees.data || [];
  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.branch_uuid || branch.id, branch.name])), [branches]);
  const filteredRows = useMemo(() => employeeRows.filter((employee) => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    const matchesText = !keyword || [employee.full_name, employee.employee_code, employee.phone, employee.position_name].some((value) => String(value || "").toLocaleLowerCase("vi").includes(keyword));
    const matchesBranch = branchFilter === "all" || employee.branchAssignments.some((assignment) => assignment.branch_uuid === branchFilter);
    return matchesText && matchesBranch;
  }), [branchFilter, employeeRows, query]);

  const branchOptions = [{ value: "all", label: "Tất cả chi nhánh" }, ...branches.map((branch) => ({ value: branch.branch_uuid || branch.id, label: branch.name }))];
  const defaultPositionId = positions.data?.find((position) => position.position_code === "MULTI_SKILL" && position.is_active)?.id || positions.data?.find((position) => position.is_active)?.id || "";
  const defaultDepartmentId = departments.data?.find((department) => department.department_code === "STORE_OPERATIONS" && department.is_active)?.id || departments.data?.find((department) => department.is_active)?.id || "";

  async function handleSave(event) {
    event.preventDefault();
    if (form.branchUuids.length === 0) {
      employees.run(() => Promise.reject(new Error("Vui lòng chọn ít nhất một chi nhánh làm việc.")), "");
      return;
    }
    const saved = await employees.run(async () => {
      let savedEmployee = await saveChecklistEmployee(form);
      const frontPath = files.front ? await uploadChecklistEmployeeIdentityImage(savedEmployee.id, "front", files.front) : form.nationalIdFrontUrl;
      const backPath = files.back ? await uploadChecklistEmployeeIdentityImage(savedEmployee.id, "back", files.back) : form.nationalIdBackUrl;
      if (frontPath !== form.nationalIdFrontUrl || backPath !== form.nationalIdBackUrl) {
        savedEmployee = await saveChecklistEmployee({ ...form, id: savedEmployee.id, employeeCode: savedEmployee.employee_code, nationalIdFrontUrl: frontPath, nationalIdBackUrl: backPath });
      }
      return savedEmployee;
    }, "Đã lưu thông tin nhân viên.");
    if (saved) setForm(null);
  }

  function openCreateForm() {
    setFiles({ front: null, back: null });
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, positionId: defaultPositionId, departmentId: defaultDepartmentId, startedOn: localDate });
  }

  function openEditForm(employee) {
    setFiles({ front: null, back: null });
    setForm(employeeToForm(employee));
  }

  function toggleBranch(branchUuid) {
    setForm((current) => ({ ...current, branchUuids: current.branchUuids.includes(branchUuid) ? current.branchUuids.filter((id) => id !== branchUuid) : [...current.branchUuids, branchUuid] }));
  }

  const tabs = [{ id: "list", label: "Danh sách nhân viên" }, { id: "accounts", label: "Tài khoản & phân quyền" }, { id: "evaluation", label: "Đánh giá tháng" }, { id: "positions", label: "Danh mục vị trí" }];
  if (activeTab === "accounts") {
    return <div className="checklist-admin-page"><nav className="checklist-admin-tabs">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav><BranchAccountSettings branches={branches} /></div>;
  }
  if (activeTab === "evaluation") {
    return <div className="checklist-admin-page"><nav className="checklist-admin-tabs">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav><AdminEmployeeMonthlyReport branches={branches} /></div>;
  }
  if (activeTab === "positions") {
    return <div className="checklist-admin-page"><nav className="checklist-admin-tabs">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav><AdminPositionCatalog /></div>;
  }

  return (
    <div className="checklist-admin-page">
      <nav className="checklist-admin-tabs">{tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</nav>
      <div className="checklist-admin-summary">
        <AdminCard><small>Tổng nhân sự</small><strong>{employeeRows.length}</strong></AdminCard>
        <AdminCard><small>Đang làm</small><strong>{employeeRows.filter((item) => item.employment_status === "active").length}</strong></AdminCard>
        <AdminCard><small>Chưa gán chi nhánh</small><strong>{employeeRows.filter((item) => item.branchAssignments.length === 0).length}</strong></AdminCard>
      </div>

      <AdminCard className="checklist-admin-panel">
        <div className="checklist-admin-toolbar">
          <AdminSearchInput value={query} onValueChange={setQuery} placeholder="Tìm tên, mã hoặc số điện thoại" />
          <AdminSelect value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} options={branchOptions} />
          <AdminButton onClick={openCreateForm}>+ Thêm nhân viên</AdminButton>
        </div>
        {employees.error ? <p className="checklist-admin-message error">{employees.error}</p> : null}
        {employees.message ? <p className="checklist-admin-message success">{employees.message}</p> : null}
        {employees.loading ? <AdminEmptyState message="Đang tải danh sách nhân viên…" /> : null}
        {!employees.loading && filteredRows.length === 0 ? <AdminEmptyState message="Chưa có nhân viên phù hợp." /> : null}
        {filteredRows.length ? (
          <div className="checklist-admin-table-wrap"><table className="checklist-admin-table"><thead><tr><th>Nhân viên</th><th>Vị trí</th><th>Chi nhánh</th><th>Trạng thái</th><th /></tr></thead><tbody>
            {filteredRows.map((employee) => <tr key={employee.id}>
              <td><strong>{employee.full_name}</strong><small>{employee.employee_code}{employee.phone ? ` · ${employee.phone}` : ""}</small></td>
              <td>{employee.position_name}</td>
              <td><div className="checklist-admin-tags">{employee.branchAssignments.length ? employee.branchAssignments.map((assignment) => <span key={assignment.branch_uuid}>{branchMap.get(assignment.branch_uuid) || "Chi nhánh"}</span>) : <small>Chưa gán</small>}</div></td>
              <td><AdminBadge tone={employee.employment_status === "active" ? "success" : "neutral"}>{STATUS_LABELS[employee.employment_status]}</AdminBadge></td>
              <td><AdminButton variant="secondary" onClick={() => openEditForm(employee)}>Sửa</AdminButton></td>
            </tr>)}
          </tbody></table></div>
        ) : null}
      </AdminCard>

      {form ? <AdminEmployeeFormModal form={form} setForm={setForm} files={files} setFiles={setFiles} branches={branches} positions={positions.data || []} departments={departments.data || []} error={employees.error} saving={employees.saving} onClose={() => setForm(null)} onSubmit={handleSave} onToggleBranch={toggleBranch} /> : null}
    </div>
  );
}
