import { useEffect, useMemo, useState } from "react";
import Icon from "../Icon.jsx";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";
import { getDeliveryAppBrand } from "../../services/deliveryAppService.js";

function DeliveryAppLogo({ app }) {
  const brand = getDeliveryAppBrand(app);
  return <span className={`delivery-app-logo delivery-app-logo-${brand.className}`}>{brand.label}</span>;
}
export default function DeliveryAppOrderingModal({ open, branches = [], onClose }) {
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.branchId || "");

  useEffect(() => {
    if (!open) return;
    if (!branches.some((branch) => branch.branchId === selectedBranchId)) {
      setSelectedBranchId(branches[0]?.branchId || "");
    }
  }, [branches, open, selectedBranchId]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.branchId === selectedBranchId) || branches[0] || null,
    [branches, selectedBranchId]
  );
  const linkedApps = (selectedBranch?.apps || []).filter((app) => app.url);

  if (!open) return null;

  const openApp = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <CustomerBottomSheet
      title="Đặt giao hàng qua ứng dụng"
      subtitle="Chọn chi nhánh, sau đó mở ứng dụng bạn muốn đặt."
      ariaLabel="Đặt giao hàng qua ứng dụng"
      className="delivery-ordering-sheet"
      contentClassName="delivery-ordering-sheet__content"
      onClose={onClose}
    >
      <div className="delivery-ordering-branch-list" role="list" aria-label="Chọn chi nhánh">
        {branches.map((branch) => (
          <button
            type="button"
            key={branch.branchId}
            className={branch.branchId === selectedBranch?.branchId ? "is-active" : ""}
            onClick={() => setSelectedBranchId(branch.branchId)}
          >
            <span className="delivery-ordering-branch-icon"><Icon name="store" size={18} /></span>
            <span><strong>{branch.branchName}</strong>{branch.branchAddress ? <small>{branch.branchAddress}</small> : null}</span>
            <i aria-hidden="true">{branch.branchId === selectedBranch?.branchId ? "✓" : ""}</i>
          </button>
        ))}
      </div>

      <section className="delivery-ordering-apps" aria-live="polite">
        <div className="delivery-ordering-apps__head">
          <span>Đặt tại</span>
          <strong>{selectedBranch?.branchName || "Chi nhánh đã chọn"}</strong>
        </div>
        {linkedApps.length ? (
          <div className="delivery-ordering-app-grid">
            {linkedApps.map((app) => (
              <button type="button" key={app.id} onClick={() => openApp(app.url)}>
                <DeliveryAppLogo app={app} />
                <span><strong>{app.name}</strong><small>Mở ứng dụng</small></span>
                <Icon name="back" size={16} className="delivery-ordering-app-arrow" />
              </button>
            ))}
          </div>
        ) : (
          <div className="delivery-ordering-empty">
            <Icon name="warning" size={20} />
            <div><strong>Link đặt món đang được cập nhật</strong><span>Vui lòng chọn chi nhánh khác hoặc quay lại sau.</span></div>
          </div>
        )}
      </section>
    </CustomerBottomSheet>
  );
}
