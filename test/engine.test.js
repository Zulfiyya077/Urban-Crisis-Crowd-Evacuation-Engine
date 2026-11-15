import assert from 'node:assert/strict';
import test from 'node:test';
import { ALERT_MESSAGE } from '../server/config.js';
import { BACKUP_NOTICE } from '../server/providers/routing.js';
import { haversineMeters } from '../server/domain/geo.js';
import { shortestPath } from '../server/domain/routing.js';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';

const MESSAGE = 'Əlavə xilasetmə briqadası göndər və yeni toplanış nöqtəsi aç';

test('district coverage circles contain the district points', () => {
  const store = createStore();
  const state = store.operatorState();
  assert.equal(state.zones.length, 8);
  for (const zone of state.zones) assert.ok(zone.radiusMeters >= 1200, zone.id);
  const yasamal = state.zones.find((zone) => zone.id === 'yasamal');
  const elmler = state.shelters.find((shelter) => shelter.id === 'shelter-elmler');
  assert.ok(haversineMeters(yasamal, elmler) < yasamal.radiusMeters);
});

test('fresh city does not raise an alarm', () => {
  const store = createStore();
  assert.equal(ALERT_MESSAGE, MESSAGE);
  assert.equal(store.operatorState().alerts.length, 0);
});

test('Nasimi plan avoids the shelter at 91% and offers an alternative', () => {
  const store = createStore();
  const plan = store.plan({ zoneId: 'nasimi' });
  assert.equal(plan.recommended.shelter.id, 'shelter-genclik');
  assert.equal(plan.recommended.route.alternative, true);
  assert.match(plan.notice, /Avtomatik alternativ marşrut/);
  assert.match(plan.notice, /28 May metro sığınacağı/);
  assert.ok(plan.avoided.some((item) => item.shelter.id === 'shelter-28may'));
  assert.ok(plan.recommended.route.geometry.length >= 2);
});

test('a closed road produces a detour to the same shelter', () => {
  const store = createStore();
  for (const shelter of store.operatorState().shelters) {
    if (shelter.id !== 'shelter-28may') store.setOccupancyPercent(shelter.id, 99);
  }
  store.setOccupancyPercent('shelter-28may', 10);
  const plan = store.plan({ lat: 40.3602, lng: 49.8488 });
  assert.equal(plan.recommended.shelter.id, 'shelter-28may');
  assert.equal(plan.recommended.route.alternative, true);
  assert.match(plan.notice, /Neftçilər prospekti/);
  assert.ok(plan.recommended.route.roads.includes('Nizami küçəsi'));
});

test('closing the road toward the nearest open shelter reroutes the citizen', () => {
  const store = createStore();
  const before = store.plan({ zoneId: 'nasimi' });
  store.toggleRoad('e5');
  const after = store.plan({ zoneId: 'nasimi' });
  assert.notEqual(after.recommended.shelter.id, before.recommended.shelter.id);
  assert.equal(after.recommended.route.alternative, true);
  assert.match(after.notice, /Neftçilər prospekti/);
});

test('shortest path skips a closed segment', () => {
  const nodes = [
    { id: 'a', lat: 0, lng: 0 },
    { id: 'b', lat: 0, lng: 1 },
    { id: 'c', lat: 1, lng: 0.5 },
  ];
  const edges = [
    { id: 'ab', name: 'Əsas', from: 'a', to: 'b', status: 'closed', minutes: 1, meters: 10 },
    { id: 'ac', name: 'Dolayı', from: 'a', to: 'c', status: 'open', minutes: 2, meters: 20 },
    { id: 'cb', name: 'Dolayı', from: 'c', to: 'b', status: 'open', minutes: 2, meters: 20 },
  ];
  const open = shortestPath(nodes, edges, 'a', 'b', { avoidClosed: true });
  const direct = shortestPath(nodes, edges, 'a', 'b', { avoidClosed: false });
  assert.deepEqual(open.nodeIds, ['a', 'c', 'b']);
  assert.deepEqual(direct.nodeIds, ['a', 'b']);
});

