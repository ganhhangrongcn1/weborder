import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import Icon from "../../../components/Icon.jsx";
import CustomerSelectionIndicator from "../../../components/customer/CustomerSelectionIndicator.jsx";
import { getBranchHours, getClosingSoonText } from "../homeHelpers.js";
import useNearbyBranches from "../hooks/useNearbyBranches.js";
import { formatBranchDistance } from "../../../services/branchProximityService.js";

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function isBranchOpenNow(branch) {
  const { openMinutes, closeMinutes } = getBranchHours(branch);
  if (openMinutes === null || closeMinutes === null) return true;

  const nowMinutes = getNowMinutes();
  if (openMinutes === closeMinutes) return true;

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

export default function HomeBranchPlannerModal({
  open,
  onBackdropClose,
  onClose,
  title,
  subtitle,
  ariaLabel,
  branches = [],
  selectedBranchId,
  onSelectBranch,
  onConfirm,
  confirmLabel = "Xong, vào menu",
  iconName = "home",
  disabledConfirm = false,
  enableNearby = false
}) {
  const nearby = useNearbyBranches(branches,open && enableNearby);
  if (!open) return null;

  const visibleBranches = enableNearby && nearby.position
    ? [...nearby.nearby].sort((a,b)=>Number(isBranchOpenNow(b))-Number(isBranchOpenNow(a)))
    : enableNearby ? nearby.nearby : branches;
  const nearest = nearby.position ? visibleBranches.find(isBranchOpenNow) : null;
  const shouldShowConfirm = false;

  return (
    <CustomerBottomSheet title={title} subtitle={subtitle} ariaLabel={ariaLabel || title || "Chọn chi nhánh"} className="branch-picker-panel" onClose={onClose} onBackdropClose={onBackdropClose} closeOnBackdrop={Boolean(onBackdropClose)}>
        {enableNearby && (nearby.busy || nearby.message) && <p className="home-nearby-status" role="status">{nearby.busy ? "Đang tìm quán gần bạn…" : nearby.message}</p>}
        <div className="branch-picker-list">
          {!visibleBranches.length && <p role="status">Hiện chưa có chi nhánh nhận hình thức đặt món này. Bạn quay lại sau nhé.</p>}
          {visibleBranches.map((branch) => {
            const openNow = isBranchOpenNow(branch);
            const closingSoonText = openNow ? getClosingSoonText(branch) : "";

            return (
              <CustomerControl
                key={branch.id}
                type="button"
                onClick={() => {
                  if (!openNow) return;
                  onSelectBranch(branch.id);
                  onConfirm?.(branch.id);
                }}
                className={`branch-card ${selectedBranchId === branch.id ? "branch-card-active" : ""} ${openNow ? "" : "branch-card-closed"}`}
                disabled={!openNow}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600">
                  <Icon name={iconName} size={18} />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <strong>{branch.name}</strong>
                  <small>{branch.address}</small>
                  <em>Giờ hoạt động: {getBranchHours(branch).label}</em>
                  {enableNearby && Number.isFinite(branch.distanceKm) && <small className="home-branch-distance">{formatBranchDistance(branch.distanceKm)}{nearest?.id === branch.id ? " · Gần bạn nhất đang mở" : ""}</small>}
                  {!openNow ? <small className="branch-closed-warning">Chi nhánh đã đóng cửa.</small> : null}
                  {closingSoonText ? <small className="branch-closing-warning">{closingSoonText}</small> : null}
                </span>
                <CustomerSelectionIndicator selected={selectedBranchId === branch.id} className="branch-radio" />
              </CustomerControl>
            );
          })}
        </div>

        {shouldShowConfirm ? (
          <div className="branch-picker-footer">
            <CustomerControl onClick={onConfirm} className="cta w-full" disabled={disabledConfirm}>{confirmLabel}</CustomerControl>
          </div>
        ) : null}
    </CustomerBottomSheet>
  );
}
