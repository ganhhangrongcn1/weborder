// A bounded cache for read-only requests. Clearing also invalidates late results.
export default function createKeyedReadCache({ now = () => Date.now(), maxEntries = 64 } = {}) {
  const cache = new Map();
  const requests = new Map();
  let generation = 0;

  function read(key, load) {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value);
    cache.delete(key);
    if (requests.has(key)) return requests.get(key);
    const requestGeneration = generation;
    const request = Promise.resolve().then(load).then(({ value, ttlMs = 0 }) => {
      if (generation === requestGeneration && ttlMs > 0) {
        cache.set(key, { value, expiresAt: now() + ttlMs });
        while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      }
      return value;
    }).finally(() => {
      if (requests.get(key) === request) requests.delete(key);
    });
    requests.set(key, request);
    return request;
  }

  function clear() {
    generation += 1;
    cache.clear();
    requests.clear();
  }

  return { read, clear };
}
