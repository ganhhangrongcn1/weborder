import { getAppDownloads } from "../services/downloadService.js";

function formatDate(value = "") {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

export default function DownloadPage() {
  const downloads = getAppDownloads();
  const latest = downloads[0];

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Inter, system-ui, Arial, sans-serif",
        padding: "18px 14px",
        display: "grid",
        placeItems: "center"
      }}
    >
      <section
        style={{
          width: "min(100%, 720px)",
          display: "grid",
          gap: 14
        }}
      >
        <header
          style={{
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            borderRadius: 12,
            padding: 18,
            display: "grid",
            gridTemplateColumns: "52px minmax(0, 1fr)",
            gap: 12,
            alignItems: "center",
            boxShadow: "0 14px 34px rgba(15, 23, 42, 0.08)"
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#ffcd00",
              display: "grid",
              placeItems: "center",
              color: "#111827",
              fontWeight: 1000,
              fontSize: 18
            }}
          >
            GHR
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", color: "#64748b", fontSize: 13, fontWeight: 900 }}>
              Gánh Hàng Rong
            </p>
            <h1 style={{ margin: 0, fontSize: "clamp(24px, 5vw, 34px)", lineHeight: 1.1 }}>
              Tải ứng dụng POS
            </h1>
          </div>
        </header>

        {downloads.map((item) => (
          <article
            key={item.id}
            style={{
              border: "1px solid #dbe3ef",
              background: "#ffffff",
              borderRadius: 12,
              padding: 18,
              display: "grid",
              gap: 16,
              boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)"
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{item.appName}</h2>
                {item.id === latest.id ? (
                  <span
                    style={{
                      border: "1px solid #99f6e4",
                      background: "#ccfbf1",
                      color: "#0f766e",
                      borderRadius: 999,
                      padding: "4px 9px",
                      fontSize: 12,
                      fontWeight: 900
                    }}
                  >
                    Mới nhất
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: "#475569", fontSize: 13, fontWeight: 800 }}>
                <span>Phiên bản: {item.version}</span>
                <span>•</span>
                <span>Cập nhật: {formatDate(item.updatedAt)}</span>
                <span>•</span>
                <span>{item.platform}</span>
              </div>
              <p style={{ margin: 0, color: "#334155", fontSize: 14, fontWeight: 750 }}>
                Hỗ trợ: {item.printerSupport}
              </p>
            </div>

            <a
              href={item.url}
              download={item.fileName}
              style={{
                minHeight: 48,
                border: "1px solid #0f766e",
                background: "#14b8a6",
                color: "#ffffff",
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "0 16px",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 950,
                width: "100%"
              }}
            >
              <DownloadIcon />
              Tải APK
            </a>

            <div
              style={{
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                borderRadius: 10,
                padding: 12,
                display: "grid",
                gap: 7,
                color: "#475569",
                fontSize: 13,
                fontWeight: 750,
                lineHeight: 1.45
              }}
            >
              {item.notes.map((note) => (
                <span key={note}>{note}</span>
              ))}
            </div>
          </article>
        ))}

        <section
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            borderRadius: 12,
            padding: 14,
            display: "grid",
            gap: 7,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.45
          }}
        >
          <strong style={{ color: "#78350f", fontSize: 14 }}>Hướng dẫn cài trên máy POS Android</strong>
          <span>1. Bấm Tải APK và mở file vừa tải.</span>
          <span>2. Nếu máy hỏi quyền cài ứng dụng ngoài CH Play, chọn Cho phép.</span>
          <span>3. Mở GHR POS, vào Cài đặt, chọn USB hoặc LAN/WiFi rồi bấm In test.</span>
        </section>
      </section>
    </main>
  );
}
