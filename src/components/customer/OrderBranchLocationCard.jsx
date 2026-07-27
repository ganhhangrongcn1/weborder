import Icon from "../Icon.jsx";
import { resolveOrderBranch } from "../../services/branchIdentityService.js";
import { buildGoogleMapsDirectionsUrl } from "../../services/branchNavigationService.js";

function getFallbackBranch(order = {}) {
  return {
    name:
      order?.pickupBranchName ||
      order?.deliveryBranchName ||
      order?.branchName ||
      order?.branch_name ||
      "",
    address:
      order?.branchAddress ||
      order?.branch_address ||
      order?.metadata?.branchAddress ||
      order?.metadata?.branch_address ||
      ""
  };
}

export default function OrderBranchLocationCard({ order, branches = [] }) {
  if (!order) return null;

  const branch = resolveOrderBranch(order, branches) || getFallbackBranch(order);
  const directionsUrl = buildGoogleMapsDirectionsUrl(branch);
  if (!directionsUrl) return null;

  return (
    <section className="order-branch-location-card">
      <span className="order-branch-location-card__icon" aria-hidden="true">
        <Icon name="store" size={19} />
      </span>
      <span className="order-branch-location-card__copy">
        <small>Vị trí quán</small>
        <strong>{branch?.name || "Gánh Hàng Rong"}</strong>
        {branch?.address ? <em>{branch.address}</em> : null}
      </span>
      <a
        className="order-branch-location-card__action"
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Xem đường đi
      </a>
    </section>
  );
}
