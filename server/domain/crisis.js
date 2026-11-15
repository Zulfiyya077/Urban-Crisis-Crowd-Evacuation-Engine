import { centroid, haversineMeters, shownPercent, formatPercent } from './geo.js';
import { ALERT_MESSAGE } from '../config.js';

/**
 * Crisis rules are plain functions so a later task can append one
 * without rewriting detection. Each rule returns zero or more drafts.
 *
 * @typedef {object} CrisisContext
 * @property {number} now
 * @property {Array} signals
 * @property {Array} shelters
 * @property {Array} zones
 * @property {object} policy
 */

export const crisisRules = [clusterRule, occupancyRule];

export function evaluateCrisis(ctx) {
  return crisisRules.flatMap((rule) => rule(ctx));
}

export function activeWindow(signals, now, policy) {
  return signals.filter(
    (signal) =>
      signal.status === 'active' &&
      signal.type !== 'checkin' &&
      now - signal.createdAt <= policy.windowMs,
  );
}

/**
 * Two spatial definitions from the brief:
 * 1. at least 4 distinct SOS in the same district inside 5 minutes
 * 2. at least 4 distinct SOS inside a 500 m radius, used when they
 *    are not already covered by a single district alarm
 */
export function clusterRule(ctx) {
  const { now, policy, zones } = ctx;
  const recent = activeWindow(ctx.signals, now, policy);
  const drafts = [];
  const covered = new Set();

  const byZone = new Map();
  for (const signal of recent) {
    const list = byZone.get(signal.zoneId) || [];
    list.push(signal);
    byZone.set(signal.zoneId, list);
  }

  for (const [zoneId, group] of byZone) {
    if (group.length < policy.minDistinctSignals) continue;
    for (const signal of group) covered.add(signal.id);
    const point = centroid(group);
    const zoneName = zones.find((zone) => zone.id === zoneId)?.name || zoneId;
    drafts.push({
      kind: 'cluster-zone',
      dedupeKey: `zone:${zoneId}`,
      message: ALERT_MESSAGE,
      params: { zoneName, count: group.length },
      detail: `${zoneName}: 5 dəqiqədə ${group.length} fərqli SOS`,
      zoneId,
      shelterId: null,
      lat: point.lat,
      lng: point.lng,
      evidenceIds: group.map((signal) => signal.id),
    });
  }

  const radiusGroups = [];
  for (const center of recent) {
    const group = recent.filter(
      (signal) => haversineMeters(center, signal) <= policy.clusterRadiusMeters,
    );
    if (group.length < policy.minDistinctSignals) continue;
    const novel = group.filter((signal) => !covered.has(signal.id));
    if (novel.length < policy.minDistinctSignals) continue;
    const signature = group
      .map((signal) => signal.id)
      .sort()
      .join(',');
    if (radiusGroups.some((item) => item.signature === signature)) continue;
    radiusGroups.push({ signature, group });
  }

  radiusGroups.sort((a, b) => b.group.length - a.group.length);
  const kept = [];
  for (const candidate of radiusGroups) {
    const overlaps = kept.some((item) => sharedCount(item.group, candidate.group) >= 3);
    if (!overlaps) kept.push(candidate);
  }

  for (const { group } of kept) {
    if (group.every((signal) => covered.has(signal.id))) continue;
    const point = centroid(group);
    const zoneNames = [
      ...new Set(
        group.map((signal) => zones.find((zone) => zone.id === signal.zoneId)?.name || signal.zoneId),
      ),
    ];
    const zoneKey = [...new Set(group.map((signal) => signal.zoneId))].sort().join('+');
    drafts.push({
      kind: 'cluster-radius',
      dedupeKey: `radius:${zoneKey}:${point.lat.toFixed(2)}:${point.lng.toFixed(2)}`,
      message: ALERT_MESSAGE,
      params: { count: group.length, zones: zoneNames.join(', ') },
      detail: `500 m radius: 5 dəqiqədə ${group.length} fərqli SOS (${zoneNames.join(', ')})`,
      zoneId: group[0].zoneId,
      shelterId: null,
      lat: point.lat,
      lng: point.lng,
      evidenceIds: group.map((signal) => signal.id),
    });
  }

  return drafts;
}

function sharedCount(left, right) {
  const ids = new Set(left.map((signal) => signal.id));
  return right.filter((signal) => ids.has(signal.id)).length;
}

/** Gathering point load strictly above 95%. */
export function occupancyRule(ctx) {
  const { policy, shelters, zones } = ctx;
  const drafts = [];
  for (const shelter of shelters) {
    if (shelter.status === 'closed') continue;
    if (shelter.alertArmed === false) continue;
    const percent = shownPercent(shelter);
    if (percent <= policy.occupancyAlertPercent) continue;
    const zoneName = zones.find((zone) => zone.id === shelter.zoneId)?.name || shelter.zoneId;
    drafts.push({
      kind: 'occupancy',
      dedupeKey: `occupancy:${shelter.id}`,
      message: ALERT_MESSAGE,
      params: {
        shelterName: shelter.name,
        percent: formatPercent(percent),
        threshold: policy.occupancyAlertPercent,
        zoneName,
      },
      detail: `${shelter.name} doluluğu ${formatPercent(percent)}% (> ${policy.occupancyAlertPercent}%). ${zoneName}`,
      zoneId: shelter.zoneId,
      shelterId: shelter.id,
      lat: shelter.lat,
      lng: shelter.lng,
      evidenceIds: [`${shelter.id}:${formatPercent(percent)}`],
    });
  }
  return drafts;
}
