import fs from "node:fs";
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;
const file = "src/App.jsx";
const src = fs.readFileSync(file, "utf8");
const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });

const cp = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
]);
const suspiciousRe = /[\u00C3\u00C2\u00C4\u00C6\u00D0][\u0080-\u00BF]|\u00E1\u00BB|\u00E1\u00BA|\u00E2\u20AC\u2122|\u00E2\u20AC\u0153|\u00E2\u20AC\x9D|\u00E2\u20AC\u00A2|\u00E2\u20AC\u201C|\u00E2\u20AC\u201D|\u00F0\u0178|\uFFFD/g;
const score = (t) => (t.match(suspiciousRe) || []).length;

function toByte(ch) {
  const c = ch.codePointAt(0);
  if (c <= 255) return c;
  if (cp.has(c)) return cp.get(c);
  return null;
}

function fixText(text) {
  if (score(text) === 0) return text;
  let out = "";
  let run = "";
  const flush = () => {
    if (!run) return;
    const bytes = [];
    for (const ch of run) {
      const b = toByte(ch);
      if (b === null) {
        out += run;
        run = "";
        return;
      }
      bytes.push(b);
    }
    const decoded = Buffer.from(bytes).toString("utf8");
    out += !decoded.includes("\uFFFD") && score(decoded) < score(run) ? decoded : run;
    run = "";
  };

  for (const ch of text) {
    if (toByte(ch) !== null) run += ch;
    else {
      flush();
      out += ch;
    }
  }
  flush();
  return out;
}

const edits = [];
traverse(ast, {
  StringLiteral(path) {
    const oldVal = path.node.value;
    const newVal = fixText(oldVal);
    if (newVal !== oldVal) {
      edits.push({ start: path.node.start, end: path.node.end, text: JSON.stringify(newVal) });
    }
  },
  JSXText(path) {
    const oldVal = path.node.value;
    const newVal = fixText(oldVal);
    if (newVal !== oldVal) {
      edits.push({ start: path.node.start, end: path.node.end, text: newVal });
    }
  }
});

edits.sort((a, b) => b.start - a.start);
let out = src;
for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

if (out !== src) {
  fs.writeFileSync(file, out, "utf8");
  console.log(`Updated ${file} with ${edits.length} edits`);
} else {
  console.log("No changes");
}
