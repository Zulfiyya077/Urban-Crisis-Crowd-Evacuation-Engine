import {
  esc, percentLabel, tone, formatDuration, formatDistance, ago, signalRef, request,
} from './format.js';
import { t, bindLanguage } from './i18n.js?v=20261116b';
import { mountMarks } from './icons.js';
import { drawCoverage } from './coverage.js';

const district = document.querySelector('#district');
const decision = document.querySelector('#decision');
const originLine = document.querySelector('#origin');
const statusLine = document.querySelector('#status');
const policyLine = document.querySelector('#policy');
const safeButton = document.querySelector('#safe');
const mobilityBox = document.querySelector('#mobility');

const sessionId = loadSession();
let mode = { type: 'zone', zoneId: 'nasimi' };
let planToken = 0;
let shownShelterId = null;
let fitKey = '';
let zones = [];
let policy = null;
let statusState = { kind: 'idle' };
let safeMode = 'idle';
let reports = [];

const layout = document.querySelector('.layout');
let latestPlan = null;
let mapShown = false;

const map = L.map('map', { zoomControl: true, minZoom: 11 }).setView([40.395, 49.875], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);
const layer = L.layerGroup().addTo(map);

mountMarks();
document.querySelector('#tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  selectTab(tab.dataset.tab);
});
document.querySelector('.skip')?.addEventListener('click', () => selectTab('sos'));
bindLanguage(() => {
  paintPolicy();
  paintStatus();
  renderReports();
  refreshPlan();
});
window.addEventListener('online', () => setOnline(true));
window.addEventListener('offline', () => setOnline(false));

district.addEventListener('change', () => {
  if (!district.value) return;
  mode = { type: 'zone', zoneId: district.value };
  refreshPlan();
});

document.querySelector('#locate').addEventListener('click', () => {
  if (!navigator.geolocation) {
    setStatus('noGeo');
    return;
  }
  setStatus('locating');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      mode = { type: 'point', lat: position.coords.latitude, lng: position.coords.longitude };
      district.value = '';
      refreshPlan();
    },
    () => setStatus('geoFail'),
    { enableHighAccuracy: true, timeout: 8000 },
  );
});

map.on('click', (event) => {
  mode = { type: 'point', lat: event.latlng.lat, lng: event.latlng.lng };
  district.value = '';
  refreshPlan();
});

document.querySelector('.sos-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-sos]');
  if (!button) return;
  sendSos(button.dataset.sos);
});

safeButton.addEventListener('click', markSafe);
mobilityBox.checked = localStorage.getItem('uce-mobility') === '1';
mobilityBox.addEventListener('change', () => {
  localStorage.setItem('uce-mobility', mobilityBox.checked ? '1' : '0');
  refreshPlan();
});

boot();

async function boot() {
  try {
    const meta = await request('/api/citizen/zones');
    zones = meta.zones;
    policy = meta.policy;
    district.innerHTML = zones.map((zone) => `<option value="${esc(zone.id)}">${esc(zone.name)}</option>`).join('');
    district.value = 'nasimi';
    paintPolicy();
    setOnline(navigator.onLine);
    await Promise.all([refreshPlan(), refreshStatus()]);
    const events = new EventSource('/api/events');
    events.addEventListener('changed', () => refreshPlan());
  } catch (error) {
    setOnline(Boolean(error.status));
    decision.textContent = error.message;
  }
}

function paintPolicy() {
  if (!policy) return;
  policyLine.textContent = t('policy', { avoid: policy.shelterAvoidPercent });
}

async function refreshPlan() {
  const token = ++planToken;
  try {
    const plan = await request('/api/citizen/plan', { method: 'POST', body: payload() });
    if (token !== planToken) return;
    shownShelterId = plan.recommended?.shelter.id || null;
    setOnline(true);
    renderDecision(plan);
    draw(plan);
  } catch (error) {
    if (token !== planToken) return;
    setOnline(Boolean(error.status));
    decision.innerHTML = `<p class="notice">${esc(error.message)}</p>`;
  }
}