test('four SOS in one district within five minutes raise the exact alarm', () => {
  const store = createStore();
  const zone = store.operatorState().zones.find((item) => item.id === 'nasimi');
  for (let index = 0; index < 3; index += 1) {
    store.addSos({
      type: ['fire', 'collapse', 'flood'][index],
      sessionId: `session-nasimi-${index}`,
      lat: zone.lat + index * 0.0004,
      lng: zone.lng,
    });
  }
  assert.equal(store.operatorState().summary.openAlerts, 0);

  const fourth = store.addSos({
    type: 'medical',
    sessionId: 'session-nasimi-3',
    lat: zone.lat,
    lng: zone.lng + 0.0004,
  });
  const open = store.operatorState().alerts.filter((alert) => alert.status === 'open');
  assert.equal(open.length, 1);
  assert.equal(open[0].kind, 'cluster-zone');
  assert.equal(open[0].message, MESSAGE);
  assert.equal(fourth.signal.zoneName, 'Nəsimi');
  assert.equal(fourth.alerts[0].id, open[0].id);
});

test('signals older than five minutes do not count', () => {
  let clock = 1_700_000_000_000;
  const store = createStore({ now: () => clock });
  const zone = store.operatorState().zones.find((item) => item.id === 'nizami');
  for (let index = 0; index < 3; index += 1) {
    store.addSos({
      type: 'fire',
      sessionId: `session-old-${index}x`,
      lat: zone.lat,
      lng: zone.lng + index * 0.0002,
    });
  }
  clock += 6 * 60 * 1000;
  store.addSos({
    type: 'fire',
    sessionId: 'session-old-new1',
    lat: zone.lat,
    lng: zone.lng,
  });
  assert.equal(store.operatorState().summary.openAlerts, 0);
});

test('saying I am safe still works after the SOS limit is full', async () => {
  const { app } = createApp({
    sosGuard: {
      ipLimit: 1,
      ipWindowMs: 60_000,
      sessionLimit: 1,
      sessionWindowMs: 60_000,
      globalLimit: 1,
      globalWindowMs: 60_000,
    },
  });
  const server = await listen(app);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const sessionId = 'session-safe-after-limit';
    const sent = await request(base, '/api/citizen/sos', {
      method: 'POST',
      body: { type: 'flood', sessionId, zoneId: 'nasimi' },
    });
    assert.equal(sent.status, 201);
    const blocked = await request(base, '/api/citizen/sos', {
      method: 'POST',
      body: { type: 'fire', sessionId, zoneId: 'nasimi' },
    });
    assert.equal(blocked.status, 429);
    const safe = await request(base, '/api/citizen/safe', {
      method: 'POST',
      body: { sessionId, zoneId: 'nasimi' },
    });
    assert.equal(safe.status, 200);
    assert.equal(safe.body.status, 'safe');
    const state = await request(base, '/api/operator/state');
    const signal = state.body.signals.find((item) => item.id === sent.body.signal.id);
    assert.equal(signal.status, 'safe');
  } finally {
    await close(server);
  }
});

test('marking safe twice does not add another check-in', () => {
  const store = createStore();
  const sessionId = 'session-safe-once';
  const first = store.markSafe({ sessionId, zoneId: 'nasimi' });
  const before = store.operatorState().signals.filter((signal) => signal.sessionId === sessionId).length;
  const second = store.markSafe({ sessionId, zoneId: 'nasimi' });
  const after = store.operatorState().signals.filter((signal) => signal.sessionId === sessionId).length;
  assert.equal(first.status, 'safe');
  assert.equal(second.already, true);
  assert.equal(after, before);
});

