import { storeOrigin } from "../constants/storeConfig.js";
import { goongConfigRepository } from "./repositories/goongConfigRepository.js";
const GOONG_API_BASE = "https://rsapi.goong.io";

function getRuntimeConfig() {
  return window.GOONG_CONFIG || {};
}

function parseLocation(location, fallback = { lat: 10.98, lng: 106.67 }) {
  if (!location) return fallback;
  const [lat, lng] = String(location).split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : fallback;
}

const config = getRuntimeConfig();
const branch = config.branches?.find((item) => item.id === config.defaultBranchId) || config.branches?.[0];
const branchLocation = parseLocation(branch?.location || config.shopLocation);

export const BRANCH_LOCATION = {
  name: branch?.name || "Gánh Hàng Rong - CN 30/4",
  ...branchLocation
};

function getApiKey() {
  return getRuntimeConfig().apiKey || goongConfigRepository.getApiKey() || "";
}

export function getGoongMapTilesKey() {
  return getRuntimeConfig().mapTilesKey || goongConfigRepository.getMapTilesKey() || "";
}

export function hasGoongApiKey() {
  const key = getApiKey().trim();
  return Boolean(key && !key.includes("your_") && key !== "API_KEY");
}

function getEndpoint(name, fallbackPath) {
  const value = getRuntimeConfig()[name];
  return value || `${GOONG_API_BASE}${fallbackPath}`;
}

function buildEndpointUrl(endpoint, params) {
  const search = new URLSearchParams({ ...params, api_key: getApiKey() });
  return `${endpoint}?${search.toString()}`;
}

export async function goongAutocomplete(keyword) {
  try {
    if (!hasGoongApiKey() || !keyword || keyword.trim().length < 3) return [];
    const response = await fetch(buildEndpointUrl(getEndpoint("autocompleteEndpoint", "/Place/AutoComplete"), {
      input: keyword,
      location: `${BRANCH_LOCATION.lat},${BRANCH_LOCATION.lng}`
    }));
    if (!response.ok) {
      console.warn("Goong autocomplete failed", response.status, await response.text());
      return [];
    }
    const data = await response.json();
    return data.predictions || [];
  } catch (error) {
    console.warn("Goong autocomplete error", error);
    return [];
  }
}

export async function goongPlaceDetail(placeId) {
  try {
    if (!hasGoongApiKey() || !placeId) return null;
    const response = await fetch(buildEndpointUrl(getEndpoint("placeDetailEndpoint", "/Place/Detail"), { place_id: placeId }));
    if (!response.ok) {
      console.warn("Goong place detail failed", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.warn("Goong place detail error", error);
    return null;
  }
}

export async function goongResolveCoordinates(inputText) {
  try {
    if (!hasGoongApiKey()) return null;
    const keyword = String(inputText || "").trim();
    if (!keyword) return null;
    const suggestions = await goongAutocomplete(keyword);
    const first = suggestions?.[0];
    if (!first?.place_id) return null;
    const detail = await goongPlaceDetail(first.place_id);
    const location = detail?.geometry?.location;
    if (!location?.lat || !location?.lng) return null;
    return {
      lat: Number(location.lat),
      lng: Number(location.lng),
      formattedAddress: detail?.formatted_address || first.description || keyword
    };
  } catch (error) {
    console.warn("Goong resolve coordinates error", error);
    return null;
  }
}

export async function goongDistanceMatrix(origin, destination) {
  try {
    if (!hasGoongApiKey() || !origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) return null;
    const response = await fetch(buildEndpointUrl(getEndpoint("distanceEndpoint", "/DistanceMatrix"), {
      origins: `${origin.lat},${origin.lng}`,
      destinations: `${destination.lat},${destination.lng}`,
      vehicle: getRuntimeConfig().vehicle || "bike"
    }));
    if (!response.ok) {
      console.warn("Goong distance failed", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    const element = data.rows?.[0]?.elements?.[0];
    const meters = element?.distance?.value;
    return meters ? {
      distanceKm: Math.max(0.1, meters / 1000),
      durationText: element?.duration?.text || ""
    } : null;
  } catch (error) {
    console.warn("Goong distance error", error);
    return null;
  }
}

export async function goongReverseGeocode(lat, lng) {
  try {
    if (!hasGoongApiKey() || !lat || !lng) return null;
    const response = await fetch(buildEndpointUrl(getEndpoint("geocodeEndpoint", "/Geocode"), { latlng: `${lat},${lng}` }));
    if (!response.ok) {
      console.warn("Goong reverse geocode failed", response.status, await response.text());
      return null;
    }
    const data = await response.json();
    return data.results?.[0] || null;
  } catch (error) {
    console.warn("Goong reverse geocode error", error);
    return null;
  }
}

export function getGoongApiKey() {
  return goongConfigRepository.getApiKey() || "";
}

export async function goongDistanceKm(destination, apiKey = getGoongApiKey()) {
  if (!apiKey || !destination?.lat || !destination?.lng) return null;
  const origins = `${storeOrigin.lat},${storeOrigin.lng}`;
  const destinations = `${destination.lat},${destination.lng}`;
  const url = `${GOONG_API_BASE}/DistanceMatrix?origins=${origins}&destinations=${destinations}&vehicle=bike&api_key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const distanceMeters = data.rows?.[0]?.elements?.[0]?.distance?.value;
  return distanceMeters ? Math.max(0.1, distanceMeters / 1000) : null;
}
