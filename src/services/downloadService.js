import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseAdminAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";

export const APP_DOWNLOADS_CONFIG_KEY = "ghr_app_downloads";
export const APP_DOWNLOADS_BUCKET = "app-downloads";

const DEFAULT_APP_NAME = "GHR Print Station";
const DEFAULT_PLATFORM = "Android POS";
const DEFAULT_PRINTER_SUPPORT = "Xprinter 80mm USB/LAN/WiFi";

const fallbackDownloads = [
  {
    id: "ghr-pos-printer",
    appName: DEFAULT_APP_NAME,
    version: "GHR VER 3",
    updatedAt: "2026-05-23",
    platform: DEFAULT_PLATFORM,
    printerSupport: DEFAULT_PRINTER_SUPPORT,
    fileName: "GHR VER 3.apk",
    url: "https://qjaklysckgzdfjthzkzu.supabase.co/storage/v1/object/public/app-downloads/GHR%20VER%203.apk",
    notes: [
      "Dùng cho máy POS Android tại chi nhánh.",
      "Nhận lệnh in bill khách qua Supabase print_jobs.",
      "Hỗ trợ máy in Xprinter 80mm qua USB hoặc LAN/WiFi."
    ]
  }
];

function getGoogleDriveFileId(value = "") {
  const rawUrl = String(value || "").trim();
  if (!rawUrl) return "";

  try {
    const parsedUrl = new URL(rawUrl);
    const host = parsedUrl.hostname.toLowerCase();
    if (!host.endsWith("drive.google.com") && !host.endsWith("drive.usercontent.google.com")) {
      return "";
    }

    const pathMatch = parsedUrl.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return String(pathMatch?.[1] || parsedUrl.searchParams.get("id") || "").trim();
  } catch {
    return "";
  }
}

export function normalizeDownloadUrl(value = "") {
  const rawUrl = String(value || "").trim();
  const driveFileId = getGoogleDriveFileId(rawUrl);
  if (driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
  }
  return rawUrl;
}

function normalizeDownloads(value) {
  const source = Array.isArray(value) ? value : value?.items;
  const items = Array.isArray(source) ? source : [];
  return items
    .map((item, index) => ({
      id: String(item?.id || `app-${index + 1}`).trim(),
      appName: String(item?.appName || item?.app_name || DEFAULT_APP_NAME).trim(),
      version: String(item?.version || "").trim(),
      updatedAt: String(item?.updatedAt || item?.updated_at || "").trim(),
      platform: String(item?.platform || DEFAULT_PLATFORM).trim(),
      printerSupport: String(item?.printerSupport || item?.printer_support || DEFAULT_PRINTER_SUPPORT).trim(),
      fileName: String(item?.fileName || item?.file_name || "").trim(),
      url: normalizeDownloadUrl(item?.url),
      notes: Array.isArray(item?.notes) ? item.notes.map((note) => String(note || "").trim()).filter(Boolean) : []
    }))
    .filter((item) => item.url);
}

function buildDefaultNotes() {
  return [
    "Dùng cho máy POS Android tại chi nhánh.",
    "Đăng nhập tài khoản chi nhánh để tự nhận đúng lệnh in.",
    "Hỗ trợ máy in Xprinter 80mm qua USB hoặc LAN/WiFi."
  ];
}

function sanitizeFileName(value = "") {
  return String(value || `${DEFAULT_APP_NAME}.apk`)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ") || `${DEFAULT_APP_NAME}.apk`;
}

