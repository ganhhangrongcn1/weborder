const APP_ID = "2442731166050783503";
const reply = (status, message) => new Response(JSON.stringify({ message }), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function signatureFor(data, key) {
  const content = Object.keys(data).sort().map((field) => typeof data[field] === "object"
    ? JSON.stringify(data[field]) : String(data[field])).join("");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content + key));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalSignature(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(left)) return false;
  let difference = 0;
  for (let index = 0; index < 64; index++) difference |= left.toLowerCase().charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

// Persist before acknowledgement. A pending request is not a completed deletion.
export function createHandler({ apiKey, persist }) {
  return async (request) => {
    if (request.method !== "POST") return reply(405, "POST required");
    if (!apiKey) return reply(503, "Webhook not configured");
    try {
      const reader = request.body?.getReader();
      if (!reader) return reply(400, "Invalid body");
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); return reply(413, "Payload too large"); }
        chunks.push(value);
      }
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
      if (!data || Array.isArray(data) || typeof data !== "object") return reply(400, "Invalid payload");
      const expected = await signatureFor(data, apiKey);
      if (!equalSignature(request.headers.get("x-zevent-signature") || "", expected)) return reply(401, "Invalid signature");
      if (data.appId !== APP_ID) return reply(403, "App not allowed");
      if (data.event !== "user.revoke.consent") return reply(400, "Unsupported event");
      if (typeof data.userId !== "string" || !/^\d{1,64}$/.test(data.userId)) return reply(400, "Invalid user identity");
      if (data.timestamp !== undefined && (!Number.isSafeInteger(data.timestamp) || data.timestamp < 0)) return reply(400, "Invalid timestamp");
      // Retry key ignores optional/unknown fields; one revocation per user/event timestamp.
      const eventKey = await signatureFor({ appId: data.appId, event: data.event, userId: data.userId,
        timestamp: data.timestamp ?? "absent" }, "");
      await persist({ event_key: eventKey, app_id: APP_ID, zalo_user_id: data.userId,
        event_timestamp: data.timestamp === undefined ? null : String(data.timestamp) });
      return reply(200, "Request recorded for processing");
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) return reply(400, "Invalid payload");
      return reply(503, "Unable to record request; retry later");
    }
  };
}
