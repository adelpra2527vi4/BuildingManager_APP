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

/** Goccia: si riempie con l'umidita', due onde sovrapposte, riflesso. */
export class DropFx extends Fx {
  constructor(canvas) { super(canvas); this.v = 45; this.cur = 45; }
  set(v) { this.v = v; }
  draw(t, dt) {
    const g = this.g, W = this.w, H = this.h; this.cur += (this.v - this.cur) * Math.min(1, dt * 2);
    const cx = W * .27, s = Math.min(H * .42, 62), cy = H * .56;
    const k = clamp(this.cur / 100, 0, 1), col = metricColor('hum', this.cur);
    const path = () => {
      g.beginPath(); g.moveTo(cx, cy - s * 1.25);
      g.bezierCurveTo(cx + s * .15, cy - s * .75, cx + s, cy - s * .2, cx + s, cy + s * .25);
      g.bezierCurveTo(cx + s, cy + s * .85, cx + s * .55, cy + s * 1.05, cx, cy + s * 1.05);
      g.bezierCurveTo(cx - s * .55, cy + s * 1.05, cx - s, cy + s * .85, cx - s, cy + s * .25);
      g.bezierCurveTo(cx - s, cy - s * .2, cx - s * .15, cy - s * .75, cx, cy - s * 1.25); g.closePath();
    };
    g.clearRect(0, 0, W, H);
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, H); halo.addColorStop(0, rgb(col, .22)); halo.addColorStop(1, rgb(col, 0));
    g.fillStyle = halo; g.fillRect(0, 0, W, H);
    g.save(); path(); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.clip();
    const y0 = cy + s * 1.05 - (s * 2.3) * k, sp = reduced ? 0 : 1;
    for (const [amp, f, ph, a] of [[4, 2.2, 0, .55], [3, 3.1, 1.7, .4]]) {
      g.fillStyle = rgb(col, a); g.beginPath(); g.moveTo(cx - s, cy + s * 1.2);
      for (let x = cx - s; x <= cx + s; x += 3) g.lineTo(x, y0 + Math.sin((x - cx) / s * f * 2 + t * (1.4 + ph * .2) * sp + ph) * amp);
      g.lineTo(cx + s, cy + s * 1.2); g.closePath(); g.fill();
    }
    g.restore();
    path(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(cx - s * .45, cy - s * .05, 3, 9, .35, 0, 6.28); g.fill();
  }
}

/** Presenza: radar che pulsa col PIR e, a destra, le persone stimate dalla CO2 (icone che entrano/escono). */
export class PresenceFx extends Fx {
  constructor(canvas) { super(canvas); this.pir = false; this.n = null; this.icons = []; this.act = 0; }
  set(pir, n) {
    this.pir = !!pir; this.n = n;
    const want = n == null ? 0 : Math.min(n, 24);
    while (this.icons.length < want) this.icons.push({ k: 0, tgt: 1, ph: Math.random() * 6.28 });
    this.icons.forEach((ic, i) => { ic.tgt = i < want ? 1 : 0; });
  }
  draw(t, dt) {
    const g = this.g, W = this.w, H = this.h, col = this.pir ? [60, 220, 140] : [120, 140, 170];
    this.act += ((this.pir ? 1 : 0) - this.act) * Math.min(1, dt * 3);
    g.clearRect(0, 0, W, H);
    const cx = W * .22, cy = H / 2, R = Math.min(W * .2, H * .4);
    for (let i = 0; i < 3; i++) {
      const p = ((t * (this.pir ? .55 : .15) + i / 3) % 1);
      g.strokeStyle = rgb(col, (1 - p) * (.15 + .5 * this.act)); g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, R * (.25 + p * .85), 0, 6.28); g.stroke();
    }
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, R * .35); core.addColorStop(0, rgb(col, .9)); core.addColorStop(1, rgb(col, 0.1));
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, R * (.28 + .04 * Math.sin(t * 4) * this.act), 0, 6.28); g.fill();
    if (!reduced && this.pir) { // sweep
      const a = t * 2.4; g.fillStyle = rgb(col, .18); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 1.1, a, a + .6); g.closePath(); g.fill();
    }
    // persone: griglia a destra, fino a 24
    const x0 = W * .46, cols = 6, cw = (W - x0 - 10) / cols, rh = Math.min(cw * 1.5, (H - 16) / 4);
    this.icons.forEach((ic, i) => {
      ic.k += (ic.tgt - ic.k) * Math.min(1, dt * 5);
      if (ic.k < .02) return;
      const px = x0 + (i % cols) * cw + cw / 2, py = 10 + Math.floor(i / cols) * rh + rh * .7 + Math.sin(t * 1.6 + ic.ph) * 1.5, s = Math.min(cw, rh) * .38 * ic.k;
      g.fillStyle = rgb([255, 214, 120], .95 * ic.k);
      g.beginPath(); g.arc(px, py - s * 1.1, s * .55, 0, 6.28); g.fill();
      g.beginPath(); g.roundRect(px - s * .8, py - s * .4, s * 1.6, s * 1.5, s * .6); g.fill();
    });
  }
}
