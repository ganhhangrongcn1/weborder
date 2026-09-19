import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";

const executablePath = process.env.CHROME_PATH || [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
].find(existsSync);
assert.ok(executablePath, "Set CHROME_PATH to run browser layout checks");

const css = await readFile("src/pages/admin/inventory/inventoryBranchMobile.css", "utf8");
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui}.inventory-workspace{width:100%}
.inventory-table-scroll{overflow-x:auto}.inventory-data-table{width:100%;min-width:1040px}.inventory-data-table td{padding:10px}
.inventory-document-line,.inventory-receipt-row,.inventory-action-line{display:grid;grid-template-columns:repeat(4,220px);min-width:760px}
.inventory-searchable-select__trigger,input,button{min-height:38px}
${css}</style></head><body><main class="inventory-workspace inventory-workspace--branch-mobile">
<section class="inventory-list-card"><div class="inventory-table-scroll"><table class="inventory-data-table inventory-document-table"><thead><tr><th>Mã phiếu</th></tr></thead><tbody>
<tr><td data-label="Mã phiếu"><strong>CK-20260919-001</strong></td><td data-label="Ngày lập">19/09/2026</td><td data-label="Kho"><strong>Kho CN 30/4 → Kho Tổng</strong></td><td data-label="Nguyên vật liệu"><strong>4 mặt hàng</strong></td><td data-label="Trạng thái"><span>Chờ nhận</span></td><td data-label="Thao tác"><div class="inventory-document-actions"><button>Xem</button><button>Nhận hàng</button></div></td></tr>
</tbody></table></div></section>
<section class="inventory-document-lines"><div class="inventory-document-lines__header">Tiêu đề</div><div class="inventory-document-line has-disposal-reason"><button class="inventory-searchable-select__trigger">Xoài sơ chế</button><button class="inventory-searchable-select__trigger">Kilogram</button><input value="2"><button>Xóa</button></div></section>
<section class="inventory-action-lines"><div class="inventory-action-lines__header">Tiêu đề</div><div class="inventory-action-line has-reason"><div><strong>Xoài sơ chế</strong></div><span>2 Kg</span><input value="2"><input value="Đủ hàng"></div></section>
</main><main class="inventory-workspace admin-fixture"><div class="inventory-table-scroll"><table class="inventory-data-table inventory-document-table"><tbody><tr><td>Desktop admin</td></tr></tbody></table></div></main>
</body></html>`;

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setContent(fixture);

  for (const width of [320, 390, 700]) {
    await page.setViewport({ width, height: 844 });
    const result = await page.evaluate(() => {
      const branch = document.querySelector(".inventory-workspace--branch-mobile");
      const row = branch.querySelector(".inventory-document-table tbody tr");
      const formLine = branch.querySelector(".inventory-document-line");
      const actionLine = branch.querySelector(".inventory-action-line");
      const buttons = [...branch.querySelectorAll("button")];
      return {
        pageFits: document.documentElement.scrollWidth <= window.innerWidth,
        rowDisplay: getComputedStyle(row).display,
        formColumns: getComputedStyle(formLine).gridTemplateColumns.split(" ").length,
        actionColumns: getComputedStyle(actionLine).gridTemplateColumns.split(" ").length,
        touchTargets: buttons.every((button) => button.getBoundingClientRect().height >= 42)
      };
    });
    assert.equal(result.pageFits, true, `${width}px: no horizontal page overflow`);
    assert.equal(result.rowDisplay, "grid", `${width}px: document table becomes cards`);
    assert.equal(result.formColumns, 1, `${width}px: document form is one column`);
    assert.equal(result.actionColumns, 1, `${width}px: receive form is one column`);
    assert.equal(result.touchTargets, true, `${width}px: touch targets stay usable`);
    console.log(`Branch inventory ${width}px: passed`);
  }

  await page.setViewport({ width: 1200, height: 900 });
  const desktop = await page.evaluate(() => ({
    branchTable: getComputedStyle(document.querySelector(".inventory-workspace--branch-mobile .inventory-document-table")).display,
    adminMinWidth: getComputedStyle(document.querySelector(".admin-fixture .inventory-document-table")).minWidth
  }));
  assert.equal(desktop.branchTable, "table", "branch desktop keeps the existing table");
  assert.equal(desktop.adminMinWidth, "1040px", "admin table remains unchanged");
  assert.deepEqual(errors, []);
  console.log("Desktop branch and Admin layouts remain unchanged");
} finally {
  await browser.close();
}