test('a safe status is not counted as an active SOS', () => {
  const store = createStore();
  const zone = store.operatorState().zones.find((item) => item.id === 'sabail');
  const sessions = ['session-safe-aaa', 'session-safe-bbb', 'session-safe-ccc', 'session-safe-ddd'];
  for (const sessionId of sessions.slice(0, 3)) {
    store.addSos({ type: 'flood', sessionId, lat: zone.lat, lng: zone.lng });
    store.markSafe({ sessionId, zoneId: zone.id });
  }
  store.addSos({ type: 'flood', sessionId: sessions[3], lat: zone.lat, lng: zone.lng });
  assert.equal(store.operatorState().summary.openAlerts, 0);
  assert.equal(store.session(sessions[0]).status, 'safe');
});

test('an alarm stays open after people mark themselves safe', () => {
  const store = createStore();
  store.demoCluster('xetai');
  const alert = store.operatorState().alerts.find((item) => item.status === 'open');
  assert.ok(alert);
  for (const signal of store.operatorState().signals.filter((item) => item.zoneId === 'xetai' && item.status === 'active')) {
    if (signal.sessionId.startsWith('demo-')) store.markSafe({ sessionId: signal.sessionId });
  }
  const still = store.operatorState().alerts.find((item) => item.id === alert.id);
  assert.equal(still.status, 'open');
});

test('four SOS inside 500 metres across a district boundary raise a radius alarm', () => {
  const store = createStore();
  const points = [
    { lat: 40.37945, lng: 49.8688 },
    { lat: 40.3803, lng: 49.8686 },
    { lat: 40.37945, lng: 49.8714 },
    { lat: 40.3803, lng: 49.8716 },
  ];
  assert.ok(haversineMeters(points[0], points[3]) < 500);
  const created = points.map((point, index) =>
    store.addSos({ type: 'fire', sessionId: `session-radius-${index}`, ...point }).signal,
  );
  const zones = new Set(created.map((signal) => signal.zoneId));
  assert.ok(zones.size >= 2, [...zones].join(','));
  const open = store.operatorState().alerts.filter((alert) => alert.status === 'open');
  assert.equal(open.length, 1);
  assert.equal(open[0].kind, 'cluster-radius');
  assert.equal(open[0].message, MESSAGE);
});

test('occupancy at 95% does not alarm and above 95% does', () => {
  const store = createStore();
  store.setOccupancyPercent('shelter-xetai', 95);
  assert.equal(store.operatorState().summary.openAlerts, 0);
  store.setOccupancyPercent('shelter-xetai', 96);
  const alert = store.operatorState().alerts.find((item) => item.status === 'open');
  assert.equal(alert.kind, 'occupancy');
  assert.equal(alert.shelterId, 'shelter-xetai');
  assert.equal(alert.message, MESSAGE);
});

test('confirming an alarm dispatches a brigade and opens a gathering point', () => {
  const store = createStore();
  store.setOccupancyPercent('shelter-xetai', 96);
  const before = store.operatorState();
  const availableBefore = before.summary.availableBrigades;
  const alert = before.alerts.find((item) => item.status === 'open');
  const result = store.confirmAlert(alert.id);
  const after = store.operatorState();
  assert.equal(result.message, MESSAGE);
  assert.equal(after.alerts.find((item) => item.id === alert.id).status, 'confirmed');
  assert.equal(after.summary.availableBrigades, availableBefore - 1);
  assert.equal(after.brigades.find((item) => item.id === result.brigade.id).status, 'dispatched');
  assert.equal(result.shelter.type, 'temporary');
  assert.ok(after.shelters.some((item) => item.id === result.shelter.id));
  assert.throws(() => store.confirmAlert(alert.id), /artıq icra olunub/);

  store.setOccupancyPercent('shelter-xetai', 97);
  assert.equal(afterOpen(store, 'occupancy'), 0);
  store.setOccupancyPercent('shelter-xetai', 80);
  store.setOccupancyPercent('shelter-xetai', 97);
  assert.equal(afterOpen(store, 'occupancy'), 1);
});

