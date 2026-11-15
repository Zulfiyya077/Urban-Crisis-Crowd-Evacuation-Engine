import {
  esc, percentLabel, tone, ago, clock, signalRef, request,
} from './format.js';
import { t, bindLanguage, getLang } from './i18n.js';
import { hazardIcon, hazardMark, mountMarks } from './icons.js';
import { drawCoverage } from './coverage.js';

const stats = document.querySelector('#stats');
const alarms = document.querySelector('#alarms');
const result = document.querySelector('#result');
const zonesBox = document.querySelector('#zones');
const feed = document.querySelector('#feed');
const resources = document.querySelector('#resources');
const detail = document.querySelector('#detail');
const clockNode = document.querySelector('#clock');
const board = document.querySelector('.board');

const map = L.map('map', { zoomControl: true, minZoom: 11 }).setView([40.395, 49.875], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
}).addTo(map);
const layer = L.layerGroup().addTo(map);

let latest = null;
let viewLang = null;
let paintedAt = 0;
let fitted = false;
let busy = false;
let selectedId = null;
const sosTypes = ['fire', 'collapse', 'flood', 'medical'];
let sosCursor = 0;

const TOKEN_KEY = 'uce-token';
const gate = document.querySelector('#gate');
const gateOut = document.querySelector('#gate-out');

mountMarks();
bindLanguage(() => refresh(true));
paintGate();
gate.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = await request('/api/auth/login', {
      method: 'POST',
      body: { username: gate.username.value, password: gate.password.value },
    });
    sessionStorage.setItem(TOKEN_KEY, body.token);
    gate.password.value = '';
    result.hidden = true;
    paintGate();
  } catch (error) {
    result.hidden = false;
    result.textContent = error.message;
  }
});
gateOut.addEventListener('click', () => {
  sessionStorage.removeItem(TOKEN_KEY);
  paintGate();
});
document.querySelector('#tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  board.dataset.tab = tab.dataset.tab;
  document.querySelectorAll('#tabs button').forEach((button) => {
    button.classList.toggle('is-on', button === tab);
  });
  if (window.matchMedia('(max-width: 980px)').matches) {
    document.querySelector('.tools').open = tab.dataset.tab === 'resources';
  }
  if (tab.dataset.tab === 'map') map.invalidateSize();
});

document.body.addEventListener('click', onClick);
resources.addEventListener('change', onOccupancy);

refresh(true);
const events = new EventSource('/api/events');
events.addEventListener('changed', () => refresh());
setInterval(tick, 1000);
setInterval(() => refresh(), 8000);

async function refresh(force = false) {
  try {
    const state = await request('/api/operator/state');
    const lang = getLang();
    if (!force && latest && latest.updatedAt === state.updatedAt && viewLang === lang) return;
    latest = state;
    viewLang = lang;
    renderChrome();
    renderMap();
  } catch (error) {
    alarms.innerHTML = `<p class="error">${esc(error.message)}</p>`;
  }
}

