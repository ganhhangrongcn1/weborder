import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve("src");
const exts = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".css", ".html"]);
const ignoreFiles = new Set([]);

const badPatterns = [
  /[ÃÂÄÆÐ][\u0080-\u00BF]/,
  /á»/,
  /áº/,
  /â€™/,
  /â€œ/,
  /â€/,
  /â€“/,
  /â€”/,
  /â€¢/,
  /\uFFFD/
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (exts.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function lineHasMojibake(line) {
  return badPatterns.some((re) => re.test(line));
}

const issues = [];
const files = walk(rootDir);

for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
  if (ignoreFiles.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (lineHasMojibake(line)) {
      issues.push({
        file: rel,
        line: i + 1,
        sample: line.slice(0, 160)
      });
    }
  }
}

if (issues.length) {
  console.error(`Encoding check failed: found ${issues.length} suspicious line(s).`);
  for (const issue of issues.slice(0, 200)) {
    console.error(`${issue.file}:${issue.line}: ${issue.sample}`);
  }
  if (issues.length > 200) {
    console.error(`...and ${issues.length - 200} more.`);
  }
  process.exit(1);
}

console.log(`Encoding check passed. Scanned ${files.length} file(s) in src.`);
