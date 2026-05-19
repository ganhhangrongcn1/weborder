import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import CustomerAppShell from "./CustomerAppShell.jsx";

function inferBranchCodeFromName(name = "") {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("30/4")) return "CN01";
  if (normalized.includes("thich quang duc")) return "CN02";
  if (normalized.includes("le hong phong")) return "CN03";
  return "";
}

function matchBranchByQrKey(branch = {}, key = "") {
  const normalizedKey = String(key || "").trim().toLowerCase();
  if (!normalizedKey) return false;
  const inferredBranchCode = inferBranchCodeFromName(branch?.name);
  const candidates = [
    branch?.branch_code,
    branch?.branchCode,
    inferredBranchCode,
    branch?.branch_uuid,
    branch?.branchUuid,
    branch?.slug,
    branch?.id
  ];
  return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === normalizedKey);
}

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
    const matchedBranch = pickupBranches.find((branch) => matchBranchByQrKey(branch, branchKey));
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
            inferBranchCodeFromName(matchedBranch?.name) ||
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
