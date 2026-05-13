import { transformFileSync } from "@babel/core";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(root, "src");
const outputDir = path.join(root, "src-compiled");

fs.rmSync(outputDir, { recursive: true, force: true });

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function rewriteImports(code) {
  return code.replace(/from\s+["']([^"']+)\.jsx["']/g, 'from "$1.js"').replace(/import\s+["']([^"']+)\.jsx["']/g, 'import "$1.js"');
}

function copyOrTransform(filePath) {
  const rel = path.relative(sourceDir, filePath);
  const ext = path.extname(filePath);
  const outRel = ext === ".jsx" ? rel.replace(/\.jsx$/, ".js") : rel;
  const outPath = path.join(outputDir, outRel);
  ensureDir(outPath);

  if (ext === ".jsx") {
    const result = transformFileSync(filePath, {
      presets: [["@babel/preset-react", { runtime: "automatic" }]],
      babelrc: false,
      configFile: false
    });
    fs.writeFileSync(outPath, rewriteImports(result.code), "utf8");
    return;
  }

  if (ext === ".js") {
    fs.writeFileSync(outPath, rewriteImports(fs.readFileSync(filePath, "utf8")), "utf8");
    return;
  }

  fs.copyFileSync(filePath, outPath);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      copyOrTransform(fullPath);
    }
  }
}

walk(sourceDir);
console.log("Compiled React source to src-compiled");
