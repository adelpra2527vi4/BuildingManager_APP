// Scale colore per le metriche e conversioni colorimetriche.
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function ramp(stops, t) {
  t = clamp(t);
  const i = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - i;
  return stops[i].map((c, k) => Math.round(lerp(c, stops[i + 1][k], f)));
}

const STOPS = {
  t: [[59, 130, 246], [34, 211, 238], [52, 211, 153], [250, 204, 21], [249, 115, 22], [239, 68, 68]],
  co2: [[52, 211, 153], [132, 204, 22], [250, 204, 21], [249, 115, 22], [239, 68, 68]],
  hum: [[250, 176, 60], [52, 211, 153], [34, 211, 238], [59, 130, 246]],
  lux: [[30, 41, 59], [120, 90, 40], [250, 204, 21], [255, 247, 205]],
};
const RANGE = { t: [16, 32], co2: [400, 2000], hum: [20, 80], lux: [0, 1000] };
export const METRICS = {
  t: { label: 'Temperatura', unit: '°C', dec: 1 },
  co2: { label: 'CO₂', unit: 'ppm', dec: 0 },
  hum: { label: 'Umidità', unit: '%', dec: 0 },
  lux: { label: 'Luce', unit: 'lx', dec: 0 },
};

export const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export function metricColor(m, v) {
  const [a, b] = RANGE[m];
  return ramp(STOPS[m], (v - a) / (b - a));
}

/** Lunghezza d'onda (nm) → RGB approssimato (Dan Bruton). */
export function nmToRgb(nm) {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 780) r = 1;
  const f = nm < 420 ? 0.3 + 0.7 * (nm - 380) / 40 : nm > 700 ? 0.3 + 0.7 * (780 - nm) / 80 : 1;
  return [r, g, b].map(c => Math.round(255 * Math.pow(c * f, 0.8)));
}

/** Locus spettrale CIE 1931 (nm → x,y), tabella standard ridotta. */
export const LOCUS = [[380, .1741, .005], [420, .1714, .0051], [440, .1644, .0109], [460, .144, .0297], [470, .1241, .0578],
  [480, .0913, .1327], [490, .0454, .295], [500, .0082, .5384], [510, .0139, .7502], [520, .0743, .8338], [530, .1547, .8059],
  [540, .2296, .7543], [550, .3016, .6923], [560, .3731, .6245], [570, .4441, .5547], [580, .5125, .4866], [590, .5752, .4242],
  [600, .627, .3725], [620, .6915, .3083], [640, .719, .2809], [700, .7347, .2653]];

/** Locus di Planck (Kim et al.): CCT in K → x,y. */
export function planck(T) {
  T = clamp(T, 1667, 25000);
  const x = T <= 4000 ? -0.2661239e9 / T ** 3 - 0.2343589e6 / T ** 2 + 0.8776956e3 / T + 0.17991
    : -3.0258469e9 / T ** 3 + 2.1070379e6 / T ** 2 + 0.2226347e3 / T + 0.24039;
  const y = T <= 2222 ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
    : T <= 4000 ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
      : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483;
  return [x, y];
}

/** CCT (K) → colore sRGB approssimato del bianco emesso (Tanner Helland). */
export function cctToRgb(K) {
  const t = clamp(K, 1000, 12000) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [r, g, b].map(c => Math.round(clamp(c, 0, 255)));
}

export const verdictCo2 = (p) => p < 600 ? 'Aria eccellente' : p < 800 ? 'Aria ottima' : p < 1000 ? 'Aria buona'
  : p < 1400 ? 'Da ricambiare' : 'Aprire le finestre!';
