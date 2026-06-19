import { useEffect, useState } from "react";
import {
  getAppDownloads,
  getFallbackAppDownloads,
  saveGoogleDriveDownload,
  uploadApkDownload
} from "../../../services/downloadService.js";

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

const inputStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "11px 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box"
};

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
    <section className="admin-card admin-stack" style={{ gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p className="admin-eyebrow" style={{ margin: "0 0 6px" }}>Ứng dụng POS</p>
          <h2 style={{ margin: 0, color: "#111827", fontSize: 22 }}>Cập nhật file APK</h2>
          <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13, fontWeight: 700 }}>
            Dùng Google Drive cho file lớn hoặc tiếp tục upload lên Supabase Storage.
          </p>
        </div>
        <a
          href="/download"
          target="_blank"
          rel="noreferrer"
          style={{
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#334155",
            borderRadius: 8,
            padding: "10px 12px",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 900
          }}
        >
          Mở trang download
        </a>
      </div>

      {latest ? (
        <div style={{ border: "1px solid #dbe3ef", background: "#f8fafc", borderRadius: 8, padding: 14, display: "grid", gap: 8 }}>
          <strong style={{ color: "#0f172a", fontSize: 15 }}>{latest.appName}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 13, fontWeight: 800 }}>
            <span>Phiên bản hiện tại: {latest.version}</span>
            <span>•</span>
            <span>Cập nhật: {formatDate(latest.updatedAt)}</span>
          </div>
          <a href={latest.url} target="_blank" rel="noreferrer" style={{ color: "#0f766e", fontSize: 13, fontWeight: 900, wordBreak: "break-all" }}>
            Kiểm tra link tải hiện tại
          </a>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <fieldset style={{ margin: 0, padding: 0, border: 0, display: "grid", gap: 8 }}>
          <legend style={{ marginBottom: 8, color: "#334155", fontSize: 13, fontWeight: 900 }}>Nguồn file APK</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            <label style={{ border: source === "google-drive" ? "2px solid #14b8a6" : "1px solid #cbd5e1", borderRadius: 8, padding: 12, display: "flex", gap: 9, cursor: "pointer", background: source === "google-drive" ? "#f0fdfa" : "#ffffff" }}>
              <input type="radio" name="download-source" value="google-drive" checked={source === "google-drive"} onChange={() => setSource("google-drive")} />
              <span><strong>Google Drive</strong><br /><small style={{ color: "#64748b" }}>Khuyên dùng cho file APK lớn</small></span>
            </label>
            <label style={{ border: source === "supabase" ? "2px solid #14b8a6" : "1px solid #cbd5e1", borderRadius: 8, padding: 12, display: "flex", gap: 9, cursor: "pointer", background: source === "supabase" ? "#f0fdfa" : "#ffffff" }}>
              <input type="radio" name="download-source" value="supabase" checked={source === "supabase"} onChange={() => setSource("supabase")} />
              <span><strong>Supabase Storage</strong><br /><small style={{ color: "#64748b" }}>Giữ cách upload cũ</small></span>
            </label>
          </div>
        </fieldset>

        <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 900 }}>
          Phiên bản mới
          <input value={version} onChange={(event) => setVersion(event.target.value)} placeholder={suggestedVersion} style={inputStyle} />
        </label>

        {source === "google-drive" ? (
          <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 900 }}>
            Link chia sẻ Google Drive
            <input
              type="url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/.../view"
              style={inputStyle}
            />
            <small style={{ color: "#64748b", fontWeight: 700, lineHeight: 1.45 }}>
              Trên Google Drive, chọn Chia sẻ → Quyền truy cập chung → Bất kỳ ai có đường liên kết.
            </small>
          </label>
        ) : (
          <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 900 }}>
            File APK mới
            <input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              style={{ ...inputStyle, borderStyle: "dashed", background: "#ffffff" }}
            />
          </label>
        )}

        {source === "supabase" && file ? (
          <div style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>
            Đã chọn: {file.name} ({Math.max(1, Math.round(file.size / 1024 / 1024))} MB)
          </div>
        ) : null}

        {notice ? (
          <div style={{ border: "1px solid #bae6fd", background: "#f0f9ff", color: "#075985", borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 800 }}>
            {notice}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{ border: "1px solid #0f766e", background: "#14b8a6", color: "#ffffff", borderRadius: 8, padding: "12px 14px", fontSize: 14, fontWeight: 950, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.72 : 1 }}
        >
          {loading ? "Đang cập nhật..." : source === "google-drive" ? "Lưu link Google Drive" : "Upload và cập nhật bản mới"}
        </button>
      </form>
    </section>
  );
}
