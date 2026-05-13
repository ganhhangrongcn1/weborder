import fs from "node:fs";

const file = "src/App.jsx";
let src = fs.readFileSync(file, "utf8");

const cp1252Map = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]
]);

const suspiciousRe = /[ÃÂÄÆÐ][\u0080-\u00BF]|á»|áº|â€™|â€œ|â€|â€¢|â€“|â€”|ðŸ|\uFFFD/g;
const score = (s) => (s.match(suspiciousRe) || []).length;

function toCp1252Bytes(str) {
  const bytes = [];
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code <= 0xFF) bytes.push(code);
    else if (cp1252Map.has(code)) bytes.push(cp1252Map.get(code));
    else return null;
  }
  return Buffer.from(bytes);
}

function decodeCp1252Mojibake(str) {
  const bytes = toCp1252Bytes(str);
  if (!bytes) return str;
  return bytes.toString("utf8");
}

function fixText(text) {
  if (score(text) === 0) return text;
  let cur = text;
  for (let i = 0; i < 3; i += 1) {
    const next = decodeCp1252Mojibake(cur);
    if (!next || next.includes("\uFFFD")) break;
    if (score(next) < score(cur)) cur = next;
    else break;
  }
  return cur;
}

// Replace inside normal quoted strings only
src = src.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, (m) => {
  const q = m[0];
  const inner = m.slice(1, -1);
  const fixed = fixText(inner);
  if (fixed === inner) return m;
  return q + fixed.replaceAll(q, "\\" + q) + q;
});

// Replace JSX text between tags (conservative)
src = src.replace(/>([^<{][^<]*)</g, (m, t) => {
  const fixed = fixText(t);
  return ">" + fixed + "<";
});

fs.writeFileSync(file, src, "utf8");
console.log("fixed App.jsx cp1252 pass");
