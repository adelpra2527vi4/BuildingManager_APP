// Animazioni ambiente: termometro, goccia d'umidita', radar di presenza con persone stimate.
import { Fx } from './fx.js';
import { metricColor, rgb } from './scales.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Termometro: tubo con liquido che sale/scende verso la temperatura, colore dalla scala, bollicine. */
export class ThermoFx extends Fx {
  constructor(canvas) { super(canvas); this.v = 22; this.cur = 22; this.bub = Array.from({ length: 10 }, () => ({ y: Math.random(), x: Math.random() - .5, s: .5 + Math.random() })); }
  set(v) { this.v = v; }
  draw(t, dt) {
    const g = this.g, W = this.w, H = this.h; this.cur += (this.v - this.cur) * Math.min(1, dt * 2);
    const col = metricColor('t', this.cur), cx = W * .27, top = 14, bot = H - 40, r = 20, tw = 15;
    const lvl = clamp((this.cur - 10) / 25, 0, 1);
    g.clearRect(0, 0, W, H);
    const halo = g.createRadialGradient(cx, bot, 0, cx, bot, H * .9);
    halo.addColorStop(0, rgb(col, .28)); halo.addColorStop(1, rgb(col, 0)); g.fillStyle = halo; g.fillRect(0, 0, W, H);
    // tubo
    g.fillStyle = 'rgba(255,255,255,.07)'; g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect(cx - tw / 2, top, tw, bot - top, tw / 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(cx, bot + r - 4, r, 0, 6.28); g.fill(); g.stroke();
    // liquido
    const y = bot - (bot - top - 8) * lvl;
    g.fillStyle = rgb(col, .95);
    g.beginPath(); g.arc(cx, bot + r - 4, r - 4, 0, 6.28); g.fill();
    g.beginPath(); g.roundRect(cx - tw / 2 + 3, y, tw - 6, bot - y + 6, 4); g.fill();
    // tacche
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '10px system-ui'; g.lineWidth = 1;
    for (let d = 10; d <= 35; d += 5) {
      const ty = bot - (bot - top - 8) * (d - 10) / 25;
      g.beginPath(); g.moveTo(cx + tw / 2 + 4, ty); g.lineTo(cx + tw / 2 + 11, ty); g.stroke(); g.fillText(d, cx + tw / 2 + 14, ty + 3);
    }
    // bollicine nel liquido
    if (!reduced) for (const b of this.bub) {
      b.y -= dt * (.12 + .1 * lvl) * b.s; if (b.y < 0) { b.y = 1; b.x = Math.random() - .5; }
      const by = bot + 6 - (bot + 6 - y) * (1 - b.y);
      if (by < y + 3 || by > bot + 6) continue;
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx + b.x * (tw - 8), by, 1.6 * b.s, 0, 6.28); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.roundRect(cx - 2, top + 6, 2.5, bot - top - 18, 2); g.fill();
  }
}

/** Goccia: sagoma classica (punta in alto, base tonda) che si riempie con l'umidita', onde, bollicine e riflesso. */
export class DropFx extends Fx {
  constructor(canvas) {
    super(canvas); this.v = 45; this.cur = 45;
    this.bub = Array.from({ length: 9 }, () => ({ y: Math.random(), x: Math.random() * 2 - 1, s: .5 + Math.random() }));
  }
  set(v) { this.v = v; }
  draw(t, dt) {
    const g = this.g, W = this.w, H = this.h; this.cur += (this.v - this.cur) * Math.min(1, dt * 2);
    const s = Math.min((H - 28) / 3, 52), cx = W * .27, cy = (H - 3 * s) / 2 + 2 * s; // altezza totale 3s: punta a cy-2s, fondo a cy+s
    const k = clamp(this.cur / 100, 0, 1), col = metricColor('hum', this.cur), sp = reduced ? 0 : 1;
    const path = () => {
      g.beginPath(); g.moveTo(cx, cy - 2 * s);
      g.quadraticCurveTo(cx + .30 * s, cy - 1.05 * s, cx + .866 * s, cy - .5 * s);
      g.arc(cx, cy, s, -Math.PI / 6, Math.PI + Math.PI / 6, false);
      g.quadraticCurveTo(cx - .30 * s, cy - 1.05 * s, cx, cy - 2 * s); g.closePath();
    };
    g.clearRect(0, 0, W, H);
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, H); halo.addColorStop(0, rgb(col, .22)); halo.addColorStop(1, rgb(col, 0));
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    // vetro
    g.save(); path(); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.clip();
    // acqua: dal fondo (cy+s) verso la punta (cy-2s)
    const y0 = cy + s - 3 * s * k;
    const grad = g.createLinearGradient(0, y0, 0, cy + s); grad.addColorStop(0, rgb(col, .9)); grad.addColorStop(1, rgb(col, .55));
    for (const [amp, f, ph, a] of [[3.5, 2.4, 0, .55], [2.5, 3.3, 1.7, .4]]) {
      g.fillStyle = a > .5 ? grad : rgb(col, a); g.beginPath(); g.moveTo(cx - s - 2, cy + s + 2);
      for (let x = cx - s - 2; x <= cx + s + 2; x += 3) g.lineTo(x, y0 + Math.sin((x - cx) / s * f * 2 + t * (1.5 + ph * .2) * sp + ph) * amp);
      g.lineTo(cx + s + 2, cy + s + 2); g.closePath(); g.fill();
    }
    for (const b of this.bub) { // bollicine
      b.y -= dt * (.10 + .08 * k) * b.s * sp; if (b.y < 0) { b.y = 1; b.x = Math.random() * 2 - 1; }
      const by = cy + s - (cy + s - y0) * (1 - b.y);
      if (by < y0 + 4) continue;
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(cx + b.x * s * .6, by, 1.5 * b.s, 0, 6.28); g.fill();
    }
    g.restore();
    path(); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.6; g.stroke();
    // riflesso a sinistra, sul bordo della base
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy, s * .78, Math.PI * .72, Math.PI * .95); g.stroke(); g.lineCap = 'butt';
  }
}

