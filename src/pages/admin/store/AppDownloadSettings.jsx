import { useEffect, useMemo, useState } from "react";
import { getAppDownloads, getFallbackAppDownloads, uploadApkDownload } from "../../../services/downloadService.js";

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
  const [file, setFile] = useState(null);
  const [version, setVersion] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const latest = downloads[0] || null;

  const suggestedVersion = useMemo(() => guessNextVersion(latest?.version || ""), [latest]);

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

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) {
      setNotice("Bạn chọn file APK trước nha.");
      return;
    }

    setLoading(true);
    setNotice("Đang upload APK lên Supabase Storage...");
    try {
      const uploaded = await uploadApkDownload({
        file,
        version: version || suggestedVersion
      });
      setDownloads([uploaded]);
      setVersion(guessNextVersion(uploaded.version));
      setFile(null);
      form?.reset?.();
      setNotice("Đã cập nhật APK mới. Trang /download sẽ tự lấy link mới nhất.");
    } catch (error) {
      setNotice(error?.message || "Upload APK thất bại.");
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
            Upload bản APK mới lên Supabase Storage, trang /download sẽ tự đổi sang phiên bản mới nhất.
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
        <div
          style={{
            border: "1px solid #dbe3ef",
            background: "#f8fafc",
            borderRadius: 8,
            padding: 14,
            display: "grid",
            gap: 8
          }}
        >
          <strong style={{ color: "#0f172a", fontSize: 15 }}>{latest.appName}</strong>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 13, fontWeight: 800 }}>
            <span>Phiên bản hiện tại: {latest.version}</span>
            <span>•</span>
            <span>Cập nhật: {formatDate(latest.updatedAt)}</span>
          </div>
          <a href={latest.url} target="_blank" rel="noreferrer" style={{ color: "#0f766e", fontSize: 13, fontWeight: 900, wordBreak: "break-all" }}>
            {latest.url}
          </a>
        </div>
      ) : null}

      <form onSubmit={handleUpload} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 900 }}>
          Phiên bản mới
          <input
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder={suggestedVersion}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "11px 12px",
              fontSize: 14
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, color: "#334155", fontSize: 13, fontWeight: 900 }}>
          File APK mới
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 8,
              padding: 12,
              background: "#ffffff",
              fontSize: 14
            }}
          />
        </label>

        {file ? (
          <div style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>
            Đã chọn: {file.name} ({Math.max(1, Math.round(file.size / 1024 / 1024))} MB)
          </div>
        ) : null}

        {notice ? (
          <div
            style={{
              border: "1px solid #bae6fd",
              background: "#f0f9ff",
              color: "#075985",
              borderRadius: 8,
              padding: 11,
              fontSize: 13,
              fontWeight: 800
            }}
          >
            {notice}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            border: "1px solid #0f766e",
            background: "#14b8a6",
            color: "#ffffff",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 14,
            fontWeight: 950,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.72 : 1
          }}
        >
          {loading ? "Đang upload..." : "Upload và cập nhật bản mới"}
        </button>
      </form>
    </section>
  );
}
