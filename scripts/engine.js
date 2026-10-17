// Grim Core: turns the shared theme into (1) each module's own theme setting
// and (2) one <style> element that overrides the colour tokens of every module.

import { PALETTES } from "./palettes.js";
import { makeRecolor, isHex } from "./color.js";

export const MODULE_ID = "grim-core";
export const PRESETS = ["crimson", "ash", "amethyst", "abyss"];
const STYLE_ID = "grim-core-theme";

export const DEFAULT_THEME = Object.freeze({
  preset: "crimson", // crimson | ash | amethyst | abyss | custom
  accent: "#c8141e", // custom only
  base: "dark", //     custom only: dark | light
  tint: 100, //        custom only: 0..200 (%), accent hue in backgrounds
  off: [] //           module ids that should not follow the hub
});

/** Accent of each preset, for modules that take a single colour. */
const PRESET_ACCENT = { crimson: "#c8141e", ash: "#b9b9be", amethyst: "#8a4fd6", abyss: "#2f7fe0" };

/**
 * Every Grim module the hub knows.
 *   setting : the module's own theme setting; `map` renames a hub preset to the module's key
 *   sheet   : read the module's stylesheet and recolour tokens with this prefix (custom mode)
 *   table   : the module has no themes; write these tokens from the reference palettes
 *   accent  : the module takes one accent colour
 *   skip    : tokens that carry a meaning and must never change
 *   lift    : re-issue the module's own theme block on a stronger selector
 */
export const TARGETS = [
  { id: "grim-almanac", title: "Grim Almanac", setting: "theme", map: { abyss: "sapphire" }, sheet: "--ga-" },
  { id: "grim-theater", title: "Grim Theater of Mind", setting: "theme", map: { abyss: "sapphire" }, sheet: "--gt-" },
  {
    id: "grim-pulse", title: "Grim Pulse", setting: "theme", sheet: "--gp-",
    skip: ["friendly", "hostile", "neutral", "secret", "unknown", "blood", "blood-dark", "temp", "heal", "bone", "gold"]
  },
  {
    id: "grim-jukebox", title: "Grim Jukebox", setting: "theme", sheet: "--gjb-", skip: ["vinyl"],
    // Jukebox declares its tokens on "#gjb", which outranks its own "[data-gjb-theme]" rules,
    // so its built-in themes never show. Re-issue the chosen theme on the same selector.
    lift: { from: (base) => `[data-gjb-theme="${base}"]`, to: "#gjb, #gjb-yt, #gjb-modal" }
  },
  { id: "stage-pacer", title: "Stage Pacer", setting: "theme", sheet: "--sp-", skip: ["red", "yellow", "blue"] },
  { id: "grim-fateroll", title: "Grim FateRoll", accent: { setting: "accent", selector: ".gfr-overlay, .gfr-panel", token: "--gfr-base" } },
  { id: "vn-stage", title: "Grim VN Stage", table: { selector: "#vn-panel", prefix: "--gv-", alias: { soft: "accent-soft" } } },
  { id: "grim-encounter", title: "Grim Encounter", table: { selector: "#efx-panel", prefix: "--ge-", alias: { soft: "accent-soft" } } },
  { id: "grim-target", title: "Grim Target", setting: "theme", sheet: "--gtg-" }
];

/** Tokens this panel uses for itself, so it previews the theme it is editing. */
const SELF = { selector: ".grim-core-app", prefix: "--gc-" };

export function normalize(raw) {
  const t = { ...DEFAULT_THEME, ...(raw && typeof raw === "object" ? raw : {}) };
  if (![...PRESETS, "custom"].includes(t.preset)) t.preset = "crimson";
  if (!isHex(t.accent)) t.accent = DEFAULT_THEME.accent;
  t.base = t.base === "light" ? "light" : "dark";
  t.tint = Math.min(200, Math.max(0, Number(t.tint) || 0));
  t.off = Array.isArray(t.off) ? t.off.filter((id) => TARGETS.some((x) => x.id === id)) : [];
  return t;
}

export const getTheme = () => normalize(game.settings.get(MODULE_ID, "theme"));
export const isActive = (id) => !!game.modules.get(id)?.active;
/** The built-in theme a hub theme sits on. */
export const baseOf = (t) => (t.preset === "custom" ? (t.base === "light" ? "amethyst" : "crimson") : t.preset);
export const accentOf = (t) => (t.preset === "custom" ? t.accent : PRESET_ACCENT[t.preset]);

function recolorFor(t) {
  if (t.preset !== "custom") return null;
  const base = baseOf(t);
  return makeRecolor(t.accent, PALETTES[base].blood, t.tint / 100);
}

/** The reference palette for a theme, recoloured when the theme is custom. */
export function paletteFor(theme) {
  const t = normalize(theme);
  const src = PALETTES[baseOf(t)];
  const fn = recolorFor(t);
  if (!fn) return { ...src };
  return Object.fromEntries(Object.entries(src).map(([k, v]) => [k, fn(v) ?? v]));
}

/* ---------------------------- stylesheet reading ---------------------------- */

const sheetCache = new Map(); // module id -> [{ wrap: [], selector, decls: [[name, value]] }]

