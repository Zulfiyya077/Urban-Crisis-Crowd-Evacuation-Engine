const KINDS = ['fire', 'collapse', 'flood', 'medical', 'checkin'];

function svg(body) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

const GLYPH = {
  fire: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
  collapse: svg('<path d="M3 21h18"/><path d="M6 21V9l6-5 6 5v12"/><path d="M12 4.2 10.6 8l2.2.8-1.6 3.6 2.4 1-1.8 3.8"/>'),
  flood: svg('<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>'),
  medical: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v9"/><path d="M7.5 12h9"/>'),
  checkin: svg('<path d="M20 6 9 17l-5-5"/>'),
};

const FLAG = {
  az: `<svg viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="5.34" fill="#0092BC"/><rect y="5.33" width="24" height="5.34" fill="#EF3340"/><rect y="10.67" width="24" height="5.33" fill="#00B140"/><g fill="#fff" transform="translate(12 8)"><path d="M-1.15-2.15a2.15 2.15 0 1 0 0 4.3 1.65 1.65 0 1 1 0-4.3z"/><path d="M1.55-1.35.9-.15h1.25L1.05.6l.4 1.2L.35.95l-1.1.85.4-1.2L-.7-.15H.55z"/></g></svg>`,
  en: `<svg viewBox="0 0 60 30" aria-hidden="true"><defs><clipPath id="uce-flag-en"><rect width="60" height="30"/></clipPath></defs><g clip-path="url(#uce-flag-en)"><rect width="60" height="30" fill="#012169"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="8"/><path d="M0 0 60 30M60 0 0 30" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="14"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="8"/></g></svg>`,
};

export function hazardIcon(kind) {
  return GLYPH[kind] || GLYPH.checkin;
}

export function hazardMark(kind) {
  const name = KINDS.includes(kind) ? kind : 'checkin';
  return `<span class="hazard ${name}" aria-hidden="true">${hazardIcon(name)}</span>`;
}

export function mountMarks(root = document) {
  root.querySelectorAll('[data-flag]').forEach((node) => {
    node.innerHTML = FLAG[node.dataset.flag] || '';
  });
  root.querySelectorAll('[data-hazard]').forEach((node) => {
    node.innerHTML = hazardIcon(node.dataset.hazard);
  });
}
