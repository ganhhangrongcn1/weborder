import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CustomerAppShell from "./CustomerAppShell.jsx";
import { resolveBranchFromCandidates } from "../../services/branchIdentityService.js";

export default function AppCustomerRoutes(props) {
  const location = useLocation();
  const { syncRouteState, branches, setCheckoutPreset } = props;

  useEffect(() => {
    syncRouteState?.(location.pathname);
  }, [location.pathname, syncRouteState]);

  useEffect(() => {
    const match = String(location.pathname || "").match(/^\/qr\/([^/]+)(?:\/(menu|checkout|orders|loyalty|account))?$/i);
    if (!match) return;
    const rawBranchId = decodeURIComponent(match[1] || "").trim();
    if (!rawBranchId) return;

    const branchKey = rawBranchId.toLowerCase();
    const pickupBranches = Array.isArray(branches) ? branches.filter((branch) => branch?.pickupEnabled !== false) : [];
    const matchedBranch = resolveBranchFromCandidates([branchKey], pickupBranches);
    if (!matchedBranch) return;

    setCheckoutPreset?.((current) => {
      const next = {
        ...(current || {}),
        fulfillmentType: "pickup",
        selectedBranch: matchedBranch.id,
        pickupMode: "soon",
        orderSource: "qr_counter",
        source: "qr_counter",
        qrBranchId: String(
          matchedBranch?.branch_code ||
            matchedBranch?.branchCode ||
            matchedBranch?.id ||
            ""
        ),
        qrBranchLocked: true,
        qrAutoPickupNow: true
      };
      const isSame =
        String(current?.fulfillmentType || "") === String(next.fulfillmentType) &&
        String(current?.selectedBranch || "") === String(next.selectedBranch) &&
        String(current?.pickupMode || "") === String(next.pickupMode) &&
        String(current?.orderSource || "") === String(next.orderSource) &&
        String(current?.qrBranchId || "") === String(next.qrBranchId) &&
        Boolean(current?.qrBranchLocked) === Boolean(next.qrBranchLocked) &&
        Boolean(current?.qrAutoPickupNow) === Boolean(next.qrAutoPickupNow);
      return isSame ? current : next;
    });
  }, [location.pathname, branches, setCheckoutPreset]);

  return <CustomerAppShell {...props} />;
}
