import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const manifest = JSON.parse(await readFile(path.join(output, ".vite/manifest.json"), "utf8"));
const config = JSON.parse(await readFile(path.join(root, "app-config.json"), "utf8"));
const html = await readFile(path.join(output, "index.html"), "utf8");
if (!/id=["']app["']/.test(html)) throw new Error("Root khởi tạo phải là #app để chạy trong Zalo.");
const entries = Object.values(manifest).filter((entry) => entry.isEntry);
if (entries.length !== 1) throw new Error("Mini App cần đúng một entry khởi tạo.");
const styles = new Set(); const visited = new Set();
function collect(entry) {
  if (visited.has(entry.file)) return;
  visited.add(entry.file);
  for (const css of entry.css || []) styles.add(css);
  for (const key of entry.imports || []) {
    if (!manifest[key]) throw new Error(`Thiếu module: ${key}`);
    collect(manifest[key]);
  }
}
collect(entries[0]);
config.listCSS = [...styles]; config.listSyncJS = [entries[0].file]; config.listAsyncJS = [];
if (!entries[0].file.endsWith(".module.js")) throw new Error("Entry Mini App phải kết thúc bằng .module.js.");
for (const entry of Object.values(manifest)) {
  for (const file of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (file.includes("..") || path.isAbsolute(file)) throw new Error("Đường dẫn bundle không hợp lệ.");
    await stat(path.join(output, file));
  }
}
await writeFile(path.join(output, "app-config.json"), JSON.stringify(config, null, 2) + "\n", "utf8");
let total = 0; let largest = 0;
async function checkFiles(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const target = path.join(folder, item.name);
    if (item.isDirectory()) await checkFiles(target);
    else {
      const { size } = await stat(target); total += size; largest = Math.max(largest, size);
      if (size > 3 * 1024 * 1024) throw new Error(`File vượt giới hạn 3 MB: ${item.name}`);
    }
  }
}
await checkFiles(output);
if (total > 10 * 1024 * 1024) throw new Error("Gói Mini App vượt giới hạn 10 MB.");
console.log(`Mini App bundle hợp lệ: ${total} byte; file lớn nhất ${largest} byte; root #app; entry ${entries[0].file}.`);
console.log("Chỉ build local. Chưa upload, deploy hoặc gửi xét duyệt.");
