/* global setInterval, clearInterval */
import { useEffect, useRef, useState } from "react";
import { readPosPagerEnabled, savePosPagerEnabled } from "../../../services/pos/posPagerSettingsService";

export default function usePosPagerSettings({ branchUuid, phoneMode, locked, onMessage, onClearPager }) {
  const [settings, setSettings] = useState({ branchUuid: "", enabled: true, ready: false });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const generationRef = useRef(0);
  const branchRef = useRef(branchUuid);
  branchRef.current = branchUuid;

  useEffect(() => {
    if (!branchUuid || phoneMode) return;
    let active = true;
    const refresh = async () => {
      if (locked || savingRef.current) return;
      const generation = generationRef.current;
      try {
        const enabled = await readPosPagerEnabled(branchUuid);
        if (active && !savingRef.current && generation === generationRef.current) setSettings({ branchUuid, enabled, ready: true });
      } catch {
        // Keep the last known branch setting when the connection drops.
        if (active && generation === generationRef.current) setSettings(current => current.branchUuid === branchUuid
          ? { ...current, ready: true } : { branchUuid, enabled: true, ready: true });
      }
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [branchUuid, phoneMode, locked]);

  const enabled = phoneMode || settings.branchUuid !== branchUuid || settings.enabled;
  const ready = phoneMode || (settings.branchUuid === branchUuid && settings.ready);

  const changeEnabled = async nextEnabled => {
    if (!ready || phoneMode || locked || savingRef.current) return false;
    savingRef.current = true;
    generationRef.current += 1;
    setSaving(true);
    try {
      await savePosPagerEnabled(branchUuid, nextEnabled);
      if (branchRef.current !== branchUuid) return false;
      setSettings({ branchUuid, enabled: Boolean(nextEnabled), ready: true });
      onClearPager();
      onMessage(nextEnabled ? "Đã bật thẻ rung cho chi nhánh." : "Đã tắt thẻ rung cho chi nhánh. Nhận món theo mã bill.");
      return true;
    } catch (error) {
      onMessage(error?.message || "Chưa lưu được cấu hình thẻ rung. Vui lòng thử lại.");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { pagerEnabled: enabled, pagerSettingsReady: ready, pagerSettingsSaving: saving, changePagerEnabled: changeEnabled };
}
