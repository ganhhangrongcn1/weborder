// Gánh Reply is retired. Keep old URLs inert without touching stored history.
Deno.serve(() => new Response(JSON.stringify({ ok: false, code: 'MODULE_DISABLED', message: 'Gánh Reply đã tạm ngừng.' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
}));
