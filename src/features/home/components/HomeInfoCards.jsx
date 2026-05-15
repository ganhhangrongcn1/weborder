import { useEffect, useMemo, useState } from "react";
import HomeBranchPlannerModal from "./HomeBranchPlannerModal.jsx";

function normalizeExternalUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getDeliveryAppBrand(app) {
  const value = `${app?.id || ""} ${app?.name || ""}`.toLowerCase();
  if (value.includes("grab")) return { className: "grab", label: "GrabFood" };
  if (value.includes("shopee")) return { className: "shopee", label: "ShopeeFood" };
  if (value.includes("xanh")) return { className: "xanh", label: "Xanh Ngon" };
  return { className: "default", label: app?.name || "App" };
}

function DeliveryAppLogo({ app }) {
  const brand = getDeliveryAppBrand(app);

  return (
    <span className={`delivery-app-logo delivery-app-logo-${brand.className}`} aria-hidden="true">
      {brand.label}
    </span>
  );
}

export default function HomeInfoCards({
  showCashback,
  cashbackRef,
  cashbackBlock,
  showDeliveryApps,
  deliveryAppsRef,
  deliveryAppsBlock,
  deliveryAppsList,
  deliveryAppBranches = [],
  deliveryBranches = []
}) {
  const [activeBranchId, setActiveBranchId] = useState(deliveryAppBranches[0]?.branchId || "");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const hasBranchApps = deliveryAppBranches.length > 0;

  useEffect(() => {
    if (!hasBranchApps) return;
    const hasCurrentBranch = deliveryAppBranches.some((branch) => branch.branchId === activeBranchId);
    if (!hasCurrentBranch) {
      setActiveBranchId(deliveryAppBranches[0]?.branchId || "");
    }
  }, [activeBranchId, deliveryAppBranches, hasBranchApps]);

  const activeBranch = useMemo(
    () => deliveryAppBranches.find((branch) => branch.branchId === activeBranchId) || deliveryAppBranches[0] || null,
    [activeBranchId, deliveryAppBranches]
  );

  const branchPickerItems = useMemo(
    () =>
      deliveryAppBranches.map((branch) => {
        const sourceBranch = deliveryBranches.find((item) =>
          String(item?.id || "") === String(branch.branchSourceId || "") ||
          String(item?.name || "") === String(branch.branchSourceId || "") ||
          String(item?.name || "") === String(branch.branchName || "")
        );
        return {
          id: branch.branchId,
          name: branch.branchName,
          address: sourceBranch?.address || "",
          time: sourceBranch?.time || "",
          openTime: sourceBranch?.openTime || sourceBranch?.open || "",
          closeTime: sourceBranch?.closeTime || sourceBranch?.close || ""
        };
      }),
    [deliveryAppBranches, deliveryBranches]
  );

  const legacyApps = deliveryAppsList.length ? deliveryAppsList : ["GrabFood", "ShopeeFood", "Xanh Ngon"];

  const openDeliveryApp = (url) => {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) return;
    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  };

  if (!showCashback && !showDeliveryApps) return null;

  return (
    <section className="home2026-section grid gap-3">
      {showCashback && (
        <article ref={cashbackRef} className="cashback-card">
          <span className="cashback-icon">{cashbackBlock?.iconText || "%"}</span>
          <div>
            <h2>{cashbackBlock?.title || "Hoàn tiền"}</h2>
            <p>{cashbackBlock?.subtitle || "Ưu đãi hoàn tiền khi đặt món."}</p>
          </div>
        </article>
      )}
      {showDeliveryApps && (
        <article ref={deliveryAppsRef} className="delivery-app-card">
          <h2>{deliveryAppsBlock?.title || "Mua trên app giao hàng"}</h2>
          {deliveryAppsBlock?.subtitle ? <p className="delivery-app-subtitle">{deliveryAppsBlock.subtitle}</p> : null}

          {hasBranchApps ? (
            <>
              <label className="delivery-app-branch-select">
                <span>Chọn chi nhánh đặt qua app</span>
                <button
                  type="button"
                  className="delivery-app-branch-trigger"
                  onClick={() => setBranchPickerOpen(true)}
                >
                  <span>{activeBranch?.branchName || "Chọn chi nhánh"}</span>
                  <i>▾</i>
                </button>
              </label>
              {activeBranch?.branchName ? (
                <p className="delivery-app-branch-note">
                  App đặt hàng của chi nhánh: <strong>{activeBranch.branchName}</strong>
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {(activeBranch?.apps || []).map((app) => {
                  const appUrl = normalizeExternalUrl(app.url);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      className="delivery-app-item"
                      disabled={!appUrl}
                      onClick={() => openDeliveryApp(appUrl)}
                    >
                      <DeliveryAppLogo app={app} />
                      <strong>{app.name}</strong>
                    </button>
                  );
                })}
              </div>

              <HomeBranchPlannerModal
                open={branchPickerOpen}
                onBackdropClose={() => setBranchPickerOpen(false)}
                onClose={() => setBranchPickerOpen(false)}
                title="Chọn chi nhánh giao hàng"
                subtitle="Chọn chi nhánh gần bạn nhất để tiết kiệm phí ship."
                ariaLabel="Chọn chi nhánh giao hàng"
                branches={branchPickerItems}
                selectedBranchId={activeBranch?.branchId || ""}
                onSelectBranch={setActiveBranchId}
                onConfirm={() => {
                  setBranchPickerOpen(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                confirmLabel="Chọn chi nhánh này"
                iconName="star"
              />
            </>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {legacyApps.map((app, index) => (
                <div key={`${app}-${index}`} className="delivery-app-item">
                  <DeliveryAppLogo app={{ name: app }} />
                  <strong>{app}</strong>
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
