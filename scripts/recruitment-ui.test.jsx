/* global Response */
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { create, act } from "recruitment-test-renderer";
import { MemoryRouter } from "react-router-dom";
import useRecruitmentForm from "../src/features/recruitment/useRecruitmentForm.js";
import RecruitmentPage from "../src/features/recruitment/RecruitmentPage.jsx";
import AdminRecruitmentPage from "../src/pages/admin/recruitment/AdminRecruitmentPage.jsx";
import { DEFAULT_RECRUITMENT_CONFIG } from "../supabase/functions/_shared/recruitmentForm.js";
import { application } from "./recruitment-fixture.mjs";

globalThis.document = { title: "Gánh", getElementById: () => ({ focus() {} }) };
globalThis.requestAnimationFrame = (callback) => callback();
const event = { preventDefault() {} };

test("actual hook: validation, rapid double click, failure, retry, edit and success", async () => {
  let state;
  function Harness() { state = useRecruitmentForm(); return null; }
  let view;
  let requests = [];
  let resolveFetch;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(url, "https://isolated.invalid/functions/v1/recruitment-api");
    assert.equal(options.headers.Authorization, undefined); // public, no login
    const body = JSON.parse(options.body);
    if (body.action === "get_form") return Promise.resolve(Response.json({ ok: true, config: DEFAULT_RECRUITMENT_CONFIG, revision: 1 }));
    requests.push(body);
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  try {
    await act(async () => { view = create(<Harness />); });
    await act(async () => { await state.submit(event); });
    assert.equal(requests.length, 0);
    assert.ok(state.errors.fullName);
    await act(async () => { for (const [key, value] of Object.entries(application)) state.update(key, value); });
    let pending;
    await act(async () => { pending = state.submit(event); await state.submit(event); });
    assert.equal(requests.length, 1);
    assert.equal(state.submitting, true);
    await act(async () => { resolveFetch(Response.json({ ok: false, message: "Lỗi kiểm thử" }, { status: 503 })); await pending; });
    assert.equal(state.receipt, null);
    assert.equal(state.form.fullName, application.fullName);
    assert.equal(state.message, "Lỗi kiểm thử");
    await act(async () => { pending = state.submit(event); });
    assert.equal(requests[1].requestId, requests[0].requestId);
    await act(async () => { resolveFetch(Response.json({ ok: false }, { status: 503 })); await pending; });
    await act(async () => { state.update("selfDescription", "Nội dung chỉnh sửa kiểm thử"); });
    await act(async () => { pending = state.submit(event); });
    assert.notEqual(requests[2].requestId, requests[1].requestId);
    await act(async () => { resolveFetch(Response.json({ ok: true, applicationId: "isolated-receipt" })); await pending; });
    assert.equal(state.receipt.applicationId, "isolated-receipt");
    await act(async () => { await state.submit(event); });
    assert.equal(requests.length, 3);
  } finally { globalThis.fetch = originalFetch; await act(async () => { view.unmount(); }); }
});

test("actual page: logo reuse, public form, required fields, education other and success view", async () => {
  let view;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => JSON.parse(options.body).action === "get_form"
    ? Response.json({ ok: true, config: DEFAULT_RECRUITMENT_CONFIG, revision: 1 }) : Response.json({ ok: true, applicationId: "isolated-receipt" });
  await act(async () => {
    view = create(<MemoryRouter><RecruitmentPage homeContent={[{ id: "siteBrand", logo: "https://isolated.invalid/existing-logo.png" }]} /></MemoryRouter>);
  });
  try {
    assert.equal(view.root.findByType("img").props.src, "https://isolated.invalid/existing-logo.png");
    const fields = ["fullName", "birthDate", "phone", "address", "school", "impression", "previousJob", "selfDescription"];
    for (const name of fields) assert.equal(view.root.findByProps({ id: `recruitment-${name}` }).props.required, true);
    assert.equal(view.root.findAllByType("legend").length, 5);
    await act(async () => { view.root.findByProps({ value: "Mục khác", type: "radio" }).props.onChange(); });
    assert.equal(view.root.findByProps({ id: "recruitment-educationOther" }).props.required, true);
    await act(async () => {
      for (const [name, value] of Object.entries(application)) {
        if (["gender", "branch", "education"].includes(name)) view.root.findByProps({ value, type: "radio" }).props.onChange();
        else if (["shifts", "workTypes"].includes(name)) view.root.findByProps({ value: value[0], type: "checkbox" }).props.onChange();
        else view.root.findByProps({ id: `recruitment-${name}` }).props.onChange({ target: { value } });
      }
    });
    await act(async () => { await view.root.findByType("form").props.onSubmit(event); });
    assert.equal(view.root.findAllByType("form").length, 0);
    assert.equal(view.root.findByProps({ role: "status" }).findByType("h2").children.join(""), "Gánh đã nhận hồ sơ của bạn!");
  } finally { globalThis.fetch = originalFetch; await act(async () => { view.unmount(); }); }
});

