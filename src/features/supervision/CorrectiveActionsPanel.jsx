import { useMemo, useState } from "react";
import useSupervisionCorrectiveActions from "../../hooks/useSupervisionCorrectiveActions.js";
import "../../styles/corrective-actions.css";

const STATUS = { open: "Chờ xử lý", in_progress: "Đang xử lý", resolved: "Chờ xác nhận", verified: "Đã hoàn tất", cancelled: "Đã hủy" };

function formatDate(value) { return value ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`)) : "Chưa đặt hạn"; }

export default function CorrectiveActionsPanel({ adminMode = false }) {
  const workflow = useSupervisionCorrectiveActions();
  const [filter, setFilter] = useState("active");
  const visible = useMemo(() => workflow.actions.filter((item) => filter === "all" || (filter === "active" ? !["verified", "cancelled"].includes(item.status) : item.status === filter)), [filter, workflow.actions]);
  const overdue = workflow.actions.filter((item) => item.due_on && item.due_on < new Date().toISOString().slice(0, 10) && !["verified", "cancelled"].includes(item.status)).length;
  return <section className={`corrective-panel${adminMode ? " admin-mode" : ""}`}>
    <header><div><p>Theo dõi sau kiểm tra</p><h1>Lỗi cần khắc phục</h1><span>Mỗi lỗi được giao người phụ trách, hạn xử lý và trạng thái rõ ràng.</span></div><button type="button" onClick={workflow.reload}>Làm mới</button></header>
    <div className="corrective-kpis"><article><span>Đang mở</span><strong>{workflow.actions.filter((item) => ["open", "in_progress"].includes(item.status)).length}</strong></article><article className={overdue ? "danger" : ""}><span>Quá hạn</span><strong>{overdue}</strong></article><article><span>Chờ xác nhận</span><strong>{workflow.actions.filter((item) => item.status === "resolved").length}</strong></article></div>
    <label className="corrective-filter"><span>Trạng thái</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">Cần xử lý</option><option value="open">Chờ xử lý</option><option value="in_progress">Đang xử lý</option><option value="resolved">Chờ xác nhận</option><option value="verified">Đã hoàn tất</option><option value="all">Tất cả</option></select></label>
    {workflow.error ? <p className="corrective-error">{workflow.error}</p> : null}
    {workflow.loading ? <p className="corrective-empty">Đang tải danh sách…</p> : null}
    {!workflow.loading && !visible.length ? <p className="corrective-empty">Chưa có lỗi cần khắc phục.</p> : null}
    <div className="corrective-list">{visible.map((action) => <CorrectiveCard key={action.id} action={action} workflow={workflow} adminMode={adminMode} />)}</div>
  </section>;
}

function CorrectiveCard({ action, workflow, adminMode }) {
  const [form, setForm] = useState({ status: action.status, assignedEmployeeId: action.assigned_employee_id || "", dueOn: action.due_on || "", resolutionNote: action.resolution_note || "" });
  const branchEmployees = workflow.employees.filter((employee) => workflow.assignments.some((item) => item.employee_id === employee.id && item.branch_uuid === action.inspection?.branch_uuid));
  const isOverdue = action.due_on && action.due_on < new Date().toISOString().slice(0, 10) && !["verified", "cancelled"].includes(action.status);
  return <article className={`corrective-card${isOverdue ? " overdue" : ""}`}><header><div><small>{action.answer?.item_code_snapshot || "Lỗi kiểm tra"} · {action.inspection?.inspection_code}</small><strong>{action.title}</strong><span>{action.inspection?.branch_name_snapshot}</span></div><b className={`status-${action.status}`}>{STATUS[action.status]}</b></header>
    {action.answer?.note ? <blockquote>Ghi nhận: {action.answer.note}</blockquote> : null}
    <div className="corrective-form"><label><span>Người phụ trách</span><select value={form.assignedEmployeeId} onChange={(event) => setForm({ ...form, assignedEmployeeId: event.target.value })}><option value="">Chưa giao người phụ trách</option>{branchEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label><label><span>Hạn xử lý</span><input type="date" value={form.dueOn} onChange={(event) => setForm({ ...form, dueOn: event.target.value })} /></label><label className="wide"><span>Ghi chú khắc phục</span><textarea rows="2" value={form.resolutionNote} placeholder="Mô tả việc đã xử lý…" onChange={(event) => setForm({ ...form, resolutionNote: event.target.value })} /></label></div>
    <footer><span>{isOverdue ? `Đã quá hạn từ ${formatDate(action.due_on)}` : `Hạn: ${formatDate(action.due_on)}`}</span><div>{action.status === "open" ? <button type="button" disabled={workflow.savingId === action.id} onClick={() => workflow.save({ id: action.id, ...form, status: "in_progress" })}>Bắt đầu xử lý</button> : null}{action.status === "in_progress" ? <button type="button" disabled={workflow.savingId === action.id} onClick={() => workflow.save({ id: action.id, ...form, status: "resolved" })}>Đã khắc phục</button> : null}{action.status === "resolved" && adminMode ? <button type="button" disabled={workflow.savingId === action.id} onClick={() => workflow.save({ id: action.id, ...form, status: "verified" })}>Xác nhận hoàn tất</button> : null}<button className="primary" type="button" disabled={workflow.savingId === action.id} onClick={() => workflow.save({ id: action.id, ...form })}>{workflow.savingId === action.id ? "Đang lưu…" : "Lưu cập nhật"}</button></div></footer>
  </article>;
}
