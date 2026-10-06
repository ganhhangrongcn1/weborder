import AdminPanel from "../ui/AdminPanel.jsx";
import useSupabaseDiagnostics from "../../../hooks/useSupabaseDiagnostics.js";

export default function AdminConnectionDiagnostics() {
  const snapshot = useSupabaseDiagnostics();
  const recentErrors = snapshot.entries.filter((entry) =>
    entry.kind === "sdk_error" || (!entry.aborted && (entry.status === 0 || entry.status >= 400))
  ).slice(-5).reverse();
  return (
    <details className="admin-ui-panel" style={{ marginTop: 16 }}>
      <summary style={{ padding: 16, cursor: "pointer" }}>Tình trạng kết nối trong phiên này</summary>
      <AdminPanel description="Chỉ các yêu cầu trong tab này trong 15 phút gần nhất. Không đại diện toàn hệ thống; thời gian đo đến lúc nhận phần đầu phản hồi HTTP.">
        <p>{snapshot.requests ? `${snapshot.requests} lượt gọi · ${snapshot.errors} lỗi · ${snapshot.aborted} lượt dừng` : "Chưa có dữ liệu kết nối trong phiên này."}</p>
        <p>Phản hồi HTTP thành công gần nhất: {snapshot.lastSuccessAt ? new Date(snapshot.lastSuccessAt).toLocaleTimeString("vi-VN") : "Chưa ghi nhận"}</p>
        {snapshot.groups.filter((group) => group.scope === "admin").slice(0, 8).map((group) => (
          <p key={group.scope + group.endpoint}>{group.endpoint}: {group.count} mẫu · {group.p95HeadersMs === null ? "Chưa đủ mẫu để đo độ trễ" : `95% phản hồi trong ${Math.round(group.p95HeadersMs)} ms`}</p>
        ))}
        {recentErrors.length > 0 && <details>
          <summary>Xem thông tin lỗi gần đây</summary>
          {recentErrors.map((entry, index) => (
            <p key={index}>{new Date(entry.at).toLocaleTimeString("vi-VN")} · {entry.endpoint} · {entry.code || (entry.status ? `HTTP ${entry.status}` : "Mất kết nối")}
              {entry.requestId ? ` · Mã tra cứu: ${entry.requestId}` : ""}
            </p>
          ))}
        </details>}
      </AdminPanel>
    </details>
  );
}
