import ChecklistAuthBoundary from "./ChecklistAuthBoundary.jsx";
import SupervisionInspectionPage from "./SupervisionInspectionPage.jsx";

export default function SupervisionRoute() {
  return (
    <ChecklistAuthBoundary>
      {(checklistAuth) => <SupervisionInspectionPage adminAuth={{ adminProfile: checklistAuth.profile, onAdminLogout: checklistAuth.onLogout }} />}
    </ChecklistAuthBoundary>
  );
}
