// Effetti canvas: aria/CO₂ (particelle), spettro AS7341, diagramma di cromaticità.
import { metricColor, rgb, nmToRgb, LOCUS, planck, cctToRgb } from './scales.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Base: canvas a DPI corretto con ciclo requestAnimationFrame fermato quando non visibile. */
export class Fx {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d'); this.t0 = performance.now(); this.raf = 0;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    this.resize();
  }
  resize() {
    const d = Math.min(devicePixelRatio || 1, 2), r = this.c.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = this.w * d; this.c.height = this.h * d; this.g.setTransform(d, 0, 0, d, 0, 0);
    this.onResize?.();
  }
  start() {
    if (this.raf) return;
    let last = performance.now();
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      this.draw((now - this.t0) / 1000, dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; this.ro.disconnect(); }
}

/** Aria: molecole di CO₂ (O=C=O) tra molecole di O₂; piu' ppm = piu' molecole, piu' rosse e agitate. */
export class AirField extends Fx {
  constructor(canvas) { super(canvas); this.ppm = 420; this.cur = 420; this.mol = []; this.o2 = []; this.onResize(); }
  set(ppm) { this.ppm = ppm; }
  onResize() { if (!this.mol) return; this.o2 = []; this.fill(); }
  fill() {
    const want = Math.round(clamp((this.cur - 350) / 1650, 0, 1) * 46 + 4);
    const area = this.w * this.h / 60000;
    while (this.mol.length < want * area + 3) this.mol.push(this.spawn(true));
    while (this.mol.length > want * area + 3) this.mol.pop();
    while (this.o2.length < 36 * area + 8) this.o2.push({ x: Math.random() * this.w, y: Math.random() * this.h, v: Math.random() * 6.28, r: 1 + Math.random() * 1.6 });
  }
  spawn(any) {
    return { x: Math.random() * this.w, y: any ? Math.random() * this.h : this.h + 12, a: Math.random() * 6.28, va: (Math.random() - .5) * 1.2,
      s: 8 + Math.random() * 7, vx: (Math.random() - .5) * 14, vy: -(6 + Math.random() * 14), ph: Math.random() * 6.28 };
  }
  draw(t, dt) {
    const g = this.g; this.cur += (this.ppm - this.cur) * Math.min(1, dt * 2); this.fill();
    const col = metricColor('co2', this.cur), k = clamp((this.cur - 400) / 1600, 0, 1);
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, this.w, this.h);
    // alone di fondo: respira piu' in fretta quando l'aria e' peggiore
    const breath = 0.5 + 0.5 * Math.sin(t * (1.2 + k * 3.2));
    const rg = g.createRadialGradient(this.w / 2, this.h / 2, 0, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
    rg.addColorStop(0, rgb(col, 0.16 + 0.18 * breath + 0.1 * k)); rg.addColorStop(1, rgb(col, 0));
    g.fillStyle = rg; g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    const sp = reduced ? 0.15 : 1;
    for (const o of this.o2) {
      o.v += dt * .8; o.x += Math.cos(o.v) * 6 * dt * sp; o.y += Math.sin(o.v * .7) * 6 * dt * sp;
      if (o.x < -5) o.x = this.w + 5; if (o.x > this.w + 5) o.x = -5; if (o.y < -5) o.y = this.h + 5; if (o.y > this.h + 5) o.y = -5;
      g.fillStyle = 'rgba(120,190,255,.38)'; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.28); g.fill();
    }
    const jit = 1 + k * 2.4;
    for (const m of this.mol) {
      m.a += m.va * dt * jit * sp; m.x += (m.vx + Math.sin(t * 2 + m.ph) * 8 * jit) * dt * sp; m.y += m.vy * dt * (0.5 + k) * sp;
      if (m.y < -20 || m.x < -30 || m.x > this.w + 30) Object.assign(m, this.spawn(false), { x: Math.random() * this.w });
      const ca = Math.cos(m.a), sa = Math.sin(m.a), s = m.s;
      const glow = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, s * 2.2);
      glow.addColorStop(0, rgb(col, .35)); glow.addColorStop(1, rgb(col, 0));
      g.fillStyle = glow; g.fillRect(m.x - s * 2.2, m.y - s * 2.2, s * 4.4, s * 4.4);
      g.strokeStyle = rgb(col, .6); g.lineWidth = 1.6; g.beginPath();
      g.moveTo(m.x - ca * s, m.y - sa * s); g.lineTo(m.x + ca * s, m.y + sa * s); g.stroke();
      g.fillStyle = rgb(col, .95); g.beginPath(); g.arc(m.x, m.y, s * .38, 0, 6.28); g.fill();
      g.fillStyle = rgb([255, 255, 255], .7);
      for (const sgn of [-1, 1]) { g.beginPath(); g.arc(m.x + ca * s * sgn, m.y + sa * s * sgn, s * .3, 0, 6.28); g.fill(); }
    }
  }
}

