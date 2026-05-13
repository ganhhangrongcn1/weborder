export function isDateInRange(startAt, endAt, now = new Date()) {
  const startDate = startAt ? new Date(`${startAt}T00:00:00`) : null;
  const endDate = endAt ? new Date(`${endAt}T23:59:59`) : null;
  if (startDate && !Number.isNaN(startDate.getTime()) && now.getTime() < startDate.getTime()) return false;
  if (endDate && !Number.isNaN(endDate.getTime()) && now.getTime() > endDate.getTime()) return false;
  return true;
}

export function estimateDistanceKm(address) {
  const text = String(address || "").toLowerCase();
  if (!text.trim()) return null;
  if (text.includes("phú hòa") || text.includes("phu hoa") || text.includes("30/4")) return 0.9;
  if (text.includes("thủ dầu một") || text.includes("thu dau mot")) return 3.8;
  if (text.includes("bình dương") || text.includes("binh duong")) return 6.5;
  return 4.5;
}

export function getDefaultAddress(addresses) {
  return addresses.find((address) => address.isDefault) || addresses[0];
}
