import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeEventEmitter, NativeModules } from "react-native";

import { supabase } from "../supabase/client";

const APP_DOWNLOADS_CONFIG_KEY = "ghr_app_downloads";
const UPDATE_CACHE_KEY = "ghr-pos-app-update-cache-v1";
const UPDATE_CHECK_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_APK_SIZE_BYTES = 157286400;
const TRUSTED_DOWNLOAD_HOST = "qjaklysckgzdfjthzkzu.supabase.co";
const TRUSTED_DOWNLOAD_PREFIX = `https://${TRUSTED_DOWNLOAD_HOST}/storage/v1/object/public/app-downloads/`;
const UPDATE_PROGRESS_EVENT = "PosAppUpdateProgress";

const nativeUpdater = NativeModules.PosAppUpdate || null;
const updateEmitter = nativeUpdater ? new NativeEventEmitter(nativeUpdater) : null;
let memoryCache = null;

function toText(value) {
  return String(value ?? "").trim();
}

function toPositiveInteger(value) {
  const number = Math.floor(Number(value || 0));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isTrustedDownloadUrl(value = "") {
  return toText(value).startsWith(TRUSTED_DOWNLOAD_PREFIX);
}

function normalizeRelease(value) {
  const source = Array.isArray(value) ? value[0] : value?.items?.[0] || value;
  if (!source || typeof source !== "object") return null;

  const versionCode = toPositiveInteger(source.versionCode || source.version_code);
  const versionName = toText(source.versionName || source.version_name || source.version);
  const url = toText(source.url);
  const sha256 = toText(source.sha256).toLowerCase();
  const sizeBytes = toPositiveInteger(source.sizeBytes || source.size_bytes);
  if (
    !versionCode
    || !versionName
    || !isTrustedDownloadUrl(url)
    || !/^[a-f0-9]{64}$/.test(sha256)
    || !sizeBytes
    || sizeBytes > MAX_APK_SIZE_BYTES
  ) {
    return null;
  }

  const releaseNotesSource = source.releaseNotes || source.release_notes;
  return {
    versionCode,
    versionName,
    url,
    sha256,
    sizeBytes,
    mandatory: Boolean(source.mandatory),
    publishedAt: toText(source.publishedAt || source.published_at || source.updatedAt || source.updated_at),
    releaseNotes: Array.isArray(releaseNotesSource)
      ? releaseNotesSource.map(toText).filter(Boolean)
      : []
  };
}

async function getCurrentVersion() {
  if (!nativeUpdater?.getCurrentVersion) {
    return { versionCode: 0, versionName: "Không xác định", packageName: "" };
  }
  const result = await nativeUpdater.getCurrentVersion();
  return {
    versionCode: toPositiveInteger(result?.versionCode),
    versionName: toText(result?.versionName),
    packageName: toText(result?.packageName)
  };
}

async function readCachedRelease() {
  if (memoryCache) return memoryCache;
  try {
    const raw = await AsyncStorage.getItem(UPDATE_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    memoryCache = parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    memoryCache = null;
  }
  return memoryCache;
}

async function saveCachedRelease(release, checkedAt) {
  memoryCache = { release, checkedAt };
  await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(memoryCache)).catch(() => {});
}

function buildUpdateResult(current, release, checkedAt, source = "remote") {
  return {
    current,
    release,
    available: Boolean(release && release.versionCode > current.versionCode),
    checkedAt,
    source
  };
}

export async function checkPosAppUpdate({ force = false } = {}) {
  const current = await getCurrentVersion();
  const cached = await readCachedRelease();
  const now = Date.now();
  if (!force && cached?.checkedAt && now - Number(cached.checkedAt) < UPDATE_CHECK_TTL_MS) {
    return buildUpdateResult(current, normalizeRelease(cached.release), Number(cached.checkedAt), "cache");
  }

  if (!supabase) {
    return buildUpdateResult(current, normalizeRelease(cached?.release), Number(cached?.checkedAt || 0), "cache");
  }

  try {
    const { data, error } = await supabase
      .from("app_configs")
      .select("value,updated_at")
      .eq("id", APP_DOWNLOADS_CONFIG_KEY)
      .maybeSingle();
    if (error) throw error;

    const release = normalizeRelease(data?.value);
    await saveCachedRelease(release, now);
    return buildUpdateResult(current, release, now, "remote");
  } catch (error) {
    if (cached) {
      return {
        ...buildUpdateResult(current, normalizeRelease(cached.release), Number(cached.checkedAt || 0), "cache"),
        warning: toText(error?.message)
      };
    }
    throw error;
  }
}

export function subscribePosAppUpdateProgress(listener) {
  if (!updateEmitter || typeof listener !== "function") return () => {};
  const subscription = updateEmitter.addListener(UPDATE_PROGRESS_EVENT, listener);
  return () => subscription.remove();
}

export async function canInstallPosAppUpdate() {
  return Boolean(await nativeUpdater?.canRequestPackageInstalls?.());
}

export async function openPosAppInstallPermissionSettings() {
  if (!nativeUpdater?.openInstallPermissionSettings) return false;
  return nativeUpdater.openInstallPermissionSettings();
}

export async function downloadAndInstallPosAppUpdate(release) {
  const safeRelease = normalizeRelease(release);
  if (!safeRelease) throw new Error("Thông tin bản cập nhật chưa hợp lệ.");
  if (!nativeUpdater?.downloadAndInstall) {
    throw new Error("Thiết bị này chưa hỗ trợ cập nhật trực tiếp.");
  }
  return nativeUpdater.downloadAndInstall(
    safeRelease.url,
    safeRelease.sha256,
    safeRelease.sizeBytes
  );
}