const CH_NM = [415, 445, 480, 515, 555, 590, 630, 680];

/** Spettro AS7341: 8 canali visibili su curva liscia a colori reali, scintillio e riflesso. */
export class SpectrumChart extends Fx {
  constructor(canvas) { super(canvas); this.tgt = Array(8).fill(0); this.cur = Array(8).fill(0); this.hover = -1;
    const mv = (e) => { const r = canvas.getBoundingClientRect(), p = (e.touches?.[0] || e).clientX - r.left;
      this.hover = clamp(Math.round(((p / r.width) * 340 + 380 - 415) / 37.1), 0, 7); };
    canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerdown', mv);
    canvas.addEventListener('pointerleave', () => { this.hover = -1; }); }
  /** spec: 10 valori (F1..F8, clear, NIR); si normalizza sul massimo dei canali visibili. */
  set(spec) { const vis = spec.slice(0, 8), mx = Math.max(...vis, 1e-6); this.tgt = vis.map(v => v / mx); this.raw = spec; }
  X(nm) { return 14 + (nm - 380) / 340 * (this.w - 28); }
  draw(t, dt) {
    const g = this.g, w = this.w, h = this.h, base = h - 26, top = 16;
    for (let i = 0; i < 8; i++) this.cur[i] += (this.tgt[i] - this.cur[i]) * Math.min(1, dt * 5);
    g.clearRect(0, 0, w, h);
    const pts = [[this.X(392), base - 1], ...CH_NM.map((nm, i) => [this.X(nm), base - (base - top) * (this.cur[i] * 0.88 + 0.02 * Math.sin(t * 2 + i))]), [this.X(708), base - 1]];
    const N = pts.length;
    const path = (close) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < N - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(N - 1, i + 2)];
        g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      }
      if (close) { g.lineTo(pts[N - 1][0], base); g.lineTo(pts[0][0], base); g.closePath(); }
    };
    const grad = g.createLinearGradient(this.X(380), 0, this.X(720), 0);
    for (let nm = 380; nm <= 720; nm += 20) grad.addColorStop((nm - 380) / 340, rgb(nmToRgb(clamp(nm, 380, 700)), 1));
    g.save(); path(true); g.globalAlpha = .85; g.fillStyle = grad; g.shadowColor = 'rgba(255,255,255,.35)'; g.shadowBlur = 24; g.fill(); g.restore();
    // velo scuro verso il basso per dare profondita'
    const fade = g.createLinearGradient(0, top, 0, base); fade.addColorStop(0, 'rgba(10,14,22,0)'); fade.addColorStop(1, 'rgba(10,14,22,.78)');
    g.save(); path(true); g.fillStyle = fade; g.fill(); g.restore();
    g.save(); path(false); g.lineWidth = 2.5; g.strokeStyle = grad; g.shadowColor = 'rgba(255,255,255,.7)'; g.shadowBlur = 10; g.stroke(); g.restore();
    // riflesso che scorre
    const sx = ((t * 0.18) % 1.4 - 0.2) * w, sh = g.createLinearGradient(sx - 60, 0, sx + 60, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); path(true); g.clip(); g.fillStyle = sh; g.fillRect(0, 0, w, h); g.restore();
    // asse e punti
    g.font = '10px system-ui'; g.textAlign = 'center'; g.fillStyle = 'rgba(200,215,235,.7)';
    for (let i = 0; i < 8; i++) {
      const c = nmToRgb(CH_NM[i]), on = i === this.hover;
      g.fillStyle = rgb(c, 1); g.beginPath(); g.arc(pts[i + 1][0], pts[i + 1][1], on ? 6 : 3.4, 0, 6.28); g.fill();
      g.fillStyle = on ? '#fff' : 'rgba(200,215,235,.7)'; g.fillText(CH_NM[i], pts[i + 1][0], h - 8);
    }
    if (this.hover >= 0 && this.raw) {
      const i = this.hover, txt = `${CH_NM[i]} nm · ${(this.tgt[i] * 100).toFixed(0)}%`, x = clamp(pts[i + 1][0], 46, w - 46), py = pts[i + 1][1];
      g.fillStyle = 'rgba(8,12,20,.85)'; g.beginPath(); g.roundRect(x - 44, Math.max(2, py - 34), 88, 20, 8); g.fill();
      g.fillStyle = '#fff'; g.font = '600 11px system-ui'; g.fillText(txt, x, Math.max(2, py - 34) + 14);
    }
  }
}

