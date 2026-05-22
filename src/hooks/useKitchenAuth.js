import { useCallback, useEffect, useState } from "react";
import {
  getKitchenSession,
  loginKitchenWithPassword,
  logoutKitchen,
  subscribeKitchenAuth
} from "../services/kitchenAuthService.js";

export default function useKitchenAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const applyAccess = useCallback((access) => {
    if (access?.transientAuthError && access?.rawSession) {
      setSession((currentSession) => currentSession || access.rawSession || null);
      setProfile((currentProfile) => currentProfile || null);
      setError("");
      return;
    }

    setSession(access?.session || null);
    setProfile(access?.profile || null);
    setError(access?.message || access?.error?.message || "");
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    async function boot() {
      setLoading(true);
      const access = await getKitchenSession();
      if (!mounted) return;
      applyAccess(access);
      setLoading(false);
      unsubscribe = await subscribeKitchenAuth((nextAccess) => {
        if (!mounted) return;
        applyAccess(nextAccess);
      });
    }

    boot();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [applyAccess]);

  const login = useCallback(async ({ email, password }) => {
    setSubmitting(true);
    setError("");
    try {
      const result = await loginKitchenWithPassword({ email, password });
      if (!result.ok) {
        setError(result.message || "Đăng nhập thất bại.");
        return false;
      }

      setSession(result.session || null);
      setProfile(result.profile || null);
      return true;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Optimistic logout: clear UI session immediately, then sign out in background.
    setSubmitting(true);
    setSession(null);
    setProfile(null);
    setError("");
    setSubmitting(false);

    logoutKitchen().catch((err) => {
      console.error("[kitchen-auth] background signOut failed", err);
    });
  }, []);

  return {
    session,
    profile,
    loading,
    submitting,
    error,
    login,
    logout
  };
}
