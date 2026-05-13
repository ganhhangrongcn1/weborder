export function createLoyaltyConfigRepository(adapter) {
  return {
    get(key, fallback) {
      return adapter.load(key, fallback);
    },
    set(key, value) {
      return adapter.save(key, value);
    },
    async getAsync(key, fallback) {
      if (adapter.loadAsync) return adapter.loadAsync(key, fallback);
      return adapter.load(key, fallback);
    },
    async setAsync(key, value) {
      if (adapter.saveAsync) return adapter.saveAsync(key, value);
      return adapter.save(key, value);
    }
  };
}
