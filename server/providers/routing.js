import { haversineMeters } from '../domain/geo.js';

/** Shown when the external routing service is down and the local matrix is used. */
export const BACKUP_NOTICE = 'Oflayn/Ehtiyat marşrut rejimində işləyir';
const BACKUP_NOTICE_EN = 'Offline/Backup route mode is on';

export function backupNotice(lang) {
  return lang === 'en' ? BACKUP_NOTICE_EN : BACKUP_NOTICE;
}

function rememberRoute(cache, key, route) {
  if (!cache || !route?.geometry || route.geometry.length < 8) return;
  cache.set(key, route);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
}

export function createCircuitBreaker({ failureThreshold = 1, openMs = 30_000, now = Date.now } = {}) {
  const breaker = {
    state: 'closed',
    failures: 0,
    openedAt: 0,
    probe: false,
    allow() {
      if (breaker.state === 'closed') return true;
      if (breaker.state === 'open' && now() - breaker.openedAt >= openMs) {
        breaker.state = 'half-open';
        breaker.probe = false;
      }
      if (breaker.state === 'half-open' && !breaker.probe) {
        breaker.probe = true;
        return true;
      }
      return false;
    },
    success() {
      breaker.state = 'closed';
      breaker.failures = 0;
      breaker.probe = false;
    },
    failure() {
      breaker.failures += 1;
      breaker.probe = false;
      if (breaker.state === 'half-open' || breaker.failures >= failureThreshold) {
        breaker.state = 'open';
        breaker.openedAt = now();
      }
    },
  };
  return breaker;
}

export function buildRouteMatrix(network) {
  const matrix = new Map();
  const byId = new Map((network?.nodes || []).map((node) => [node.id, node]));
  for (const edge of network?.edges || []) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    const value = { meters: edge.meters, minutes: edge.minutes };
    matrix.set(`${pointKey(from)}|${pointKey(to)}`, value);
    matrix.set(`${pointKey(to)}|${pointKey(from)}`, value);
  }
  return matrix;
}

/**
 * Street geometry for a route the local graph already chose.
 * A 503, a timeout, or a network failure never throws: the circuit opens
 * and distance stays on the last cache or the static coordinate matrix.
 */
export async function enrichPlanWithOsrm(plan, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const fetchImpl = options.fetchImpl || fetch;
  const breaker = options.breaker;
  const matrix = options.matrix || new Map();
  const cache = options.cache || new Map();
  const targets = [plan.recommended, ...(plan.alternatives || [])].filter((item) => item?.route?.geometry?.length >= 2);

  if (!targets.length) {
    plan.routing = { provider: 'simulated', mode: 'local', fallback: false, circuit: breaker?.state || 'closed' };
    return plan;
  }

  let live = false;
  let backup = false;
  let source = 'matrix';

  try {
    await Promise.all(targets.map(async (item) => {
      const snapshot = {
        geometry: item.route.geometry.map((point) => ({ ...point })),
        durationMinutes: item.route.durationMinutes,
        distanceMeters: item.route.distanceMeters,
      };
      const waypoints = dedupe(snapshot.geometry);
      const key = waypoints.map((point) => `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`).join(';');
      try {
        if (breaker && !breaker.allow()) {
          backup = true;
          source = applyBackup(item, key, snapshot, matrix, cache);
          return;
        }
        const route = await osrmFoot(options.baseUrl, waypoints, fetchImpl, timeoutMs);
        rememberRoute(cache, key, route);
        if (!route || route.geometry.length < 8) {
          breaker?.failure();
          backup = true;
          source = applyBackup(item, key, snapshot, matrix, cache);
          return;
        }
        breaker?.success();
        item.route.geometry = route.geometry;
        item.route.durationMinutes = Math.round(route.minutes * 10) / 10;
        item.route.distanceMeters = Math.round(route.meters);
        item.route.provider = 'osrm';
        live = true;
      } catch (error) {
        if (error?.code !== 'CLIENT') breaker?.failure();
        backup = true;
        source = applyBackup(item, key, snapshot, matrix, cache);
      }
    }));
  } catch {
    backup = true;
    for (const item of targets) {
      if (item.route.provider !== 'fallback') {
        source = applyBackup(item, '', {
          geometry: item.route.geometry,
          durationMinutes: item.route.durationMinutes,
          distanceMeters: item.route.distanceMeters,
        }, matrix, cache);
      }
    }
  }

  assignRouting(plan, { live: live && !backup, backup, source, lang: options.lang, circuit: breaker?.state || 'closed' });
  return plan;
}