function renderDecision(plan) {
  const zone = zones.find((item) => item.id === plan.origin.zoneId);
  if (district.value && zone) district.value = plan.origin.zoneId;
  originLine.textContent = plan.origin.source === 'coordinates'
    ? t('origin.point', {
      lat: plan.origin.lat.toFixed(5),
      lng: plan.origin.lng.toFixed(5),
      zone: plan.origin.zoneName,
    })
    : t('origin.zone', { zone: plan.origin.zoneName });

  if (!plan.recommended) {
    decision.innerHTML = `<p class="notice">${esc(t('plan.empty'))}</p>`;
    return;
  }

  const picked = findRoute(plan, shownShelterId) || plan.recommended;
  const backup = plan.routing?.mode === 'backup'
    ? `<p class="notice backup" role="status">${esc(t('routing.backup'))}</p>`
    : '';
  const notice = plan.notice ? `<p class="notice">${esc(plan.notice)}</p>` : '';
  const extra = [
    ...plan.alternatives.map((item) => routeRow(item)),
    ...plan.avoided.map((item) => `<article class="avoid"><strong>${esc(item.shelter.name)}</strong> · ${item.reasons.map(esc).join(' ')}</article>`),
  ].join('');
  const more = extra
    ? `<details class="more"><summary>${esc(t('plan.more'))}</summary><div class="stack">${extra}</div></details>`
    : '';
  const source = plan.routing?.mode === 'backup'
    ? t('source.backup')
    : plan.routing?.provider === 'osrm' ? t('source.osrm') : t('source.sim');

  decision.innerHTML = `
    ${backup}
    ${notice}
    <p class="next-step">${esc(t('plan.next'))}</p>
    ${shelterCard(picked, true)}
    ${more}
    <p class="footnote">${esc(t('plan.source', { source }))}</p>
  `;
  decision.querySelectorAll('[data-show]').forEach((button) => {
    button.addEventListener('click', () => {
      shownShelterId = button.dataset.show;
      renderDecision(plan);
      draw(plan);
    });
  });
}

function shelterCard(item, primary) {
  const shelter = item.shelter;
  const route = item.route;
  const badge = route.alternative ? t('plan.alt') : t('plan.best');
  const roads = route.roads.length ? route.roads.join(' · ') : t('plan.here');
  return `
    <article class="${primary ? 'card' : 'alt'}">
      <div>
        <div class="card-head">
          <span class="kind">${esc(t('place.' + shelter.type))}</span>
          <span class="badge">${esc(badge)}</span>
        </div>
        <h3>${esc(shelter.name)}</h3>
        <div class="metrics">
          <span>${formatDuration(route.durationMinutes)}</span>
          <span>${formatDistance(route.distanceMeters)}</span>
          <span class="pct tone-${tone(shelter.percent)}">${esc(t('plan.full', { n: percentLabel(shelter.percent) }))}</span>
        </div>
        <div class="bar" aria-hidden="true"><span class="tone-${tone(shelter.percent)}" style="width:${Math.min(shelter.percent, 100)}%"></span></div>
        <p class="roads">${esc(roads)}</p>
        ${shelter.accessible ? `<p class="access-note">${esc(t('access.' + shelter.accessKind))}</p>` : ''}
      </div>
    </article>
  `;
}

function routeRow(item) {
  return `
    <article class="alt">
      <div>
        <strong>${esc(item.shelter.name)}</strong>
        <div class="muted">${formatDuration(item.route.durationMinutes)} · ${esc(t('plan.full', { n: percentLabel(item.shelter.percent) }))}</div>
      </div>
      <button type="button" class="textish" data-show="${esc(item.shelter.id)}">${esc(t('plan.show'))}</button>
    </article>
  `;
}

