import { useState } from "react";
import AppShell from "./components/layout/AppShell.jsx";
import FullPageState from "./components/ui/FullPageState.jsx";
import { useAdminSession } from "./hooks/useAdminSession.js";
import LoginPage from "./pages/LoginPage.jsx";
import PeopleManagementPage from "./pages/PeopleManagementPage.jsx";
import SupervisionManagementPage from "./pages/SupervisionManagementPage.jsx";

export default function App() {
  const auth = useAdminSession();
  const [activeModule, setActiveModule] = useState("people");

  if (auth.loading) {
    return <FullPageState title="Đang kiểm tra phiên đăng nhập" description="Vui lòng chờ trong giây lát." />;
  }

  if (!auth.session) {
    return <LoginPage message={auth.message} onLogin={auth.login} loading={auth.submitting} />;
  }

  return (
    <AppShell profile={auth.profile} onLogout={auth.logout} activeModule={activeModule} onModuleChange={setActiveModule}>
      {activeModule === "people" ? <PeopleManagementPage /> : <SupervisionManagementPage />}
    </AppShell>
  );
}
