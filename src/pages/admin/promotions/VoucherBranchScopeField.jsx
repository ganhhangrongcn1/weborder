import {
  getVoucherBranchOptionId,
  getVoucherBranchOptionLabel,
  normalizeVoucherBranchUuids
} from "../../../services/voucherBranchScopeService.js";

export default function VoucherBranchScopeField({ branches = [], value = [], onChange }) {
  const options = (Array.isArray(branches) ? branches : [])
    .map((branch, index) => ({
      id: getVoucherBranchOptionId(branch),
      label: getVoucherBranchOptionLabel(branch, index)
    }))
    .filter((option) => option.id);
  const selected = normalizeVoucherBranchUuids(value);
  const selectedSet = new Set(selected);
  const appliesToAll = selected.length === 0;

  const toggleBranch = (branchId) => {
    const next = selectedSet.has(branchId)
      ? selected.filter((id) => id !== branchId)
      : [...selected, branchId];
    onChange(normalizeVoucherBranchUuids(next));
  };

  return (
    <div className="admin-voucher-branch-scope">
      <label className={`admin-voucher-branch-option ${appliesToAll ? "is-selected" : ""}`}>
        <input type="checkbox" checked={appliesToAll} onChange={() => onChange([])} />
        <span>
          <strong>Tất cả chi nhánh</strong>
          <small>Không giới hạn địa điểm sử dụng.</small>
        </span>
      </label>

      <div className="admin-voucher-branch-list">
        {options.map((option) => (
          <label key={option.id} className={`admin-voucher-branch-option ${selectedSet.has(option.id) ? "is-selected" : ""}`}>
            <input
              type="checkbox"
              checked={selectedSet.has(option.id)}
              onChange={() => toggleBranch(option.id)}
            />
            <span><strong>{option.label}</strong></span>
          </label>
        ))}
      </div>

      {!options.length ? (
        <p className="admin-voucher-branch-empty">Chưa có dữ liệu chi nhánh; voucher tạm áp dụng cho tất cả.</p>
      ) : null}
    </div>
  );
}
