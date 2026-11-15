const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearest(point, items) {
  let best = null;
  let bestDistance = Infinity;
  for (const item of items) {
    const distanceMeters = haversineMeters(point, item);
    if (distanceMeters < bestDistance) {
      best = item;
      bestDistance = distanceMeters;
    }
  }
  return { item: best, distanceMeters: bestDistance };
}

export function centroid(points) {
  if (!points.length) return { lat: 0, lng: 0 };
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return { lat, lng };
}

export function occupancyRatio(shelter) {
  if (!shelter.capacity) return 0;
  return (shelter.occupancy / shelter.capacity) * 100;
}

/** One decimal, so the 95% and 90% rules match what the UI shows. */
export function shownPercent(shelter) {
  return Math.round(occupancyRatio(shelter) * 10) / 10;
}

export function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