test('a new reserve brigade is created when none are available', () => {
  const store = createStore();
  const zones = ['nasimi', 'yasamal', 'sabail', 'nerimanov'];
  for (const zoneId of zones) {
    const { alerts } = store.demoCluster(zoneId);
    const alert = alerts.find((item) => item.kind === 'cluster-zone');
    store.confirmAlert(alert.id);
  }
  assert.equal(store.operatorState().summary.availableBrigades, 0);
  store.setOccupancyPercent('shelter-binegedi', 98);
  const occupancy = store.operatorState().alerts.find((item) => item.kind === 'occupancy' && item.status === 'open');
  const result = store.confirmAlert(occupancy.id);
  assert.equal(result.brigade.name.startsWith('Əlavə briqada'), true);
  assert.equal(store.operatorState().brigades.find((item) => item.id === result.brigade.id).status, 'dispatched');
});

test('http plan, traffic and confirm', async () => {
  const { app } = createApp();
  const server = await listen(app);
  try {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;
    const plan = await request(base, '/api/citizen/plan', {
      method: 'POST',
      body: { zoneId: 'nasimi' },
    });
    assert.equal(plan.status, 200);
    assert.equal(plan.body.recommended.route.alternative, true);

    const traffic = await request(base, '/api/traffic');
    assert.equal(traffic.body.provider, 'simulated');
    assert.ok(traffic.body.segments.some((segment) => segment.status === 'closed' && segment.name === 'Neftçilər prospekti'));

    const token = await dispatcherToken(base);
    const burst = await request(base, '/api/operator/demo/cluster', {
      method: 'POST',
      body: { zoneId: 'binegedi' },
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(burst.status, 201);
    const state = await request(base, '/api/operator/state');
    const alert = state.body.alerts.find((item) => item.status === 'open');
    assert.equal(alert.message, MESSAGE);

    const confirmed = await request(base, `/api/operator/alerts/${alert.id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.shelter.type, 'temporary');
  } finally {
    await close(server);
  }
});

test('the same session and hazard is one signal, not a second row', () => {
  const store = createStore();
  const first = store.addSos({ type: 'fire', sessionId: 'session-dup-1', zoneId: 'nasimi' });
  const second = store.addSos({ type: 'fire', sessionId: 'session-dup-1', zoneId: 'nasimi' });
  assert.equal(second.duplicate, true);
  assert.equal(second.signal.id, first.signal.id);
  const rows = store.operatorState().signals.filter((item) => item.sessionId === 'session-dup-1');
  assert.equal(rows.length, 1);
});

test('brigade dispatch and road routing require the dispatcher role', async () => {
  const { app, store, auth } = createApp();
  store.setOccupancyPercent('shelter-xetai', 96);
  const alert = store.operatorState().alerts.find((item) => item.status === 'open');
  const road = store.operatorState().roads[0];
  const server = await listen(app);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const denied = await request(base, `/api/operator/alerts/${alert.id}/confirm`, { method: 'POST' });
    assert.equal(denied.status, 401);

    const citizen = auth.sign({ sub: 'guest', role: 'citizen' });
    const forbidden = await request(base, `/api/operator/roads/${road.id}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizen}` },
    });
    assert.equal(forbidden.status, 403);
    assert.equal(store.operatorState().roads.find((item) => item.id === road.id).status, road.status);

    const token = await dispatcherToken(base);
    const confirmed = await request(base, `/api/operator/alerts/${alert.id}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.shelter.type, 'temporary');
  } finally {
    await close(server);
  }
});

test('more than 500 fake SOS stay off the panel and answer in under 300 ms', async () => {
  const { app } = createApp();
  const server = await listen(app);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const before = await request(base, '/api/operator/state');
    const started = before.body.signals.length;
    const total = 520;
    const results = await Promise.all(Array.from({ length: total }, (_, index) => {
      const t0 = performance.now();
      return request(base, '/api/citizen/sos', {
        method: 'POST',
        headers: { 'X-Forwarded-For': `203.0.113.${index % 250}` },
        body: {
          type: ['fire', 'collapse', 'flood', 'medical'][index % 4],
          sessionId: `flood-session-${index}`,
          lat: 40.379 + (index % 7) * 0.0003,
          lng: 49.848 + (index % 5) * 0.0003,
        },
      }).then((result) => ({ ...result, ms: performance.now() - t0 }));
    }));
    const mean = results.reduce((sum, item) => sum + item.ms, 0) / results.length;
    const accepted = results.filter((item) => item.status === 201).length;
    const rejected = results.filter((item) => item.status === 429).length;
    assert.ok(mean < 300, `mean ${mean.toFixed(1)} ms`);
    assert.ok(accepted <= 30, `accepted ${accepted}`);
    assert.equal(accepted + rejected, total);
    const after = await request(base, '/api/operator/state');
    assert.ok(after.body.signals.length - started <= 30);
    assert.ok(after.body.signals.length - started === accepted);
  } finally {
    await close(server);
  }
});

