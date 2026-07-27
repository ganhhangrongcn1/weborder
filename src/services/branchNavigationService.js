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

