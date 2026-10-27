// Mappa: pianta + poligoni delle zone colorati per metrica, con etichette e respiro per la CO₂.
import { METRICS, metricColor, rgb } from './scales.js';

const NS = 'http://www.w3.org/2000/svg';
const centroid = (pts) => {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  return Math.abs(a) < 1e-9 ? pts[0] : [cx / (3 * a), cy / (3 * a)];
};

export function createMap(root, { onSelect }) {
  root.innerHTML = '<div class="stage grid"><img class="plan" alt="" hidden><svg class="zones" viewBox="0 0 1 1" preserveAspectRatio="none"></svg><div class="labels"></div></div>';
  const stage = root.firstElementChild, img = stage.querySelector('img'), svg = stage.querySelector('svg'), labels = stage.querySelector('.labels');
  let key = '', els = {};

  function build(zones, imgUrl) {
    svg.innerHTML = ''; labels.innerHTML = ''; els = {};
    if (imgUrl) {
      img.hidden = false; stage.classList.remove('grid');
      img.onload = () => { stage.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`; };
      img.src = imgUrl;
    } else { img.hidden = true; stage.classList.add('grid'); stage.style.aspectRatio = '1000 / 560'; }
    for (const z of zones) {
      if (!z.pts || z.pts.length < 3) continue;
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', z.pts.map(q => q.join(',')).join(' '));
      p.dataset.id = z.id; p.classList.add('zone');
      p.addEventListener('click', () => onSelect(z.id));
      svg.appendChild(p);
      const [cx, cy] = centroid(z.pts), l = document.createElement('button');
      l.className = 'zlabel'; l.style.left = cx * 100 + '%'; l.style.top = cy * 100 + '%';
      l.innerHTML = '<b></b><i></i>'; l.querySelector('i').textContent = z.id;
      l.addEventListener('click', () => onSelect(z.id));
      labels.appendChild(l);
      els[z.id] = { p, l, v: l.querySelector('b') };
    }
  }

  return {
    /** zones: zone del piano mostrato; metric: t|co2|hum|lux. */
    update(planId, zones, metric, imgUrl) {
      const k = planId + '|' + zones.map(z => z.id).join(',') + '|' + !!imgUrl;
      if (k !== key) { key = k; build(zones, imgUrl); }
      const m = METRICS[metric];
      for (const z of zones) {
        const e = els[z.id]; if (!e) continue;
        const v = z[metric];
        if (v == null) { e.p.style.fill = 'rgba(120,130,150,.16)'; e.p.style.stroke = 'rgba(160,170,190,.5)'; e.p.style.removeProperty('--bd'); e.v.textContent = '—'; e.p.classList.remove('breathe'); continue; }
        const c = metricColor(metric, v);
        e.p.style.fill = rgb(c, .55); e.p.style.stroke = rgb(c, 1);
        e.v.textContent = v.toFixed(m.dec) + (metric === 'co2' ? '' : m.unit === '°C' ? '°' : '');
        e.p.classList.toggle('breathe', metric === 'co2');
        if (metric === 'co2') e.p.style.setProperty('--bd', (4.2 - 3 * Math.min(1, Math.max(0, (v - 400) / 1600))).toFixed(2) + 's');
      }
    },
    highlight(id) { for (const [k, e] of Object.entries(els)) e.p.classList.toggle('sel', k === id); },
  };
}
