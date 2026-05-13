import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { getBranchHours, getClosingSoonText } from "../homeHelpers.js";

export default function HomeBranchPlannerModal({
  open,
  onBackdropClose,
  onClose,
  title,
  subtitle,
  ariaLabel,
  branches,
  selectedBranchId,
  onSelectBranch,
  onConfirm,
  confirmLabel = "Xong, vào menu",
  iconName = "home",
  disabledConfirm = false
}) {
  if (!open) return null;

  return (
    <CustomerBottomSheet
      title={title}
      subtitle={subtitle}
      ariaLabel={ariaLabel}
      onClose={onClose}
      closeOnBackdrop={Boolean(onBackdropClose)}
      className="promo-sheet"
      footer={<button onClick={onConfirm} className="cta w-full" disabled={disabledConfirm}>{confirmLabel}</button>}
    >
      <div className="space-y-3">
        {branches.map((branch) => (
          <button key={branch.id} onClick={() => onSelectBranch(branch.id)} className={`branch-card ${selectedBranchId === branch.id ? "branch-card-active" : ""}`}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Icon name={iconName} size={18} /></span>
            <span className="min-w-0 flex-1 text-left">
              <strong>{branch.name}</strong>
              <small>{branch.address}</small>
              <em>Giờ hoạt động: {getBranchHours(branch).label}</em>
              {getClosingSoonText(branch) && <small className="branch-closing-warning">{getClosingSoonText(branch)}</small>}
            </span>
            <span className="branch-radio">{selectedBranchId === branch.id ? "✓" : ""}</span>
          </button>
        ))}
      </div>
    </CustomerBottomSheet>
  );
}
