import { useCallback, useEffect, useState } from "react";
import { getRepositoryRuntimeInfo } from "../../../services/repositories/repositoryRuntime.js";
import {
  getAdminSession,
  loginAdminWithPassword,
  logoutAdmin,
  subscribeAdminAuth
} from "../../../services/adminAuthService.js";
import AdminAuthGate from "./AdminAuthGate.jsx";

const AUTH_LOADING_GUARD_MS = 7000;

export default function AdminAuthBoundary({ children }) {
  const runtimeInfo = getRepositoryRuntimeInfo();
  const isSupabaseAdminMode = runtimeInfo.source === "supabase";
  const [adminSession, setAdminSession] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [blockedAdminSession, setBlockedAdminSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseAdminMode);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const applyAdminAccessState = useCallback((access = {}) => {
    if (access?.transientAuthError && access?.session) {
      setAdminSession((current) => current || access.session);
      setAdminProfile((current) => current || access?.profile || null);
      setBlockedAdminSession(null);
      setLoginMessage(access?.message || "");
      return;
    }

    setAdminSession(access?.session || null);
    setAdminProfile(access?.profile || null);
    setBlockedAdminSession(access?.unauthorized ? access?.rawSession || null : null);
    setLoginMessage(access?.message || "");
  }, []);

  useEffect(() => {
    if (!isSupabaseAdminMode) {
      setAuthLoading(false);
      return undefined;
    }

    let disposed = false;
    let unsubscribe = () => {};
    const authLoadingGuard = setTimeout(() => {
      if (!disposed) setAuthLoading(false);
    }, AUTH_LOADING_GUARD_MS);

    getAdminSession()
      .then((access) => {
        if (disposed) return;
        applyAdminAccessState(access);
        setAuthLoading(false);
      })
      .catch(() => {
        if (disposed) return;
        applyAdminAccessState();
        setAuthLoading(false);
      });

    subscribeAdminAuth((access) => {
      if (disposed) return;
      applyAdminAccessState(access);
      setAuthLoading(false);
    }).then((cleanup) => {
      const resolvedCleanup = typeof cleanup === "function" ? cleanup : () => {};
      if (disposed) {
        resolvedCleanup();
        return;
      }
      unsubscribe = resolvedCleanup;
    }).catch(() => {});

    return () => {
      disposed = true;
      clearTimeout(authLoadingGuard);
      unsubscribe();
    };
  }, [applyAdminAccessState, isSupabaseAdminMode]);

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setLoginMessage("");
    setLoginSubmitting(true);

    const result = await loginAdminWithPassword({
      email: loginEmail,
      password: loginPassword
    });

    setLoginSubmitting(false);
    if (!result.ok) {
      setBlockedAdminSession(null);
      setAdminSession(null);
      setAdminProfile(null);
      setLoginMessage(result.message || "Đăng nhập thất bại.");
      return;
    }

    setAdminSession(result.session || null);
    setAdminProfile(result.profile || null);
    setBlockedAdminSession(null);
    setLoginPassword("");
    setLoginMessage("");
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    setAdminSession(null);
    setAdminProfile(null);
    setBlockedAdminSession(null);
    setLoginPassword("");
    setLoginMessage("");
  };

  if (isSupabaseAdminMode && authLoading) {
    return <AdminAuthGate mode="loading" />;
  }

  if (isSupabaseAdminMode && blockedAdminSession && !adminSession) {
    return (
      <AdminAuthGate
        mode="blocked"
        blockedEmail={blockedAdminSession?.user?.email || ""}
        message={loginMessage}
        onLogout={handleAdminLogout}
      />
    );
  }

  if (isSupabaseAdminMode && !adminSession) {
    return (
      <AdminAuthGate
        mode="login"
        email={loginEmail}
        password={loginPassword}
        message={loginMessage}
        submitting={loginSubmitting}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onSubmit={handleAdminLogin}
      />
    );
  }

  return children({
    adminSession,
    adminProfile,
    isSupabaseAdminMode,
    onAdminLogout: isSupabaseAdminMode ? handleAdminLogout : null
  });
}
