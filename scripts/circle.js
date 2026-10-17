// The dice sigil: four stacked layers that each rotate on their own.
// Motifs come from dice: d4 triangle, d6 cube, d8 diamond, d12 pentagon, d20 hexagon and a 1-20 number ring.
// Every layer is painted once onto a canvas with its glow baked in, so spinning costs
// the browser nothing more than rotating a picture. That keeps eight sigils smooth.

const RUNE = {
  a: "ᚨ", b: "ᛒ", c: "ᚲ", d: "ᛞ", e: "ᛖ", f: "ᚠ", g: "ᚷ", h: "ᚺ", i: "ᛁ", j: "ᛃ", k: "ᚲ", l: "ᛚ", m: "ᛗ",
  n: "ᚾ", o: "ᛟ", p: "ᛈ", q: "ᚲ", r: "ᚱ", s: "ᛊ", t: "ᛏ", u: "ᚢ", v: "ᚹ", w: "ᚹ", x: "ᛉ", y: "ᛇ", z: "ᛉ"
};
const POOL = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";

/** Turn any name (Latin, Thai, anything) into rune glyphs. */
export function toRunes(name) {
  let out = "";
  for (const ch of String(name ?? "").toLowerCase()) {
    if (/\s/.test(ch)) out += "᛫";
    else if (RUNE[ch]) out += RUNE[ch];
    else if (/[\p{L}\p{N}\p{M}]/u.test(ch)) out += POOL[ch.codePointAt(0) % POOL.length];
  }
  return out || "ᚠᚨᛏᛖ";
}

const TAU = Math.PI * 2;
function ngon(n, r, rot = -90, cx = 0, cy = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
function path(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  if (close) ctx.closePath();
}
const stroke = (ctx, pts, w, a = 1, close = true) => { ctx.lineWidth = w; ctx.globalAlpha = a; path(ctx, pts, close); ctx.stroke(); ctx.globalAlpha = 1; };
const ring = (ctx, r, w, a = 1) => { ctx.lineWidth = w; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; };
const line = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };

/** Small line-art dice for the five nodes on the ring. */
function glyph(ctx, kind, cx, cy, s) {
  const P = (n, r, rot) => ngon(n, r, rot, cx, cy), c = [cx, cy];
  ctx.lineWidth = 0.6;
  if (kind === "d4") { const t = P(3, s, -90); path(ctx, t); ctx.stroke(); t.forEach((v) => line(ctx, c, v)); return; }
  if (kind === "d6") { const h = P(6, s, -90); path(ctx, h); ctx.stroke(); [1, 3, 5].forEach((i) => line(ctx, c, h[i])); return; }
  if (kind === "d8") { const d = P(4, s, -90); path(ctx, d); ctx.stroke(); line(ctx, d[1], d[3]); line(ctx, d[0], [cx - s * 0.5, cy]); line(ctx, d[0], [cx + s * 0.5, cy]); line(ctx, d[2], [cx - s * 0.5, cy]); line(ctx, d[2], [cx + s * 0.5, cy]); return; }
  if (kind === "d12") { const o = P(10, s, -90), i = P(5, s * 0.55, -90); path(ctx, o); ctx.stroke(); path(ctx, i); ctx.stroke(); i.forEach((v, k) => line(ctx, v, o[k * 2])); return; }
  const h = P(6, s, -90), t = P(3, s * 0.56, -90);
  path(ctx, h); ctx.stroke(); path(ctx, t); ctx.stroke();
  [[0, 0], [1, 2], [2, 4], [0, 1], [0, 5], [1, 1], [1, 3], [2, 3], [2, 5]].forEach(([a, b]) => line(ctx, t[a], h[b]));
}

