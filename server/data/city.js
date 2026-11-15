import { haversineMeters } from '../domain/geo.js';

const NODES = [
  { id: 'bayil', name: 'Bayıl', lat: 40.3448, lng: 49.8275, zoneId: 'sabail' },
  { id: 'icherisheher', name: 'İçərişəhər', lat: 40.3661, lng: 49.837, zoneId: 'sabail' },
  { id: 'denizkenari', name: 'Dənizkənarı', lat: 40.3602, lng: 49.8488, zoneId: 'sabail' },
  { id: 'may28', name: '28 May', lat: 40.3797, lng: 49.8486, zoneId: 'nasimi' },
  { id: 'genclik', name: 'Gənclik', lat: 40.4008, lng: 49.8532, zoneId: 'nasimi' },
  { id: 'tofiq', name: 'Tofiq Bəhramov', lat: 40.3986, lng: 49.8524, zoneId: 'nasimi' },
  { id: 'yasamal', name: 'Yasamal', lat: 40.3828, lng: 49.8028, zoneId: 'yasamal' },
  { id: 'elmler', name: 'Elmlər Akademiyası', lat: 40.3748, lng: 49.8155, zoneId: 'yasamal' },
  { id: 'nerimanov', name: 'Nərimanov', lat: 40.4088, lng: 49.8715, zoneId: 'nerimanov' },
  { id: 'ganja', name: 'Gənclik–Koroğlu', lat: 40.4145, lng: 49.892, zoneId: 'nerimanov' },
  { id: 'xetai', name: 'Xətai', lat: 40.3792, lng: 49.8915, zoneId: 'xetai' },
  { id: 'heydar', name: 'Heydər parkı', lat: 40.386, lng: 49.9105, zoneId: 'xetai' },
  { id: 'koroglu', name: 'Koroğlu', lat: 40.421, lng: 49.9185, zoneId: 'nizami' },
  { id: 'nizami', name: 'Nizami', lat: 40.4098, lng: 49.9435, zoneId: 'nizami' },
  { id: 'ahmadli', name: 'Əhmədli', lat: 40.3955, lng: 49.972, zoneId: 'nizami' },
  { id: 'azadliq', name: 'Azadlıq', lat: 40.4255, lng: 49.8385, zoneId: 'binegedi' },
  { id: 'binegedi', name: 'Binəqədi', lat: 40.4552, lng: 49.8082, zoneId: 'binegedi' },
  { id: 'olimpiya', name: 'Olimpiya Stadionu', lat: 40.4301, lng: 49.9196, zoneId: 'sabuncu' },
];

const ZONES = [
  ['sabail', 'Səbail', 'icherisheher'],
  ['nasimi', 'Nəsimi', 'may28'],
  ['yasamal', 'Yasamal', 'yasamal'],
  ['nerimanov', 'Nərimanov', 'nerimanov'],
  ['xetai', 'Xətai', 'xetai'],
  ['nizami', 'Nizami', 'nizami'],
  ['binegedi', 'Binəqədi', 'binegedi'],
  ['sabuncu', 'Sabunçu', 'olimpiya'],
];

/** Last field is the accessible entrance: ramp, barrier-free, or none. */
const SHELTERS = [
  ['shelter-28may', '28 May metro sığınacağı', 'shelter', 'may28', 1200, 1092, null],
  ['shelter-tofiq', 'Tofiq Bəhramov stadionu', 'stadium', 'tofiq', 8000, 2400, 'ramp'],
  ['shelter-deniz', 'Dənizkənarı Milli Park', 'park', 'denizkenari', 12000, 3800, 'barrier-free'],
  ['shelter-bayil', 'Bayıl parkı', 'park', 'bayil', 2200, 640, null],
  ['shelter-yasamal', 'Yasamal sığınacağı', 'shelter', 'yasamal', 700, 260, null],
  ['shelter-elmler', 'Elmlər parkı', 'park', 'elmler', 1800, 420, null],
  ['shelter-nerimanov', 'Nərimanov parkı', 'park', 'nerimanov', 3200, 1100, 'barrier-free'],
  ['shelter-genclik', 'Gənclik sığınacağı', 'shelter', 'genclik', 650, 180, null],
  ['shelter-xetai', 'Xətai sığınacağı', 'shelter', 'xetai', 900, 702, null],
  ['shelter-heydar', 'Heydər Əliyev parkı', 'park', 'heydar', 4500, 980, 'barrier-free'],
  ['shelter-nizami', 'Nizami parkı', 'park', 'nizami', 3800, 860, 'barrier-free'],
  ['shelter-ahmadli', 'Əhmədli sığınacağı', 'shelter', 'ahmadli', 800, 240, 'ramp'],
  ['shelter-binegedi', 'Binəqədi parkı', 'park', 'binegedi', 3600, 740, 'barrier-free'],
  ['shelter-olimpiya', 'Bakı Olimpiya Stadionu', 'stadium', 'olimpiya', 68000, 5200, 'ramp'],
];

