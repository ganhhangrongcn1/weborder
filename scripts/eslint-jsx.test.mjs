import assert from "node:assert/strict";
import test from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();
const jsxPaths = [
  "src/features/lint-probe.jsx",
  "apps/checklist/src/lint-probe.jsx",
  "inventory-app/src/lint-probe.jsx",
  "ghr-pos-mobile-native/src/lint-probe.js"
];

for (const filePath of jsxPaths) {
  test(`JSX references count as usage in ${filePath}`, async () => {
    const [result] = await eslint.lintText(`
      import React from "react";
      import Card from "./Card";
      import * as UI from "./ui";
      export default function View({ icon: Icon }) {
        return <><Card /><UI.Card /><Icon /></>;
      }
    `, { filePath });
    assert.deepEqual(result.messages, []);
  });

  test(`real unused imports and locals remain visible in ${filePath}`, async () => {
    const [result] = await eslint.lintText(`
      import UnusedCard from "./Card";
      export default function View() {
        const obsolete = 1;
        return <div />;
      }
    `, { filePath });
    assert.equal(result.warningCount, 2);
    assert.ok(result.messages.every(message => message.ruleId === "no-unused-vars"));
    assert.ok(result.messages.some(message => message.message.includes("UnusedCard")));
    assert.ok(result.messages.some(message => message.message.includes("obsolete")));
  });
}

test("undeclared variables still fail lint", async () => {
  const [result] = await eslint.lintText("export const total = missingAmount;", {
    filePath: "src/lint-probe.js"
  });
  assert.equal(result.errorCount, 1);
  assert.equal(result.messages[0].ruleId, "no-undef");
});