function renderChrome() {
  const state = latest;
  if (!state) return;
  document.title = state.summary.openAlerts ? t('title.alarm') : t('title.operator');
  stats.innerHTML = [
    ['stat.active', state.summary.activeSignals],
    ['stat.alerts', state.summary.openAlerts],
  ].map(([label, value]) => `<div><dt>${esc(t(label))}</dt><dd>${value}</dd></div>`).join('');

  const open = state.alerts.filter((alert) => alert.status === 'open');
  alarms.innerHTML = open.length ? `<div class="alarms">${open.map(alarmView).join('')}</div>` : '';

  const feedScroll = feed.scrollTop;
  const hot = state.zones.filter((zone) => zone.recentSignals >= state.policy.minDistinctSignals);
  zonesBox.hidden = hot.length === 0;
  zonesBox.innerHTML = hot
    .map((zone) => `<span class="chip hot">${esc(zone.name)} ${zone.recentSignals}/${state.policy.minDistinctSignals}</span>`)
    .join('');
  feed.innerHTML = state.signals.map(signalView).join('') || `<p class="hint">${esc(t('feed.empty'))}</p>`;
  feed.scrollTop = feedScroll;
  detail.innerHTML = detailView(state);

  const resourceScroll = resources.scrollTop;
  const selectedZone = document.querySelector('#demo-zone')?.value || 'nasimi';
  const confirmed = state.alerts.filter((alert) => alert.status === 'confirmed').slice(0, 4);
  const shelters = state.shelters.slice().sort((a, b) => b.percent - a.percent);
  const roads = state.roads.slice().sort((a, b) => Number(b.status === 'closed') - Number(a.status === 'closed') || a.name.localeCompare(b.name, getLang() === 'en' ? 'en' : 'az'));
  resources.innerHTML = `
    <section>
      <h2>${esc(t('section.shelters'))}</h2>
      ${shelters.map(shelterView).join('')}
    </section>
    <section class="group">
      <h2>${esc(t('section.brigades'))}</h2>
      ${state.brigades.map(brigadeView).join('')}
    </section>
    <section class="group">
      <h2>${esc(t('section.roads'))}</h2>
      ${roads.map(roadView).join('')}
    </section>
    <section class="group">
      <h2>${esc(t('section.scenario'))}</h2>
      <div class="demo">
        <select id="demo-zone">${state.zones.map((zone) => `<option value="${esc(zone.id)}" ${zone.id === selectedZone ? 'selected' : ''}>${esc(zone.name)}</option>`).join('')}</select>
        <button type="button" data-demo="signal">${esc(t('demo.signal'))}</button>
        <button type="button" data-demo="cluster">${esc(t('demo.cluster'))}</button>
        <button type="button" data-demo="full">${esc(t('demo.full'))}</button>
        <p class="hint">${esc(t('demo.hint'))}</p>
      </div>
    </section>
    <section class="group">
      <h2>${esc(t('section.decisions'))}</h2>
      ${confirmed.map(decisionView).join('') || `<p class="hint">${esc(t('decisions.empty'))}</p>`}
    </section>
  `;
  resources.scrollTop = resourceScroll;
}

function renderMap() {
  const state = latest;
  layer.clearLayers();
  const selected = state.signals.find((item) => item.id === selectedId);
  drawCoverage(state.zones, selected?.zoneId, layer);
  for (const road of state.roads.filter((item) => item.status === 'closed')) {
    L.polyline([[road.from.lat, road.from.lng], [road.to.lat, road.to.lng]], {
      color: '#DC3545', weight: 5, dashArray: '6 7',
    }).bindPopup(esc(t('road.closedPopup', { name: road.name }))).addTo(layer);
  }
  for (const brigade of state.brigades) {
    if (!brigade.destination) continue;
    L.polyline([[brigade.lat, brigade.lng], [brigade.destination.lat, brigade.destination.lng]], {
      color: '#F97316', weight: 2, dashArray: '4 6',
    }).addTo(layer);
  }
  for (const shelter of state.shelters) {
    L.marker([shelter.lat, shelter.lng], { icon: pin(tone(shelter.percent), percentLabel(shelter.percent)) })
      .bindPopup(`<strong>${esc(shelter.name)}</strong><br>${percentLabel(shelter.percent)}%`)
      .addTo(layer);
  }
  for (const signal of state.signals.filter((item) => item.status === 'active' && item.type !== 'checkin')) {
    L.marker([signal.lat, signal.lng], {
      icon: hazardPin(signal.type),
      title: t('type.' + signal.type),
      zIndexOffset: signal.id === selectedId ? 900 : 500,
    })
      .bindPopup(`${esc(t('type.' + signal.type))} · ${esc(signal.zoneName)}`)
      .addTo(layer);
  }
  for (const brigade of state.brigades) {
    L.marker([brigade.lat, brigade.lng], { icon: pin('brigade', 'B'), zIndexOffset: 400 })
      .bindPopup(`<strong>${esc(brigade.name)}</strong><br>${esc(t('brigade.' + brigade.status))}`)
      .addTo(layer);
  }
  for (const alert of state.alerts.filter((item) => item.status === 'open')) {
    if (alert.kind === 'cluster-radius') {
      L.circle([alert.lat, alert.lng], { radius: state.policy.clusterRadiusMeters, color: '#DC3545', weight: 1, fillOpacity: 0.08 }).addTo(layer);
    }
    L.marker([alert.lat, alert.lng], { icon: pin('alert', '!'), zIndexOffset: 700 })
      .bindPopup(esc(alert.message))
      .addTo(layer);
  }
  map.invalidateSize();
  if (!fitted && state.shelters.length) {
    const bounds = L.latLngBounds(state.shelters.map((shelter) => [shelter.lat, shelter.lng]));
    map.fitBounds(bounds.pad(0.15));
    fitted = true;
  }
  paintedAt = state.updatedAt;
}