/** [id, name, from, to, status, medical]. medical = wheelchair and medical vehicle. */
const EDGES = [
  ['e1', 'Dəniz yolu', 'bayil', 'icherisheher', 'open', true],
  ['e2', 'Neftçilər prospekti', 'icherisheher', 'denizkenari', 'open', true],
  ['e3', 'Neftçilər prospekti', 'denizkenari', 'may28', 'closed', false],
  ['e4', 'Nizami küçəsi', 'icherisheher', 'may28', 'open', true],
  ['e5', 'Neftçilər prospekti', 'may28', 'genclik', 'open', true],
  ['e6', 'Fətəli xan Xoyski', 'genclik', 'tofiq', 'open', true],
  ['e7', 'Tbilisi prospekti', 'may28', 'yasamal', 'open', true],
  ['e8', 'Həsən bəy Zərdabi', 'yasamal', 'elmler', 'open', true],
  ['e9', 'Səməd Vurğun', 'elmler', 'may28', 'open', false],
  ['e10', 'Ziya Bünyadov prospekti', 'tofiq', 'azadliq', 'open', true],
  ['e11', 'Ziya Bünyadov prospekti', 'azadliq', 'binegedi', 'open', true],
  ['e12', 'Abbas Mirzə Şərifzadə', 'yasamal', 'azadliq', 'open', false],
  ['e13', 'Heydər Əliyev prospekti', 'genclik', 'nerimanov', 'open', true],
  ['e14', 'Heydər Əliyev prospekti', 'nerimanov', 'ganja', 'open', true],
  ['e15', 'Heydər Əliyev prospekti', 'ganja', 'olimpiya', 'open', true],
  ['e16', 'Babək prospekti', 'may28', 'xetai', 'open', true],
  ['e17', 'Babək prospekti', 'xetai', 'heydar', 'open', true],
  ['e18', 'Babək prospekti', 'heydar', 'nizami', 'open', true],
  ['e19', 'Məhəmməd Hadi', 'nizami', 'ahmadli', 'open', true],
  ['e20', 'Nobel prospekti', 'nerimanov', 'xetai', 'open', true],
  ['e21', 'Koroğlu yolu', 'ganja', 'koroglu', 'open', true],
  ['e22', 'Koroğlu yolu', 'koroglu', 'nizami', 'open', true],
  ['e23', 'Olimpiya yolu', 'koroglu', 'olimpiya', 'open', true],
  ['e24', 'Dərnəgül yolu', 'genclik', 'heydar', 'open', true],
];

const BRIGADES = [
  ['b1', 'Briqada 1', 'nasimi', 'may28', 'available', null],
  ['b2', 'Briqada 2', 'sabail', 'icherisheher', 'on_scene', 'Səbail patrulu'],
  ['b3', 'Briqada 3', 'yasamal', 'yasamal', 'available', null],
  ['b4', 'Briqada 4', 'xetai', 'xetai', 'dispatched', 'Xətai çağırışı'],
  ['b5', 'Briqada 5', 'nerimanov', 'nerimanov', 'available', null],
  ['b6', 'Briqada 6', 'binegedi', 'binegedi', 'available', null],
];

