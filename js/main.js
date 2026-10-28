import { initSession, getState, getHistory, getPlanUrl, clearSession, expiresAt, setLights, setRele, setPersone } from './api.js';
import { demoState, demoHistory, demoRele } from './demo.js';
import { estimatePeople } from './occupancy.js';
import { createMap } from './map.js';
import { SpectrumChart, countTo, sparkline } from './fx.js';
import { METRICS, RANGE, metricColor, rgb, verdictCo2, cctToRgb, xyToRgb } from './scales.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const demo = q.has('demo');
const session = demo ? null : initSession();
const S = { data: null, plan: null, metric: 't', sel: null, mode: 'metric', hours: 6, hist: {}, planUrls: {} };
const POLL_MS = 2000, HIST = 60;
if (demo && q.get('metric') in METRICS) S.metric = q.get('metric');

// ---------------------------------------------------------------- accesso
function gate(title, text) {
  $('app').hidden = true; $('gate').hidden = false;
  $('gate-t').textContent = title; $('gate-p').textContent = text;
}
if (!demo && !session) {
  gate('Indirizzo non configurato', "Apri il link con l'indirizzo del Building Manager (#a=https://host.ts.net).");
} else {
  $('app').hidden = false;
}

// ---------------------------------------------------------------- pagina principale
// Click su una zona: scheda della metrica scelta (valore e storico). I 3 pulsanti sotto la mappa aprono
// pannelli per zona: Aria (CO₂, persone), Luce (spettro, colore), Luci (dimmer, colore), Relè (HVAC, ventola, umidità).
const map = createMap($('map'), { onSelect: (id) => openSheet(id, 'metric') });

const MODES = {
  metric: { label: null },
  air: { label: 'Aria', ok: (z) => z.co2 != null || z.pir != null },
  light: { label: 'Luce', ok: (z) => !!S.data.spectra[z.id] },
  lights: { label: 'Luci', ok: (z) => z.luci[1] > 0 },
  rele: { label: 'Relè', ok: (z) => z.rele?.length > 0 },
};
const planZones = () => S.data.zones.filter(z => z.piano === S.plan);
const modeZones = (mode) => planZones().filter(MODES[mode].ok);

function start() {
  $('chips').innerHTML = Object.entries(METRICS).map(([k, m]) => `<button data-m="${k}">${m.label}</button>`).join('');
  $('chips').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.metric = b.dataset.m; paint(); } });
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.plan = b.dataset.p; paint(); } });
  $('showcase').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled || !S.data) return;
    const mode = b.dataset.show, zs = modeZones(mode); if (!zs.length) return;
    const z = mode === 'air' ? [...zs].sort((a, b) => (b.co2 ?? -1) - (a.co2 ?? -1))[0] : zs[0];
    openSheet(z.id, mode);
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
  if (demo && q.get('open') && !S.opened) { S.opened = true; openSheet(q.get('open'), q.get('focus') || 'metric'); }
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
  // I pulsanti aprono il pannello di una zona del piano che abbia il dato: senza, restano spenti.
  for (const b of $('showcase').children) { b.disabled = !modeZones(b.dataset.show).length; b.title = b.disabled ? 'Dato non disponibile su questo piano' : ''; }
  $('foot').textContent = (demo ? 'Dati simulati · ' : '') + 'Aggiornato alle ' + new Date().toLocaleTimeString('it-IT');
  if (S.sel) fillSheet();
}

