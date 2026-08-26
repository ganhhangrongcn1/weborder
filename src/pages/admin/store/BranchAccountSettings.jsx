import { useEffect, useMemo, useState } from "react";
import { createBranchAccount, listBranchAccounts } from "../../../services/branchAccountService.js";
import { AdminButton, AdminCard, AdminInput } from "../ui/index.js";

const ROLE_OPTIONS = [
  { value: "staff", label: "POS / Nhân viên" },
  { value: "kitchen", label: "Bếp" },
  { value: "admin", label: "Quản lý chi nhánh" }
];

const STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  blocked: "Đã khóa"
};

function toText(value = "") {
  return String(value || "").trim();
}

function getBranchUuid(branch = {}) {
  return toText(branch.branch_uuid || branch.branchUuid || branch.uuid || branch.id);
}

function getBranchName(branch = {}) {
  return toText(branch.name || branch.branchName || branch.branch_name || "Chi nhánh");
}

function getRoleLabel(role = "") {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role || "Nhân viên";
}

function getStatusLabel(status = "") {
  return STATUS_LABELS[status] || status || "Không rõ";
}

function createInitialForm(branches = []) {
  const firstBranch = (Array.isArray(branches) ? branches : []).find((branch) => getBranchUuid(branch));
  return {
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "staff",
    accountScope: "branch",
    branchUuid: getBranchUuid(firstBranch)
  };
}

export default function BranchAccountSettings({ branches = [] }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(() => createInitialForm(branches));
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("");

  const branchOptions = useMemo(
    () => (Array.isArray(branches) ? branches : [])
      .map((branch) => ({
        uuid: getBranchUuid(branch),
        name: getBranchName(branch),
        code: toText(branch.branch_code || branch.branchCode)
      }))
      .filter((branch) => branch.uuid),
    [branches]
  );

  const branchNameByUuid = useMemo(() => {
    const map = new Map();
    branchOptions.forEach((branch) => {
      map.set(branch.uuid, branch.code ? `${branch.code} - ${branch.name}` : branch.name);
    });
    return map;
  }, [branchOptions]);

  useEffect(() => {
    setForm((current) => {
      if (current.branchUuid || !branchOptions.length) return current;
      return { ...current, branchUuid: branchOptions[0].uuid };
    });
  }, [branchOptions]);

  const loadAccounts = async ({ preserveMessage = false } = {}) => {
    setLoading(true);
    if (!preserveMessage) {
      setMessage("");
      setMessageTone("");
    }
    const result = await listBranchAccounts();
    setLoading(false);
    if (!result.ok) {
      setMessage(result.message || "Không tải được danh sách tài khoản chi nhánh.");
      setMessageTone("error");
      return;
    }
    setAccounts(result.accounts || []);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const resetForm = () => {
    setForm(createInitialForm(branches));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setMessageTone("");

    if (form.accountScope === "branch" && !toText(form.branchUuid)) {
      setMessage("Vui lòng chọn chi nhánh cho tài khoản.");
      setMessageTone("error");
      return;
    }

    setSubmitting(true);
    const result = await createBranchAccount(form);
    setSubmitting(false);

    if (!result.ok) {
      setMessage(`Chưa tạo tài khoản: ${result.message || "Không tạo được tài khoản chi nhánh."}`);
      setMessageTone("error");
      return;
    }

    setMessage(result.message || "Đã tạo tài khoản chi nhánh.");
    setMessageTone("success");
    resetForm();
    await loadAccounts({ preserveMessage: true });
  };

  return (
    <AdminCard className="admin-panel admin-store-panel admin-branch-account-panel">
      <div className="admin-panel-head">
        <div>
          <h2>Tài khoản & phân quyền</h2>
          <p className="admin-branch-account-note">
            Tài khoản chi nhánh chỉ thấy Tổng quan ca và kho của mình. Quản lý Tổng kho chỉ thấy phân hệ Kho nhưng thao tác được toàn bộ kho.
          </p>
        </div>
        <AdminButton variant="secondary" onClick={loadAccounts} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </AdminButton>
      </div>

      {message ? (
        <p className={`admin-store-message admin-store-message--${messageTone || "info"}`} role={messageTone === "error" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}

      <form className="admin-branch-account-form" onSubmit={handleSubmit}>
        <select
          className="admin-input"
          value={form.accountScope}
          onChange={(event) => {
            const accountScope = event.target.value;
            setForm((current) => ({
              ...current,
              accountScope,
              role: accountScope === "central_inventory" ? "staff" : current.role
            }));
          }}
        >
          <option value="branch">Tài khoản chi nhánh</option>
          <option value="central_inventory">Quản lý Tổng kho</option>
        </select>
        <AdminInput
          placeholder="Tên nhân viên"
          value={form.name}
          onChange={(event) => updateForm("name", event.target.value)}
        />
        <AdminInput
          placeholder="Số điện thoại"
          value={form.phone}
          onChange={(event) => updateForm("phone", event.target.value)}
          required
        />
        <AdminInput
          type="email"
          placeholder="Email đăng nhập"
          value={form.email}
          onChange={(event) => updateForm("email", event.target.value)}
          required
        />
        <AdminInput
          type="password"
          placeholder="Mật khẩu tạm"
          value={form.password}
          onChange={(event) => updateForm("password", event.target.value)}
          minLength={8}
          required
        />
        {form.accountScope === "branch" ? (
          <>
            <select
              className="admin-input"
              value={form.role}
              onChange={(event) => updateForm("role", event.target.value)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select
              className="admin-input"
              value={form.branchUuid}
              onChange={(event) => updateForm("branchUuid", event.target.value)}
              required
            >
              <option value="">Chọn chi nhánh</option>
              {branchOptions.map((branch) => (
                <option key={branch.uuid} value={branch.uuid}>
                  {branch.code ? `${branch.code} - ${branch.name}` : branch.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <div className="admin-input" aria-label="Phạm vi tài khoản">Kho Tổng + các kho chi nhánh</div>
        )}
        <AdminButton type="submit" disabled={submitting || (form.accountScope === "branch" && !branchOptions.length)}>
          {submitting ? "Đang tạo..." : "Tạo tài khoản"}
        </AdminButton>
      </form>

      <div className="admin-branch-account-list">
        {loading && !accounts.length ? (
          <div className="admin-branch-account-empty">Đang tải danh sách tài khoản...</div>
        ) : null}

        {!loading && !accounts.length ? (
          <div className="admin-branch-account-empty">Chưa có tài khoản chi nhánh nào.</div>
        ) : null}

        {accounts.map((account) => (
          <div key={account.id || account.email} className="admin-branch-account-row">
            <div>
              <strong>{account.name || account.email || account.phone}</strong>
              <span>{account.email || "Chưa có email"} · {account.phone || "Chưa có số điện thoại"}</span>
            </div>
            <div>
              <strong>{account.accountScope === "central_inventory" ? "Quản lý Tổng kho" : account.accountScope === "system_admin" ? "Admin hệ thống" : getRoleLabel(account.role)}</strong>
              <span>{getStatusLabel(account.status)}</span>
            </div>
            <div>
              <strong>{account.warehouseName || account.branchName || branchNameByUuid.get(account.branchUuid) || "Chưa gán phạm vi"}</strong>
              <span>{account.inventoryRole === "central_manager" ? "Toàn bộ hệ thống kho" : account.branchUuid || "Không gán chi nhánh"}</span>
            </div>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
