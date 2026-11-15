import { config as defaultConfig, SOS_TYPES, inBbox, ALERT_MESSAGE } from './config.js';
import { buildCity, measureEdge } from './data/city.js';
import { nearest, shownPercent, haversineMeters } from './domain/geo.js';
import { evaluateCrisis, activeWindow } from './domain/crisis.js';
import { planEvacuation, publicShelter, roadView } from './domain/evacuation.js';
import { localizeAlert } from './i18n.js';

export class StoreError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createStore(options = {}) {
  const cfg = options.config || defaultConfig;
  const now = options.now || (() => Date.now());
  const onChange = options.onChange;
  const state = structuredClone(options.city || buildCity(cfg, now()));
  const policy = cfg.crisis;
  let signalSeq = 1;
  let alertSeq = 1;
  let brigadeSeq = state.brigades.length;
  let placeSeq = 1;

  evaluate();
  state.updatedAt = now();

  return {
    plan(input) {
      return planEvacuation({
        origin: resolveOrigin(input),
        nodes: state.nodes,
        edges: state.edges,
        shelters: state.shelters,
        zones: state.zones,
        policy,
        travel: cfg.travel,
        lang: input.lang === 'en' ? 'en' : 'az',
        access: input.access === 'mobility' || input.role === 'mobility' ? 'mobility' : 'general',
      });
    },
    addSos(input) {
      const prepared = prepareSos(input);
      const duplicate = state.signals.find(
        (signal) =>
          signal.sessionId === prepared.sessionId &&
          signal.type === prepared.type &&
          signal.status === 'active' &&
          now() - signal.createdAt < 30_000,
      );
      if (duplicate) {
        if (prepared.priority === 1 && duplicate.priority !== 1) {
          duplicate.role = 'mobility';
          duplicate.priority = 1;
          duplicate.priorityStatus = CLINICAL_PRIORITY;
          commit();
        }
        return { signal: publicSignal(duplicate), duplicate: true, alerts: [] };
      }
      const signal = pushSignal(prepared);
      const alerts = commit();
      return { signal: publicSignal(signal), duplicate: false, alerts };
    },
    markSafe(input) {
      const sessionId = cleanSession(input.sessionId);
      const stamp = now();
      const active = state.signals.filter(
        (signal) => signal.sessionId === sessionId && signal.status === 'active',
      );
      if (active.length) {
        for (const signal of active) {
          signal.status = 'safe';
          signal.safeAt = stamp;
        }
      } else if (state.signals.some((signal) => signal.sessionId === sessionId && signal.status === 'safe')) {
        return { ...sessionView(sessionId), already: true };
      } else {
        const origin = resolveOrigin(
          input.lat != null || input.zoneId ? input : { zoneId: 'nasimi' },
        );
        pushSignal({
          type: 'checkin',
          sessionId,
          lat: origin.lat,
          lng: origin.lng,
          zoneId: origin.zoneId,
          status: 'safe',
          createdAt: stamp,
          safeAt: stamp,
        });
      }
      commit();
      return sessionView(sessionId);
    },
    session(sessionId) {
      return sessionView(cleanSession(sessionId));
    },
    setOccupancyPercent(shelterId, percent) {
      const shelter = state.shelters.find((item) => item.id === shelterId);
      if (!shelter) throw new StoreError(404, 'Toplanış məntəqəsi tapılmadı', 'SHELTER_NOT_FOUND');
      const value = Number(percent);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new StoreError(400, 'Doluluq 0 ilə 100 arasında olmalıdır', 'BAD_PERCENT');
      }
      shelter.occupancy = shelter.capacity * (value / 100);
      commit();
      return publicShelter(shelter);
    },
    toggleRoad(roadId) {
      const road = state.edges.find((edge) => edge.id === roadId);
      if (!road) throw new StoreError(404, 'Yol seqmenti tapılmadı', 'ROAD_NOT_FOUND');
      road.status = road.status === 'closed' ? 'open' : 'closed';
      commit();
      return roadView(road, state.nodes);
    },
    confirmAlert(alertId) {
      const alert = state.alerts.find((item) => item.id === alertId);
      if (!alert) throw new StoreError(404, 'Xəbərdarlıq tapılmadı', 'ALERT_NOT_FOUND');
      if (alert.status !== 'open') throw new StoreError(409, 'Qərar artıq icra olunub', 'ALREADY_CONFIRMED');
      const { brigade, createdBrigade } = takeBrigade(alert);
      brigade.status = 'dispatched';
      brigade.assignedZoneId = alert.zoneId;
      brigade.destination = { lat: alert.lat, lng: alert.lng };
      brigade.task = `Əlavə çağırış — ${zoneName(alert.zoneId)}`;
      const shelter = openTemporaryShelter(alert);
      if (alert.kind === 'occupancy') {
        const source = state.shelters.find((item) => item.id === alert.shelterId);
        if (source) source.alertArmed = false;
      }
      alert.status = 'confirmed';
      alert.confirmedAt = now();
      alert.resolution = {
        brigadeId: brigade.id,
        brigadeName: brigade.name,
        createdBrigade,
        shelterId: shelter.id,
        shelterName: shelter.name,
        at: alert.confirmedAt,
      };
      commit();
      return { alert: publicAlert(alert), brigade: publicBrigade(brigade), shelter: publicShelter(shelter), message: ALERT_MESSAGE };
    },
    demoCluster(zoneId = 'nasimi') {
      const zone = state.zones.find((item) => item.id === zoneId);
      if (!zone) throw new StoreError(404, 'Rayon tapılmadı', 'ZONE_NOT_FOUND');
      const types = ['fire', 'collapse', 'flood', 'medical'];
      const jitter = [
        [0, 0],
        [0.0011, 0.0004],
        [-0.0006, 0.001],
        [0.0004, -0.0008],
      ];
      const stamp = now();
      const signals = jitter.map(([dLat, dLng], index) =>
        pushSignal({
          type: types[index],
          sessionId: `demo-${stamp}-${index}`,
          lat: zone.lat + dLat,
          lng: zone.lng + dLng,
          zoneId: zone.id,
          status: 'active',
          createdAt: stamp,
          safeAt: null,
        }),
      );
      const alerts = commit();
      return { signals, alerts };
    },
    demoSignal(zoneId = 'nasimi', type = 'fire') {
      const zone = state.zones.find((item) => item.id === zoneId);
      if (!zone) throw new StoreError(404, 'Rayon tapılmadı', 'ZONE_NOT_FOUND');
      if (!SOS_TYPES.includes(type)) throw new StoreError(400, 'Təhlükə növü tanınmır', 'BAD_TYPE');
      const stamp = now();
      const signal = pushSignal({
        type,
        sessionId: `demo-one-${stamp}-${signalSeq}`,
        lat: zone.lat + (Math.random() - 0.5) * 0.002,
        lng: zone.lng + (Math.random() - 0.5) * 0.002,
        zoneId: zone.id,
        status: 'active',
        createdAt: stamp,
        safeAt: null,
      });
      const alerts = commit();
      return { signal, alerts };
    },
    citizenMeta() {
      return {
        city: cfg.city.name,
        zones: state.zones.map(publicZone),
        policy: publicPolicy(),
      };
    },
    localNetwork() {
      return {
        nodes: state.nodes.map((node) => ({ id: node.id, lat: node.lat, lng: node.lng })),
        edges: state.edges.map((edge) => ({
          from: edge.from,
          to: edge.to,
          meters: edge.meters,
          minutes: edge.minutes,
        })),
      };
    },
    traffic() {
      return {
        provider: 'simulated',
        description: 'Simulyasiya olunmuş yol-nəqliyyat endpoint-i',
        updatedAt: state.updatedAt || now(),
        segments: state.edges.map((edge) => roadView(edge, state.nodes)),
      };
    },
    operatorState(lang = 'az') {
      const stamp = now();
      const active = state.signals.filter((signal) => signal.status === 'active' && signal.type !== 'checkin');
      return {
        city: cfg.city,
        generatedAt: stamp,
        updatedAt: state.updatedAt || stamp,
        policy: publicPolicy(),
        summary: {
          activeSignals: active.length,
          openAlerts: state.alerts.filter((alert) => alert.status === 'open').length,
          sheltersOver90: state.shelters.filter((shelter) => shownPercent(shelter) >= policy.shelterAvoidPercent).length,
          closedRoads: state.edges.filter((edge) => edge.status === 'closed').length,
          availableBrigades: state.brigades.filter((brigade) => brigade.status === 'available').length,
        },
        zones: state.zones.map((zone) => ({
          ...publicZone(zone),
          recentSignals: activeWindow(state.signals, stamp, policy).filter((signal) => signal.zoneId === zone.id).length,
        })),
        shelters: state.shelters.map(publicShelter),
        roads: state.edges.map((edge) => roadView(edge, state.nodes)),
        brigades: state.brigades.map(publicBrigade),
        signals: state.signals
          .slice()
          .sort((a, b) => Number(b.priority === 1) - Number(a.priority === 1) || b.createdAt - a.createdAt)
          .slice(0, 80)
          .map(publicSignal),
        alerts: state.alerts
          .slice()
          .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.createdAt - a.createdAt)
          .map((alert) => publicAlert(alert, lang)),
      };
    },
  };

  function commit() {
    const created = evaluate();
    state.updatedAt = now();
    onChange?.({ created });
    return created;
  }

  function evaluate() {
    const stamp = now();
    for (const shelter of state.shelters) {
      if (shownPercent(shelter) <= policy.occupancyAlertPercent) {
        shelter.alertArmed = true;
        for (const alert of state.alerts) {
          if (alert.kind === 'occupancy' && alert.shelterId === shelter.id && alert.status === 'open') {
            alert.status = 'cleared';
            alert.clearedAt = stamp;
          }
        }
      }
    }

    const drafts = evaluateCrisis({
      now: stamp,
      signals: state.signals,
      shelters: state.shelters,
      zones: state.zones,
      policy,
    });
    const created = [];
    for (const draft of drafts) {
      const alert = upsertAlert(draft, stamp);
      if (alert) created.push(alert);
    }
    return created.map(publicAlert);
  }

  function upsertAlert(draft, stamp) {
    if (draft.kind === 'occupancy') {
      const open = state.alerts.find((alert) => alert.dedupeKey === draft.dedupeKey && alert.status === 'open');
      if (open) {
        open.detail = draft.detail;
        open.evidenceIds = draft.evidenceIds;
        open.updatedAt = stamp;
        return null;
      }
      return materialize(draft, stamp);
    }

    const open = state.alerts.find((alert) => alert.dedupeKey === draft.dedupeKey && alert.status === 'open');
    if (open) {
      assignDraft(open, draft, stamp);
      return null;
    }
    if (draft.kind === 'cluster-radius') {
      const overlap = state.alerts.find(
        (alert) =>
          alert.kind === 'cluster-radius' &&
          alert.status === 'open' &&
          shared(alert.evidenceIds, draft.evidenceIds) >= 3,
      );
      if (overlap) {
        assignDraft(overlap, draft, stamp);
        return null;
      }
    }

    const covered = new Set(
      state.alerts
        .filter((alert) => alert.status === 'confirmed' && String(alert.kind).startsWith('cluster'))
        .flatMap((alert) => alert.evidenceIds),
    );
    const novel = draft.evidenceIds.filter((id) => !covered.has(id));
    if (covered.size && novel.length < policy.minDistinctSignals) return null;
    return materialize(draft, stamp);
  }

  function materialize(draft, stamp) {
    const alert = {
      id: `alert_${alertSeq++}`,
      ...draft,
      status: 'open',
      createdAt: stamp,
      updatedAt: stamp,
      confirmedAt: null,
      clearedAt: null,
      resolution: null,
    };
    state.alerts.push(alert);
    return alert;
  }

  function takeBrigade(alert) {
    const available = state.brigades.filter((brigade) => brigade.status === 'available');
    if (available.length) {
      const brigade = available
        .slice()
        .sort((a, b) => haversineMeters(a, alert) - haversineMeters(b, alert))[0];
      return { brigade, createdBrigade: false };
    }
    brigadeSeq += 1;
    const brigade = {
      id: `b${brigadeSeq}`,
      name: `Əlavə briqada ${brigadeSeq}`,
      zoneId: alert.zoneId,
      status: 'available',
      lat: alert.lat,
      lng: alert.lng,
      task: null,
      assignedZoneId: null,
      destination: null,
    };
    state.brigades.push(brigade);
    return { brigade, createdBrigade: true };
  }

  function openTemporaryShelter(alert) {
    const index = state.shelters.filter((shelter) => shelter.type === 'temporary').length;
    const point = {
      lat: alert.lat + 0.004 + index * 0.0015,
      lng: alert.lng + 0.003,
    };
    const shelterId = `shelter-temp-${placeSeq++}`;
    const node = {
      id: `node-${shelterId}`,
      name: `Müvəqqəti ${index + 1}`,
      lat: point.lat,
      lng: point.lng,
      zoneId: alert.zoneId,
    };
    state.nodes.push(node);
    const { item: link } = nearest(node, state.nodes.filter((item) => item.id !== node.id));
    const measured = measureEdge(node, link, cfg.travel.roadKmh);
    state.edges.push({
      id: `edge-${shelterId}`,
      name: 'Müvəqqəti keçid',
      from: node.id,
      to: link.id,
      status: 'open',
      medical: true,
      ...measured,
    });
    const shelter = {
      id: shelterId,
      name: `Müvəqqəti məntəqə ${index + 1} — ${zoneName(alert.zoneId)}`,
      type: 'temporary',
      nodeId: node.id,
      zoneId: alert.zoneId,
      lat: point.lat,
      lng: point.lng,
      capacity: 1500,
      occupancy: 0,
      status: 'open',
      alertArmed: true,
      accessible: true,
      accessKind: 'ramp',
    };
    state.shelters.push(shelter);
    return shelter;
  }

  function pushSignal(fields) {
    const signal = {
      id: fields.id || `sos_${signalSeq++}`,
      type: fields.type,
      sessionId: fields.sessionId,
      lat: fields.lat,
      lng: fields.lng,
      zoneId: fields.zoneId,
      status: fields.status,
      role: fields.role || 'general',
      priority: fields.priority ?? null,
      priorityStatus: fields.priorityStatus ?? null,
      createdAt: fields.createdAt,
      safeAt: fields.safeAt ?? null,
    };
    state.signals.push(signal);
    return signal;
  }

  function prepareSos(input) {
    if (!SOS_TYPES.includes(input.type)) throw new StoreError(400, 'Təhlükə növü tanınmır', 'BAD_TYPE');
    const origin = resolveOrigin(input);
    return {
      type: input.type,
      sessionId: cleanSession(input.sessionId),
      lat: origin.lat,
      lng: origin.lng,
      zoneId: origin.zoneId,
      status: 'active',
      role: input.role === 'mobility' ? 'mobility' : 'general',
      priority: input.role === 'mobility' ? 1 : null,
      priorityStatus: input.role === 'mobility' ? CLINICAL_PRIORITY : null,
      createdAt: now(),
      safeAt: null,
    };
  }

  function resolveOrigin(input) {
    if (input.zoneId && input.lat == null) {
      const zone = state.zones.find((item) => item.id === input.zoneId);
      if (!zone) throw new StoreError(404, 'Rayon tapılmadı', 'ZONE_NOT_FOUND');
      return { lat: zone.lat, lng: zone.lng, zoneId: zone.id, source: 'zone' };
    }
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new StoreError(400, 'Koordinat və ya rayon seçin', 'BAD_ORIGIN');
    }
    if (!inBbox(lat, lng, cfg.bbox)) {
      throw new StoreError(400, 'Koordinat Bakı ərazisindən kənardadır. Rayon seçin.', 'OUT_OF_CITY');
    }
    const zone = nearest({ lat, lng }, state.zones).item;
    return { lat, lng, zoneId: zone.id, source: 'coordinates' };
  }

  function sessionView(sessionId) {
    const mine = state.signals.filter((signal) => signal.sessionId === sessionId);
    const active = mine.some((signal) => signal.status === 'active' && signal.type !== 'checkin');
    const safe = mine.some((signal) => signal.status === 'safe');
    return {
      sessionId,
      status: active ? 'alert' : safe ? 'safe' : 'idle',
      signals: mine.slice().sort((a, b) => b.createdAt - a.createdAt).map(publicSignal),
    };
  }

  function publicPolicy() {
    return {
      windowMinutes: policy.windowMs / 60000,
      minDistinctSignals: policy.minDistinctSignals,
      clusterRadiusMeters: policy.clusterRadiusMeters,
      shelterAvoidPercent: policy.shelterAvoidPercent,
      occupancyAlertPercent: policy.occupancyAlertPercent,
      message: ALERT_MESSAGE,
    };
  }

  function publicZone(zone) {
    return {
      id: zone.id,
      name: zone.name,
      lat: zone.lat,
      lng: zone.lng,
      radiusMeters: zone.radiusMeters,
    };
  }

  function publicSignal(signal) {
    return {
      id: signal.id,
      type: signal.type,
      sessionId: signal.sessionId,
      lat: signal.lat,
      lng: signal.lng,
      zoneId: signal.zoneId,
      zoneName: zoneName(signal.zoneId),
      status: signal.status,
      role: signal.role || 'general',
      priority: signal.priority ?? null,
      priorityStatus: signal.priorityStatus ?? null,
      createdAt: signal.createdAt,
      safeAt: signal.safeAt,
    };
  }

  function publicAlert(alert, lang = 'az') {
    const copy = localizeAlert(alert, lang);
    return {
      id: alert.id,
      kind: alert.kind,
      dedupeKey: alert.dedupeKey,
      message: copy.message,
      detail: copy.detail,
      zoneId: alert.zoneId,
      zoneName: zoneName(alert.zoneId),
      shelterId: alert.shelterId,
      lat: alert.lat,
      lng: alert.lng,
      evidenceIds: alert.evidenceIds,
      status: alert.status,
      createdAt: alert.createdAt,
      confirmedAt: alert.confirmedAt,
      resolution: alert.resolution,
    };
  }

  function publicBrigade(brigade) {
    return {
      id: brigade.id,
      name: brigade.name,
      zoneId: brigade.zoneId,
      zoneName: zoneName(brigade.zoneId),
      assignedZoneId: brigade.assignedZoneId,
      assignedZoneName: brigade.assignedZoneId ? zoneName(brigade.assignedZoneId) : null,
      status: brigade.status,
      lat: brigade.lat,
      lng: brigade.lng,
      task: brigade.task,
      destination: brigade.destination,
    };
  }

  function zoneName(id) {
    return state.zones.find((zone) => zone.id === id)?.name || id;
  }
}

function assignDraft(alert, draft, stamp) {
  alert.detail = draft.detail;
  alert.params = draft.params;
  alert.evidenceIds = draft.evidenceIds;
  alert.lat = draft.lat;
  alert.lng = draft.lng;
  alert.updatedAt = stamp;
}

function shared(left, right) {
  const ids = new Set(left);
  return right.filter((id) => ids.has(id)).length;
}

const CLINICAL_PRIORITY = 'KLİNİK PRİORİTET';

function cleanSession(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.trim().length < 8 || sessionId.length > 80) {
    throw new StoreError(400, 'Sessiya identifikatoru etibarsızdır', 'BAD_SESSION');
  }
  return sessionId.trim();
}
