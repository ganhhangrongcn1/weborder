/* global Response, structuredClone */
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { create, act } from "recruitment-test-renderer";
import { MemoryRouter } from "react-router-dom";
import useRecruitmentForm from "../src/features/recruitment/useRecruitmentForm.js";
import RecruitmentPage from "../src/features/recruitment/RecruitmentPage.jsx";
import RecruitmentFormEditor from "../src/pages/admin/recruitment/RecruitmentFormEditor.jsx";
import RecruitmentQuestion from "../src/features/recruitment/RecruitmentQuestion.jsx";
import AdminRecruitmentPage from "../src/pages/admin/recruitment/AdminRecruitmentPage.jsx";
import { DEFAULT_RECRUITMENT_CONFIG } from "../supabase/functions/_shared/recruitmentForm.js";
import { application } from "./recruitment-fixture.mjs";

globalThis.document = { title: "Gánh", getElementById: () => ({ focus() {} }) };
globalThis.requestAnimationFrame = (callback) => callback();
const event = { preventDefault() {} };

test("Admin pauses and reopens a branch; applicant preview immediately follows the saved choices", async () => {
  const baseline = structuredClone(DEFAULT_RECRUITMENT_CONFIG);
  const branchOptions = baseline.questions.find((q) => q.id === "branch").options;
  const paused = branchOptions.find((value) => value.includes("Lê Hồng Phong"));
  let draft;
  let saved;
  function Harness() {
    const [config, setConfig] = React.useState(baseline);
    draft = config;
    return <RecruitmentFormEditor draft={config} setDraft={setConfig} baseline={baseline} ready save={() => { saved = structuredClone(config); }} />;
  }
  let view;
  try {
    await act(async () => { view = create(<Harness />); });
    await act(async () => { view.root.findByProps({ "aria-label": "Danh sách câu hỏi" }).findAllByType("button")[5].props.onClick(); });
    const control = () => view.root.findByProps({ "aria-label": `Tuyển tại ${paused}` });
    assert.equal(control().props.checked, true);
    await act(async () => { control().props.onChange({ target: { checked: false } }); });
    assert.equal(control().props.checked, false);
    assert.equal(draft.questions.find((q) => q.id === "branch").options.length, 3);
    assert.equal(view.root.findAllByType("input").some((input) => input.props.type === "radio" && input.props.value === paused), false);
    await act(async () => { view.root.findByType("form").props.onSubmit(event); });
    assert.equal(saved.questions.find((q) => q.id === "branch").options.includes(paused), false);
    await act(async () => { control().props.onChange({ target: { checked: true } }); });
    assert.equal(view.root.findAllByType("input").some((input) => input.props.type === "radio" && input.props.value === paused), true);
    assert.deepEqual(draft.questions.find((q) => q.id === "branch").options, branchOptions);
    for (const value of branchOptions.slice(1)) {
      await act(async () => { view.root.findByProps({ "aria-label": `Tuyển tại ${value}` }).props.onChange({ target: { checked: false } }); });
    }
    assert.equal(view.root.findByProps({ "aria-label": `Tuyển tại ${branchOptions[0]}` }).props.disabled, true);
    assert.equal(baseline.questions.find((q) => q.id === "branch").options.length, 4);
  } finally { if (view) await act(async () => { view.unmount(); }); }
});

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
    assert.ok(JSON.stringify(view.toJSON()).includes("Hồ sơ theo chi nhánh"));
    assert.ok(JSON.stringify(view.toJSON()).includes("100%"));
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


test("form builder: live preview, separate form, options, hide, move, add, validation and restore", async () => {
  let currentDraft;
  let saved = 0;
  const baseline = structuredClone(DEFAULT_RECRUITMENT_CONFIG);
  function Harness() {
    const [draft, setDraft] = React.useState(baseline);
    currentDraft = draft;
    return <RecruitmentFormEditor draft={draft} setDraft={setDraft} ready baseline={baseline} save={() => { saved++; }} />;
  }
  let view;
  await act(async () => { view = create(<Harness />); });
  const list = () => view.root.findByProps({ "aria-label": "Danh sách câu hỏi" });
  const text = (node) => node.findAllByType("button").map((b) => b.children.filter((v) => typeof v === "string").join(""));
  const click = async (label) => act(async () => {
    view.root.findAllByType("button").find((b) => b.children.filter((v) => typeof v === "string").join("") === label).props.onClick();
  });
  try {
    // Required preview controls are siblings of the save form and cannot block native submit.
    assert.equal(view.root.findByType("form").findAllByType(RecruitmentQuestion).length, 0);
    await act(async () => { list().findAllByType("button")[4].props.onClick(); });
    await act(async () => { view.root.findByProps({ id: "recruitment-editor-question" }).props.onChange({ target: { value: "Giới tính (kiểm thử)" } }); });
    assert.equal(view.root.findAllByType(RecruitmentQuestion).find((q) => q.props.question.id === "gender").props.question.label, "Giới tính (kiểm thử)");
    await act(async () => { view.root.findByProps({ "aria-label": "Đáp án 1" }).props.onChange({ target: { value: "Nam kiểm thử" } }); });
    assert.ok(view.root.findAllByType("input").some((i) => i.props.type === "radio" && i.props.value === "Nam kiểm thử"));
    await click("↑ Đưa lên");
    assert.equal(currentDraft.questions[3].id, "gender");
    await act(async () => { view.root.findByProps({ className: "recruitment-editor-switches" }).findAllByType("input")[0].props.onChange({ target: { checked: false } }); });
    assert.equal(view.root.findAllByType(RecruitmentQuestion).some((q) => q.props.question.id === "gender"), false);
    await click("+ Thêm câu hỏi");
    assert.equal(currentDraft.questions.length, 14);
    assert.equal(view.root.findByProps({ id: "recruitment-editor-question" }).props.value, "Câu hỏi mới");
    await act(async () => { view.root.findByProps({ id: "recruitment-editor-type" }).props.onChange({ target: { value: "radio" } }); });
    await click("+ Thêm đáp án");
    await act(async () => { view.root.findByProps({ "aria-label": "Đáp án 2" }).props.onChange({ target: { value: "Lựa chọn 1" } }); });
    await act(async () => { view.root.findByType("form").props.onSubmit(event); });
    assert.equal(saved, 0);
    assert.ok(view.root.findByProps({ role: "alert" }));
    await act(async () => { view.root.findByProps({ "aria-label": "Đáp án 2" }).props.onChange({ target: { value: "Đáp án khác" } }); });
    await act(async () => { view.root.findByType("form").props.onSubmit(event); });
    assert.equal(saved, 1);
    await click("Nội dung & tiếp nhận");
    await act(async () => { view.root.findByProps({ id: "recruitment-editor-success" }).props.onChange({ target: { value: "Thông báo xem thử" } }); });
    await click("Sau khi gửi");
    assert.ok(JSON.stringify(view.toJSON()).includes("Thông báo xem thử"));
    await click("Khôi phục");
    assert.equal(currentDraft.questions.length, 14); // no destructive reset until explicit confirmation
    await click("Bỏ thay đổi");
    assert.deepEqual(currentDraft, baseline);
    assert.ok(text(view.root).includes("Lưu thay đổi"));
  } finally { await act(async () => { view.unmount(); }); }
});
