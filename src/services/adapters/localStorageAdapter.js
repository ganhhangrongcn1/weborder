import { loadMock, saveMock } from "../storageService.js";

export function createLocalStorageAdapter() {
  return {
    load(key, fallback) {
      return loadMock(key, fallback);
    },
    save(key, value) {
      return saveMock(key, value);
    },
    async loadAsync(key, fallback) {
      return loadMock(key, fallback);
    },
    async saveAsync(key, value) {
      return saveMock(key, value);
    }
  };
}
