import fs from "node:fs";
import path from "node:path";

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) return;
    process.env[key] = value;
  });
  return true;
}

export function loadLocalEnv() {
  const rootDir = process.cwd();
  const candidates = [".env.local", ".env"];
  candidates.forEach((fileName) => {
    applyEnvFile(path.join(rootDir, fileName));
  });
}

export default loadLocalEnv;