const PAINT = {
  // 1. outer band: the player's name in runes
  runes(ctx, s) {
    ring(ctx, 96, 0.9); ring(ctx, 80.6, 1.5); ring(ctx, 78.4, 0.5);
    ctx.lineWidth = 0.5; ctx.globalAlpha = 0.8;
    for (let i = 0; i < 72; i++) { const a = (i * 5 * Math.PI) / 180, r2 = i % 6 ? 98 : 99.4; line(ctx, [96.6 * Math.cos(a), 96.6 * Math.sin(a)], [r2 * Math.cos(a), r2 * Math.sin(a)]); }
    ctx.globalAlpha = 1;
    ctx.font = `8.8px "GFR Runic", "Noto Sans Runic", "Segoe UI Historic", "Segoe UI Symbol", sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const g = s.runes;
    g.forEach((ch, i) => { ctx.save(); ctx.rotate((i / g.length) * TAU); ctx.fillText(ch, 0, -88.3); ctx.restore(); });
  },
  // 2. d12 pentagon + d20 hexagon lattice
  geo(ctx) {
    const pent = ngon(5, 78.4, -90);
    stroke(ctx, pent, 1);
    stroke(ctx, [0, 2, 4, 1, 3].map((i) => pent[i]), 0.4, 0.45);
    stroke(ctx, ngon(6, 70, -90), 0.9);
    stroke(ctx, ngon(6, 70, -60), 0.4, 0.5);
    ngon(6, 65, -90).forEach(([x, y], i) => { path(ctx, ngon(3, 3, -90 + i * 60, x, y)); ctx.fill(); });
  },
  // 3. the d20 number ring
  nums(ctx) {
    ring(ctx, 57.6, 0.8); ring(ctx, 44.6, 0.8);
    ctx.setLineDash([1, 2.4]); ring(ctx, 42.6, 0.35, 0.6); ctx.setLineDash([]);
    ctx.font = `700 5.6px "GFR Num", Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 20; i++) {
      ctx.save(); ctx.rotate((i / 20) * TAU); ctx.fillText(String(i + 1), 0, -51);
      ctx.rotate(TAU / 40); line(ctx, [0, -57.4], [0, -55.2]); line(ctx, [0, -46.8], [0, -44.8]); ctx.restore();
    }
  },
  // 4. five dice nodes riding the inner rim
  nodes(ctx, s, color) {
    const kinds = ["d20", "d4", "d6", "d8", "d12"];
    ngon(5, 80, -90).forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, 8.4, 0, TAU); ctx.fillStyle = "#070506"; ctx.fill(); ctx.fillStyle = color;
      ctx.lineWidth = 1.1; ctx.stroke();
      ctx.lineWidth = 0.35; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y, 6.6, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      glyph(ctx, kinds[i], x, y, 4.7);
    });
  }
};
const ORDER = ["runes", "geo", "nums", "nodes"];
const PAD = 1.12; // canvases are a little larger than the sigil so the glow is not clipped (see CSS)

export class Sigil {
  constructor(name) {
    const unit = [...(toRunes(name) + "᛭")];
    const reps = Math.max(1, Math.round(56 / unit.length));
    this.runes = Array.from({ length: reps }, () => unit).flat();
    this.el = document.createElement("div");
    this.el.className = "gfr-sigil";
    this.layers = ORDER.map((k) => { const c = document.createElement("canvas"); c.className = `gfr-layer gfr-l-${k}`; this.el.appendChild(c); return c; });
    this.key = "";
  }

  /** (Re)draw all layers. Cheap enough to call on colour or size changes; skipped when nothing changed. */
  paint(sizeCss, color, glow = 1, force = false) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.max(64, Math.round(sizeCss * PAD * dpr));
    const key = `${px}|${color}|${glow}`;
    if (key === this.key && !force) return;
    this.key = key;
    const u = (sizeCss * dpr) / 200;
    this.layers.forEach((cv, i) => {
      cv.width = px; cv.height = px;
      const ctx = cv.getContext("2d");
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // pass 1 lays down the glow, pass 2 the crisp line work
      for (const pass of [0, 1]) {
        ctx.setTransform(u, 0, 0, u, px / 2, px / 2);
        ctx.strokeStyle = color; ctx.fillStyle = color;
        ctx.shadowColor = pass || !glow ? "transparent" : color;
        ctx.shadowBlur = pass ? 0 : sizeCss * dpr * 0.022 * glow;
        if (!pass && !glow) continue;
        PAINT[ORDER[i]](ctx, this, color);
      }
    });
  }
}

/** Fracture lines for a Natural 1. */
export function cracksHTML() {
  const d = [
    "M0 -22 L-14 -44 L-6 -66 L-22 -84 L-18 -99",
    "M-14 -44 L-40 -50 L-60 -38 L-92 -44",
    "M0 -22 L24 -16 L44 -32 L70 -26 L97 -38",
    "M24 -16 L40 6 L62 14 L72 40 L92 52",
    "M0 -22 L-26 -10 L-46 8 L-52 34 L-78 50",
    "M-52 34 L-44 60 L-58 86",
    "M62 14 L56 44 L68 78"
  ];
  const paths = (cls) => d.map((p, i) => `<path class="${cls}" d="${p}" pathLength="1" style="--i:${i}"/>`).join("");
  return `<svg class="gfr-cracks" viewBox="-100 -100 200 200" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths("gfr-crack-b")}${paths("gfr-crack-f")}</svg>`;
}