function buildStoragePath({ version = "", fileName = "" } = {}) {
  const safeVersion = String(version || "latest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "latest";
  const safeName = sanitizeFileName(fileName || `${version || DEFAULT_APP_NAME}.apk`);
  return `pos-printer/${safeVersion}/${safeName}`;
}

async function getRuntimeClientOrThrow() {
  const existing = getSupabaseRuntimeClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  throw new Error("Supabase client chưa sẵn sàng.");
}

async function getAdminClientOrThrow() {
  const existing = getSupabaseAdminAuthClient();
  if (existing) return existing;
  const initialized = await initSupabaseAdminAuthClient();
  if (initialized) return initialized;
  throw new Error("Supabase admin client chưa sẵn sàng.");
}

async function saveDownloadConfig(client, download) {
  const { error } = await client
    .from("app_configs")
    .upsert(
      {
        id: APP_DOWNLOADS_CONFIG_KEY,
        value: [download],
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(error.message || "Chưa lưu được thông tin phiên bản mới.");
  }
}

function buildDownloadMetadata({
  url,
  version,
  fileName,
  appName = DEFAULT_APP_NAME,
  platform = DEFAULT_PLATFORM,
  printerSupport = DEFAULT_PRINTER_SUPPORT,
  notes = buildDefaultNotes()
}) {
  const cleanVersion = String(version || "").trim() || `GHR VER ${new Date().toLocaleDateString("vi-VN")}`;
  return {
    id: "ghr-pos-printer",
    appName: String(appName || DEFAULT_APP_NAME).trim(),
    version: cleanVersion,
    updatedAt: new Date().toISOString(),
    platform,
    printerSupport,
    fileName: sanitizeFileName(fileName || `${cleanVersion}.apk`),
    url: normalizeDownloadUrl(url),
    notes: Array.isArray(notes) && notes.length ? notes : buildDefaultNotes()
  };
}

export function getFallbackAppDownloads() {
  return fallbackDownloads;
}

export async function getAppDownloads() {
  try {
    const client = await getRuntimeClientOrThrow();
    const { data, error } = await client
      .from("app_configs")
      .select("value")
      .eq("id", APP_DOWNLOADS_CONFIG_KEY)
      .maybeSingle();

    if (error) throw error;
    const downloads = normalizeDownloads(data?.value);
    return downloads.length ? downloads : fallbackDownloads;
  } catch (error) {
    console.warn("[downloadService] Không đọc được app downloads từ Supabase.", error);
    return fallbackDownloads;
  }
}

export async function saveGoogleDriveDownload({
  url,
  version,
  appName = DEFAULT_APP_NAME,
  platform = DEFAULT_PLATFORM,
  printerSupport = DEFAULT_PRINTER_SUPPORT,
  notes = buildDefaultNotes()
} = {}) {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) throw new Error("Bạn chưa nhập link Google Drive.");
  if (!getGoogleDriveFileId(rawUrl)) {
    throw new Error("Link Google Drive chưa đúng. Hãy dùng link chia sẻ của một file APK.");
  }

  const client = await getAdminClientOrThrow();
  const download = buildDownloadMetadata({
    url: rawUrl,
    version,
    appName,
    platform,
    printerSupport,
    notes
  });
  await saveDownloadConfig(client, download);
  return download;
}

export async function uploadApkDownload({
  file,
  version,
  appName = DEFAULT_APP_NAME,
  platform = DEFAULT_PLATFORM,
  printerSupport = DEFAULT_PRINTER_SUPPORT,
  notes = buildDefaultNotes()
} = {}) {
  if (!file) throw new Error("Bạn chưa chọn file APK.");
  if (!String(file.name || "").toLowerCase().endsWith(".apk")) {
    throw new Error("File tải lên phải là file .apk.");
  }

  const client = await getAdminClientOrThrow();
  const cleanVersion = String(version || "").trim() || `GHR VER ${new Date().toLocaleDateString("vi-VN")}`;
  const fileName = sanitizeFileName(file.name || `${cleanVersion}.apk`);
  const path = buildStoragePath({ version: cleanVersion, fileName });

  const { error: uploadError } = await client.storage
    .from(APP_DOWNLOADS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || "application/vnd.android.package-archive",
      upsert: true
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Upload APK lên Supabase Storage thất bại.");
  }

  const { data: publicData } = client.storage.from(APP_DOWNLOADS_BUCKET).getPublicUrl(path);
  const publicUrl = String(publicData?.publicUrl || "").trim();
  if (!publicUrl) throw new Error("Không lấy được link public của APK.");

  const download = buildDownloadMetadata({
    url: publicUrl,
    version: cleanVersion,
    fileName,
    appName,
    platform,
    printerSupport,
    notes
  });
  await saveDownloadConfig(client, download);
  return download;
}

export default getAppDownloads;
