// Disabled after the explicitly authorized, read-only WSS inspection.
// No clients, credentials, sockets, database reads or business writes.
Deno.serve(() => new Response(JSON.stringify({ error: 'probe_disabled' }), {
  status: 410,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
}));
