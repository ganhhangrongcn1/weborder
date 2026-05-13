import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcDir = path.join(root, "src");
const compiledDir = path.join(root, "src-compiled");

function walkFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function toPosix(relPath) {
  return relPath.replace(/\\/g, "/");
}

if (!fs.existsSync(srcDir)) {
  console.error("Missing src directory.");
  process.exit(1);
}

if (!fs.existsSync(compiledDir)) {
  console.error("Missing src-compiled directory. Run: node scripts/compile-jsx.mjs");
  process.exit(1);
}

const srcFiles = walkFiles(srcDir);
const compiledFiles = new Set(
  walkFiles(compiledDir).map((file) => toPosix(path.relative(compiledDir, file)))
);

const missingCompiled = [];

for (const srcFile of srcFiles) {
  const rel = toPosix(path.relative(srcDir, srcFile));
  const ext = path.extname(rel).toLowerCase();
  const expectedRel = ext === ".jsx" ? rel.replace(/\.jsx$/i, ".js") : rel;
  if (!compiledFiles.has(expectedRel)) {
    missingCompiled.push({ src: rel, expected: expectedRel });
  }
}

if (missingCompiled.length) {
  console.error(`Generated sync check failed: ${missingCompiled.length} file(s) missing in src-compiled.`);
  for (const issue of missingCompiled.slice(0, 100)) {
    console.error(`src/${issue.src} -> src-compiled/${issue.expected}`);
  }
  if (missingCompiled.length > 100) {
    console.error(`...and ${missingCompiled.length - 100} more.`);
  }
  process.exit(1);
}

console.log(`Generated sync check passed. ${srcFiles.length} src file(s) mapped to src-compiled.`);
