import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG,
  getPartnerOrderAutomationConfig,
  normalizePartnerOrderAutomationConfig,
  savePartnerOrderAutomationConfig
} from "../services/partnerOrderAutomationService.js";

export default function useGrabAutomationSettings() {
  const [savedConfig, setSavedConfig] = useState(DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG);
  const [draftConfig, setDraftConfig] = useState(DEFAULT_PARTNER_ORDER_AUTOMATION_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    getPartnerOrderAutomationConfig()
      .then((config) => {
        if (!active) return;
        setSavedConfig(config);
        setDraftConfig(config);
      })
      .catch(() => {
        if (!active) return;
        setMessage("Chưa tải được cài đặt Grab. Hệ thống đang dùng mặc định 20 phút.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draftConfig) !== JSON.stringify(savedConfig),
    [draftConfig, savedConfig]
  );

  const updateConfig = useCallback((patch = {}) => {
    setMessage("");
    setDraftConfig((current) => normalizePartnerOrderAutomationConfig({
      ...current,
      ...patch
    }));
  }, []);

  const save = useCallback(async () => {
    if (saving || !dirty) return null;
    setSaving(true);
    setMessage("");

    try {
      const saved = await savePartnerOrderAutomationConfig(draftConfig);
      setSavedConfig(saved);
      setDraftConfig(saved);
      setMessage(saved.grabAutoPrepEnabled
        ? `Đã bật tự động đặt thời gian Grab ${saved.grabPrepMinutes} phút.`
        : "Đã tắt tự động đặt thời gian Grab.");
      return saved;
    } catch {
      setMessage("Lưu cài đặt Grab thất bại. Vui lòng kiểm tra lại quyền Admin.");
      return null;
    } finally {
      setSaving(false);
    }
  }, [dirty, draftConfig, saving]);

  return {
    config: draftConfig,
    dirty,
    loading,
    saving,
    message,
    updateConfig,
    save
  };
}
