import { useEffect, useState } from "react";
import { getChecklistSession, loginChecklistUser, logoutChecklistUser } from "../../services/checklistAuthService.js";
import ChecklistLoginPage from "./ChecklistLoginPage.jsx";

export default function ChecklistAuthBoundary({ children }) {
  const [state, setState] = useState({ loading: true, submitting: false, access: null, message: "" });

  useEffect(() => {
    let active = true;
    getChecklistSession().then((access) => {
      if (!active) return;
      setState({ loading: false, submitting: false, access: access.authorized ? access : null, message: "" });
    }).catch(() => active && setState({ loading: false, submitting: false, access: null, message: "" }));
    return () => { active = false; };
  }, []);

  async function login(credentials) {
    setState((current) => ({ ...current, submitting: true, message: "" }));
    try {
      const access = await loginChecklistUser(credentials);
      setState({ loading: false, submitting: false, access, message: "" });
    } catch (error) {
      setState({ loading: false, submitting: false, access: null, message: error.message || "Đăng nhập thất bại." });
    }
  }

  async function logout() {
    await logoutChecklistUser();
    setState({ loading: false, submitting: false, access: null, message: "" });
  }

  if (state.loading) return <main className="supervision-state"><div className="supervision-spinner" /><h1>Đang kiểm tra phiên đăng nhập</h1></main>;
  if (!state.access) return <ChecklistLoginPage onLogin={login} loading={state.submitting} message={state.message} />;
  return children({ ...state.access, onLogout: logout });
}