function applyBackup(item, key, snapshot, matrix, cache) {
  const cached = key ? cache?.get(key) : null;
  if (cached?.geometry?.length >= 8) {
    item.route.geometry = cached.geometry;
    item.route.durationMinutes = Math.round(cached.minutes * 10) / 10;
    item.route.distanceMeters = Math.round(cached.meters);
    item.route.provider = 'fallback';
    return 'cache';
  }
  const measured = measureGeometry(snapshot.geometry, matrix);
  item.route.geometry = snapshot.geometry;
  item.route.durationMinutes = measured.meters > 0 ? measured.minutes : snapshot.durationMinutes;
  item.route.distanceMeters = measured.meters > 0 ? measured.meters : snapshot.distanceMeters;
  item.route.provider = 'fallback';
  return 'matrix';
}

function assignRouting(plan, { live, backup, source, lang, circuit }) {
  plan.routing = live
    ? { provider: 'osrm', mode: 'live', fallback: false, circuit }
    : {
      provider: 'fallback',
      mode: 'backup',
      fallback: true,
      source: source || 'matrix',
      circuit,
      notice: backupNotice(lang),
    };
}

export function measureGeometry(geometry, matrix) {
  let meters = 0;
  let minutes = 0;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const from = geometry[index];
    const to = geometry[index + 1];
    const known = matrix.get(`${pointKey(from)}|${pointKey(to)}`);
    if (known) {
      meters += known.meters;
      minutes += known.minutes;
      continue;
    }
    const hop = haversineMeters(from, to);
    meters += hop;
    minutes += (hop / 1000 / 5) * 60;
  }
  return { meters: Math.round(meters), minutes: Math.round(minutes * 10) / 10 };
}

async function osrmFoot(baseUrl, points, fetchImpl, timeoutMs) {
  const coords = points.map((point) => `${point.lng},${point.lat}`).join(';');
  const url =
    `${String(baseUrl || '').replace(/\/$/, '')}/route/v1/foot/${coords}` +
    '?overview=full&geometries=geojson';
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' }));
    }, timeoutMs);
  });
  const pending = Promise.resolve().then(() => fetchImpl(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'urban-crisis-engine/1.0', Accept: 'application/json' },
  }));
  const guarded = pending.then(
    (response) => response,
    (error) => {
      const aborted = controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError';
      throw Object.assign(new Error(aborted ? 'timeout' : 'network'), { code: aborted ? 'TIMEOUT' : 'NETWORK' });
    },
  );
  pending.catch(() => {});
  guarded.catch(() => {});

  let response;
  try {
    response = await Promise.race([guarded, timeout]);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 503) throw Object.assign(new Error('OSRM 503'), { code: 'UNAVAILABLE' });
  if (response.status >= 500) throw Object.assign(new Error(`OSRM ${response.status}`), { code: 'UPSTREAM' });
  if (!response.ok) throw Object.assign(new Error(`OSRM ${response.status}`), { code: 'CLIENT' });
  const body = await response.json();
  const route = body.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;
  return {
    minutes: route.duration / 60,
    meters: route.distance,
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
  };
}

function pointKey(point) {
  return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
}

function dedupe(points) {
  const kept = [];
  for (const point of points) {
    const previous = kept[kept.length - 1];
    if (previous && Math.abs(previous.lat - point.lat) < 0.0004 && Math.abs(previous.lng - point.lng) < 0.0004) continue;
    kept.push(point);
  }
  return kept;
}
