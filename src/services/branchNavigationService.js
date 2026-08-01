function getBranchCoordinates(branch = {}) {
  const lat = Number(branch?.lat);
  const lng = Number(branch?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat || !lng) return null;
  return { lat, lng };
}

export function buildGoogleMapsDirectionsUrl(branch = {}) {
  if (!branch || typeof branch !== "object") return "";

  const coordinates = getBranchCoordinates(branch);
  const destination = coordinates
    ? `${coordinates.lat},${coordinates.lng}`
    : [branch?.name, branch?.address].filter(Boolean).join(", ").trim();

  if (!destination) return "";

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving"
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsPlaceUrl(branch = {}) {
  if (!branch || typeof branch !== "object") return "";

  const savedUrl = String(branch?.map || branch?.map_url || "").trim();
  if (/^https?:\/\//i.test(savedUrl)) return savedUrl;

  const coordinates = getBranchCoordinates(branch);
  const query = coordinates
    ? `${coordinates.lat},${coordinates.lng}`
    : [branch?.name, branch?.address].filter(Boolean).join(", ").trim();
  if (!query) return "";

  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsReviewUrl(branch = {}) {
  if (!branch || typeof branch !== "object") return "";

  const savedReviewUrl = String(
    branch?.googleReviewUrl ||
    branch?.google_review_url ||
    branch?.metadata?.googleReviewUrl ||
    ""
  ).trim();
  if (/^https?:\/\//i.test(savedReviewUrl)) return savedReviewUrl;

  const placeId = String(branch?.googlePlaceId || branch?.google_place_id || "").trim();
  if (placeId) {
    const params = new URLSearchParams({ placeid: placeId });
    return `https://search.google.com/local/writereview?${params.toString()}`;
  }

  return buildGoogleMapsPlaceUrl(branch);
}

