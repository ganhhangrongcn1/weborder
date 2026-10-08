import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";

export default function PromotionBranchField({ branches = [], value = [], onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const options = buildBranchFilterOptions(branches);
  return (
    <div className="admin-promo-form-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-[12px] font-semibold text-slate-600">Chi nhánh áp dụng tại POS</p>
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={!selected.length} onChange={() => onChange([])} />
        Tất cả chi nhánh
      </label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              disabled={selected.length === 1 && selected.includes(option.value)}
              onChange={() => onChange(selected.includes(option.value)
                ? selected.filter((id) => id !== option.value)
                : [...selected, option.value])}
            />
            {option.label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Chọn chi nhánh riêng sẽ chỉ áp dụng trên POS. POS cần cập nhật bản hỗ trợ khuyến mãi theo chi nhánh.
      </p>
    </div>
  );
}
