import { useEffect, useState } from "react";
import {
  getAppDownloads,
  getFallbackAppDownloads,
  saveGoogleDriveDownload,
  uploadApkDownload
} from "../../../services/downloadService.js";
import { AdminButton, AdminInput } from "../ui/index.js";

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return value || "Chưa có";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function guessNextVersion(currentVersion = "") {
  const match = String(currentVersion || "").match(/(\d+)(?!.*\d)/);
  if (!match) return "GHR VER 4";
  const nextNumber = Number(match[1]) + 1;
  return String(currentVersion).replace(/(\d+)(?!.*\d)/, String(nextNumber));
}

export default function AppDownloadSettings() {
  const [downloads, setDownloads] = useState(() => getFallbackAppDownloads());
  const [source, setSource] = useState("google-drive");
  const [driveUrl, setDriveUrl] = useState("");
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const latest = downloads[0] || null;
  const suggestedVersion = guessNextVersion(latest?.version || "");

  useEffect(() => {
    let mounted = true;

    async function loadDownloads() {
      const nextDownloads = await getAppDownloads();
      if (!mounted) return;
      setDownloads(nextDownloads);
      setVersion((current) => current || guessNextVersion(nextDownloads?.[0]?.version || ""));
    }

    loadDownloads();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (source === "google-drive" && !driveUrl.trim()) {
      setNotice("Bạn hãy dán link chia sẻ Google Drive trước nha.");
      return;
    }
    if (source === "supabase" && !file) {
      setNotice("Bạn hãy chọn file APK trước nha.");
      return;
    }

    setLoading(true);
    setNotice(source === "google-drive" ? "Đang lưu link Google Drive..." : "Đang upload APK lên Supabase Storage...");

    try {
      const updated = source === "google-drive"
        ? await saveGoogleDriveDownload({ url: driveUrl, version: version || suggestedVersion })
        : await uploadApkDownload({ file, version: version || suggestedVersion });

      setDownloads([updated]);
      setVersion(guessNextVersion(updated.version));
      setDriveUrl("");
      setFile(null);
      form?.reset?.();
      setNotice("Đã cập nhật bản mới. Trang /download sẽ tự dùng link tải mới nhất.");
    } catch (error) {
      setNotice(error?.message || "Cập nhật APK thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-card admin-stack admin-download-card">
      <div className="admin-download-head">
        <div>
          <p className="admin-eyebrow">Ứng dụng POS</p>
          <h2>Cập nhật file APK</h2>
          <p>
            Dùng Google Drive cho file lớn hoặc tiếp tục upload lên Supabase Storage.
          </p>
        </div>
        <a
          href="/download"
          target="_blank"
          rel="noreferrer"
          className="admin-download-link"
        >
          Mở trang download
        </a>
      </div>

      {latest ? (
        <div className="admin-download-current">
          <strong>{latest.appName}</strong>
          <div>
            <span>Phiên bản hiện tại: {latest.version}</span>
            <span>Cập nhật: {formatDate(latest.updatedAt)}</span>
          </div>
          <a href={latest.url} target="_blank" rel="noreferrer">
            Kiểm tra link tải hiện tại
          </a>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="admin-download-form">
        <fieldset className="admin-download-source">
          <legend>Nguồn file APK</legend>
          <div className="admin-download-source-grid">
            <label className={source === "google-drive" ? "is-active" : ""}>
              <input type="radio" name="download-source" value="google-drive" checked={source === "google-drive"} onChange={() => setSource("google-drive")} />
              <span>
                <strong>Google Drive</strong>
                <small>Khuyên dùng cho file APK lớn</small>
              </span>
            </label>
            <label className={source === "supabase" ? "is-active" : ""}>
              <input type="radio" name="download-source" value="supabase" checked={source === "supabase"} onChange={() => setSource("supabase")} />
              <span>
                <strong>Supabase Storage</strong>
                <small>Giữ cách upload cũ</small>
              </span>
            </label>
          </div>
        </fieldset>

        <label className="admin-download-field">
          Phiên bản mới
          <AdminInput value={version} onChange={(event) => setVersion(event.target.value)} placeholder={suggestedVersion} />
        </label>

        {source === "google-drive" ? (
          <label className="admin-download-field">
            Link chia sẻ Google Drive
            <AdminInput
              type="url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/.../view"
            />
            <small>
              Trên Google Drive, chọn Chia sẻ → Quyền truy cập chung → Bất kỳ ai có đường liên kết.
            </small>
          </label>
        ) : (
          <label className="admin-download-field">
            File APK mới
            <input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="admin-download-file"
            />
          </label>
        )}

        {source === "supabase" && file ? (
          <div className="admin-download-file-note">
            Đã chọn: {file.name} ({Math.max(1, Math.round(file.size / 1024 / 1024))} MB)
          </div>
        ) : null}

        {notice ? (
          <div className="admin-download-notice">
            {notice}
          </div>
        ) : null}

        <AdminButton
          type="submit"
          disabled={loading}
          variant="success"
          className="admin-download-submit"
        >
          {loading ? "Đang cập nhật..." : source === "google-drive" ? "Lưu link Google Drive" : "Upload và cập nhật bản mới"}
        </AdminButton>
      </form>
    </section>
  );
}
