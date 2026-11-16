const KEY = 'uce-lang';

const az = {
  'title.citizen': 'Təxliyə · Bakı',
  'title.operator': 'Dispetçer · Bakı',
  'title.alarm': '● Həyəcan · Dispetçer',
  'nav.operator': 'Dispetçer paneli',
  'nav.citizen': 'Vətəndaş səhifəsi',
  'lang.group': 'Dil',
  'lang.az': 'Azərbaycan dili',
  'lang.en': 'English',
  'citizen.kicker': 'Bakı · fövqəladə təxliyə',
  'citizen.title': 'Təxliyə',
  'citizen.district': 'Yer',
  'citizen.locate': 'Yerimi tap',
  'citizen.origin': 'Rayon mərkəzi. Xəritəyə klikləsəniz, koordinat götürülər.',
  'citizen.loading': 'Məlumat yüklənir…',
  'a11y.skipSos': 'SOS siqnalına keç',
  'citizen.sos': 'Təhlükəni bildirin',
  'citizen.safe': 'Təhlükədəyəm',
  'citizen.safeDone': 'Təhlükəsizəm',
  'citizen.mapNote': 'Qırmızı xətt bağlı yoldur.',
  'operator.kicker': 'Bakı böhran mərkəzi',
  'operator.title': 'Dispetçer',
  'tab.map': 'Xəritə',
  'tab.feed': 'SOS',
  'tab.route': 'Yol',
  'tab.resources': 'Resurslar',
  'feed.title': 'Siqnallar',
  'section.tools': 'Resurslar',
  'detail.empty': 'Siqnal seçin',
  'detail.where': 'Yer',
  'detail.when': 'Vaxt',
  'detail.status': 'Status',
  'alarm.ask': 'Əlavə briqada göndərilsin və yeni toplanış nöqtəsi açılsın?',
  'gate.need': 'Briqada və yol üçün giriş',
  'gate.user': 'İstifadəçi',
  'gate.pass': 'Şifrə',
  'gate.in': 'Giriş',
  'gate.out': 'Çıxış',
  'type.fire': 'Yanğın',
  'type.collapse': 'Zəlzələ',
  'type.flood': 'Daşqın',
  'type.medical': 'Tibbi yardım',
  'type.checkin': 'Təhlükəsizəm',
  'place.shelter': 'Sığınacaq',
  'place.park': 'Park',
  'place.stadium': 'Stadion',
  'place.temporary': 'Müvəqqəti məntəqə',
  'brigade.available': 'Hazır',
  'brigade.dispatched': 'Yolda',
  'brigade.on_scene': 'Hadisə yerində',
  'status.idle': 'Status göndərilməyib',
  'status.locating': 'Yer axtarılır…',
  'status.noGeo': 'Bu brauzer yer xidmətini dəstəkləmir. Rayon seçin.',
  'status.geoFail': 'Yer müəyyən edilmədi. Rayon seçin.',
  'status.sent': ({ type, zone, id }) => `Qəbul olundu · ${type} · ${zone} · İstinad ${id}`,
  'status.duplicate': ({ type, id }) => `${type} artıq qəbul olunub · İstinad ${id}`,
  'status.safe': '',
  'status.lastSafe': '',
  'status.activeHint': 'SOS aktivdir.',
  'status.next': 'Təhlükə ötəndə «Təhlükədəyəm» düyməsini basın.',
  'status.priority': ({ type, zone, id }) => `KLİNİK PRİORİTET · №1 · ${type} · ${zone} · İstinad ${id}`,
  'role.title': 'Hərəkət məhdudiyyəti',
  'role.hint': 'Klinik prioritet. Yalnız panduslu və maneəsiz yol.',
  'access.ramp': 'Pandus · əlil arabası və tibbi nəqliyyat',
  'access.barrier-free': 'Maneəsiz · əlil arabası və tibbi nəqliyyat',
  'priority.badge': 'KLİNİK PRİORİTET · №1',
  'policy': ({ avoid }) =>
    `Məntəqə ${avoid}% dolduqda və ya yol bağlandıqda alternativ marşrut açılır.`,
  'origin.point': ({ lat, lng, zone }) => `Koordinat: ${lat}, ${lng} · ${zone}`,
  'origin.zone': ({ zone }) => `${zone} · rayon mərkəzi`,
  'plan.empty': 'Açıq marşrut tapılmadı. Başqa nöqtə seçin və ya yeni məntəqə açılana qədər gözləyin.',
  'plan.next': 'Növbəti addım: bu məntəqəyə gedin',
  'plan.more': 'Digər marşrutlar',
  'plan.show': 'Xəritədə göstər',
  'reports.title': 'Mənim siqnallarım',
  'net.offline': 'Şəbəkə yoxdur. Siqnal göndərilməyibsə, yenidən cəhd edin.',
  'plan.alt': 'Alternativ marşrut',
  'plan.best': 'Tövsiyə olunan marşrut',
  'plan.here': 'Siz bu məntəqənin yanındasınız',
  'plan.full': ({ n }) => `${n}% dolu`,
  'plan.source': ({ source }) => `Marşrut mənbəyi: ${source}.`,
  'source.osrm': 'OSRM',
  'source.sim': 'simulyasiya olunmuş yol-nəqliyyat endpoint-i',
  'source.backup': 'ehtiyat marşrut bazası',
  'routing.backup': 'Oflayn/Ehtiyat marşrut rejimində işləyir',
  'map.closed': ({ name }) => `Bağlı yol: ${name}`,
  'map.you': 'Sizin mövqeyiniz',
  'map.youShort': 'Siz',
  'map.coverage': ({ name }) => name,
  'time.under': '1 dəq-dən az',
  'time.min': ({ n }) => `${n} dəq`,
  'time.secAgo': ({ n }) => `${n} san əvvəl`,
  'time.minAgo': ({ n }) => `${n} dəq əvvəl`,
  'time.hourAgo': ({ n }) => `${n} saat əvvəl`,
  'error.request': 'Sorğu alınmadı',
  'stat.active': 'Aktiv SOS',
  'stat.alerts': 'Həyəcan',
  'stat.roads': 'Bağlı yol',
  'stat.brigades': 'Hazır briqada',
  'calm': ({ count, minutes, percent }) =>
    `Aktiv həyəcan yoxdur. Hədd: ${count} SOS / ${minutes} dəq və ya doluluq ${percent}%-dən yuxarı.`,
  'feed.empty': 'Hələ SOS yoxdur.',
  'section.shelters': 'Toplanış məntəqələri',
  'section.brigades': 'Xilasetmə briqadaları',
  'section.roads': 'Yollar',
  'section.scenario': 'Ssenari',
  'section.decisions': 'Son qərarlar',
  'demo.signal': '1 SOS əlavə et',
  'demo.cluster': '4 SOS ssenarisi',
  'demo.full': '28 May doluluğunu 96% et',
  'demo.hint':
    'Eyni rayonda 5 dəqiqə içində 4-cü fərqli SOS, və ya məntəqə 95%-i keçəndə qırmızı həyəcan yaranır. “Qərarı icra et” əlavə briqada göndərir və yeni məntəqə açır.',
  'decisions.empty': 'Hələ icra olunmuş qərar yoxdur.',
  'alarm.kicker': ({ zone }) => `Kritik həyəcan · ${zone}`,
  'alarm.confirm': 'Qərarı icra et',
  'signal.safe': 'Təhlükəsizəm',
  'signal.active': 'Aktiv',
  'occupancy.label': ({ name }) => `${name} doluluğu`,
  'brigade.going': ({ zone }) => `Gedir: ${zone}`,
  'road.openAction': 'Yolu aç',
  'road.closeAction': 'Yolu bağla',
  'road.closed': 'bağlıdır',
  'road.open': 'açıqdır',
  'road.minutes': ({ n }) => `${n} dəq`,
  'road.closedPopup': ({ name }) => `Bağlıdır: ${name}`,
  'decision.done': ({ brigade, shelter }) => `${brigade} göndərildi. ${shelter} açıldı.`,
  'toast.sent': ({ brigade, extra, shelter }) => `${brigade} göndərildi${extra}. Yeni toplanış nöqtəsi: ${shelter}.`,
  'toast.reserve': ' (ehtiyatdan yaradıldı)',
};