window.addEventListener('resize', () => map.invalidateSize());

function tick() {
  clockNode.textContent = clock();
  if (!latest || latest.updatedAt !== paintedAt) return;
  document.querySelectorAll('.ago').forEach((node) => {
    node.textContent = ago(Number(node.dataset.t));
  });
}

async function onClick(event) {
  const select = event.target.closest('[data-select]');
  if (select && !event.target.closest('[data-confirm], [data-demo], [data-road]')) {
    selectedId = select.dataset.select;
    renderChrome();
    renderMap();
    return;
  }
  const confirm = event.target.closest('[data-confirm]');
  const demo = event.target.closest('[data-demo]');
  const road = event.target.closest('[data-road]');
  if (!confirm && !demo && !road) return;
  if (busy) return;
  if (confirm && !window.confirm(t('alarm.ask'))) return;
  busy = true;
  try {
    if (confirm) {
      confirm.disabled = true;
      const body = await request(`/api/operator/alerts/${confirm.dataset.confirm}/confirm`, { method: 'POST' });
      const extra = body.brigade.name.startsWith('Əlavə briqada') ? t('toast.reserve') : '';
      result.hidden = false;
      result.textContent = t('toast.sent', { brigade: body.brigade.name, extra, shelter: body.shelter.name });
    } else if (road) {
      await request(`/api/operator/roads/${road.dataset.road}/toggle`, { method: 'POST' });
    } else if (demo) {
      await runDemo(demo.dataset.demo);
    }
    await refresh(true);
  } catch (error) {
    noteAuth(error);
  } finally {
    busy = false;
  }
}

async function onOccupancy(event) {
  const input = event.target.closest('[data-shelter]');
  if (!input) return;
  try {
    await request(`/api/operator/shelters/${input.dataset.shelter}/occupancy`, {
      method: 'POST',
      body: { percent: Number(input.value) },
    });
    await refresh(true);
  } catch (error) {
    noteAuth(error);
  }
}

function paintGate() {
  const signedIn = Boolean(sessionStorage.getItem(TOKEN_KEY));
  document.querySelector('.shell').classList.toggle('signed-in', signedIn);
  gate.hidden = signedIn;
  gateOut.hidden = !signedIn;
  requestAnimationFrame(() => map.invalidateSize());
}

function noteAuth(error) {
  if (error.status === 401 || error.status === 403) {
    sessionStorage.removeItem(TOKEN_KEY);
    paintGate();
  }
  result.hidden = false;
  result.textContent = error.message;
}

async function runDemo(kind) {
  const zoneId = document.querySelector('#demo-zone')?.value || 'nasimi';
  if (kind === 'signal') {
    const type = sosTypes[sosCursor % sosTypes.length];
    sosCursor += 1;
    await request('/api/operator/demo/signal', { method: 'POST', body: { zoneId, type } });
  } else if (kind === 'cluster') {
    await request('/api/operator/demo/cluster', { method: 'POST', body: { zoneId } });
  } else if (kind === 'full') {
    await request('/api/operator/shelters/shelter-28may/occupancy', { method: 'POST', body: { percent: 96 } });
  }
}

function alarmView(alert) {
  return `
    <article class="alarm" role="alert">
      <div>
        <p class="kicker">${esc(t('alarm.kicker', { zone: alert.zoneName }))}</p>
        <h3>${esc(alert.message)}</h3>
        <p>${esc(alert.detail)}</p>
      </div>
      <button type="button" data-confirm="${esc(alert.id)}">${esc(t('alarm.confirm'))}</button>
    </article>
  `;
}