function collect(rules, prefix, wrap, out) {
  for (const rule of rules) {
    if (rule.styleSheet) { // @import
      try { collect(rule.styleSheet.cssRules, prefix, wrap, out); } catch (e) { /* cross-origin */ }
    } else if (rule.selectorText !== undefined && rule.style) {
      const decls = [];
      for (const name of rule.style) {
        if (name.startsWith(prefix)) decls.push([name, rule.style.getPropertyValue(name).trim()]);
      }
      if (decls.length) out.push({ wrap, selector: rule.selectorText, decls });
    } else if (rule.cssRules) {
      // @layer needs no re-wrapping (our rules are !important); conditions do.
      const cond = rule.conditionText !== undefined && rule.cssText ? rule.cssText.slice(0, rule.cssText.indexOf("{")).trim() : null;
      collect(rule.cssRules, prefix, cond ? [...wrap, cond] : wrap, out);
    }
  }
}

function findSheets(id, list = document.styleSheets, found = []) {
  for (const sheet of list) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    if (sheet.href && sheet.href.includes(`/modules/${id}/`)) { found.push(sheet); continue; }
    const imports = [];
    for (const r of rules) if (r.styleSheet) imports.push(r.styleSheet);
    if (imports.length) findSheets(id, imports, found);
  }
  return found;
}

function tokensOf(target) {
  if (sheetCache.has(target.id)) return sheetCache.get(target.id);
  const out = [];
  for (const sheet of findSheets(target.id)) {
    try { collect(sheet.cssRules, target.sheet, [], out); } catch (e) { /* unreadable */ }
  }
  if (out.length) sheetCache.set(target.id, out); // retry later if the sheet was not loaded yet
  return out;
}

/* -------------------------------- CSS output -------------------------------- */

const block = (selector, decls, wrap = []) => {
  if (!decls.length) return "";
  let css = `${selector} { ${decls.map(([k, v]) => `${k}: ${v} !important;`).join(" ")} }`;
  for (let i = wrap.length - 1; i >= 0; i--) css = `${wrap[i]} { ${css} }`;
  return css + "\n";
};

function tableBlock({ selector, prefix, alias = {} }, palette, only) {
  const decls = [];
  for (const [key, value] of Object.entries(palette)) decls.push([prefix + key, value]);
  for (const [short, full] of Object.entries(alias)) if (palette[full]) decls.push([prefix + short, palette[full]]);
  return block(selector, only ? decls.filter(([k]) => only.has(k)) : decls);
}

/** Build the override stylesheet for a theme. Pure apart from reading loaded stylesheets. */
export function buildCSS(theme, { active = isActive } = {}) {
  const t = normalize(theme);
  const fn = recolorFor(t);
  const palette = paletteFor(t);
  const accent = accentOf(t);
  let css = "";

  // The panel always follows the theme, even while crimson, because it previews drafts.
  css += tableBlock(SELF, palette);

  for (const target of TARGETS) {
    if (t.off.includes(target.id) || !active(target.id)) continue;
    if (target.table && t.preset !== "crimson") css += tableBlock(target.table, palette);
    if (target.accent && t.preset !== "crimson") css += block(target.accent.selector, [[target.accent.token, accent]]);
    if (target.sheet && (fn || target.lift)) {
      const skip = new Set((target.skip ?? []).map((s) => target.sheet + s));
      const recolored = (rule) => {
        const decls = [];
        for (const [name, value] of rule.decls) {
          if (skip.has(name)) continue;
          const next = fn ? fn(value) : /^(#|rgb)/i.test(value) ? value : null;
          if (next) decls.push([name, next]);
        }
        return decls;
      };
      const rules = tokensOf(target);
      if (fn) for (const rule of rules) css += block(rule.selector, recolored(rule), rule.wrap);
      const base = baseOf(t);
      if (target.lift && base !== "crimson") {
        const from = target.lift.from(base);
        for (const rule of rules) if (rule.selector === from) css += block(target.lift.to, recolored(rule), rule.wrap);
      }
    }
  }
  return css;
}

/** Write the theme into the page. Runs on every client. */
export function applyTheme(theme = getTheme()) {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildCSS(theme);
  document.body.dataset.grimCore = normalize(theme).preset;
}

/* ------------------------------ setting sync ------------------------------ */

/** What each module's own setting should be for a theme: [[moduleId, key, value], ...] */
export function plannedSettings(theme, { active = isActive } = {}) {
  const t = normalize(theme);
  const base = baseOf(t);
  const plan = [];
  for (const target of TARGETS) {
    if (t.off.includes(target.id) || !active(target.id)) continue;
    if (target.setting) plan.push([target.id, target.setting, target.map?.[base] ?? base]);
    if (target.accent) plan.push([target.id, target.accent.setting, accentOf(t)]);
  }
  return plan;
}

/** GM only: save the theme and push it into every module's own setting. */
export async function saveTheme(theme) {
  const t = normalize(theme);
  const failed = [];
  for (const [id, key, value] of plannedSettings(t)) {
    try {
      if (!game.settings.settings.has(`${id}.${key}`)) continue;
      if (game.settings.get(id, key) !== value) await game.settings.set(id, key, value);
    } catch (e) {
      console.warn(`Grim Core | could not set ${id}.${key}`, e);
      failed.push(id);
    }
  }
  await game.settings.set(MODULE_ID, "theme", t);
  applyTheme(t);
  return failed;
}
