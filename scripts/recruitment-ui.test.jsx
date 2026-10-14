/* global Response */
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { create, act } from "recruitment-test-renderer";
import { MemoryRouter } from "react-router-dom";
import useRecruitmentForm from "../src/features/recruitment/useRecruitmentForm.js";
import RecruitmentPage from "../src/features/recruitment/RecruitmentPage.jsx";
import { application } from "./recruitment-fixture.mjs";

globalThis.document = { title: "Gánh", getElementById: () => ({ focus() {} }) };
globalThis.requestAnimationFrame = (callback) => callback();
const event = { preventDefault() {} };

test("actual hook: validation, rapid double click, failure, retry, edit and success", async () => {
  let state;
  function Harness() { state = useRecruitmentForm(); return null; }
  let view;
  await act(async () => { view = create(<Harness />); });
  let requests = [];
  let resolveFetch;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) => {
    assert.equal(url, "https://isolated.invalid/functions/v1/recruitment-api");
    assert.equal(options.headers.Authorization, undefined); // public, no login
    requests.push(JSON.parse(options.body));
    return new Promise((resolve) => { resolveFetch = resolve; });
  };
  try {
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
  globalThis.fetch = async () => Response.json({ ok: true, applicationId: "isolated-receipt" });
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
