import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve("src");
const exts = new Set([".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".css", ".html"]);

const suspiciousRe = /[ÃÂÄÆÐ][\u0080-\u00BF]|á»|áº|â€™|â€œ|â€|â€¢|â€“|â€”|\uFFFD/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (exts.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function badScore(text) {
  return (text.match(suspiciousRe) || []).length;
}

function decodeLatin1(text) {
  return Buffer.from(text, "latin1").toString("utf8");
}

function fixLine(line) {
  if (badScore(line) === 0) return line;
  let current = line;
  for (let i = 0; i < 2; i += 1) {
    const candidate = decodeLatin1(current);
    if (candidate.includes("\uFFFD")) break;
    if (badScore(candidate) < badScore(current)) {
      current = candidate;
    } else {
      break;
    }
  }
  return current;
}

const changed = [];
const files = walk(rootDir);

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  const lines = original.split(/\r?\n/);
  let touched = false;

  const fixedLines = lines.map((line) => {
    const fixed = fixLine(line);
    if (fixed !== line) touched = true;
    return fixed;
  });

  if (touched) {
    fs.writeFileSync(filePath, fixedLines.join("\n"), "utf8");
    changed.push(path.relative(process.cwd(), filePath).replace(/\\/g, "/"));
  }
}

console.log(`Scanned ${files.length} files in src.`);
console.log(`Fixed ${changed.length} file(s).`);
for (const file of changed) console.log(file);
