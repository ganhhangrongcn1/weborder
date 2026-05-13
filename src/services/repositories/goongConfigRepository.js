import { adminConfigRepository } from "./adminConfigRepository.js";

export const GOONG_CONFIG_KEY = "ghr_goong_config";
export const LEGACY_GOONG_API_KEY = "ghr_goong_api_key";
export const LEGACY_GOONG_MAPTILES_KEY = "ghr_goong_maptiles_key";

function cleanText(value) {
  return String(value || "").trim();
}

function readUnifiedConfig() {
  const saved = adminConfigRepository.getLocal(GOONG_CONFIG_KEY, null);
  if (!saved || typeof saved !== "object") return {};
  return saved;
}

function readLegacyApiKey() {
  return cleanText(adminConfigRepository.getLocal(LEGACY_GOONG_API_KEY, ""));
}

function readLegacyMapTilesKey() {
  return cleanText(adminConfigRepository.getLocal(LEGACY_GOONG_MAPTILES_KEY, ""));
}

export const goongConfigRepository = {
  getMergedConfig() {
    const envApiKey = cleanText(import.meta.env?.VITE_GOONG_API_KEY);
    const envMapTilesKey = cleanText(import.meta.env?.VITE_GOONG_MAPTILES_KEY);
    const unified = readUnifiedConfig();

    const apiKey = envApiKey || cleanText(unified.apiKey) || readLegacyApiKey();
    const mapTilesKey = envMapTilesKey || cleanText(unified.mapTilesKey) || readLegacyMapTilesKey();

    return {
      apiKey,
      mapTilesKey
    };
  },
  getApiKey() {
    return this.getMergedConfig().apiKey;
  },
  getMapTilesKey() {
    return this.getMergedConfig().mapTilesKey;
  }
};

