import fs from "node:fs";
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;
const files = ["src/App.jsx", "src/data/defaultData.js"];

const suspiciousRe = /[ÃÂÄÆÐ][\u0080-\u00BF]|á»|áº|â€™|â€œ|â€|â€¢|â€“|â€”|ðŸ|\uFFFD/g;
const score = (s) => (s.match(suspiciousRe) || []).length;

function decodeCandidate(text) {
  let cur = text;
  for (let i = 0; i < 3; i += 1) {
    const next = Buffer.from(cur, "latin1").toString("utf8");
    if (next.includes("\uFFFD")) break;
    if (score(next) < score(cur)) cur = next;
    else break;
  }
  return cur;
}

const changedFiles = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx"],
    errorRecovery: false
  });

  const edits = [];

  traverse(ast, {
    StringLiteral(path) {
      const val = path.node.value;
      if (!val || score(val) === 0) return;
      const fixed = decodeCandidate(val);
      if (fixed !== val) {
        edits.push({ start: path.node.start, end: path.node.end, text: JSON.stringify(fixed) });
      }
    },
    JSXText(path) {
      const val = path.node.value;
      if (!val || score(val) === 0) return;
      const fixed = decodeCandidate(val);
      if (fixed !== val) {
        edits.push({ start: path.node.start, end: path.node.end, text: fixed });
      }
    }
  });

  if (!edits.length) continue;

  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }

  if (out !== src) {
    fs.writeFileSync(file, out, "utf8");
    changedFiles.push({ file, edits: edits.length });
  }
}

for (const item of changedFiles) {
  console.log(`${item.file}: ${item.edits} edits`);
}
if (!changedFiles.length) console.log("No changes");
