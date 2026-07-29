import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDir, "../../..");
const migrationDir = path.join(repositoryRoot, "supabase", "migrations");
const migrationName = fs.readdirSync(migrationDir).find((name) => name.endsWith("_checklist_phase_1.sql"));
assert.ok(migrationName, "Không tìm thấy migration checklist Phase 1.");

const sql = fs.readFileSync(path.join(migrationDir, migrationName), "utf8");
const requiredTables = [
  "checklist_user_access",
  "checklist_employees",
  "checklist_employee_branches",
  "checklist_templates",
  "checklist_template_versions",
  "checklist_sections",
  "checklist_items",
  "checklist_inspections",
  "checklist_inspection_participants",
  "checklist_answers",
  "checklist_answer_employees",
  "checklist_evidence",
  "checklist_corrective_actions",
  "checklist_audit_logs"
];

for (const table of requiredTables) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, "i"), `Thiếu bảng ${table}.`);
  assert.ok(sql.includes(`'${table}'`), `Bảng ${table} chưa có trong danh sách bật RLS.`);
}

const itemCodes = [...sql.matchAll(/'((?:AP|HY|FS|PR|SV|OP|FU)-\d{2})'/g)].map((match) => match[1]);
assert.equal(new Set(itemCodes).size, 37, "Seed phải có đúng 37 mã tiêu chí không trùng.");
assert.match(sql, /insert into storage\.buckets[\s\S]*'checklist-evidence'/i, "Thiếu bucket ảnh private.");
assert.match(sql, /private\.checklist_is_admin/i, "Thiếu helper kiểm tra quyền admin.");
assert.match(sql, /notify pgrst, 'reload schema'/i, "Thiếu reload schema PostgREST.");

console.log(`Phase 1 SQL hợp lệ ở mức cấu trúc: ${requiredTables.length} bảng, ${new Set(itemCodes).size} tiêu chí.`);
