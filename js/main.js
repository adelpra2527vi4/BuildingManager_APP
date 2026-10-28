import { initSession, getState, getPlanUrl, clearSession, expiresAt } from './api.js';
import { demoState } from './demo.js';
import { createMap } from './map.js';
import { AirField, SpectrumChart, ChromaChart, countTo, sparkline } from './fx.js';
import { METRICS, metricColor, rgb, verdictCo2 } from './scales.js';

const $ = (id) => document.getElementById(id);
const demo = new URLSearchParams(location.search).has('demo');
const session = demo ? null : initSession();
const S = { data: null, plan: null, metric: 't', sel: null, hist: {}, planUrls: {} };
const POLL_MS = 2000, HIST = 60;

// ---------------------------------------------------------------- accesso
function gate(title, text) {
  $('app').hidden = true; $('gate').hidden = false;
  $('gate-t').textContent = title; $('gate-p').textContent = text;
}
if (!demo && !session) {
  gate('Inquadra il QR allo stand', 'Questa vista live è riservata ai visitatori. Scansiona il QR code per entrare.');
} else {
  $('app').hidden = false;
}

// ---------------------------------------------------------------- UI
const map = createMap($('map'), { onSelect: openSheet });

function start() {
  $('chips').innerHTML = Object.entries(METRICS).map(([k, m]) => `<button data-m="${k}">${m.label}</button>`).join('');
  $('chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.metric = b.dataset.m; paint(); } });
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.plan = b.dataset.p; paint(); } });
  $('showcase').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !S.data) return;
    const zs = S.data.zones;
    if (b.dataset.show === 'air') {
      const z = (zs.filter(z => z.co2 != null).sort((a, b) => b.co2 - a.co2))[0];
      if (z) openSheet(z.id, 'sh-air');
    } else {
      const z = zs.find(z => S.data.spectra[z.id]);
      if (z) openSheet(z.id, 'sh-spec');
    }
  });
  setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('it-IT'); }, 1000);
  poll();
}

let failures = 0;
async function poll() {
  try {
    const d = demo ? demoState() : await getState(session);
    failures = 0; document.body.classList.remove('offline');
    ingest(d);
  } catch (e) {
    if (e.auth) { clearSession(); return gate('QR scaduto o non valido', 'Chiedi allo stand un nuovo QR code e inquadralo di nuovo.'); }
    failures++; document.body.classList.add('offline');
  }
  setTimeout(poll, document.hidden ? 8000 : Math.min(POLL_MS * (1 + failures), 10000));
}

function ingest(d) {
  S.data = d;
  for (const z of d.zones) {
    const h = (S.hist[z.id] ||= {});
    for (const m of ['t', 'hum', 'co2', 'lux']) { const a = (h[m] ||= []); a.push(z[m]); if (a.length > HIST) a.shift(); }
  }
  if (!S.plan || !d.piani.some(p => p.id === S.plan)) S.plan = d.piani[0]?.id;
  paint();
  const q = new URLSearchParams(location.search);
  if (demo && q.get('open') && !S.opened) { S.opened = true; openSheet(q.get('open'), q.get('focus')); }
}

async function planUrl(p) {
  if (!p?.img || demo) return null;
  if (!(p.id in S.planUrls)) { S.planUrls[p.id] = null; getPlanUrl(session, p.id).then(u => { S.planUrls[p.id] = u; paint(); }).catch(() => {}); }
  return S.planUrls[p.id];
}

async function paint() {
  const d = S.data; if (!d) return;
  $('bname').textContent = d.nome;
  const p = d.piani.find(p => p.id === S.plan);
  $('tabs').hidden = d.piani.length < 2;
  $('tabs').innerHTML = d.piani.map(q => `<button data-p="${q.id}" class="${q.id === S.plan ? 'on' : ''}">${esc(q.nome)}</button>`).join('');
  for (const b of $('chips').children) b.classList.toggle('on', b.dataset.m === S.metric);
  map.update(S.plan, d.zones.filter(z => z.piano === S.plan), S.metric, await planUrl(p));
  map.highlight(S.sel);
  legend();
  const t = d.totali;
  $('totals').innerHTML = `<span><b>${Math.round(t.w)}</b> W</span><span><b>${t.luci[0]}</b>/${t.luci[1]} luci</span>`;
  $('showcase').hidden = false;
  $('foot').textContent = (demo ? 'Dati simulati · ' : '') + 'Aggiornamento in tempo reale';
  if (S.sel) fillSheet();
}