/** Presenza: a destra figure umane (una per persona stimata dalla CO2; senza CO2 una sola, accesa dal PIR).
 *  Il PIR e' mostrato anche nel testo a sinistra con un pallino che pulsa. */
export class PresenceFx extends Fx {
  constructor(canvas) { super(canvas); this.pir = false; this.n = null; this.icons = []; this.act = 0; }
  set(pir, n) {
    this.pir = !!pir; this.n = n;
    const want = n == null ? 0 : Math.min(n, 30);
    while (this.icons.length < want) this.icons.push({ k: 0, tgt: 1, ph: Math.random() * 6.28 });
    this.icons.forEach((ic, i) => { ic.tgt = i < want ? 1 : 0; });
  }
  person(x, y, s, fill, line) { // y = piedi
    const g = this.g;
    g.beginPath(); g.arc(x, y - s * 1.55, s * .36, 0, 6.28);
    g.roundRect(x - s * .62, y - s * 1.1, s * 1.24, s * 1.1, [s * .6, s * .6, s * .12, s * .12]);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (line) { g.strokeStyle = line; g.lineWidth = 1.6; g.stroke(); }
  }
  draw(t, dt) {
    const g = this.g, W = this.w, H = this.h, x0 = W * .46, aw = W - x0 - 8, ah = H - 16;
    this.act += ((this.pir ? 1 : 0) - this.act) * Math.min(1, dt * 3);
    g.clearRect(0, 0, W, H);
    const green = [60, 220, 140], sp = reduced ? 0 : 1;
    const aura = g.createRadialGradient(x0 + aw / 2, H / 2, 0, x0 + aw / 2, H / 2, Math.max(aw, ah) * .7);
    aura.addColorStop(0, rgb(green, .22 * this.act)); aura.addColorStop(1, rgb(green, 0)); g.fillStyle = aura; g.fillRect(x0 - 10, 0, aw + 20, H);
    if (this.n == null || this.n === 0) { // una sola figura: accesa dal PIR, spenta senza movimento
      const s = Math.min(aw * .5, ah * .45), cx = x0 + aw / 2, fy = H / 2 + s * .8;
      if (this.act > .02) for (let i = 0; i < 2; i++) {
        const p = (t * .5 * sp + i / 2) % 1; g.strokeStyle = rgb(green, (1 - p) * .35 * this.act); g.lineWidth = 2;
        g.beginPath(); g.arc(cx, fy - s * .8, s * (.9 + p * 1.1), 0, 6.28); g.stroke();
      }
      this.person(cx, fy, s, this.act > .5 ? rgb(green, .35 + .6 * this.act) : null, this.act > .5 ? rgb(green, .9) : 'rgba(255,255,255,.28)');
      return;
    }
    const cnt = this.icons.length, cols = Math.max(1, Math.min(cnt, Math.ceil(Math.sqrt(cnt * aw / ah * 1.6))));
    const rows = Math.ceil(cnt / cols), cw = aw / cols, rh = ah / rows, s = Math.min(cw * .5, rh * .55);
    this.icons.forEach((ic, i) => {
      ic.k += (ic.tgt - ic.k) * Math.min(1, dt * 5);
      if (ic.k < .02) return;
      const px = x0 + (i % cols) * cw + cw / 2, fy = 8 + Math.floor(i / cols) * rh + rh * .5 + s * .8 - Math.abs(Math.sin(t * 2 + ic.ph)) * 2.5 * this.act * sp, k = ic.k;
      this.person(px, fy, s * k, rgb([255, 214, 120], .95 * k), null);
    });
  }
}