test("actual Admin: branch/date filters, list/detail, summary, save error keeps edited questions", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let saveFails = true;
  const config = structuredClone(DEFAULT_RECRUITMENT_CONFIG);
  globalThis.__GHR_SUPABASE_ADMIN_AUTH_CLIENT__ = { auth: { getSession: async () => ({ data: { session: { access_token: "isolated-admin-jwt" } } }) } };
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    assert.equal(options.headers.Authorization, "Bearer isolated-admin-jwt");
    if (body.action === "admin_form") return Response.json({ ok: true, config, revision: 1 });
    if (body.action === "admin_save_form") return saveFails
      ? Response.json({ ok: false, message: "Lưu lỗi kiểm thử" }, { status: 503 })
      : Response.json({ ok: true, config: body.config, revision: 2 });
    if (body.action === "admin_detail") return Response.json({ ok: true, application: { id: body.id, application,
      submitted_at: "2026-10-14T00:00:00Z", notification_status: "pending", form_snapshot: config } });
    return Response.json({ ok: true, rows: [{ id: "isolated", fullName: application.fullName, phone: application.phone,
      branch: application.branch, submitted_at: "2026-10-14T00:00:00Z", notification_status: "pending" }], count: 1,
      summary: { total: 1, notificationFailed: 0, branches: [{ branch: application.branch, count: 1 }], choices: [{ question_id: "shifts", label: "Khung giờ", answer: "Cả 2 ca", count: 1 }] } });
  };
  let view;
  try {
    await act(async () => { view = create(<AdminRecruitmentPage />); });
    const buttons = () => view.root.findAllByType("button");
    const clickText = (text) => buttons().find((b) => b.children.join("") === text).props.onClick();
    await act(async () => { view.root.findByType("select").props.onChange({ target: { value: application.branch } }); });
    assert.equal(calls.filter((c) => c.action === "admin_dashboard").at(-1).branch, application.branch);
    await act(async () => { view.root.findAllByType("input").find((i) => i.props.type === "date").props.onChange({ target: { value: "2026-10-14" } }); });
    assert.equal(calls.filter((c) => c.action === "admin_dashboard").at(-1).from, "2026-10-14");
    await act(async () => { clickText("Xem"); });
    assert.equal(view.root.findAllByType("dt").length, 13);
    await act(async () => { clickText("Tổng hợp"); });
    assert.equal(view.root.findByType("meter").props.value, 1);
    await act(async () => { clickText("Câu hỏi & cài đặt"); });
    await act(async () => { view.root.findAllByType("input").find((i) => i.props.value === "Họ và tên").props.onChange({ target: { value: "Tên đã sửa kiểm thử" } }); });
    await act(async () => { view.root.findByType("form").props.onSubmit(event); });
    assert.equal(view.root.findAllByType("input").find((i) => i.props.value === "Tên đã sửa kiểm thử").props.value, "Tên đã sửa kiểm thử");
    assert.equal(view.root.findByProps({ role: "alert" }).children.join(""), "Lưu lỗi kiểm thử");
    saveFails = false;
    await act(async () => { view.root.findByType("form").props.onSubmit(event); });
    assert.ok(view.root.findByProps({ role: "status" }).children.join("").includes("Đã lưu"));
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__GHR_SUPABASE_ADMIN_AUTH_CLIENT__;
    if (view) await act(async () => { view.unmount(); });
  }
});
