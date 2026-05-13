import AppProviders from "./features/app/AppProviders.jsx";
import AppRoutes from "./app/routes.jsx";

export default function App() {
  return (
    <AppProviders>
      {(providers) => <AppRoutes {...providers} />}
    </AppProviders>
  );
}
