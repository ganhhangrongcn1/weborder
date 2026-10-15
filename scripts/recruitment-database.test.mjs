import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { DEFAULT_RECRUITMENT_CONFIG } from "../supabase/functions/_shared/recruitmentForm.js";
import { application } from "./recruitment-fixture.mjs";

test("isolated PostgreSQL: migration, RLS, idempotency, rate limit and notification leases", {
  skip: !process.env.RECRUITMENT_PGLITE_MODULE
}, async () => {
  // QA-only PostgreSQL WASM runtime outside this repo; no production credentials/connections.
  const { PGlite } = await import(process.env.RECRUITMENT_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const sql = await readFile(new URL("../docs/supabase-sql/recruitment-applications.sql", import.meta.url), "utf8");
    await db.exec(sql);
    await db.exec(sql); // safe to rerun
    await db.exec(await readFile(new URL("../docs/supabase-sql/recruitment-form-admin.sql", import.meta.url), "utf8"));
    assert.equal((await db.query("select relrowsecurity from pg_class where relname='recruitment_applications'")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      const access = await db.query(`select has_table_privilege('${role}', 'public.recruitment_applications', 'SELECT,INSERT,UPDATE,DELETE') as table_access,
        has_function_privilege('${role}', 'public.submit_recruitment_application(uuid,text,text,jsonb,jsonb,integer)', 'EXECUTE') as rpc_access`);
      assert.equal(access.rows[0].table_access, false);
      assert.equal(access.rows[0].rpc_access, false);
    }
    const submit = async (id, fingerprint, ip = "a".repeat(64), phone = application.phone) => {
      const result = await db.query("select public.submit_recruitment_application($1,$2,$3,$4) as receipt", [id, fingerprint, ip, { ...application, phone }]);
      return result.rows[0].receipt;
    };
    const key = randomUUID();
    const first = await submit(key, "b".repeat(64));
    const repeated = await Promise.all(Array.from({ length: 8 }, () => submit(key, "b".repeat(64))));
    assert.ok(repeated.every((row) => row.applicationId === first.applicationId && row.duplicate));
    assert.equal((await submit(randomUUID(), "b".repeat(64))).applicationId, first.applicationId);
    await assert.rejects(submit(key, "c".repeat(64)), /REQUEST_CONFLICT/);
    assert.equal((await db.query("select count(*)::int as n from public.recruitment_applications")).rows[0].n, 1);
    await submit(randomUUID(), "c".repeat(64));
    await submit(randomUUID(), "d".repeat(64));
    await assert.rejects(submit(randomUUID(), "e".repeat(64)), /RATE_LIMITED/);
    for (let i = 1; i <= 7; i++) await submit(randomUUID(), "f".repeat(64), "a".repeat(64), `09000000${String(i).padStart(2, "0")}`);
    await assert.rejects(submit(randomUUID(), "f".repeat(64), "a".repeat(64), "0900000099"), /RATE_LIMITED/);
    const snapshotId = randomUUID();
    const snapshot = await db.query("select public.submit_recruitment_application($1,$2,$3,$4,$5,1) as receipt", [snapshotId, "0".repeat(64), "1".repeat(64), { ...application, phone: "0900000098" }, DEFAULT_RECRUITMENT_CONFIG]);
    const immutableId = snapshot.rows[0].receipt.applicationId;
    const summary = (await db.query("select public.recruitment_summary($1,null,null) as value", [application.branch])).rows[0].value;
    assert.equal(summary.total, 11);
    assert.equal(summary.branches[0].count, 11);
    assert.ok(summary.choices.some((item) => item.question_id === "gender" && item.answer === "LGBT" && item.count === 1));
    assert.equal((await db.query("select public.recruitment_summary('absent',null,null) as value")).rows[0].value.total, 0);
    const edited = structuredClone(DEFAULT_RECRUITMENT_CONFIG); edited.questions[0].label = "Họ tên đã chỉnh";
    await db.query("update public.recruitment_form_settings set config=$1, revision=2 where id='default'", [edited]);
    await assert.rejects(db.query("select public.submit_recruitment_application($1,$2,$3,$4,$5,1)", [randomUUID(), "2".repeat(64), "3".repeat(64), application, DEFAULT_RECRUITMENT_CONFIG]), /FORM_CHANGED/);
    const oldSnapshot = (await db.query("select form_snapshot from public.recruitment_applications where id=$1", [immutableId])).rows[0].form_snapshot;
    assert.equal(oldSnapshot.questions[0].label, DEFAULT_RECRUITMENT_CONFIG.questions[0].label);
    await db.query("update public.recruitment_applications set notification_status='sent' where id=$1", [immutableId]);
    await db.exec("set role service_role;");
    const claimed = (await db.query("select * from public.claim_recruitment_notifications()")).rows;
    assert.equal(claimed.length, 10);
    assert.ok(claimed.every((row) => row.notification_status === "sending" && row.notification_attempts === 1));
    assert.equal((await db.query("select * from public.claim_recruitment_notifications()")).rows.length, 0);
    // Notification failure does not remove or modify the original application.
    await db.query("update public.recruitment_applications set notification_status='failed', notification_last_error='ISOLATED_TIMEOUT', notification_lease_until=null where id=$1", [first.applicationId]);
    const saved = (await db.query("select application from public.recruitment_applications where id=$1", [first.applicationId])).rows[0];
    assert.deepEqual(saved.application, application);
    assert.equal((await db.query("select * from public.claim_recruitment_notifications()")).rows.length, 1);
    await db.query("update public.recruitment_applications set notification_status='sent', notification_lease_until=null where id=$1", [first.applicationId]);
    assert.equal((await db.query("select * from public.claim_recruitment_notifications()")).rows.length, 0);
    // Crashed workers recover after lease expiry, exhausted retries remain observable.
    await db.exec("update public.recruitment_applications set notification_lease_until=now()-interval '1 minute', notification_attempts=4 where notification_status='sending';");
    const finalAttempt = (await db.query("select * from public.claim_recruitment_notifications()")).rows;
    assert.equal(finalAttempt.length, 9);
    const delivery = finalAttempt[0];
    const gate = (await db.query("select public.authorize_recruitment_delivery($1,$2) as result", [delivery.id, delivery.notification_lease])).rows[0].result;
    assert.equal(gate.allowed, true);
    assert.equal(gate.row.id, delivery.id);
    const repeatedGate = (await db.query("select public.authorize_recruitment_delivery($1,$2) as result", [delivery.id, delivery.notification_lease])).rows[0].result;
    assert.equal(repeatedGate.allowed, false);
    assert.equal(repeatedGate.sent, false);
    await db.query("update public.recruitment_applications set notification_attempts=1, notification_status='failed', notification_lease_until=null where id=$1", [delivery.id]);
    // A worker must never replay an authorized send after an uncertain Zalo/HTTP outcome.
    assert.equal((await db.query("select * from public.claim_recruitment_notifications()")).rows.length, 0);
    await db.exec("update public.recruitment_applications set notification_lease_until=null where notification_status='sending';");
    assert.equal((await db.query("select * from public.claim_recruitment_notifications()")).rows.length, 0);
  } finally { await db.close(); }
});
