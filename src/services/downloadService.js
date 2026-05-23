import {
  getSupabaseAdminAuthClient,
  getSupabaseRuntimeClient,
  initSupabaseAdminAuthClient,
  initSupabaseRuntimeClient
} from "./supabase/supabaseRuntimeClient.js";

export const APP_DOWNLOADS_CONFIG_KEY = "ghr_app_downloads";
export const APP_DOWNLOADS_BUCKET = "app-downloads";

const fallbackDownloads = [
  {
    id: "ghr-pos-printer",
    appName: "GHR Print Station",
    version: "GHR VER 3",
    updatedAt: "2026-05-23",
    platform: "Android POS",
    printerSupport: "Xprinter 80mm USB/LAN/WiFi",
    fileName: "GHR VER 3.apk",
    url: "https://qjaklysckgzdfjthzkzu.supabase.co/storage/v1/object/public/app-downloads/GHR%20VER%203.apk",
    notes: [
      "Dùng cho máy POS Android tại chi nhánh.",
      "Nhận lệnh in bill khách qua Supabase print_jobs.",
      "Hỗ trợ máy in Xprinter 80mm qua USB hoặc LAN/WiFi."
    ]
  }
];

function normalizeDownloads(value) {
  const source = Array.isArray(value) ? value : value?.items;
  const items = Array.isArray(source) ? source : [];
  return items
    .map((item, index) => ({
      id: String(item?.id || `app-${index + 1}`).trim(),
      appName: String(item?.appName || item?.app_name || "GHR Print Station").trim(),
      version: String(item?.version || "").trim(),
      updatedAt: String(item?.updatedAt || item?.updated_at || "").trim(),
      platform: String(item?.platform || "Android POS").trim(),
      printerSupport: String(item?.printerSupport || item?.printer_support || "Xprinter 80mm USB/LAN/WiFi").trim(),
      fileName: String(item?.fileName || item?.file_name || "").trim(),
      url: String(item?.url || "").trim(),
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
  return String(value || "GHR Print Station.apk")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    || "GHR Print Station.apk";
}

function buildStoragePath({ version = "", fileName = "" } = {}) {
  const safeVersion = String(version || "latest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "latest";
  const safeName = sanitizeFileName(fileName || `${version || "GHR Print Station"}.apk`);
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

export async function uploadApkDownload({
  file,
  version,
  appName = "GHR Print Station",
  platform = "Android POS",
  printerSupport = "Xprinter 80mm USB/LAN/WiFi",
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

  const nextDownload = {
    id: "ghr-pos-printer",
    appName: String(appName || "GHR Print Station").trim(),
    version: cleanVersion,
    updatedAt: new Date().toISOString(),
    platform,
    printerSupport,
    fileName,
    url: publicUrl,
    notes: Array.isArray(notes) && notes.length ? notes : buildDefaultNotes()
  };

  const { error: saveError } = await client
    .from("app_configs")
    .upsert(
      {
        id: APP_DOWNLOADS_CONFIG_KEY,
        value: [nextDownload],
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

  if (saveError) {
    throw new Error(saveError.message || "Đã upload APK nhưng chưa lưu được phiên bản mới.");
  }

  return nextDownload;
}

export default getAppDownloads;