/** Diagramma CIE xy: contorno dello spettro visibile, curva di Planck e punto della sorgente. */
export class ChromaChart extends Fx {
  constructor(canvas) { super(canvas); this.xy = null; this.cct = null; this.px = null; }
  set(cx, cy, cct) { this.cct = cct; this.xy = cx != null && cy != null ? [cx, cy] : (cct ? planck(cct) : null); }
  draw(t) {
    const g = this.g, w = this.w, h = this.h, S = Math.min(w / 0.85, h / 0.9), ox = (w - S * 0.78) / 2, oy = h - 14;
    const P = ([x, y]) => [ox + x * S, oy - y * S];
    g.clearRect(0, 0, w, h);
    g.beginPath(); LOCUS.forEach(([, x, y], i) => { const [px, py] = P([x, y]); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
    const gr = g.createRadialGradient(...P([.33, .33]), 0, ...P([.33, .33]), S * 0.45);
    gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(1, 'rgba(255,255,255,.04)');
    g.fillStyle = gr; g.fill();
    for (let i = 0; i < LOCUS.length - 1; i++) {
      g.strokeStyle = rgb(nmToRgb(LOCUS[i][0]), 1); g.lineWidth = 3; g.beginPath();
      g.moveTo(...P([LOCUS[i][1], LOCUS[i][2]])); g.lineTo(...P([LOCUS[i + 1][1], LOCUS[i + 1][2]])); g.stroke();
    }
    g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath();
    for (let T = 1700; T <= 12000; T += 300) { const [px, py] = P(planck(T)); T === 1700 ? g.moveTo(px, py) : g.lineTo(px, py); }
    g.stroke(); g.setLineDash([]);
    if (this.xy) {
      const [px, py] = P(this.xy), col = this.cct ? cctToRgb(this.cct) : [255, 255, 255], pulse = (t % 1.6) / 1.6;
      g.strokeStyle = rgb(col, 1 - pulse); g.lineWidth = 2; g.beginPath(); g.arc(px, py, 5 + pulse * 22, 0, 6.28); g.stroke();
      g.fillStyle = rgb(col, 1); g.shadowColor = rgb(col, 1); g.shadowBlur = 16; g.beginPath(); g.arc(px, py, 6, 0, 6.28); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
  }
}

/** Anima un numero fino al nuovo valore (innerText) senza scatti. */
export function countTo(el, to, dec = 0) {
  if (to == null || isNaN(to)) { el.textContent = '—'; el._v = null; return; }
  const from = el._v ?? to; el._v = to; cancelAnimationFrame(el._r);
  if (reduced || from === to) { el.textContent = to.toFixed(dec); return; }
  const t0 = performance.now(), D = 700;
  const step = (n) => { const f = clamp((n - t0) / D, 0, 1), e = 1 - (1 - f) ** 3;
    el.textContent = (from + (to - from) * e).toFixed(dec); if (f < 1) el._r = requestAnimationFrame(step); };
  el._r = requestAnimationFrame(step);
}

/** Mini grafico a linea per lo storico locale (ultimi campioni). */
export function sparkline(svg, vals, color) {
  const v = vals.filter(x => x != null); if (v.length < 2) { svg.innerHTML = ''; return; }
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1) * 100).toFixed(1)},${(18 - (x - mn) / r * 16).toFixed(1)}`).join('');
  svg.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linecap="round"/>`;
}
