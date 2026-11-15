import { formatPercent, haversineMeters, nearest, shownPercent } from './geo.js';
import { shortestPath } from './routing.js';
import { routeCopy } from '../i18n.js';

/**
 * Picks a gathering point and a street path.
 * The recommendation becomes an automatic alternative when the nearest
 * usable point is at least 90% full, or when the short path is closed.
 */
export function planEvacuation({ origin, nodes, edges, shelters, zones, policy, travel, lang = 'az', access = 'general' }) {
  const medicalOnly = access === 'mobility';
  const { item: snap, distanceMeters: walkMeters } = nearest(origin, nodes);
  const walkMinutes = (walkMeters / 1000 / travel.walkKmh) * 60;
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const zone = zones.find((item) => item.id === origin.zoneId) || nearest(origin, zones).item;

  const ranked = shelters
    .filter((shelter) => shelter.status !== 'closed')
    .map((shelter) => {
      const target = nodes.find((node) => node.id === shelter.nodeId);
      const crow = haversineMeters(origin, shelter);
      const openPath = target
        ? shortestPath(nodes, edges, snap.id, target.id, { avoidClosed: true, medicalOnly })
        : null;
      const directPath = target
        ? shortestPath(nodes, edges, snap.id, target.id, { avoidClosed: false })
        : null;
      const closedRoads = unique(
        (directPath?.edgeIds || [])
          .map((id) => edgeById.get(id))
          .filter((edge) => edge && edge.status === 'closed')
          .map((edge) => edge.name),
      );
      const detour =
        closedRoads.length > 0 &&
        openPath &&
        openPath.edgeIds.join('|') !== directPath.edgeIds.join('|');
      return {
        shelter,
        crow,
        openPath,
        directPath,
        closedRoads,
        detour,
        percent: shownPercent(shelter),
      };
    });

  const nearestCrow = ranked.reduce((min, item) => Math.min(min, item.crow), Infinity);
  const avoided = [];
  const viable = [];

  for (const item of ranked) {
    const reasons = [];
    if (medicalOnly && !item.shelter.accessible) {
      reasons.push(routeCopy(lang, 'notAccessible'));
    }
    if (item.percent >= policy.shelterAvoidPercent) {
      reasons.push(routeCopy(lang, 'occupancy', {
        percent: formatPercent(item.percent),
        threshold: policy.shelterAvoidPercent,
      }));
    }
    if (!item.openPath) {
      reasons.push(
        item.closedRoads.length
          ? routeCopy(lang, 'road', { roads: item.closedRoads.join(', ') })
          : medicalOnly
            ? routeCopy(lang, 'noMedical')
            : routeCopy(lang, 'unreachable'),
      );
    }
    const relevant = item.crow <= Math.max(nearestCrow * 2.4, 4000);
    if (reasons.length && relevant) {
      avoided.push({
        shelter: publicShelter(item.shelter),
        reasons,
        distanceMeters: Math.round(item.crow),
      });
    }
    if ((!medicalOnly || item.shelter.accessible) && item.percent < policy.shelterAvoidPercent && item.openPath) viable.push(item);
  }

  viable.sort((a, b) => a.openPath.minutes - b.openPath.minutes || a.crow - b.crow);
  const best = viable[0] || null;
  const reasons = [];

  if (best) {
    const nearerFull = ranked
      .filter((item) => item.crow + 80 < best.crow && item.percent >= policy.shelterAvoidPercent)
      .sort((a, b) => a.crow - b.crow);
    for (const item of nearerFull.slice(0, 2)) {
      reasons.push(routeCopy(lang, 'full', {
        name: item.shelter.name,
        percent: formatPercent(item.percent),
      }));
    }
    const nearerBlocked = ranked
      .filter((item) => item.crow + 80 < best.crow && !item.openPath && item.closedRoads.length)
      .sort((a, b) => a.crow - b.crow);
    for (const item of nearerBlocked.slice(0, 2)) {
      reasons.push(routeCopy(lang, 'blocked', {
        name: item.shelter.name,
        roads: item.closedRoads.join(', '),
      }));
    }
    if (medicalOnly) {
      const nearerClosedAccess = ranked
        .filter((item) => item.crow + 80 < best.crow && !item.shelter.accessible)
        .sort((a, b) => a.crow - b.crow);
      for (const item of nearerClosedAccess.slice(0, 2)) {
        reasons.push(routeCopy(lang, 'skipAccess', { name: item.shelter.name }));
      }
    }
    if (medicalOnly && best.shelter.provisional) {
      const area = zones.find((item) => item.id === best.shelter.zoneId);
      reasons.unshift(routeCopy(lang, 'localRamp', {
        zone: area?.name || '',
        name: best.shelter.name,
      }));
    }
    if (best.detour) {
      reasons.push(routeCopy(lang, 'detour', { roads: best.closedRoads.join(', ') }));
    }
    const directBest = ranked
      .filter((item) => item.percent < policy.shelterAvoidPercent && item.directPath)
      .sort((a, b) => a.directPath.minutes - b.directPath.minutes || a.crow - b.crow)[0];
    if (
      directBest &&
      directBest.shelter.id !== best.shelter.id &&
      directBest.closedRoads.length &&
      !reasons.some((line) => line.includes(directBest.closedRoads[0]))
    ) {
      reasons.push(routeCopy(lang, 'instead', {
        roads: directBest.closedRoads.join(', '),
        name: directBest.shelter.name,
      }));
    }
  }

  const present = (item, alternativeReasons) => ({
    shelter: publicShelter(item.shelter),
    route: {
      durationMinutes: round1(item.openPath.minutes + walkMinutes),
      distanceMeters: Math.round(item.openPath.meters + walkMeters),
      roads: item.openPath.roads,
      edgeIds: item.openPath.edgeIds,
      geometry: withOrigin(origin, item.openPath.geometry, walkMeters),
      alternative: alternativeReasons.length > 0,
      medical: medicalOnly,
      reasons: alternativeReasons,
    },
  });

  return {
    origin: {
      lat: origin.lat,
      lng: origin.lng,
      zoneId: zone?.id || origin.zoneId,
      zoneName: zone?.name || '',
      source: origin.source,
      snapNodeId: snap.id,
    },
    access: medicalOnly ? 'mobility' : 'general',
    notice: medicalOnly
      ? [routeCopy(lang, 'clinicalNotice'), ...reasons].join(' ')
      : reasons.length
        ? routeCopy(lang, 'notice', { body: reasons.join(' ') })
        : null,
    recommended: best ? present(best, reasons) : null,
    alternatives: viable.slice(1, 4).map((item) => present(item, [])),
    avoided,
    closedRoads: edges
      .filter((edge) => edge.status === 'closed')
      .map((edge) => roadView(edge, nodes)),
    routing: { provider: 'simulated' },
  };
}

export function publicShelter(shelter) {
  return {
    id: shelter.id,
    name: shelter.name,
    type: shelter.type,
    zoneId: shelter.zoneId,
    lat: shelter.lat,
    lng: shelter.lng,
    capacity: shelter.capacity,
    occupancy: shelter.occupancy,
    percent: shownPercent(shelter),
    status: shelter.status,
    accessible: Boolean(shelter.accessible),
    accessKind: shelter.accessKind || null,
  };
}

export function roadView(edge, nodes) {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  return {
    id: edge.id,
    name: edge.name,
    status: edge.status,
    medical: Boolean(edge.medical),
    distanceMeters: Math.round(edge.meters),
    travelMinutes: round1(edge.minutes),
    from: { lat: from.lat, lng: from.lng, name: from.name },
    to: { lat: to.lat, lng: to.lng, name: to.name },
  };
}

function withOrigin(origin, geometry, walkMeters) {
  if (walkMeters < 25) return geometry;
  return [{ lat: origin.lat, lng: origin.lng }, ...geometry];
}

function unique(values) {
  return [...new Set(values)];
}

function round1(value) {
  return Math.round(value * 10) / 10;
}
