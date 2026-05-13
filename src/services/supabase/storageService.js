import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabaseRuntimeClient.js";

export const MENU_IMAGE_BUCKET = "menu-images";

function sanitizePathPart(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildStoragePath({ folder = "misc", fileName = "image.webp", stableKey = "", hash = "" } = {}) {
  const safeFolder = sanitizePathPart(folder) || "misc";
  const safeName = sanitizePathPart(fileName.replace(/\.[^/.]+$/, "")) || "image";
  const safeStableKey = sanitizePathPart(stableKey) || safeName;
  const safeHash = sanitizePathPart(hash) || "raw";
  return `${safeFolder}/${safeStableKey}-${safeHash}.webp`;
}

async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeStoragePublicUrl(url = "") {
  return String(url || "").trim().split("?")[0];
}

async function getClientOrThrow() {
  const existing = getSupabaseRuntimeClient();
  if (existing) return existing;
  const initialized = await initSupabaseRuntimeClient();
  if (initialized) return initialized;
  throw new Error("Supabase client chưa sẵn sàng.");
}

export async function uploadImageToMenuBucket(file, { folder = "misc", stableKey = "", currentUrl = "" } = {}) {
  if (!file) throw new Error("Không có file ảnh để tải lên.");

  const client = await getClientOrThrow();
  const fileHash = await computeFileHash(file);
  const shortHash = String(fileHash || "").slice(0, 20);
  const path = buildStoragePath({
    folder,
    fileName: file.name || "image.webp",
    stableKey,
    hash: shortHash
  });
  const { data } = client.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = String(data?.publicUrl || "").trim();
  if (!publicUrl) {
    throw new Error("Không lấy được public URL từ Supabase Storage.");
  }

  const normalizedCurrentUrl = normalizeStoragePublicUrl(currentUrl);
  const normalizedTargetUrl = normalizeStoragePublicUrl(publicUrl);
  if (normalizedCurrentUrl && normalizedCurrentUrl === normalizedTargetUrl) {
    return {
      bucket: MENU_IMAGE_BUCKET,
      path,
      publicUrl,
      reused: true,
      uploaded: false
    };
  }

  const { error: uploadError } = await client.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || "image/webp",
      upsert: false
    });

  if (uploadError) {
    // Duplicate path means file already exists: reuse URL, skip new upload.
    if (String(uploadError?.message || "").toLowerCase().includes("duplicate")) {
      return {
        bucket: MENU_IMAGE_BUCKET,
        path,
        publicUrl,
        reused: true,
        uploaded: false
      };
    }
    throw new Error(uploadError.message || "Upload ảnh lên Supabase thất bại.");
  }

  return {
    bucket: MENU_IMAGE_BUCKET,
    path,
    publicUrl,
    reused: false,
    uploaded: true
  };
}
