// Share only concurrent reads. There is no retained cache of financial totals.
export default function createPosReadCoalescer() {
  const pending = new Map();
  return (key, read, { fresh = false } = {}) => {
    if (fresh) {
      // A post-write refresh must also detach older pending reads from reuse.
      pending.delete(key);
      return Promise.resolve().then(read);
    }
    if (pending.has(key)) return pending.get(key);
    const request = Promise.resolve().then(read).finally(() => {
      if (pending.get(key) === request) pending.delete(key);
    });
    pending.set(key, request);
    return request;
  };
}
