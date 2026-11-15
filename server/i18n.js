import { ALERT_MESSAGE } from './config.js';

export function requestLang(req) {
  const raw = String(req.query?.lang || req.body?.lang || req.get?.('accept-language') || 'az').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'az';
}

export function localizeAlert(alert, lang = 'az') {
  const params = alert.params || {};
  if (lang !== 'en') {
    return { message: alert.message || ALERT_MESSAGE, detail: alert.detail };
  }
  const message = 'Send an additional rescue brigade and open a new gathering point';
  if (alert.kind === 'cluster-zone') {
    return { message, detail: `${params.zoneName}: ${params.count} different SOS signals in 5 minutes` };
  }
  if (alert.kind === 'cluster-radius') {
    return { message, detail: `500 m radius: ${params.count} different SOS signals in 5 minutes (${params.zones})` };
  }
  if (alert.kind === 'occupancy') {
    return {
      message,
      detail: `${params.shelterName} is ${params.percent}% full (> ${params.threshold}%). ${params.zoneName}`,
    };
  }
  return { message, detail: alert.detail };
}

export function routeCopy(lang, key, params = {}) {
  const pack = lang === 'en' ? enRoute : azRoute;
  return pack[key](params);
}

const azRoute = {
  full: ({ name, percent }) => `${name} ${percent}% doludur, ona görə bu məntəqə tövsiyə olunmur.`,
  blocked: ({ name, roads }) => `${name} istiqamətində yol bağlıdır: ${roads}.`,
  detour: ({ roads }) => `${roads} bağlıdır, ona görə dolayısı marşrut seçildi.`,
  instead: ({ roads, name }) => `${roads} bağlı olduğu üçün ${name} əvəzinə başqa marşrut seçildi.`,
  notice: ({ body }) => `Avtomatik alternativ marşrut. ${body}`,
  occupancy: ({ percent, threshold }) => `Doluluq ${percent}% (≥ ${threshold}%)`,
  road: ({ roads }) => `Yol bağlıdır: ${roads}`,
  unreachable: () => 'Açıq marşrut yoxdur',
  notAccessible: () => 'Pandus və ya maneəsiz giriş yoxdur.',
  noMedical: () => 'Əlil arabası və tibbi nəqliyyat üçün açıq marşrut yoxdur.',
  clinicalNotice: () => 'Klinik prioritet. Marşrut yalnız panduslu və ya maneəsiz məntəqəyə, əlil arabası və tibbi nəqliyyatın keçdiyi küçələrlə təyin edildi.',
  skipAccess: ({ name }) => `${name} panduslu və ya maneəsiz deyil, ona görə təyin edilmir.`,
  localRamp: ({ zone, name }) => `${zone} ərazisində pandus yoxdur, ona görə ${name} açıldı. Uzaq məntəqəyə vaxt sərf olunmur.`,
};

const enRoute = {
  full: ({ name, percent }) => `${name} is ${percent}% full, so this point is not recommended.`,
  blocked: ({ name, roads }) => `The road toward ${name} is closed: ${roads}.`,
  detour: ({ roads }) => `${roads} is closed, so a detour was selected.`,
  instead: ({ roads, name }) => `${roads} is closed, so another route was selected instead of ${name}.`,
  notice: ({ body }) => `Automatic alternative route. ${body}`,
  occupancy: ({ percent, threshold }) => `Occupancy ${percent}% (≥ ${threshold}%)`,
  road: ({ roads }) => `Road closed: ${roads}`,
  unreachable: () => 'No open route',
  notAccessible: () => 'No ramp or barrier-free entrance.',
  noMedical: () => 'No open route for a wheelchair or medical vehicle.',
  clinicalNotice: () => 'Clinical priority. The route uses only a ramp or barrier-free point that a wheelchair or medical vehicle can reach.',
  skipAccess: ({ name }) => `${name} has no ramp or barrier-free entrance, so it is not assigned.`,
  localRamp: ({ zone, name }) => `${zone} has no ramp, so ${name} was opened here. Time is not spent traveling to a distant point.`,
};

export function errorText(code, lang) {
  const pack = lang === 'en' ? enErrors : null;
  return pack?.[code] || null;
}

const enErrors = {
  SHELTER_NOT_FOUND: 'Gathering point not found',
  BAD_PERCENT: 'Occupancy must be between 0 and 100',
  ROAD_NOT_FOUND: 'Road segment not found',
  ALERT_NOT_FOUND: 'Alert not found',
  ALREADY_CONFIRMED: 'This decision has already been carried out',
  ZONE_NOT_FOUND: 'District not found',
  BAD_TYPE: 'Unknown hazard type',
  BAD_ORIGIN: 'Choose a coordinate or a district',
  OUT_OF_CITY: 'The coordinate is outside Baku. Choose a district.',
  BAD_SESSION: 'Invalid session identifier',
  RATE_LIMIT: 'Too many SOS signals. Wait a moment and try again.',
  UNAUTHORIZED: 'Dispatcher sign-in is required',
  FORBIDDEN: 'This action requires the dispatcher role',
  BAD_LOGIN: 'Sign-in was rejected',
};
