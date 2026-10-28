// Dati simulati per provare la web app senza Raspberry (apri con ?demo).
import { planck } from './scales.js';

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ZONES = [
  { id: 'Ingresso', piano: 'p0', pts: rect(.05, .1, .26, .3), base: [22, 45, 520, 240] },
  { id: 'Sala conferenze', piano: 'p0', pts: rect(.36, .1, .34, .38), base: [23.5, 48, 700, 420], people: true, spec: 4200,
    rele: [{ k: 'hvac_freddo', n: 'HVAC Freddo', on: true }, { k: 'ventola', n: 'Ventola', on: true, vel: 2, vels: 3 }, { k: 'deumidificatore', n: 'Deumidificatore', on: false }] },
  { id: 'Open space', piano: 'p0', pts: rect(.05, .5, .5, .4), base: [24, 42, 640, 520], spec: 5600,
    rele: [{ k: 'hvac_caldo', n: 'HVAC Caldo', on: false }, { k: 'hvac_freddo', n: 'HVAC Freddo', on: true }] },
  { id: 'Laboratorio', piano: 'p0', pts: rect(.6, .55, .35, .35), base: [25.5, 38, 580, 780],
    rele: [{ k: 'ventola', n: 'Ventola', on: false }, { k: 'umidificatore', n: 'Umidificatore', on: true }] },
  { id: 'Direzione', piano: 'p1', pts: rect(.08, .12, .3, .35), base: [22.5, 44, 540, 300], spec: 3000 },
  { id: 'Showroom', piano: 'p1', pts: rect(.45, .12, .47, .5), base: [24.5, 50, 760, 900], spec: 6500 },
  { id: 'Archivio', piano: 'p1', pts: rect(.08, .55, .3, .33), base: [20.5, 35, 450, 90] },
];

const spectrum = (cct, t) => {
  // Spettro plausibile: corpo nero approssimato sui canali AS7341 (415..680 nm) con un po' di vita.
  const nm = [415, 445, 480, 515, 555, 590, 630, 680], h = 6.626e-34, c = 3e8, k = 1.381e-23;
  const bb = nm.map(l => { const L = l * 1e-9; return 1 / (L ** 5 * (Math.exp(h * c / (L * k * cct)) - 1)); });
  const mx = Math.max(...bb);
  const v = bb.map((x, i) => Math.max(0.05, x / mx * 1000 * (1 + 0.05 * Math.sin(t * 1.3 + i))));
  return [...v, 900, 300].map(x => +x.toFixed(2));
};

/** Storico simulato di una metrica (m = t|hum|co2|lux): una curva lenta con un po' di rumore e la banda min-max. */
export function demoHistory(id, m, hours) {
  const z = ZONES.find(z => z.id === id); if (!z) return [];
  const i = ZONES.indexOf(z), base = z.base[{ t: 0, hum: 1, co2: 2, lux: 3 }[m]];
  const amp = { t: 1.6, hum: 6, co2: z.people ? 380 : 90, lux: 90 }[m], now = Math.floor(Date.now() / 1000), step = hours <= 6 ? 300 : 900, pts = [];
  for (let t = now - hours * 3600; t <= now; t += step) {
    const av = base + Math.sin(t / 5400 + i) * amp + Math.sin(t / 700 + i * 3) * amp * .15, sp = amp * .25, r = (v) => +Math.max(0, v).toFixed(1);
    pts.push({ t, mn: r(av - sp), av: r(av), mx: r(av + sp) });
  }
  return pts;
}

// Relè simulati: stato in memoria, così in ?demo gli interruttori rispondono davvero.
const DR = {};
const demoReleState = (id) => (DR[id] ||= { manuale: false, items: (ZONES.find(z => z.id === id)?.rele || []).map(r => ({ vel: 0, vels: 0, tot: 1, ...r })) });

/** Comando relè simulato, stessa forma del body di POST /fair/api/zone/<zona>/rele. */
export function demoRele(id, body) {
  const s = demoReleState(id);
  if (body.manuale === false) { s.manuale = false; return { ok: true, n: 0 }; }
  const r = s.items.find(r => r.k === body.k); if (!r) return { ok: true, n: 0 };
  s.manuale = true;
  if (body.vel != null) { r.vel = body.vel; r.on = body.vel > 0; } else r.on = !!body.on;
  return { ok: true, n: 1 };
}

export function demoState() {
  const t = Date.now() / 1000, zones = [], spectra = {};
  ZONES.forEach((z, i) => {
    const wob = (a, p) => Math.sin(t / p + i * 1.7) * a;
    let co2 = z.base[2] + wob(60, 9);
    if (z.people) co2 += 380 + 330 * Math.sin(t / 25); // la sala si riempie e si svuota
    zones.push({
      id: z.id, piano: z.piano, pts: z.pts, colore: null,
      t: +(z.base[0] + wob(.8, 14)).toFixed(1), hum: +(z.base[1] + wob(3, 11)).toFixed(0), co2: Math.round(co2),
      lux: Math.round(Math.max(0, z.base[3] + wob(60, 7))), pir: Math.sin(t / 8 + i) > 0.2, cct: z.spec ?? null,
      luci: [Math.round(3 + wob(2, 30)), 6], rele: demoReleState(z.id).items, manuale: demoReleState(z.id).manuale, dim: 80, ct: z.spec ? Math.round(z.spec / 100) * 100 : null, w: +(40 + i * 12 + wob(8, 6)).toFixed(1), wh: 1200 + i * 310,
    });
    if (z.spec) {
      const cct = z.spec + wob(120, 17), [x, y] = planck(cct);
      spectra[z.id] = [{ id: z.id + '|1', name: 'Sensore spettrale', cct: Math.round(cct), cx: +x.toFixed(4), cy: +y.toFixed(4), spec: spectrum(cct, t) }];
    }
  });
  return {
    ts: Math.round(t), nome: 'Demo Building', piani: [{ id: 'p0', nome: 'Piano Terra', img: false }, { id: 'p1', nome: 'Primo Piano', img: false }],
    zones, spectra, totali: { w: +zones.reduce((a, z) => a + z.w, 0).toFixed(1), wh: zones.reduce((a, z) => a + z.wh, 0), luci: [18, 42] },
  };
}
