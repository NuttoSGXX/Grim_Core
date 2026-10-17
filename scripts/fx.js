// Lightweight canvas particles for roll outcomes. One emitter per sigil.
import { Loop } from "./dice3d.js";

const rand = (a, b) => a + Math.random() * (b - a);

const KINDS = {
  // Natural 20: a golden burst, then drifting motes that rise
  gold: {
    burst: 110, rate: 26, blend: "lighter",
    spawn(p, burst) {
      const a = rand(0, Math.PI * 2), sp = burst ? rand(0.25, 1.15) : rand(0.02, 0.12);
      const r = burst ? rand(0, 0.06) : rand(0.1, 0.48);
      p.x = Math.cos(a) * r; p.y = Math.sin(a) * r;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - (burst ? 0 : rand(0.05, 0.16));
      p.g = burst ? 0.35 : -0.03; p.drag = burst ? 2.2 : 0.4;
      p.life = p.max = burst ? rand(0.7, 1.7) : rand(1.2, 2.6);
      p.size = rand(0.004, 0.012); p.tw = rand(6, 16);
      p.col = Math.random() < 0.3 ? [255, 250, 225] : Math.random() < 0.5 ? [255, 214, 110] : [240, 170, 50];
      p.star = Math.random() < 0.22;
    }
  },
  // Natural 1: ash and dying embers sinking down
  doom: {
    burst: 70, rate: 18, blend: "source-over",
    spawn(p, burst) {
      const a = rand(0, Math.PI * 2), r = rand(0.05, 0.5);
      p.x = Math.cos(a) * r; p.y = Math.sin(a) * r * 0.9;
      p.vx = rand(-0.06, 0.06) + (burst ? Math.cos(a) * rand(0.1, 0.5) : 0);
      p.vy = rand(0.04, 0.22) + (burst ? Math.sin(a) * rand(0.1, 0.4) : 0);
      p.g = 0.16; p.drag = burst ? 1.8 : 0.3;
      p.life = p.max = rand(1.2, 2.8);
      p.size = rand(0.004, 0.011); p.tw = rand(2, 6);
      const ember = Math.random() < 0.3;
      p.col = ember ? [190, 24, 24] : Math.random() < 0.5 ? [70, 66, 66] : [28, 24, 24];
      p.glow = ember; p.sway = rand(1, 3);
    }
  },
  // ordinary success: a brief pale shimmer
  spark: {
    burst: 34, rate: 0, blend: "lighter",
    spawn(p) {
      const a = rand(0, Math.PI * 2), sp = rand(0.15, 0.6);
      p.x = Math.cos(a) * 0.05; p.y = Math.sin(a) * 0.05;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.g = 0.2; p.drag = 2.4;
      p.life = p.max = rand(0.5, 1.1); p.size = rand(0.003, 0.008); p.tw = rand(8, 14);
      p.col = [255, 236, 214];
    }
  }
};

export class Emitter {
  constructor(canvas) {
    this.el = canvas; this.ctx = canvas.getContext("2d");
    this.parts = []; this.kind = null; this.acc = 0; this.px = 0;
  }

  /** @param {"gold"|"doom"|"spark"} kind */
  play(kind) {
    this.kind = KINDS[kind]; if (!this.kind) return;
    this.parts.length = 0;
    for (let i = 0; i < this.kind.burst; i++) { const p = {}; this.kind.spawn(p, true); this.parts.push(p); }
    Loop.add(this);
  }

  tick(dt, now) {
    const css = this.el.clientWidth;
    const px = Math.round(css * Math.min(2, window.devicePixelRatio || 1));
    if (px && px !== this.px) { this.px = px; this.el.width = px; this.el.height = px; }
    const { ctx, kind } = this; if (!kind || !this.px) return;
    this.acc += kind.rate * dt;
    while (this.acc >= 1 && this.parts.length < 220) { this.acc--; const p = {}; kind.spawn(p, false); this.parts.push(p); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.px, this.px);
    ctx.globalCompositeOperation = kind.blend;
    // The canvas is larger than the sigil (see CSS), so 1 unit = one sigil diameter.
    const unit = this.px / 1.7, c = this.px / 2;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += (p.vx + (p.sway ? Math.sin(now * p.sway + i) * 0.03 : 0)) * dt; p.y += p.vy * dt;
      const k = p.life / p.max;
      const a = Math.min(1, k * 2.2) * (0.6 + 0.4 * Math.sin(now * p.tw + i));
      const x = c + p.x * unit, y = c + p.y * unit, s = p.size * unit * (0.6 + 0.4 * k);
      ctx.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${Math.max(0, a)})`;
      if (p.star) {
        ctx.beginPath();
        ctx.moveTo(x, y - s * 3.2); ctx.quadraticCurveTo(x, y, x + s * 3.2, y); ctx.quadraticCurveTo(x, y, x, y + s * 3.2);
        ctx.quadraticCurveTo(x, y, x - s * 3.2, y); ctx.quadraticCurveTo(x, y, x, y - s * 3.2); ctx.fill();
      } else {
        if (p.glow) { ctx.shadowColor = "rgba(255,40,30,.9)"; ctx.shadowBlur = s * 4; }
        ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
        if (p.glow) ctx.shadowBlur = 0;
      }
    }
    if (!this.parts.length && !kind.rate) Loop.remove(this);
  }

  destroy() { Loop.remove(this); this.parts.length = 0; }
}
