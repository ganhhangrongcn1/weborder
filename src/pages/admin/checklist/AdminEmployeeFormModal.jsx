import { AdminButton, AdminInput, AdminSelect } from "../ui/index.js";
import EmployeeBranchPicker from "./EmployeeBranchPicker.jsx";

const employeeTypeOptions = [
  { value: "official", label: "Nhân viên chính thức" },
  { value: "probation", label: "Thử việc" },
  { value: "part_time", label: "Bán thời gian" },
  { value: "seasonal", label: "Thời vụ" }
];

function Field({ label, required = false, children, className = "" }) {
  return <label className={className}><span>{label}{required ? <b className="employee-required-mark" aria-label="bắt buộc">*</b> : null}</span>{children}</label>;
}

export default function AdminEmployeeFormModal({ form, setForm, files, setFiles, branches, positions, departments, error, saving, onClose, onSubmit, onToggleBranch }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const activePositions = positions.filter((item) => form.id || item.is_active);
  const activeDepartments = departments.filter((item) => form.id || item.is_active);

  return (
    <div className="checklist-admin-modal-backdrop" onMouseDown={onClose}>
      <section className="checklist-admin-modal employee-profile-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><h2>{form.id ? "Cập nhật nhân viên" : "Thêm nhân viên"}</h2><p>Thông tin nền tảng để quản lý nhân sự, chấm công và tính lương về sau.</p></div><button type="button" onClick={onClose}>×</button></header>
        <form onSubmit={onSubmit}>
          {error ? <p className="checklist-admin-message error employee-form-error">{error}</p> : null}

          <section className="employee-form-section">
            <h3>Thông tin công việc</h3>
            <div className="checklist-admin-form-grid">
              <Field label="Mã nhân viên"><AdminInput readOnly value={form.employeeCode || "Tự động tạo khi lưu"} className="checklist-auto-code-input" /></Field>
              <Field label="Ngày bắt đầu" required><AdminInput required type="date" value={form.startedOn} onValueChange={(value) => update("startedOn", value)} /></Field>
              <Field label="Họ và tên" required className="employee-form-wide"><AdminInput required value={form.fullName} onValueChange={(value) => update("fullName", value)} placeholder="Nguyễn Văn A" /></Field>
              <Field label="Vị trí" required><AdminSelect required value={form.positionId} onChange={(event) => update("positionId", event.target.value)} options={[{ value: "", label: "Chọn vị trí" }, ...activePositions.map((item) => ({ value: item.id, label: `${item.name}${item.is_active ? "" : " (đã tạm ngưng)"}` }))]} /></Field>
              <Field label="Bộ phận" required><AdminSelect required value={form.departmentId} onChange={(event) => update("departmentId", event.target.value)} options={[{ value: "", label: "Chọn bộ phận" }, ...activeDepartments.map((item) => ({ value: item.id, label: item.name }))]} /></Field>
              <Field label="Loại nhân viên" required><AdminSelect required value={form.employeeType} onChange={(event) => update("employeeType", event.target.value)} options={employeeTypeOptions} /></Field>
              <Field label="Cấp bậc"><AdminInput value={form.levelCode} onValueChange={(value) => update("levelCode", value)} placeholder="Ví dụ: Level 1" /></Field>
              <Field label="Trạng thái"><AdminSelect value={form.employmentStatus} onChange={(event) => update("employmentStatus", event.target.value)} options={[{ value: "active", label: "Đang làm" }, { value: "inactive", label: "Tạm nghỉ" }, { value: "left", label: "Đã nghỉ" }]} /></Field>
              <Field label="Hình thức trả lương"><AdminSelect value={form.payrollMethod} onChange={(event) => update("payrollMethod", event.target.value)} options={[{ value: "bank_transfer", label: "Chuyển khoản" }, { value: "cash", label: "Tiền mặt" }]} /></Field>
              <Field label="Mức lương"><AdminInput type="number" min="0" value={form.baseSalary} onValueChange={(value) => update("baseSalary", value)} placeholder="0" /></Field>
              <Field label="Mức lương KPI"><AdminInput type="number" min="0" value={form.kpiSalary} onValueChange={(value) => update("kpiSalary", value)} placeholder="0" /></Field>
            </div>
            <EmployeeBranchPicker branches={branches} selectedIds={form.branchUuids} onToggle={onToggleBranch} />
          </section>

          <section className="employee-form-section">
            <h3>Thông tin cá nhân</h3>
            <div className="checklist-admin-form-grid">
              <Field label="Email"><AdminInput type="email" value={form.email} onValueChange={(value) => update("email", value)} /></Field>
              <Field label="Số điện thoại" required><AdminInput required inputMode="tel" value={form.phone} onValueChange={(value) => update("phone", value)} /></Field>
              <Field label="Ngày sinh"><AdminInput type="date" value={form.birthDate} onValueChange={(value) => update("birthDate", value)} /></Field>
              <Field label="Giới tính"><AdminSelect value={form.gender} onChange={(event) => update("gender", event.target.value)} options={[{ value: "", label: "Chọn giới tính" }, { value: "male", label: "Nam" }, { value: "female", label: "Nữ" }, { value: "other", label: "Khác" }]} /></Field>
              <Field label="Tỉnh / thành phố"><AdminInput value={form.addressProvince} onValueChange={(value) => update("addressProvince", value)} /></Field>
              <Field label="Quận / huyện"><AdminInput value={form.addressDistrict} onValueChange={(value) => update("addressDistrict", value)} /></Field>
              <Field label="Số nhà, tên đường" className="employee-form-wide"><AdminInput value={form.addressLine} onValueChange={(value) => update("addressLine", value)} /></Field>
            </div>
          </section>

          <section className="employee-form-section">
            <h3>Ngân hàng và giấy tờ</h3>
            <div className="checklist-admin-form-grid">
              <Field label="Ngân hàng"><AdminInput value={form.bankName} onValueChange={(value) => update("bankName", value)} /></Field>
              <Field label="Số tài khoản ngân hàng"><AdminInput value={form.bankAccountNumber} onValueChange={(value) => update("bankAccountNumber", value)} /></Field>
              <Field label="Tên chủ tài khoản"><AdminInput value={form.bankAccountHolder} onValueChange={(value) => update("bankAccountHolder", value)} /></Field>
              <Field label="Số CCCD"><AdminInput value={form.nationalIdNumber} onValueChange={(value) => update("nationalIdNumber", value)} /></Field>
              <Field label="Ngày cấp CCCD"><AdminInput type="date" value={form.nationalIdIssuedOn} onValueChange={(value) => update("nationalIdIssuedOn", value)} /></Field>
            </div>
            <div className="employee-document-grid">
              <label><span>Mặt trước CCCD</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles((current) => ({ ...current, front: event.target.files?.[0] || null }))} /><strong>{files.front?.name || (form.nationalIdFrontUrl ? "Đã lưu ảnh mặt trước" : "Chọn hoặc chụp ảnh")}</strong><small>JPG, PNG hoặc WebP · tối đa 5 MB</small></label>
              <label><span>Mặt sau CCCD</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFiles((current) => ({ ...current, back: event.target.files?.[0] || null }))} /><strong>{files.back?.name || (form.nationalIdBackUrl ? "Đã lưu ảnh mặt sau" : "Chọn hoặc chụp ảnh")}</strong><small>JPG, PNG hoặc WebP · tối đa 5 MB</small></label>
            </div>
          </section>

          <footer><AdminButton type="button" variant="secondary" onClick={onClose}>Hủy</AdminButton><AdminButton type="submit" disabled={saving}>{saving ? "Đang lưu…" : "Lưu nhân viên"}</AdminButton></footer>
        </form>
      </section>
    </div>
  );
}
