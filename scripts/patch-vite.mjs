import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const chunksDir = path.join(root, "node_modules", "vite", "dist", "node", "chunks");

if (fs.existsSync(chunksDir)) {
  for (const file of fs.readdirSync(chunksDir)) {
    if (!file.endsWith(".js")) continue;
    const fullPath = path.join(chunksDir, file);
    let code = fs.readFileSync(fullPath, "utf8");
    let changed = false;
    const needle = 'exec("net use", (error, stdout) => {';
    if (code.includes(needle) && !code.includes("Codex Windows realpath patch")) {
      code = code.replace(needle, 'safeRealpathSync = fs__default.realpathSync.native; return; // Codex Windows realpath patch\n  exec("net use", (error, stdout) => {');
      changed = true;
    }
    const defineNeedle = 'async function replaceDefine(code, id, define, config) {\n  const esbuildOptions = config.esbuild || {};';
    if (code.includes(defineNeedle) && !code.includes("Codex Windows define patch")) {
      code = code.replace(defineNeedle, 'async function replaceDefine(code, id, define, config) {\n  return { code, map: null }; // Codex Windows define patch\n  const esbuildOptions = config.esbuild || {};');
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(fullPath, code, "utf8");
      console.log("Patched Vite for Windows sandbox");
    }
  }
}