function selectTab(name) {
  layout.dataset.tab = name;
  document.querySelectorAll('#tabs button').forEach((button) => {
    button.classList.toggle('is-on', button.dataset.tab === name);
  });
  if (name !== 'map') return;
  requestAnimationFrame(() => {
    map.invalidateSize();
    if (!mapShown) {
      mapShown = true;
      fitKey = '';
      if (latestPlan) draw(latestPlan);
    }
  });
}

function draw(plan) {
  latestPlan = plan;
  layer.clearLayers();
  drawCoverage(zones, plan.origin.zoneId, layer);
  for (const road of plan.closedRoads) {
    L.polyline([[road.from.lat, road.from.lng], [road.to.lat, road.to.lng]], {
      color: '#DC3545', weight: 5, dashArray: '7 7', opacity: 0.9,
    }).bindPopup(esc(t('map.closed', { name: road.name }))).addTo(layer);
  }

  const picked = findRoute(plan, shownShelterId) || plan.recommended;
  const places = [plan.recommended, ...plan.alternatives, ...plan.avoided.map((item) => ({ shelter: item.shelter, route: null }))]
    .filter(Boolean);
  const seen = new Set();
  for (const item of places) {
    if (seen.has(item.shelter.id)) continue;
    seen.add(item.shelter.id);
    const selected = picked && item.shelter.id === picked.shelter.id;
    const marker = L.marker([item.shelter.lat, item.shelter.lng], {
      icon: pin(tone(item.shelter.percent), percentLabel(item.shelter.percent)),
      zIndexOffset: selected ? 600 : 0,
    });
    marker.bindPopup(`<strong>${esc(item.shelter.name)}</strong><br>${esc(t('place.' + item.shelter.type))} · ${percentLabel(item.shelter.percent)}%`);
    marker.on('click', (event) => {
      if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      if (!item.route) return;
      shownShelterId = item.shelter.id;
      renderDecision(plan);
      draw(plan);
    });
    marker.addTo(layer);
  }

  map.invalidateSize();
  if (picked?.route?.geometry?.length) {
    const routeLine = L.polyline(picked.route.geometry.map((point) => [point.lat, point.lng]), {
      color: picked.route.alternative ? '#F97316' : '#176B87',
      weight: 6,
      opacity: 0.95,
      smoothFactor: 0.2,
      dashArray: picked.route.alternative ? '10 8' : null,
    }).addTo(layer);
    const key = `${plan.origin.lat.toFixed(4)}:${plan.origin.lng.toFixed(4)}:${picked.shelter.id}:${picked.route.alternative}`;
    if (key !== fitKey) {
      map.fitBounds(routeLine.getBounds().pad(0.25));
      fitKey = key;
    }
  }

  L.marker([plan.origin.lat, plan.origin.lng], { icon: pin('you', t('map.youShort')), zIndexOffset: 800 })
    .bindPopup(esc(t('map.you')))
    .addTo(layer);
}

window.addEventListener('resize', () => map.invalidateSize());

async function sendSos(type) {
  setBusy(true);
  try {
    const result = await request('/api/citizen/sos', {
      method: 'POST',
      body: { type, sessionId, role: mobilityBox.checked ? 'mobility' : 'general', ...payload() },
    });
    setStatus(result.signal.priority === 1 ? 'priority' : result.duplicate ? 'duplicate' : 'sent', {
      type,
      zone: result.signal.zoneName,
      id: signalRef(result.signal.id),
    });
    await refreshStatus();
  } catch (error) {
    setStatus('error', { text: error.message });
  } finally {
    setBusy(false);
  }
}

async function markSafe() {
  if (safeButton.dataset.busy === '1') return;
  safeButton.dataset.busy = '1';
  safeButton.disabled = true;
  try {
    await request('/api/citizen/safe', { method: 'POST', body: { sessionId, ...payload() } });
    await refreshStatus();
    if (safeMode !== 'alert') setStatus('safe');
  } catch (error) {
    setStatus('error', { text: error.message });
  } finally {
    delete safeButton.dataset.busy;
    paintSafeButton();
  }
}

