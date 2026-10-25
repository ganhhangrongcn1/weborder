import { build } from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const output = await mkdtemp(join(tmpdir(), 'ghr-bill-preview-'));
await build({ entryPoints: ['scripts/receipt-template-preview-entry.jsx'], bundle: true, format: 'esm',
  jsx: 'automatic', outfile: join(output, 'preview.js'), define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' } });
const page = `<!doctype html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xem thử mẫu in bill — Gánh Hàng Rong</title><link rel="stylesheet" href="/preview.css"><style>
*{box-sizing:border-box}body{margin:0;background:#f7f5f0;color:#33291e;font-family:Arial,system-ui,sans-serif}
#root{max-width:1200px;margin:auto;padding:28px}.admin-stack{display:flex;flex-direction:column;gap:16px}
.admin-ui-input{width:100%;border:1px solid #dcd4c8;padding:10px;border-radius:8px;font:inherit}
.admin-ui-button{padding:11px 16px;border:1px solid #d7c7ae;border-radius:8px;background:#553d28;color:white;font-weight:600}
.admin-ui-button:disabled{opacity:.45}.admin-ui-button--secondary{background:white;color:#553d28}
</style></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>`;
createServer(async (req, res) => {
  const name = req.url?.split('?')[0];
  if (name === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page); return; }
  if (!['/preview.js', '/preview.css'].includes(name)) { res.writeHead(404); res.end(); return; }
  try { res.writeHead(200, { 'Content-Type': name.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(await readFile(join(output, name.slice(1)))); }
  catch { res.writeHead(404); res.end(); }
}).listen(4180, '127.0.0.1', () => console.log('Xem thử mẫu bill: http://127.0.0.1:4180/ — không ghi dữ liệu/in thật.'));
