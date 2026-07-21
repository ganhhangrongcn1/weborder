import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  canInstallPosAppUpdate,
  checkPosAppUpdate,
  downloadAndInstallPosAppUpdate,
  openPosAppInstallPermissionSettings,
  subscribePosAppUpdateProgress
} from "../services/pos/posAppUpdateService";

function getErrorMessage(error) {
  return String(error?.message || "Không cập nhật được ứng dụng.").trim();
}

export default function usePosAppUpdate() {
  const [current, setCurrent] = useState(null);
  const [release, setRelease] = useState(null);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const checkNow = useCallback(async ({ force = true } = {}) => {
    setChecking(true);
    if (force) setMessage("");
    try {
      const result = await checkPosAppUpdate({ force });
      setCurrent(result.current);
      setRelease(result.release);
      setAvailable(result.available);
      if (force) {
        setMessage(result.available
          ? `Đã có phiên bản ${result.release.versionName}.`
          : "POS đang dùng phiên bản mới nhất.");
      }
      return result;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkNow({ force: false });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void checkNow({ force: false });
    });
    return () => subscription.remove();
  }, [checkNow]);

  useEffect(() => subscribePosAppUpdateProgress((event) => {
    const nextProgress = Math.max(0, Math.min(1, Number(event?.progress || 0)));
    setProgress(nextProgress);
    if (event?.state === "verified") setMessage("Đã xác minh APK. Đang mở trình cài đặt...");
    if (event?.state === "failed") setMessage("Tải bản cập nhật thất bại.");
  }), []);

  const installUpdate = useCallback(async () => {
    if (!release || downloading) return false;
    try {
      const allowed = await canInstallPosAppUpdate();
      if (!allowed) {
        setMessage("Hãy bật Cho phép từ nguồn này, quay lại POS rồi bấm cập nhật lần nữa.");
        await openPosAppInstallPermissionSettings();
        return false;
      }

      setDownloading(true);
      setProgress(0);
      setMessage("Đang tải bản cập nhật...");
      await downloadAndInstallPosAppUpdate(release);
      setMessage("Trình cài đặt đã mở. Bấm Cập nhật để hoàn tất.");
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    } finally {
      setDownloading(false);
    }
  }, [downloading, release]);

  return {
    current,
    release,
    available,
    checking,
    downloading,
    progress,
    message,
    checkNow,
    installUpdate
  };
}
