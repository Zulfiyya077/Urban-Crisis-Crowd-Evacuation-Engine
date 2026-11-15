import { esc } from './format.js';

export function drawCoverage(zones, activeId, layer) {
  const zone = (zones || []).find((item) => item.id === activeId && item.radiusMeters);
  if (!zone) return;
  const circle = L.circle([zone.lat, zone.lng], {
    radius: zone.radiusMeters,
    color: '#16A6A1',
    weight: 2.5,
    opacity: 0.95,
    fillColor: '#16A6A1',
    fillOpacity: 0.12,
    interactive: false,
  });
  circle.bindTooltip(esc(zone.name), {
    permanent: true,
    direction: 'center',
    className: 'zone-label',
    opacity: 1,
  });
  circle.addTo(layer);
  circle.bringToBack();
}