test('english requests localize the notice and alarm while the stored text stays Azerbaijani', () => {
  const store = createStore();
  const english = store.plan({ zoneId: 'nasimi', lang: 'en' });
  assert.match(english.notice, /Automatic alternative route/);
  assert.match(english.notice, /28 May metro sığınacağı/);
  const azerbaijani = store.plan({ zoneId: 'nasimi' });
  assert.match(azerbaijani.notice, /Avtomatik alternativ marşrut/);

  store.demoCluster('nasimi');
  const translated = store.operatorState('en').alerts.find((alert) => alert.status === 'open');
  assert.equal(translated.message, 'Send an additional rescue brigade and open a new gathering point');
  assert.match(translated.detail, /different SOS/);
  const stored = store.operatorState().alerts.find((alert) => alert.status === 'open');
  assert.equal(stored.message, MESSAGE);
});

test('mobility role receives clinical priority and a wheelchair route', () => {
  const store = createStore();
  const plan = store.plan({ zoneId: 'nasimi', access: 'mobility' });
  assert.equal(plan.access, 'mobility');
  assert.equal(plan.recommended.route.medical, true);
  assert.equal(plan.recommended.shelter.accessible, true);
  assert.equal(plan.recommended.shelter.id, 'shelter-tofiq');
  assert.match(plan.notice, /Klinik prioritet/);
  assert.match(plan.notice, /28 May metro sığınacağı/);
  assert.match(plan.notice, /panduslu və ya maneəsiz deyil/);
  const medical = new Map(store.operatorState().roads.map((road) => [road.id, road.medical]));
  for (const id of plan.recommended.route.edgeIds) assert.equal(medical.get(id), true);

  const sent = store.addSos({
    type: 'medical',
    sessionId: 'mobility-user-01',
    zoneId: 'nasimi',
    role: 'mobility',
  });
  assert.equal(sent.signal.priority, 1);
  assert.equal(sent.signal.priorityStatus, 'KLİNİK PRİORİTET');
  assert.equal(sent.signal.role, 'mobility');
  assert.equal(store.operatorState().signals[0].id, sent.signal.id);

  const ordinary = store.addSos({
    type: 'fire',
    sessionId: 'ordinary-user-01',
    zoneId: 'yasamal',
  });
  assert.equal(ordinary.signal.priority, null);
  assert.equal(ordinary.signal.priorityStatus, null);

  const yasamal = store.plan({ zoneId: 'yasamal', access: 'mobility' });
  assert.equal(yasamal.recommended.shelter.id, 'shelter-temp-yasamal');
  assert.equal(yasamal.recommended.shelter.type, 'temporary');
  assert.equal(yasamal.recommended.shelter.accessKind, 'ramp');
  assert.ok(yasamal.recommended.route.durationMinutes < 2);
  assert.match(yasamal.notice, /Yasamal ərazisində pandus yoxdur/);
  assert.match(yasamal.notice, /Uzaq məntəqəyə vaxt sərf olunmur/);
  assert.equal(store.plan({ zoneId: 'yasamal' }).recommended.shelter.id, 'shelter-yasamal');

  const english = store.plan({ zoneId: 'nasimi', access: 'mobility', lang: 'en' });
  assert.match(english.notice, /Clinical priority/);
  assert.match(english.notice, /wheelchair or medical vehicle/);
});