function legend() {
  const m = S.metric, M = METRICS[m], steps = [0, .25, .5, .75, 1];
  const rng = RANGE[m];
  const cs = steps.map(s => rgb(metricColor(m, rng[0] + (rng[1] - rng[0]) * s))).join(',');
  $('legend').innerHTML = `<span>${rng[0]}</span><i style="background:linear-gradient(90deg,${cs})"></i><span>${rng[1]} ${M.unit}</span>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = (t) => new Date(t * 1000).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const tempWord = (v) => v < 19 ? 'Fresco' : v < 25 ? 'Confortevole' : 'Caldo';
const humWord = (v) => v < 30 ? 'Secco' : v < 60 ? 'Nella norma' : 'Umido';
const luxWord = (v) => v < 50 ? 'Buio' : v < 300 ? 'Soffusa' : v < 750 ? 'Luminosa' : 'Molto luminosa';
const toneWord = (k) => k < 3300 ? 'Calda' : k < 5300 ? 'Neutra' : 'Fredda';
const WORD = { t: tempWord, hum: humWord, co2: verdictCo2, lux: luxWord };
const PERSON = '<svg viewBox="0 0 14 22" aria-hidden="true"><circle cx="7" cy="5" r="4"/><rect x="1" y="10" width="12" height="12" rx="5"/></svg>';
const CCT_MIN = 2000, CCT_MAX = 7000, CT_MIN = 2700, CT_MAX = 6500;
const grads = {};
const gradient = (m) => grads[m] ||= 'linear-gradient(90deg,' + [0, .25, .5, .75, 1].map(s => rgb(metricColor(m, RANGE[m][0] + (RANGE[m][1] - RANGE[m][0]) * s))).join(',') + ')';
const ctGradient = (a, b) => `linear-gradient(90deg,${[0, .25, .5, .75, 1].map(s => rgb(cctToRgb(a + (b - a) * s))).join(',')})`;
$('tone-g').style.background = ctGradient(CCT_MIN, CCT_MAX);
$('ct').style.background = ctGradient(CT_MIN, CT_MAX);
const pos = (m, v) => Math.min(100, Math.max(0, (v - RANGE[m][0]) / (RANGE[m][1] - RANGE[m][0]) * 100)) + '%';

// ---------------------------------------------------------------- scheda zona
let spec = null, zonesSig = '', histKey = '', histAt = 0, histPts = null, chartCtx = null, dimHold = 0, ctHold = 0, releSig = '', settingsOpen = false;

function openSheet(id, mode = 'metric') {
  if (!S.data || !(mode in MODES)) return;
  S.sel = id; S.mode = mode; histKey = ''; zonesSig = ''; dimHold = ctHold = 0; settingsOpen = false;
  const zp = S.data.zones.find(z => z.id === id)?.piano; if (zp && zp !== S.plan) { S.plan = zp; paint(); }  // es. da link demo
  map.highlight(id);
  const sh = $('sheet'); sh.hidden = false; requestAnimationFrame(() => sh.classList.add('open'));
  document.body.classList.add('noscroll');
  fillSheet(true);
}

function closeSheet() {
  S.sel = null; map.highlight(null);
  const sh = $('sheet'); sh.classList.remove('open'); document.body.classList.remove('noscroll');
  spec?.stop(); spec = null;
  setTimeout(() => { if (!S.sel) sh.hidden = true; }, 300);
}
$('sh-x').onclick = $('backdrop').onclick = closeSheet;
$('sh-gear').addEventListener('click', () => { settingsOpen = !settingsOpen; fillSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sel) closeSheet(); });

$('sh-zones').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  S.sel = b.dataset.z; histKey = ''; zonesSig = ''; dimHold = ctHold = 0; map.highlight(S.sel);
  fillSheet(true);
});
$('mv-r').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S.hours = +b.dataset.h; histPts = null; fillSheet();
});

function fillSheet(first) {
  const z = S.data?.zones.find(z => z.id === S.sel); if (!z) return;
  const m = S.mode, piano = S.data.piani.find(p => p.id === z.piano);
  $('sh-title').textContent = z.id;
  $('sh-sub').textContent = [m === 'metric' ? METRICS[S.metric].label : MODES[m].label, piano?.nome].filter(Boolean).join(' · ');
  zoneChips(m);
  for (const k of Object.keys(MODES)) $('sec-' + k).hidden = k !== m;
  // Impostazioni (ingranaggio): oggi aperte a chi può comandare; in futuro dietro password (qui va il controllo).
  const hasSet = m === 'air' && z.co2 != null && canCmd();
  $('sh-gear').hidden = !hasSet; $('sh-gear').setAttribute('aria-expanded', String(hasSet && settingsOpen));
  $('sec-cal').hidden = !(hasSet && settingsOpen);
  if (m !== 'light') { spec?.stop(); spec = null; }
  ({ metric: fillMetric, air: fillAir, light: fillLight, lights: fillLights, rele: fillRele })[m](z, first);
}

/** Chip delle zone del piano (non per la scheda della metrica, che nasce dal click sulla mappa). */
function zoneChips(m) {
  const box = $('sh-zones'); box.hidden = m === 'metric'; if (m === 'metric') return;
  const zs = planZones(), sig = m + '|' + S.sel + '|' + zs.map(z => z.id + MODES[m].ok(z)).join();
  if (sig === zonesSig) return; zonesSig = sig;
  box.innerHTML = zs.map(z => `<button data-z="${esc(z.id)}" class="${z.id === S.sel ? 'on' : ''}"${MODES[m].ok(z) ? '' : ' disabled'}>${esc(z.id)}</button>`).join('');
}

// ---- metrica scelta: valore attuale e storico
function fillMetric(z) {
  const m = S.metric, M = METRICS[m], v = z[m];
  countTo($('mv-v'), v, M.dec); $('mv-u').textContent = M.unit;
  $('mv-w').innerHTML = v == null ? 'Dato non disponibile' : `<i class="sw" style="background:${rgb(metricColor(m, v))}"></i>${WORD[m](v)}`;
  const g = $('mv-g'); g.hidden = v == null;
  if (v != null) { g.style.background = gradient(m); g.firstElementChild.style.left = pos(m, v); }
  for (const b of $('mv-r').children) b.classList.toggle('on', +b.dataset.h === S.hours);
  loadHistory(z.id);
}

async function loadHistory(id) {
  const key = `${id}|${S.metric}|${S.hours}`;
  if (key === histKey && Date.now() - histAt < 30000) return;
  if (key !== histKey) histPts = null;
  histKey = key; histAt = Date.now(); drawChart();
  try {
    const pts = demo ? demoHistory(id, S.metric, S.hours) : (await getHistory(session, id, S.metric, S.hours)).pts;
    if (key === histKey) { histPts = pts; drawChart(); }
  } catch { if (key === histKey) { histPts = []; drawChart(); } }
}

const niceStep = (x) => { const p = 10 ** Math.floor(Math.log10(x)), f = x / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; };

function drawChart() {
  const svg = $('mv-chart'), pts = histPts, M = METRICS[S.metric];
  chartCtx = null; $('mv-s').innerHTML = '';
  const msg = (t) => { svg.innerHTML = `<text class="ch-t" x="160" y="90" text-anchor="middle">${t}</text>`; };
  if (!pts) return msg('Carico lo storico…');
  if (pts.length < 2) return msg('Nessun dato storico per questa zona');
  const W = 320, H = 180, L = 40, R = 10, T = 10, B = 24;
  const t1 = pts[pts.length - 1].t, t0 = t1 - S.hours * 3600;
  let lo = Math.min(...pts.map(p => p.mn)), hi = Math.max(...pts.map(p => p.mx));
  const pad = (hi - lo || 1) * .12; lo = S.metric === 't' ? lo - pad : Math.max(0, lo - pad); hi += pad;
  const step = niceStep((hi - lo) / 4), y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const X = (t) => L + (t - t0) / (t1 - t0) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const last = pts[pts.length - 1], col = rgb(metricColor(S.metric, last.av)), dec = step < 1 ? 1 : 0, f = (n) => n.toFixed(1);
  let g = '';
  for (let v = y0; v <= y1 + step / 2; v += step) g += `<line class="ch-g" x1="${L}" x2="${W - R}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="ch-t" x="${L - 6}" y="${f(Y(v) + 3)}" text-anchor="end">${v.toFixed(dec)}</text>`;
  for (let i = 0; i <= 3; i++) { const t = t0 + (t1 - t0) * i / 3; g += `<text class="ch-t" x="${f(X(t))}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}">${clock(t)}</text>`; }
  const up = pts.map(p => `${f(X(p.t))},${f(Y(p.mx))}`), dn = pts.map(p => `${f(X(p.t))},${f(Y(p.mn))}`).reverse();
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${f(X(p.t))},${f(Y(p.av))}`).join('');
  svg.innerHTML = g + `<polygon points="${up.concat(dn).join(' ')}" fill="${col}" fill-opacity=".22"/><path class="ch-l" d="${line}"/>`
    + `<g id="mv-cur" visibility="hidden"><line class="ch-g cur" y1="${T}" y2="${H - B}"/><circle r="4" class="ch-d"/></g>`
    + `<circle cx="${f(X(last.t))}" cy="${f(Y(last.av))}" r="4.5" fill="${col}" stroke="var(--card)" stroke-width="2"/><text id="mv-tip" class="ch-tip" x="${L + 4}" y="${T + 10}"></text>`;
  chartCtx = { pts, X, Y, M };
  const avg = pts.reduce((a, p) => a + p.av, 0) / pts.length;
  $('mv-s').innerHTML = [['Min', Math.min(...pts.map(p => p.mn))], ['Media', avg], ['Max', Math.max(...pts.map(p => p.mx))]]
    .map(([l, v]) => `<div><small>${l}</small><b>${v.toFixed(M.dec)}</b><u>${M.unit}</u></div>`).join('');
}

// Scorrendo il dito sul grafico compare il valore di quell'istante.
const scrub = (e) => {
  const c = chartCtx; if (!c) return;
  const r = $('mv-chart').getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 320;
  const p = c.pts.reduce((a, b) => Math.abs(c.X(b.t) - x) < Math.abs(c.X(a.t) - x) ? b : a);
  const cur = $('mv-cur'), px = c.X(p.t);
  cur.setAttribute('visibility', 'visible');
  cur.firstElementChild.setAttribute('x1', px); cur.firstElementChild.setAttribute('x2', px);
  cur.lastElementChild.setAttribute('cx', px); cur.lastElementChild.setAttribute('cy', c.Y(p.av));
  $('mv-tip').textContent = `${p.av.toFixed(c.M.dec)} ${c.M.unit} · ${clock(p.t)}`;
};
$('mv-chart').addEventListener('pointermove', scrub);
$('mv-chart').addEventListener('pointerleave', () => { $('mv-cur')?.setAttribute('visibility', 'hidden'); if ($('mv-tip')) $('mv-tip').textContent = ''; });

// ---- aria: CO2 e persone stimate
/** Tessera con numero, barra sulla scala colore col segnaposto, giudizio e storico locale. */
function stat(id, m, v, word) {
  const el = $(id); el.hidden = v == null; if (v == null) return;
  const g = el.querySelector('.gauge'), c = rgb(metricColor(m, v));
  g.style.background = gradient(m); g.firstElementChild.style.left = pos(m, v);
  el.querySelector('.word').innerHTML = `<i class="sw" style="background:${c}"></i>${word}`;
  sparkline(el.querySelector('svg'), S.hist[S.sel]?.[m] || [], c);
}

function fillAir(z) {
  stat('sh-air', 'co2', z.co2, z.co2 == null ? '' : verdictCo2(z.co2)); countTo($('air-ppm'), z.co2, 0);
  // Presenza: PIR (sensore) + persone stimate dalla CO2 (modello in occupancy.js)
  // Dal Raspberry (bilancio con transitorio e taratura); la formula locale resta per la demo.
  const n = z.persone !== undefined ? z.persone : estimatePeople(z.id, z.co2, z.vol);
  $('env-p').hidden = z.pir == null && n == null;
  const lit = n == null ? !!z.pir : n > 0, shown = n == null ? 1 : Math.max(1, Math.min(n, 10));
  $('ppl').className = 'ppl' + (lit ? '' : ' off');
  $('ppl').innerHTML = PERSON.repeat(shown) + (n > 10 ? `<em>+${n - 10}</em>` : '');
  $('pp-n').textContent = n == null ? (z.pir ? 'Sì' : 'No') : '≈ ' + n;
  $('pp-l').textContent = n == null ? 'presenza rilevata' : (n === 1 ? 'persona stimata' : 'persone stimate') + ' dalla CO₂' + (z.persone_k ? ' · tarata' : '');
  fillCal(z);
  // Sensore CO₂ vicino a una porta o finestra (posizione dalla pianta del Manager): la lettura può essere bassa.
  const w = z.sens_aperture;
  $('air-warn').hidden = !w;
  if (w) $('air-warn').textContent = `Il sensore è a ${w.d.toFixed(1).replace('.', ',')} m da ${w.t === 'porta' ? 'una porta' : 'una finestra'}: la CO₂ può essere sottostimata, e con lei le persone.`;
  $('pp-s').innerHTML = z.pir == null ? '' : `<i class="dot${z.pir ? ' on' : ''}"></i>${z.pir ? 'Movimento rilevato' : 'Nessun movimento'}`;
}

// Taratura: l'utente conta le persone presenti, il Raspberry calcola il fattore della zona (assorbe volume, ricambi e posizione del sensore).
function fillCal(z) {
  const can = canCmd();
  $('cal-k').textContent = z.persone_k ? '× ' + z.persone_k.toFixed(2).replace('.', ',') : 'non tarata';
  $('cal-reset').hidden = !z.persone_k;
  $('cal-n').disabled = $('cal-go').disabled = $('cal-reset').disabled = !can;
  $('cal-note').textContent = can
    ? 'Conta le persone nella stanza e inserisci il numero: la stima si adatta a volume, ventilazione e posizione del sensore. Se sposti il sensore o cambia la ventilazione, ripeti.'
    : 'Per tarare la stima apri il link del QR dello stand.';
}

async function sendPersone(body) {
  if (!S.sel) return;
  const msg = $('cal-msg'); msg.textContent = 'Invio…';
  try {
    if (!demo) await setPersone(session, S.sel, body);
    msg.textContent = body.reset ? 'Taratura azzerata' : demo ? 'Taratura simulata' : 'Taratura salvata';
    if (body.reset) $('cal-n').value = '';
  } catch (e) { msg.textContent = e.status === 422 ? 'CO₂ troppo vicina al valore esterno: niente da tarare' : 'Taratura non riuscita'; }
  setTimeout(() => { msg.textContent = ''; }, 3500);
}
$('cal-go').addEventListener('click', () => {
  const v = $('cal-n').value;
  if (v === '' || !Number.isInteger(+v) || +v < 0 || +v > 500) { $('cal-msg').textContent = 'Inserisci un numero intero tra 0 e 500'; return; }
  sendPersone({ n: +v });
});
$('cal-reset').addEventListener('click', () => sendPersone({ reset: true }));

// ---- luce: spettro e colore
/** Colore della luce: pastiglia col colore emesso, kelvin, parola e segnaposto sulla barra calda-fredda. */
function fillTone(n) {
  const rgbc = n.cct ? cctToRgb(n.cct) : n.cx != null && n.cy ? xyToRgb(n.cx, n.cy) : null;
  $('tone-dot').style.background = rgbc ? rgb(rgbc) : 'var(--line)';
  $('tone-k').textContent = n.cct ? n.cct + ' K' : '—';
  $('tone-w').textContent = n.cct ? toneWord(n.cct) : '';
  $('tone-g').hidden = !n.cct; $('tone-g').nextElementSibling.hidden = !n.cct;
  if (n.cct) $('tone-g').firstElementChild.style.left = Math.min(100, Math.max(0, (n.cct - CCT_MIN) / (CCT_MAX - CCT_MIN) * 100)) + '%';
}

function fillLight(z, first) {
  const nodes = S.data.spectra[z.id] || [];
  if (!nodes.length) return;
  spec ||= new SpectrumChart($('sec-light').querySelector('.spc'));
  const sel = $('spec-node');
  if (first || sel.options.length !== nodes.length) {
    sel.innerHTML = nodes.map((n, i) => `<option value="${i}">${esc(n.name)}</option>`).join(''); sel.hidden = nodes.length < 2;
    sel.onchange = () => fillSheet();
  }
  const n = nodes[Math.min(+sel.value || 0, nodes.length - 1)];
  spec.set(n.spec); spec.start(); fillTone(n);
  $('spec-cct').textContent = n.cct ? n.cct + ' K' : '';
}

// ---- luci: dimmer e colore. Solo con un token (link dal QR); in demo i comandi sono simulati.
// Il numero segue il dito, il comando parte al rilascio. Per ~6 s dopo l'invio lo slider non
// viene riallineato ai dati (le lampade impiegano qualche secondo a riportare il nuovo livello).
const dimLabel = (v) => (+v ? v + '%' : 'Spente');
const ctLabel = (k) => `${k} K · ${toneWord(+k)}`;
const canCmd = () => demo || !!session?.t;

function fillLights(z) {
  const [on, tot] = z.luci, hasCt = z.ct != null, can = canCmd();
  $('lights-n').textContent = tot ? `${on} di ${tot} accese` : 'Nessuna luce in questa zona';
  $('dim').disabled = $('ct').disabled = !can;
  $('act-note').textContent = can ? '' : 'Per comandare le luci apri il link del QR dello stand.';
  $('dim-row').hidden = !tot; $('ct-row').hidden = !hasCt;
  if (Date.now() > dimHold) { const d = z.dim ?? (on ? 100 : 0); $('dim').value = d; $('dim-v').textContent = dimLabel(d); }
  if (hasCt && Date.now() > ctHold) { $('ct').value = z.ct; $('ct-v').textContent = ctLabel(z.ct); }
}

async function send(body, hold) {
  if (!S.sel) return;
  const msg = $('act-msg'); msg.textContent = 'Invio…';
  try {
    const r = demo ? { n: 1 } : await setLights(session, S.sel, body);
    msg.textContent = !r.n ? (body.ct != null ? 'Nessuna lampada con colore regolabile' : 'Nessuna luce in questa zona') : demo ? 'Comando simulato' : 'Comando inviato';
  } catch { msg.textContent = 'Comando non riuscito'; }
  hold(Date.now() + 6000);
  setTimeout(() => { msg.textContent = ''; }, 2500);
}
$('dim').addEventListener('input', (e) => { dimHold = Infinity; $('dim-v').textContent = dimLabel(e.target.value); });
$('dim').addEventListener('change', (e) => send({ pct: +e.target.value }, (t) => { dimHold = t; }));
$('ct').addEventListener('input', (e) => { ctHold = Infinity; $('ct-v').textContent = ctLabel(e.target.value); });
$('ct').addEventListener('change', (e) => send({ ct: +e.target.value }, (t) => { ctHold = t; }));

// ---- relè: un interruttore per categoria (ventola a velocità: Off/1/2/3). Il primo comando mette la zona in manuale.
const releRow = (r, can) => {
  const st = r.vels ? (r.vel ? `Velocità ${r.vel}` : 'Spenta') : (r.on ? 'Accesa' : 'Spenta'), dis = can ? '' : ' disabled';
  const ctl = r.vels
    ? `<div class="seg3" role="group" aria-label="${esc(r.n)}">${Array.from({ length: r.vels + 1 }, (_, v) => `<button type="button" data-k="${r.k}" data-vel="${v}" aria-pressed="${r.vel === v}"${dis}>${v || 'Off'}</button>`).join('')}</div>`
    : `<button type="button" class="swt" role="switch" aria-checked="${!!r.on}" aria-label="${esc(r.n)}" data-k="${r.k}" data-on="${r.on ? 0 : 1}"${dis}><i></i></button>`;
  return `<div class="row"><div><b>${esc(r.n)}</b><span>${st}</span></div>${ctl}</div>`;
};

function fillRele(z) {
  const can = canCmd();
  $('rele-man').hidden = !z.manuale; $('rele-auto').disabled = !can;
  $('rele-note').textContent = can ? "Il primo comando mette la zona in manuale: l'automazione non riporta lo stato indietro finché non torni in automatico." : 'Per comandare i relè apri il link del QR dello stand.';
  const sig = z.id + '|' + can + '|' + z.rele.map(r => [r.k, r.on, r.vel, r.vels].join(':')).join();
  if (sig === releSig) return;
  releSig = sig;
  $('rele-list').innerHTML = z.rele.map(r => releRow(r, can)).join('');
}

async function sendRele(body) {
  if (!S.sel) return;
  const msg = $('rele-msg'); msg.textContent = 'Invio…';
  try {
    const r = demo ? demoRele(S.sel, body) : await setRele(session, S.sel, body);
    msg.textContent = body.manuale === false ? 'Zona in automatico' : !r.n ? 'Nessun relè di questa categoria' : demo ? 'Comando simulato' : 'Comando inviato';
  } catch { msg.textContent = 'Comando non riuscito'; }
  releSig = '';
  if (demo) ingest(demoState());
  setTimeout(() => { msg.textContent = ''; }, 2500);
}
$('rele-list').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  sendRele(b.dataset.vel != null ? { k: b.dataset.k, vel: +b.dataset.vel } : { k: b.dataset.k, on: b.dataset.on === '1' });
});
$('rele-auto').addEventListener('click', () => sendRele({ manuale: false }));

if (session && session.t) setTimeout(() => gate('Sessione scaduta', 'Riapri il link.'), Math.min(expiresAt(session) - Date.now(), 2 ** 31 - 1));

if (demo || session) start();
