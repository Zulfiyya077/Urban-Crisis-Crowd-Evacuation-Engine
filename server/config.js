/** Tunable policy. New tasks should add fields here instead of hard-coding numbers. */
export const ALERT_MESSAGE =
  'Əlavə xilasetmə briqadası göndər və yeni toplanış nöqtəsi aç';

export const SOS_TYPES = ['fire', 'collapse', 'flood', 'medical'];

export const config = {
  port: Number(process.env.PORT) || 3000,
  routingProvider: process.env.ROUTING_PROVIDER || 'osrm',
  osrmUrl: process.env.OSRM_URL || 'https://router.project-osrm.org',
  routingTimeoutMs: Number(process.env.ROUTING_TIMEOUT_MS) || 5000,
  city: {
    name: 'Bakı',
    center: { lat: 40.395, lng: 49.875 },
    defaultZoom: 12,
  },
  bbox: { minLat: 40.15, maxLat: 40.65, minLng: 49.55, maxLng: 50.15 },
  travel: {
    roadKmh: 18,
    walkKmh: 5,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'local-demo-jwt-secret',
    dispatcherUser: process.env.DISPATCHER_USER || 'dispatcher',
    dispatcherPassword: process.env.DISPATCHER_PASSWORD || 'baki-dispetcer',
    tokenTtlSec: 8 * 60 * 60,
  },
  sosGuard: {
    ipLimit: 8,
    ipWindowMs: 60_000,
    sessionLimit: 4,
    sessionWindowMs: 60_000,
    globalLimit: 30,
    globalWindowMs: 10_000,
  },
  crisis: {
    windowMs: 5 * 60 * 1000,
    minDistinctSignals: 4,
    clusterRadiusMeters: 500,
    /** Citizen alternative route when a shelter reaches this load. */
    shelterAvoidPercent: 90,
    /** Operator alarm when occupancy is strictly above this. */
    occupancyAlertPercent: 95,
  },
};

export function inBbox(lat, lng, bbox = config.bbox) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}