test('routing 503 opens the circuit and keeps the local matrix route', async () => {
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response('unavailable', { status: 503 });
  };
  const { app } = createApp({ fetchImpl });
  const server = await listen(app);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const first = await request(base, '/api/citizen/plan', { method: 'POST', body: { zoneId: 'nasimi' } });
    const afterOutage = calls;
    const second = await request(base, '/api/citizen/plan', { method: 'POST', body: { zoneId: 'nasimi' } });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.ok(afterOutage >= 1);
    assert.equal(calls, afterOutage);
    assert.equal(first.body.routing.mode, 'backup');
    assert.equal(first.body.routing.source, 'matrix');
    assert.equal(first.body.routing.notice, BACKUP_NOTICE);
    assert.equal(first.body.recommended.route.provider, 'fallback');
    assert.ok(first.body.recommended.route.distanceMeters > 0);
    assert.ok(first.body.recommended.route.geometry.length >= 2);
    assert.equal(second.body.routing.notice, BACKUP_NOTICE);
    const english = await request(base, '/api/citizen/plan', {
      method: 'POST',
      body: { zoneId: 'nasimi', lang: 'en' },
    });
    assert.equal(english.body.routing.notice, 'Offline/Backup route mode is on');
  } finally {
    await close(server);
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', onUnhandled);
  }
  assert.equal(unhandled.length, 0);
});

test('routing timeout past the limit falls back without hanging', async () => {
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on('unhandledRejection', onUnhandled);
  const fetchImpl = (_url, { signal } = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(new Response('{}', { status: 200 })), 10_000);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });
  const { app } = createApp({ fetchImpl, routingTimeoutMs: 40 });
  const server = await listen(app);
  try {
    const started = Date.now();
    const plan = await request(`http://127.0.0.1:${server.address().port}`, '/api/citizen/plan', {
      method: 'POST',
      body: { zoneId: 'nasimi' },
    });
    assert.ok(Date.now() - started < 2000);
    assert.equal(plan.status, 200);
    assert.equal(plan.body.routing.mode, 'backup');
    assert.equal(plan.body.routing.notice, BACKUP_NOTICE);
    assert.ok(plan.body.recommended.route.distanceMeters > 0);
  } finally {
    await close(server);
    await new Promise((resolve) => setTimeout(resolve, 30));
    process.off('unhandledRejection', onUnhandled);
  }
  assert.equal(unhandled.length, 0);
});

test('a thrown routing client does not become an unhandled plan error', async () => {
  const fetchImpl = async () => {
    throw new Error('socket hang up');
  };
  const { app } = createApp({ fetchImpl });
  const server = await listen(app);
  try {
    const plan = await request(`http://127.0.0.1:${server.address().port}`, '/api/citizen/plan', {
      method: 'POST',
      body: { zoneId: 'nasimi' },
    });
    assert.equal(plan.status, 200);
    assert.equal(plan.body.routing.mode, 'backup');
    assert.equal(plan.body.recommended.route.provider, 'fallback');
  } finally {
    await close(server);
  }
});

function afterOpen(store, kind) {
  return store.operatorState().alerts.filter((alert) => alert.kind === kind && alert.status === 'open').length;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function dispatcherToken(base) {
  const login = await request(base, '/api/auth/login', {
    method: 'POST',
    body: { username: 'dispatcher', password: 'baki-dispetcer' },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, 'dispatcher');
  return login.body.token;
}

async function request(base, pathname, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
