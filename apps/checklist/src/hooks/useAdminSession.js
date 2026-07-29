import { useCallback, useEffect, useState } from "react";
import {
  getAuthMessage,
  loadAdminAccess,
  loginAdmin,
  logoutAdmin,
  subscribeAdminSession
} from "../services/authService.js";

const EMPTY_ACCESS = { session: null, profile: null };

export function useAdminSession() {
  const [access, setAccess] = useState(EMPTY_ACCESS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    loadAdminAccess()
      .then((nextAccess) => {
        if (!active) return;
        setAccess(nextAccess);
        unsubscribe = subscribeAdminSession((updatedAccess) => {
          if (!active) return;
          if (updatedAccess?.error) setMessage(getAuthMessage(updatedAccess.error));
          setAccess(updatedAccess?.session ? updatedAccess : EMPTY_ACCESS);
        });
      })
      .catch((error) => {
        if (!active) return;
        setMessage(getAuthMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setSubmitting(true);
    setMessage("");
    try {
      const nextAccess = await loginAdmin(credentials);
      setAccess(nextAccess);
      return true;
    } catch (error) {
      setMessage(getAuthMessage(error));
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setSubmitting(true);
    try {
      await logoutAdmin();
      setAccess(EMPTY_ACCESS);
    } catch (error) {
      setMessage(getAuthMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { ...access, loading, submitting, message, login, logout };
}
