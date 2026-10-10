// Grim Core: colour maths. Everything is done in OKLCH so a recoloured
// palette keeps the light/dark structure of the theme it started from.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** "#rgb", "#rgba", "#rrggbb", "#rrggbbaa", "rgb()", "rgba()" -> {r,g,b,a} (0..1), or null. */
export function parseColor(input) {
  const s = String(input ?? "").trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: clamp(+m[1] / 255, 0, 1), g: clamp(+m[2] / 255, 0, 1), b: clamp(+m[3] / 255, 0, 1), a: clamp(a, 0, 1) };
  }
  return null;
}

export const isHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s ?? "").trim());

export function toOklch({ r, g, b }) {
  const lr = toLin(r), lg = toLin(g), lb = toLin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}

function oklchToLinear(L, C, h) {
  const A = C * Math.cos(h), B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

/** OKLCH -> sRGB, lowering chroma until the colour fits the screen gamut. */
export function fromOklch(L, C, h) {
  L = clamp(L, 0, 1);
  const fits = (c) => oklchToLinear(L, c, h).every((v) => v >= -0.0005 && v <= 1.0005);
  let c = Math.max(0, C);
  if (!fits(c)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid; else hi = mid;
    }
    c = lo;
  }
  const [r, g, b] = oklchToLinear(L, c, h).map((v) => clamp(toGam(clamp(v, 0, 1)), 0, 1));
  return { r, g, b };
}

export function formatColor({ r, g, b, a = 1 }) {
  const i = (v) => Math.round(clamp(v, 0, 1) * 255);
  if (a < 0.999) return `rgba(${i(r)}, ${i(g)}, ${i(b)}, ${Math.round(a * 1000) / 1000})`;
  return "#" + [r, g, b].map((v) => i(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Build a recolouring function.
 *   accent : the colour the user picked
 *   ref    : the accent colour of the theme being recoloured
 *   tint   : 0..2, how much of the accent hue leaks into backgrounds and text
 * Each source colour keeps its own lightness; its hue becomes the accent hue and
 * its saturation is scaled to match. Strongly coloured tokens also drift toward
 * the accent's lightness so a pale or deep pick still reads as that colour.
 */
export function makeRecolor(accent, ref, tint = 1) {
  const A = toOklch(parseColor(accent) ?? parseColor("#a3161b"));
  const R = toOklch(parseColor(ref));
  const k = clamp(A.C / Math.max(R.C, 0.01), 0, 1.7);
  const dL = A.L - R.L;
  return (value) => {
    const src = parseColor(value);
    if (!src) return null;
    const o = toOklch(src);
    if (o.C < 0.0015) return formatColor(src); // true greys, black and white stay put
    const w = clamp(o.C / R.C, 0, 1); // 0 = neutral surface, 1 = full accent
    const C = o.C * k * (w + (1 - w) * clamp(tint, 0, 2));
    const L = clamp(o.L + dL * 0.75 * w * w, 0.02, 0.99);
    return formatColor({ ...fromOklch(L, C, A.h), a: src.a });
  };
}

/** Black or bone, whichever reads better on the given colour. */
export function inkOn(value) {
  const c = parseColor(value);
  return c && toOklch(c).L > 0.7 ? "#120b0c" : "#f4efe6";
}
