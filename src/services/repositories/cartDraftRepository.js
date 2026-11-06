import { STORAGE_KEYS } from "./storageKeys.js";

// A device draft, never an order or app_configs write.
let memoryDraft;
function normalize(value, fallback = []) {
  return Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
}

const cartDraftRepository = {
  get(fallback = []) {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEYS.cartDraft);
      if (raw != null) return normalize(JSON.parse(raw), fallback);
    } catch { /* Blocked storage or malformed cache must not break ordering. */ }
    return normalize(memoryDraft, fallback);
  },
  save(value) {
    memoryDraft = normalize(value);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEYS.cartDraft, JSON.stringify(memoryDraft));
    } catch { /* The current cart still works if the device cannot persist it. */ }
    return memoryDraft;
  },
  clear() { return this.save([]); }
};

export default cartDraftRepository;
