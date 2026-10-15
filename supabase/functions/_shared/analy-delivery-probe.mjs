// Read-only diagnostics using public city coordinates and empty contact details.
// Deliberately has no create/cancel/update delivery paths.
export function analySuffix(now = new Date()) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  return encodeURIComponent([...`${fields.year}${fields.month}${fields.day}${fields.hour}${fields.minute}`]
    .map(char => String.fromCharCode(char.charCodeAt(0) + 20)).join(''));
}
export async function probeAnalyDelivery(session, { fetcher = fetch, now = () => new Date() } = {}) {
  const report = { checked_at: now().toISOString(), runtime: 'edge', deliveries_created: 0, tests: [] };
  const point = longitude => ({ address: 'Thu Dau Mot, Binh Duong', keywords: '', cityCode: '',
    coordinates: { latitude: 10.978, longitude } });
  const contact = { firstName: 'GHR API test', lastName: '', phone: '', email: '', instruction: 'Quote only', smsEnabled: false };
  const quote = { merchantOrderID: `GHR-QUOTE-QA-${crypto.randomUUID()}`, cashOnDelivery: { amount: 0 }, isCashOnDelivery: false,
    packages: [{ name: 'API quote check', description: '', quantity: 1, price: 0, dimensions: { height: 0, width: 0, depth: 0, weight: 0 } }],
    origin: point(106.675), destination: point(106.659), sender: contact, recipient: contact };
  const operations = [
    { name: 'address_search', path: 'find_address_v2', query: '?keyword=Thu%20Dau%20Mot' },
    { name: 'grabexpress_quote', path: 'get_quote', body: quote },
  ];
  for (const operation of operations) {
    try {
      const result = await session.readWithSession(token => fetcher(
        `https://api.analy.co/resto_dlvr/v1/${operation.path}/${analySuffix(now())}${operation.query || ''}`, {
          method: operation.body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          ...(operation.body ? { body: JSON.stringify(operation.body) } : {}),
        }));
      const data = await result.json().catch(() => null);
      const entry = { name: operation.name, http_status: result.status, ok: result.ok };
      if (operation.name === 'address_search') {
        entry.address_count = Array.isArray(data) ? data.length : 0;
        entry.usable = result.ok && entry.address_count > 0;
      } else {
        const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
        entry.quotes = quotes.map(item => ({ amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : null,
          currency: typeof item.currency === 'string' ? item.currency : 'VND' }));
        entry.usable = result.ok && entry.quotes.some(item => item.amount !== null && item.amount >= 0);
      }
      report.tests.push(entry);
    } catch {
      // Do not disclose upstream bodies, token-bearing errors or echoed contacts.
      report.tests.push({ name: operation.name, ok: false, usable: false, code: 'probe_failed' });
    }
  }
  report.shipping_api_usable = report.tests.every(test => test.usable);
  return report;
}