function signalView(signal) {
  const safe = signal.status === 'safe';
  const on = signal.id === selectedId;
  return `
    <button type="button" class="signal ${safe ? 'safe' : ''} ${signal.type === 'checkin' ? 'checkin' : ''} ${signal.priority === 1 ? 'priority' : ''} ${on ? 'is-on' : ''}" data-select="${esc(signal.id)}" aria-pressed="${on}">
      ${hazardMark(signal.type)}
      <span class="signal-copy">
        <span class="who">${esc(t('type.' + signal.type))}</span>
        <span class="meta">${esc(signal.zoneName)} · ${safe ? esc(t('signal.safe')) : esc(t('signal.active'))}</span>
      </span>
      <time class="ago" data-t="${signal.createdAt}">${ago(signal.createdAt)}</time>
      ${signal.priority === 1 ? `<span class="priority-badge">${esc(t('priority.badge'))}</span>` : ''}
    </button>
  `;
}

function detailView(state) {
  const signal = state.signals.find((item) => item.id === selectedId);
  if (!signal) return `<p class="hint">${esc(t('detail.empty'))}</p>`;
  const safe = signal.status === 'safe';
  return `
    <article class="picked">
      <p class="kicker">${esc(signalRef(signal.id))}</p>
      <h2>${esc(t('type.' + signal.type))}</h2>
      ${signal.priority === 1 ? `<p class="priority-badge">${esc(t('priority.badge'))}</p>` : ''}
      <dl>
        <div><dt>${esc(t('detail.where'))}</dt><dd>${esc(signal.zoneName)}</dd></div>
        <div><dt>${esc(t('detail.when'))}</dt><dd class="ago" data-t="${signal.createdAt}">${ago(signal.createdAt)}</dd></div>
        <div><dt>${esc(t('detail.status'))}</dt><dd>${safe ? esc(t('signal.safe')) : esc(t('signal.active'))}</dd></div>
      </dl>
    </article>
  `;
}

function shelterView(shelter) {
  return `
    <article class="resource">
      <div class="spread">
        <h3>${esc(shelter.name)}</h3>
        <strong class="tone-${tone(shelter.percent)}">${percentLabel(shelter.percent)}%</strong>
      </div>
      <p class="meta">${esc(t('place.' + shelter.type))}</p>
      <div class="bar"><span class="tone-${tone(shelter.percent)}" style="width:${Math.min(shelter.percent, 100)}%"></span></div>
      <input type="range" min="0" max="100" step="1" value="${Math.round(shelter.percent)}" data-shelter="${esc(shelter.id)}" aria-label="${esc(t('occupancy.label', { name: shelter.name }))}" />
    </article>
  `;
}

function brigadeView(brigade) {
  const where = brigade.assignedZoneName && brigade.status === 'dispatched'
    ? t('brigade.going', { zone: brigade.assignedZoneName })
    : brigade.zoneName;
  return `
    <article class="resource">
      <div class="spread">
        <h3>${esc(brigade.name)}</h3>
        <span class="pill ${esc(brigade.status)}">${esc(t('brigade.' + brigade.status))}</span>
      </div>
      <p class="meta">${esc(where)}${brigade.task ? ` · ${esc(brigade.task)}` : ''}</p>
    </article>
  `;
}

function roadView(road) {
  const closed = road.status === 'closed';
  return `
    <article class="road">
      <div class="spread">
        <h3>${esc(road.name)}</h3>
        <button type="button" data-road="${esc(road.id)}">${closed ? esc(t('road.openAction')) : esc(t('road.closeAction'))}</button>
      </div>
      <p class="meta">${esc(road.from.name)} → ${esc(road.to.name)} · ${closed ? esc(t('road.closed')) : esc(t('road.open'))} · ${esc(t('road.minutes', { n: road.travelMinutes }))}</p>
    </article>
  `;
}

function decisionView(alert) {
  const done = alert.resolution;
  return `
    <article class="decision">
      <strong>${esc(alert.detail)}</strong>
      <p class="meta">${done ? esc(t('decision.done', { brigade: done.brigadeName, shelter: done.shelterName })) : ''}</p>
    </article>
  `;
}

function hazardPin(type) {
  return L.divIcon({
    className: 'pin',
    html: `<span class="pin-dot ${type}" title="${esc(t('type.' + type))}">${hazardIcon(type)}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function pin(kind, text) {
  return L.divIcon({
    className: 'pin',
    html: `<span class="pin-dot ${kind}">${esc(text)}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
