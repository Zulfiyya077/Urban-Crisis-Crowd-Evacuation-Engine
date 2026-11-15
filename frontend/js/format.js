import { getLang, t } from './i18n.js';

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function signalRef(id) {
  const text = String(id || '');
  if (!text.startsWith('sos_')) return text;
  return `SOS-${text.slice(4).replaceAll('_', '-').toUpperCase()}`;
}

export function percentLabel(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  if (!Number.isFinite(rounded)) return '0';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function tone(percent) {
  if (percent >= 90) return 'bad';
  if (percent >= 70) return 'warn';
  return 'ok';
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return t('time.under');
  return t('time.min', { n: Math.round(minutes) });
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function ago(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return t('time.secAgo', { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('time.minAgo', { n: minutes });
  return t('time.hourAgo', { n: Math.round(minutes / 60) });
}

export function clock(timestamp = Date.now()) {
  return new Date(timestamp).toLocaleTimeString(getLang() === 'en' ? 'en-GB' : 'az-AZ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export async function request(url, options = {}) {
  const headers = { 'Accept-Language': getLang() };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (url.startsWith('/api/operator')) {
    const token = sessionStorage.getItem('uce-token');
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(body?.error || t('error.request'));
    error.status = response.status;
    throw error;
  }
  return body;
}
