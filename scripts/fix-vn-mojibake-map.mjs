import fs from "node:fs";
import path from "node:path";
import parser from "@babel/parser";
import traverseModule from "@babel/traverse";

const traverse = traverseModule.default || traverseModule;
const SRC_DIR = "src";

function walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkJsFiles(full));
      continue;
    }
    if (entry.isFile() && /\.(js|jsx)$/.test(entry.name)) {
      out.push(full.replace(/\\/g, "/"));
    }
  }
  return out;
}

const files = walkJsFiles(SRC_DIR);

const cp1252 = new Map([
  [0x80, "€"], [0x82, "‚"], [0x83, "ƒ"], [0x84, "„"], [0x85, "…"], [0x86, "†"], [0x87, "‡"], [0x88, "ˆ"],
  [0x89, "‰"], [0x8A, "Š"], [0x8B, "‹"], [0x8C, "Œ"], [0x8E, "Ž"], [0x91, "‘"], [0x92, "’"], [0x93, "“"],
  [0x94, "”"], [0x95, "•"], [0x96, "–"], [0x97, "—"], [0x98, "˜"], [0x99, "™"], [0x9A, "š"], [0x9B, "›"],
  [0x9C, "œ"], [0x9E, "ž"], [0x9F, "Ÿ"]
]);

const viChars = "àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ";
const extras = "→•✓🧡🔖🕒🍽️🧾🚚🌶️💰📍⚡";
const allChars = Array.from(new Set((viChars + extras).split(""))).filter(Boolean);

function mojibakeOnce(ch) {
  const bytes = Buffer.from(ch, "utf8");
  let out = "";
  for (const b of bytes) {
    if (cp1252.has(b)) out += cp1252.get(b);
    else out += String.fromCharCode(b);
  }
  return out;
}

const map = new Map();
for (const ch of allChars) {
  const m1 = mojibakeOnce(ch);
  const m2 = mojibakeOnce(m1);
  if (m1 !== ch) map.set(m1, ch);
  if (m2 !== ch) map.set(m2, ch);
}

const keys = [...map.keys()].sort((a, b) => b.length - a.length);
const keyRe = new RegExp(keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");

function fixText(text) {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(keyRe, (m) => map.get(m) || m);
    if (next === out) break;
    out = next;
  }
  return out;
}

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, { sourceType: "module", plugins: ["jsx"] });
  const edits = [];

  traverse(ast, {
    StringLiteral(path) {
      const oldVal = path.node.value;
      const newVal = fixText(oldVal);
      if (newVal !== oldVal) edits.push({ start: path.node.start, end: path.node.end, text: JSON.stringify(newVal) });
    },
    JSXText(path) {
      const oldVal = path.node.value;
      const newVal = fixText(oldVal);
      if (newVal !== oldVal) edits.push({ start: path.node.start, end: path.node.end, text: newVal });
    }
  });

  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);

  if (out !== src) {
    fs.writeFileSync(file, out, "utf8");
    console.log(`${file}: ${edits.length} edits`);
  }
}
