import { createServer } from "node:http";

// Local-only development bridge. No secret is shipped in the Vite bundle.
// A hosted version needs independent authentication, access control and rate limits.
export async function exchangeToken(kind, input, secret, fetcher = fetch) {
  if (!secret) throw new Error("Chưa cấu hình ZALO_APP_SECRET ở máy chủ local.");
  if (!["location", "phone"].includes(kind) || typeof input.token !== "string" || !input.token || input.token.length > 4096
    || typeof input.accessToken !== "string" || !input.accessToken || input.accessToken.length > 4096) throw new Error("Token không hợp lệ.");
  const response = await fetcher("https://graph.zalo.me/v2.0/me/info", {
    headers: { access_token: input.accessToken, code: input.token, secret_key: secret }, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Máy chủ Zalo chưa trả về thông tin hợp lệ.");
  const result = await response.json();
  if (result.error !== 0 || !result.data) throw new Error("Zalo từ chối đổi token. Token có thể đã hết hạn hoặc đã dùng.");
  if (kind === "phone") {
    const phone = String(result.data.number || "");
    if (!/^\+?\d{9,15}$/.test(phone)) throw new Error("Zalo chưa trả về số điện thoại hợp lệ.");
    // Demo only needs a masked phone; do not persist the full phone.
    return { masked: `SĐT Zalo · *** ${phone.slice(-4)}`, simulated: false };
  }
  const latitude = Number(result.data.latitude); const longitude = Number(result.data.longitude);
  const capturedAt = Number(result.data.timestamp);
  if (![latitude, longitude, capturedAt].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Vị trí Zalo chưa hợp lệ.");
  return { latitude, longitude, capturedAt,
    // The Zalo response does not promise GPS accuracy. Use an explicit conservative margin.
    accuracy: Number.isFinite(Number(result.data.accuracy)) && result.data.accuracy != null ? Number(result.data.accuracy) : 100,
    accuracyEstimated: result.data.accuracy == null, simulated: false };
}

export function startBridge() {
  const origins = new Set(["http://127.0.0.1:5180", "http://localhost:5180", "http://127.0.0.1:5182", "http://localhost:5182", "https://h5.zdn.vn"]);
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    response.setHeader("Cache-Control", "no-store"); response.setHeader("Content-Type", "application/json; charset=utf-8");
    if (origin && !origins.has(origin)) { response.writeHead(403); response.end(JSON.stringify({ error: "Origin không được phép." })); return; }
    if (origin) { response.setHeader("Access-Control-Allow-Origin", origin); response.setHeader("Vary", "Origin"); }
    if (request.method === "OPTIONS") { response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); response.setHeader("Access-Control-Allow-Headers", "Content-Type"); response.writeHead(204); response.end(); return; }
    const kind = request.url === "/api/zalo/location" ? "location" : request.url === "/api/zalo/phone" ? "phone" : null;
    if (!kind || request.method !== "POST") { response.writeHead(404); response.end(JSON.stringify({ error: "Không tìm thấy API." })); return; }
    try {
      let body = "";
      for await (const chunk of request) { body += chunk.toString(); if (Buffer.byteLength(body) > 12000) throw new Error("Yêu cầu quá lớn."); }
      const result = await exchangeToken(kind, JSON.parse(body), process.env.ZALO_APP_SECRET);
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(400); response.end(JSON.stringify({ error: error.message === "fetch failed" ? "Không kết nối được Zalo." : error.message }));
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  server.listen(5181, "127.0.0.1", () => console.log("Zalo token bridge local: http://127.0.0.1:5181 (chưa có cấu hình secret thì API sẽ báo thiếu cấu hình)"));
  return server;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/zaloBridge.mjs")) startBridge();