const en = {
  'title.citizen': 'Evacuation · Baku',
  'title.operator': 'Dispatcher · Baku',
  'title.alarm': '● Alarm · Dispatcher',
  'nav.operator': 'Dispatcher desk',
  'nav.citizen': 'Citizen page',
  'lang.group': 'Language',
  'lang.az': 'Azerbaijani',
  'lang.en': 'English',
  'citizen.kicker': 'Baku · emergency evacuation',
  'citizen.title': 'Evacuation',
  'citizen.district': 'Location',
  'citizen.locate': 'Find me',
  'citizen.origin': 'District center. Click the map to use a coordinate.',
  'citizen.loading': 'Loading…',
  'a11y.skipSos': 'Skip to the SOS signal',
  'citizen.sos': 'Report the danger',
  'citizen.safe': 'I am in danger',
  'citizen.safeDone': 'I am safe',
  'citizen.mapNote': 'A red line is a closed road.',
  'operator.kicker': 'Baku crisis center',
  'operator.title': 'Dispatcher',
  'tab.map': 'Map',
  'tab.feed': 'SOS',
  'tab.route': 'Route',
  'tab.resources': 'Resources',
  'feed.title': 'Signals',
  'section.tools': 'Resources',
  'detail.empty': 'Select a signal',
  'detail.where': 'Location',
  'detail.when': 'Time',
  'detail.status': 'Status',
  'alarm.ask': 'Send an extra brigade and open a new gathering point?',
  'gate.need': 'Sign in for brigade and routing',
  'gate.user': 'User',
  'gate.pass': 'Password',
  'gate.in': 'Sign in',
  'gate.out': 'Sign out',
  'type.fire': 'Fire',
  'type.collapse': 'Earthquake',
  'type.flood': 'Flood',
  'type.medical': 'Medical aid',
  'type.checkin': 'I am safe',
  'place.shelter': 'Shelter',
  'place.park': 'Park',
  'place.stadium': 'Stadium',
  'place.temporary': 'Temporary point',
  'brigade.available': 'Ready',
  'brigade.dispatched': 'En route',
  'brigade.on_scene': 'On scene',
  'status.idle': 'No status sent',
  'status.locating': 'Looking for your location…',
  'status.noGeo': 'This browser has no location service. Choose a district.',
  'status.geoFail': 'Location was not found. Choose a district.',
  'status.sent': ({ type, zone, id }) => `Received · ${type} · ${zone} · Ref. ${id}`,
  'status.duplicate': ({ type, id }) => `${type} was already received · Ref. ${id}`,
  'status.safe': '',
  'status.lastSafe': '',
  'status.activeHint': 'SOS is active.',
  'status.next': 'When the danger has passed, press “I am in danger”.',
  'status.priority': ({ type, zone, id }) => `CLINICAL PRIORITY · #1 · ${type} · ${zone} · Ref. ${id}`,
  'role.title': 'Limited mobility',
  'role.hint': 'Clinical priority. Ramp or barrier-free route only.',
  'access.ramp': 'Ramp · wheelchair and medical vehicle',
  'access.barrier-free': 'Barrier-free · wheelchair and medical vehicle',
  'priority.badge': 'CLINICAL PRIORITY · #1',
  'policy': ({ avoid }) =>
    `An alternative route opens when a point reaches ${avoid}% or a road closes.`,
  'origin.point': ({ lat, lng, zone }) => `Coordinate: ${lat}, ${lng} · ${zone}`,
  'origin.zone': ({ zone }) => `${zone} · district center`,
  'plan.empty': 'No open route was found. Choose another point, or wait until a new gathering point opens.',
  'plan.next': 'Next step: go to this point',
  'plan.more': 'Other routes',
  'plan.show': 'Show on map',
  'reports.title': 'My signals',
  'net.offline': 'No network. If the signal was not sent, try again.',
  'plan.alt': 'Alternative route',
  'plan.best': 'Recommended route',
  'plan.here': 'You are next to this point',
  'plan.full': ({ n }) => `${n}% full`,
  'plan.source': ({ source }) => `Route source: ${source}.`,
  'source.osrm': 'OSRM',
  'source.sim': 'simulated road-traffic endpoint',
  'source.backup': 'backup route database',
  'routing.backup': 'Offline/Backup route mode is on',
  'map.closed': ({ name }) => `Closed road: ${name}`,
  'map.you': 'Your position',
  'map.youShort': 'You',
  'map.coverage': ({ name }) => name,
  'time.under': 'under 1 min',
  'time.min': ({ n }) => `${n} min`,
  'time.secAgo': ({ n }) => `${n}s ago`,
  'time.minAgo': ({ n }) => `${n} min ago`,
  'time.hourAgo': ({ n }) => `${n} h ago`,
  'error.request': 'Request failed',
  'stat.active': 'Active SOS',
  'stat.alerts': 'Alarms',
  'stat.roads': 'Closed roads',
  'stat.brigades': 'Ready crews',
  'calm': ({ count, minutes, percent }) =>
    `No active alarm. Threshold: ${count} SOS / ${minutes} min, or occupancy above ${percent}%.`,
  'feed.empty': 'No SOS yet.',
  'section.shelters': 'Gathering points',
  'section.brigades': 'Rescue brigades',
  'section.roads': 'Roads',
  'section.scenario': 'Scenario',
  'section.decisions': 'Recent decisions',
  'demo.signal': 'Add 1 SOS',
  'demo.cluster': '4 SOS scenario',
  'demo.full': 'Set 28 May to 96%',
  'demo.hint':
    'A red alarm opens on the 4th different SOS in the same district within 5 minutes, or when a point passes 95%. “Carry out the decision” sends an extra brigade and opens a new point.',
  'decisions.empty': 'No decision has been carried out yet.',
  'alarm.kicker': ({ zone }) => `Critical alarm · ${zone}`,
  'alarm.confirm': 'Carry out the decision',
  'signal.safe': 'Marked safe',
  'signal.active': 'Active',
  'occupancy.label': ({ name }) => `${name} occupancy`,
  'brigade.going': ({ zone }) => `Going to ${zone}`,
  'road.openAction': 'Open road',
  'road.closeAction': 'Close road',
  'road.closed': 'closed',
  'road.open': 'open',
  'road.minutes': ({ n }) => `${n} min`,
  'road.closedPopup': ({ name }) => `Closed: ${name}`,
  'decision.done': ({ brigade, shelter }) => `${brigade} was dispatched. ${shelter} opened.`,
  'toast.sent': ({ brigade, extra, shelter }) => `${brigade} was dispatched${extra}. New gathering point: ${shelter}.`,
  'toast.reserve': ' (created from reserve)',
};

export function getLang() {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'az';
}

export function t(key, params = {}) {
  const pack = getLang() === 'en' ? en : az;
  const value = pack[key] ?? az[key] ?? key;
  return typeof value === 'function' ? value(params) : value;
}

export function applyI18n(root = document) {
  document.documentElement.lang = getLang();
  const keepAlarmTitle = document.title.startsWith('●');
  root.querySelectorAll('[data-i18n]').forEach((node) => {
    if (node.tagName === 'TITLE' && keepAlarmTitle) return;
    node.textContent = t(node.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria));
  });
  const title = document.querySelector('title[data-i18n]');
  if (title && !document.title.startsWith('●')) document.title = t(title.dataset.i18n);
}

export function bindLanguage(onChange) {
  applyI18n();
  markLanguage();
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.setLang === 'en' ? 'en' : 'az';
      if (getLang() === next) return;
      localStorage.setItem(KEY, next);
      applyI18n();
      markLanguage();
      onChange?.();
    });
  });
}

function markLanguage() {
  const lang = getLang();
  document.querySelectorAll('[data-set-lang]').forEach((button) => {
    const on = button.dataset.setLang === lang;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
  });
}