function legend() {
  const m = S.metric, M = METRICS[m], steps = [0, .25, .5, .75, 1];
  const rng = { t: [16, 32], co2: [400, 2000], hum: [20, 80], lux: [0, 1000] }[m];
  const cs = steps.map(s => rgb(metricColor(m, rng[0] + (rng[1] - rng[0]) * s))).join(',');
  $('legend').innerHTML = `<span>${rng[0]}</span><i style="background:linear-gradient(90deg,${cs})"></i><span>${rng[1]} ${M.unit}</span>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- scheda zona
let air = null, spec = null, chroma = null;
const TILES = [['t', 'Temperatura', '°C', 1], ['hum', 'Umidità', '%', 0], ['co2', 'CO₂', 'ppm', 0], ['lux', 'Luce', 'lx', 0]];

function openSheet(id, focus) {
  S.sel = id; map.highlight(id);
  const sh = $('sheet'); sh.hidden = false; requestAnimationFrame(() => sh.classList.add('open'));
  document.body.classList.add('noscroll');
  $('sh-tiles').innerHTML = TILES.map(([k, l, u]) => `<div class="tile" data-k="${k}"><small>${l}</small><div><b>—</b><u>${u}</u></div><svg viewBox="0 0 100 20" preserveAspectRatio="none"></svg></div>`).join('')
    + '<div class="tile" data-k="pir"><small>Presenza</small><div><b>—</b></div></div><div class="tile" data-k="luci"><small>Luci accese</small><div><b>—</b></div></div>';
  air ||= new AirField($('sh-air').querySelector('canvas'));
  spec ||= new SpectrumChart($('sh-spec').querySelector('.spc'));
  chroma ||= new ChromaChart($('sh-spec').querySelector('.chr'));
  fillSheet(true);
  if (focus) setTimeout(() => $(focus).scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
}

function closeSheet() {
  S.sel = null; map.highlight(null);
  const sh = $('sheet'); sh.classList.remove('open'); document.body.classList.remove('noscroll');
  for (const f of [air, spec, chroma]) f?.stop(); air = spec = chroma = null;
  setTimeout(() => { if (!S.sel) sh.hidden = true; }, 300);
}
$('sh-x').onclick = $('backdrop').onclick = closeSheet;

function fillSheet(first) {
  const z = S.data?.zones.find(z => z.id === S.sel); if (!z || !air) return;
  const piano = S.data.piani.find(p => p.id === z.piano);
  $('sh-title').textContent = z.id; $('sh-sub').textContent = piano?.nome || '';
  for (const [k, , , dec] of TILES) {
    const el = $('sh-tiles').querySelector(`[data-k="${k}"]`), v = z[k];
    countTo(el.querySelector('b'), v, dec);
    sparkline(el.querySelector('svg'), S.hist[z.id]?.[k] || [], v != null ? rgb(metricColor(k, v)) : '#667');
  }
  $('sh-tiles').querySelector('[data-k="pir"] b').textContent = z.pir == null ? '—' : z.pir ? 'Rilevata' : 'Nessuna';
  $('sh-tiles').querySelector('[data-k="luci"] b').textContent = z.luci[1] ? `${z.luci[0]} / ${z.luci[1]}` : '—';

  $('sh-air').hidden = z.co2 == null;
  if (z.co2 != null) {
    air.set(z.co2); air.start(); countTo($('air-ppm'), z.co2, 0);
    $('air-v').textContent = verdictCo2(z.co2); $('air-v').style.color = rgb(metricColor('co2', z.co2));
  } else air.stop();

  const nodes = S.data.spectra[z.id] || [];
  $('sh-spec').hidden = !nodes.length;
  if (nodes.length) {
    const sel = $('spec-node');
    if (first || sel.options.length !== nodes.length) {
      sel.innerHTML = nodes.map((n, i) => `<option value="${i}">${esc(n.name)}</option>`).join(''); sel.hidden = nodes.length < 2;
      sel.onchange = () => fillSheet();
    }
    const n = nodes[Math.min(+sel.value || 0, nodes.length - 1)];
    spec.set(n.spec); spec.start(); chroma.set(n.cx, n.cy, n.cct); chroma.start();
    $('spec-cct').textContent = n.cct ? n.cct + ' K' : '';
  }
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sel) closeSheet(); });
if (session && session.t) setTimeout(() => gate('Sessione scaduta', 'Inquadra di nuovo il QR code allo stand.'), Math.min(expiresAt(session) - Date.now(), 2 ** 31 - 1));

if (demo || session) start();
