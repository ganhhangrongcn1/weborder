export async function drainRecruitmentNotifications({ client, env, fetchImpl = fetch }) {
  const url = env("RECRUITMENT_N8N_WEBHOOK_URL");
  const token = env("RECRUITMENT_N8N_WEBHOOK_SECRET");
  if (env("RECRUITMENT_NOTIFICATIONS_ENABLED") !== "true" || !url || !token) {
    return { enabled: false, sent: 0, failed: 0 };
  }
  if (!url.startsWith("https://")) throw new Error("INVALID_WEBHOOK_CONFIG");
  const { data: rows, error } = await client.rpc("claim_recruitment_notifications");
  if (error) throw new Error("QUEUE_UNAVAILABLE");
  let sent = 0;
  let failed = 0;
  await Promise.all((rows || []).map(async (row) => {
    let delivered = false;
    let failure = "WEBHOOK_UNCONFIRMED";
    try {
      const response = await fetchImpl(url, {
        method: "POST", redirect: "error",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          event: "recruitment_application_received", application_id: row.id,
          submitted_at: row.submitted_at, application: row.application
        }),
        signal: globalThis.AbortSignal.timeout(10000)
      });
      const ack = await response.json().catch(() => null);
      // Webhook must confirm this one ID only after durable, idempotent processing.
      delivered = response.ok && ack?.ok === true && ack?.application_id === row.id;
      if (!response.ok) failure = `WEBHOOK_HTTP_${response.status}`;
    } catch { failure = "WEBHOOK_NETWORK_OR_TIMEOUT"; }
    const patch = {
      notification_status: delivered ? "sent" : "failed",
      notification_last_error: delivered ? null : failure,
      notified_at: delivered ? new Date().toISOString() : null,
      notification_next_attempt_at: new Date(Date.now() + Math.min(3600, 60 * 2 ** row.notification_attempts) * 1000).toISOString(),
      notification_lease_until: null
    };
    const result = await client.from("recruitment_applications").update(patch)
      .eq("id", row.id).eq("notification_lease", row.notification_lease);
    // Leave a leased row recoverable if persisting the acknowledgement fails.
    if (result.error) throw new Error("QUEUE_ACK_FAILED");
    if (delivered) sent++; else failed++;
  }));
  return { enabled: true, sent, failed };
}