async function refreshStatus() {
  try {
    const status = await request(`/api/citizen/status?sessionId=${encodeURIComponent(sessionId)}`);
    reports = status.signals || [];
    renderReports();
    setOnline(true);
    safeMode = status.status;
    paintSafeButton();
    if (status.status === 'alert' && statusState.kind !== 'sent' && statusState.kind !== 'duplicate' && statusState.kind !== 'priority') {
      setStatus('activeHint');
    } else if (status.status === 'safe' && statusState.kind === 'idle') {
      setStatus('lastSafe');
    }
  } catch (error) {
    setOnline(Boolean(error.status));
  }
}

function renderReports() {
  const box = document.querySelector('#reports');
  const list = document.querySelector('#report-list');
  if (!reports.length) {
    box.hidden = true;
    list.innerHTML = '';
    return;
  }
  box.hidden = false;
  list.innerHTML = reports.slice(0, 5).map((signal) => `
    <li>
      <strong>${esc(t('type.' + signal.type))}</strong>
      <span>${esc(signal.zoneName)} · ${esc(signalRef(signal.id))} · ${esc(signal.status === 'safe' ? t('signal.safe') : t('signal.active'))}</span>
      <time>${ago(signal.createdAt)}</time>
    </li>
  `).join('');
}

function setOnline(ok) {
  const node = document.querySelector('#net');
  node.hidden = ok;
  node.textContent = ok ? '' : t('net.offline');
}

function payload() {
  const body = mode.type === 'zone' ? { zoneId: mode.zoneId } : { lat: mode.lat, lng: mode.lng };
  if (mobilityBox.checked) body.access = 'mobility';
  return body;
}

function findRoute(plan, shelterId) {
  return [plan.recommended, ...plan.alternatives].find((item) => item && item.shelter.id === shelterId) || null;
}

function setStatus(kind, extra = {}) {
  statusState = { kind, ...extra };
  paintStatus();
}

const SPOKEN = new Set(['sent', 'duplicate', 'priority', 'error', 'locating', 'noGeo', 'geoFail']);

function paintStatus() {
  const state = statusState;
  const next = document.querySelector('#next');
  const showNext = state.kind === 'sent' || state.kind === 'priority' || state.kind === 'activeHint';
  next.hidden = !showNext;
  next.textContent = showNext ? t('status.next') : '';
  if (state.kind === 'error') statusLine.textContent = state.text || '';
  else if (state.kind === 'sent' || state.kind === 'duplicate' || state.kind === 'priority') {
    statusLine.textContent = t('status.' + state.kind, { type: t('type.' + state.type), zone: state.zone, id: state.id });
  } else statusLine.textContent = t('status.' + state.kind);
  statusLine.hidden = statusLine.textContent === '';
  if (state.kind === 'safe') speak(t('citizen.safeDone'));
  else if (statusLine.textContent && SPOKEN.has(state.kind)) speak(statusLine.textContent);
  paintSafeButton();
}

function paintSafeButton() {
  const done = safeMode === 'safe';
  safeButton.classList.toggle('is-next', safeMode === 'alert');
  safeButton.classList.toggle('is-done', done);
  safeButton.disabled = safeButton.dataset.busy === '1';
  safeButton.setAttribute('aria-pressed', String(done));
  safeButton.textContent = t(done ? 'citizen.safeDone' : 'citizen.safe');
}

function speak(text) {
  const node = document.querySelector('#sos-alert');
  node.textContent = '';
  window.setTimeout(() => {
    node.textContent = text;
  }, 40);
}

function setBusy(busy) {
  document.querySelectorAll('[data-sos], #safe').forEach((button) => {
    button.disabled = busy;
  });
  if (!busy) paintSafeButton();
}

function pin(kind, text) {
  const size = kind === 'you' ? 52 : 32;
  return L.divIcon({
    className: 'pin',
    html: `<span class="pin-dot tone-${kind}">${esc(text)}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function loadSession() {
  const key = 'uce-session';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}
