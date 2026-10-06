// Memory only. No polling, realtime subscriptions or customer data in localStorage.
export function createStampRequestCache({ ttl = 60000, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let generation = 0;
  const stats = { requests: 0, hits: 0, shared: 0 };
  return {
    stats,
    clear() { generation += 1; cache.clear(); pending.clear(); },
    async get(key, fetcher, force = false) {
      if (pending.has(key)) { stats.shared += 1; return pending.get(key); }
      const value = cache.get(key);
      if (!force && value && now() - value.at < ttl) { stats.hits += 1; return value.data; }
      const version = generation;
      stats.requests += 1;
      const request = Promise.resolve().then(fetcher).then((data) => {
        if (generation === version) cache.set(key, { data, at: now() });
        return data;
      }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
      pending.set(key, request);
      return request;
    }
  };
}
export default createStampRequestCache;