export function buildCity(cfg, now = Date.now()) {
  const nodes = NODES.map((node) => ({ ...node }));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const edges = EDGES.map(([id, name, from, to, status, medical]) => {
    const start = byId.get(from);
    const end = byId.get(to);
    if (!start || !end) throw new Error(`Qırılmış yol seqmenti: ${id}`);
    const meters = haversineMeters(start, end);
    return {
      id,
      name,
      from,
      to,
      status,
      medical: Boolean(medical),
      meters,
      minutes: (meters / 1000 / cfg.travel.roadKmh) * 60,
    };
  });

  const zones = ZONES.map(([id, name, nodeId]) => {
    const node = byId.get(nodeId);
    if (!node) throw new Error(`Rayon qovşağı tapılmadı: ${id}`);
    return { id, name, nodeId, lat: node.lat, lng: node.lng };
  });
  for (const zone of zones) zone.radiusMeters = coverageMeters(zone, zones, nodes);

  const shelters = SHELTERS.map(([id, name, type, nodeId, capacity, occupancy, accessKind]) => {
    const node = byId.get(nodeId);
    if (!node) throw new Error(`Məntəqə qovşağı tapılmadı: ${id}`);
    return {
      id,
      name,
      type,
      nodeId,
      zoneId: node.zoneId,
      lat: node.lat,
      lng: node.lng,
      capacity,
      occupancy,
      status: 'open',
      alertArmed: true,
      accessible: Boolean(accessKind),
      accessKind: accessKind || null,
    };
  });
  addLocalRamps(shelters, zones);

  const brigades = BRIGADES.map(([id, name, zoneId, nodeId, status, task]) => {
    const node = byId.get(nodeId);
    if (!node) throw new Error(`Briqada qovşağı tapılmadı: ${id}`);
    return {
      id,
      name,
      zoneId,
      status,
      lat: node.lat,
      lng: node.lng,
      task,
      assignedZoneId: status === 'dispatched' ? zoneId : null,
      destination: null,
    };
  });

  const signals = [
    signal('sos_seed_1', 'fire', 'seed-a', 'may28', 'nasimi', 'active', now - 22 * 60 * 1000, byId),
    signal('sos_seed_2', 'flood', 'seed-b', 'xetai', 'xetai', 'active', now - 3 * 60 * 1000, byId),
    signal('sos_seed_3', 'collapse', 'seed-c', 'yasamal', 'yasamal', 'active', now - 2 * 60 * 1000, byId),
    signal('sos_seed_4', 'medical', 'seed-d', 'icherisheher', 'sabail', 'safe', now - 18 * 60 * 1000, byId),
  ];

  return { nodes, edges, zones, shelters, brigades, signals, alerts: [] };
}

function coverageMeters(zone, zones, nodes) {
  const reach = nodes
    .filter((node) => node.zoneId === zone.id && node.id !== zone.nodeId)
    .reduce((max, node) => Math.max(max, haversineMeters(zone, node)), 0);
  if (reach > 0) return Math.round(reach + 450);
  const gap = Math.min(...zones.filter((item) => item.id !== zone.id).map((item) => haversineMeters(zone, item)));
  return Math.round(Math.max(1200, gap * 0.42));
}

function addLocalRamps(shelters, zones) {
  for (const zone of zones) {
    const covered = shelters.some((shelter) => shelter.zoneId === zone.id && shelter.accessible);
    if (covered) continue;
    shelters.push({
      id: `shelter-temp-${zone.id}`,
      name: `${zone.name} müvəqqəti sığınacağı`,
      type: 'temporary',
      nodeId: zone.nodeId,
      zoneId: zone.id,
      lat: zone.lat,
      lng: zone.lng,
      capacity: 500,
      occupancy: 0,
      status: 'open',
      alertArmed: true,
      accessible: true,
      accessKind: 'ramp',
      provisional: true,
    });
  }
}

function signal(id, type, sessionId, nodeId, zoneId, status, createdAt, byId) {
  const node = byId.get(nodeId);
  return {
    id,
    type,
    sessionId,
    lat: node.lat + 0.0015,
    lng: node.lng + 0.0012,
    zoneId,
    status,
    createdAt,
    safeAt: status === 'safe' ? createdAt + 60 * 1000 : null,
  };
}

export function measureEdge(from, to, kmh) {
  const meters = haversineMeters(from, to);
  return { meters, minutes: (meters / 1000 / kmh) * 60 };
}
