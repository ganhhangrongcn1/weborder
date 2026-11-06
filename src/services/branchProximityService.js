export function getBranchCoordinates(branch = {}) {
  const meta = branch.metadata || branch.data || {};
  const lat = branch.lat ?? branch.latitude ?? meta.lat;
  const lng = branch.lng ?? branch.longitude ?? meta.lng;
  if (lat === "" || lat == null || lng === "" || lng == null) return null;
  const point = { lat:Number(lat),lng:Number(lng) };
  return Number.isFinite(point.lat) && Math.abs(point.lat)<=90 && Number.isFinite(point.lng) && Math.abs(point.lng)<=180 ? point : null;
}

export function formatBranchDistance(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "";
  if (distanceKm < 0.1) return "Dưới 100 m";
  if (distanceKm < 1) return `Khoảng ${Math.round(distanceKm * 100) * 10} m`;
  return `Khoảng ${distanceKm.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} km`;
}

export function rankNearbyBranches(branches = [], position) {
  const radians = value => value * Math.PI / 180;
  return branches.map((branch,index)=>{
    const point = getBranchCoordinates(branch);
    if (!point || !position) return {...branch,distanceKm:null,_distanceOrder:index};
    const a = Math.sin(radians(point.lat-position.lat)/2)**2 + Math.cos(radians(position.lat))*Math.cos(radians(point.lat))*Math.sin(radians(point.lng-position.lng)/2)**2;
    return {...branch,distanceKm:6371*2*Math.asin(Math.sqrt(Math.min(1,a))),_distanceOrder:index};
  }).sort((a,b)=>(a.distanceKm ?? Infinity)-(b.distanceKm ?? Infinity) || a._distanceOrder-b._distanceOrder);
}
