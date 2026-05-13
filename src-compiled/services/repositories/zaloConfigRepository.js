import { adminConfigRepository } from "./adminConfigRepository.js";

export const ZALO_CONFIG_KEY = "ghr_zalo_config";

export const zaloConfigRepository = {
  get(fallback) {
    return adminConfigRepository.get(ZALO_CONFIG_KEY, fallback);
  },
  set(value) {
    return adminConfigRepository.set(ZALO_CONFIG_KEY, value);
  },
  async getAsync(fallback) {
    return adminConfigRepository.getAsync(ZALO_CONFIG_KEY, fallback);
  },
  async setAsync(value) {
    return adminConfigRepository.setAsync(ZALO_CONFIG_KEY, value);
  }
};
