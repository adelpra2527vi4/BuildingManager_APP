// Dati simulati per provare la web app senza Raspberry (apri con ?demo).
import { planck } from './scales.js';

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ZONES = [
  { id: 'Ingresso', piano: 'p0', pts: rect(.05, .1, .26, .3), base: [22, 45, 520, 240] },
  { id: 'Sala conferenze', piano: 'p0', pts: rect(.36, .1, .34, .38), base: [23.5, 48, 700, 420], people: true, spec: 4200 },
  { id: 'Open space', piano: 'p0', pts: rect(.05, .5, .5, .4), base: [24, 42, 640, 520], spec: 5600 },
  { id: 'Laboratorio', piano: 'p0', pts: rect(.6, .55, .35, .35), base: [25.5, 38, 580, 780] },
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
      luci: [Math.round(3 + wob(2, 30)), 6], w: +(40 + i * 12 + wob(8, 6)).toFixed(1), wh: 1200 + i * 310,
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
