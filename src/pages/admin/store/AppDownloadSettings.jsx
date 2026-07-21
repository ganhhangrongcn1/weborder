import { useEffect, useState } from "react";
import {
  getAppDownloads,
  getFallbackAppDownloads,
  uploadApkDownload
} from "../../../services/downloadService.js";
import { AdminButton, AdminInput, AdminTextarea } from "../ui/index.js";

const FIRST_SIGNED_RELEASE_CODE = 6;

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

function formatFileSize(value = 0) {
  const size = Math.max(0, Number(value || 0));
  if (!size) return "Chưa có";
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function guessNextVersion(currentVersion = "") {
  const value = String(currentVersion || "").trim();
  const semanticMatch = value.match(/(\d+)\.(\d+)\.(\d+)/);
  if (semanticMatch) {
    return `${semanticMatch[1]}.${semanticMatch[2]}.${Number(semanticMatch[3]) + 1}`;
  }
  return "0.1.5";
}

function getVersionFromFileName(fileName = "") {
  const match = String(fileName || "").match(/(?:^|[^\d])(\d+\.\d+\.\d+)(?:[^\d]|$)/);
  return String(match?.[1] || "");
}

function parseReleaseNotes(value = "") {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AppDownloadSettings() {
  const [downloads, setDownloads] = useState(() => getFallbackAppDownloads());
  const [file, setFile] = useState(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const latest = downloads[0] || null;

  useEffect(() => {
    let mounted = true;

    async function loadDownloads() {
      const nextDownloads = await getAppDownloads();
      if (!mounted) return;
      const current = nextDownloads?.[0] || null;
      setDownloads(nextDownloads);
      setVersionName((value) => value || guessNextVersion(current?.versionName || current?.version));
      setVersionCode((value) => value || String(Math.max(
        FIRST_SIGNED_RELEASE_CODE,
        Number(current?.versionCode || 0) + 1
      )));
    }

    loadDownloads();
    return () => {
      mounted = false;
    };
  }, []);

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    const fileVersion = getVersionFromFileName(nextFile?.name);
    if (fileVersion) setVersionName(fileVersion);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const safeVersionCode = Math.floor(Number(versionCode || 0));

    if (!file) {
      setNotice("Bạn hãy chọn file APK trước nha.");
      return;
    }
    if (!versionName.trim()) {
      setNotice("Bạn hãy nhập tên phiên bản, ví dụ 0.1.5.");
      return;
    }
    if (safeVersionCode <= Number(latest?.versionCode || 0)) {
      setNotice("Mã phiên bản Android phải lớn hơn bản đang phát hành.");
      return;
    }

    setLoading(true);
    setNotice("Đang chuẩn bị file APK...");

    try {
      const updated = await uploadApkDownload({
        file,
        version: versionName,
        versionCode: safeVersionCode,
        mandatory,
        releaseNotes: parseReleaseNotes(releaseNotes),
        onStage: setNotice
      });

      setDownloads([updated]);
      setVersionName(guessNextVersion(updated.versionName || updated.version));
      setVersionCode(String(updated.versionCode + 1));
      setReleaseNotes("");
      setMandatory(false);
      setFile(null);
      form?.reset?.();
      setNotice("Đã phát hành. Các máy POS sẽ nhận thông báo khi kiểm tra phiên bản mới.");
    } catch (error) {
      setNotice(error?.message || "Phát hành APK thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-card admin-stack admin-download-card">
      <div className="admin-download-head">
        <div>
          <p className="admin-eyebrow">Ứng dụng POS</p>
          <h2>Phát hành bản cập nhật</h2>
          <p>APK được lưu trên Supabase và xác minh SHA-256 trước khi máy POS cài đặt.</p>
        </div>
        <a href="/download" target="_blank" rel="noreferrer" className="admin-download-link">
          Mở trang download
        </a>
      </div>

      {latest ? (
        <div className="admin-download-current">
          <strong>{latest.appName}</strong>
          <div>
            <span>Phiên bản: {latest.versionName || latest.version || "Chưa có"}</span>
            <span>Mã Android: {latest.versionCode || "Bản cũ"}</span>
            <span>Dung lượng: {formatFileSize(latest.sizeBytes)}</span>
            <span>Cập nhật: {formatDate(latest.publishedAt || latest.updatedAt)}</span>
          </div>
          {latest.sha256 ? <code>SHA-256: {latest.sha256}</code> : null}
          <a href={latest.url} target="_blank" rel="noreferrer">Kiểm tra APK đang phát hành</a>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="admin-download-form">
        <div className="admin-download-version-grid">
          <label className="admin-download-field">
            Tên phiên bản
            <AdminInput
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
              placeholder="0.1.5"
            />
          </label>

          <label className="admin-download-field">
            Mã phiên bản Android
            <AdminInput
              type="number"
              min="1"
              step="1"
              value={versionCode}
              onChange={(event) => setVersionCode(event.target.value)}
              placeholder="6"
            />
          </label>
        </div>

        <label className="admin-download-field">
          File APK mới
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={handleFileChange}
            className="admin-download-file"
          />
        </label>

        {file ? (
          <div className="admin-download-file-note">
            Đã chọn: {file.name} ({formatFileSize(file.size)})
          </div>
        ) : null}

        <label className="admin-download-field">
          Nội dung cập nhật
          <AdminTextarea
            value={releaseNotes}
            onChange={(event) => setReleaseNotes(event.target.value)}
            placeholder={"Mỗi thay đổi một dòng\nVí dụ: Tối ưu tốc độ tải đơn"}
            rows={4}
          />
        </label>

        <label className="admin-download-check">
          <input
            type="checkbox"
            checked={mandatory}
            onChange={(event) => setMandatory(event.target.checked)}
          />
          <span>
            <strong>Bản cập nhật bắt buộc</strong>
            <small>POS vẫn chờ người dùng xác nhận cài đặt theo quy định của Android.</small>
          </span>
        </label>

        {notice ? <div className="admin-download-notice">{notice}</div> : null}

        <AdminButton type="submit" disabled={loading} variant="success" className="admin-download-submit">
          {loading ? "Đang phát hành..." : "Upload và phát hành"}
        </AdminButton>
      </form>
    </section>
  );
}
