import AppProviders from "./features/app/AppProviders.jsx";
import AppRoutes from "./app/routes.jsx";
import useSiteVisitTracking from "./hooks/useSiteVisitTracking.js";

export default function App() {
  useSiteVisitTracking();

  return (
    <AppProviders>
      {(providers) => <AppRoutes {...providers} />}
    </AppProviders>
  );
}
