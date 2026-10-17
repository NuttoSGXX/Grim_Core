// Everything that reads dnd5e actor data lives here, written defensively so
// small changes between dnd5e versions degrade to sensible fallbacks.
import { DEFAULT_LOOK } from "./dice3d.js";

export const MODULE_ID = "grim-fateroll";
export const SOCKET = `module.${MODULE_ID}`;
export const MAX_PLAYERS = 8;

const cfg = () => globalThis.CONFIG?.DND5E ?? {};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const label = (v, fallback) => (typeof v === "string" ? v : v?.label) || fallback;

const TOOL_FALLBACK = {
  alchemist: "Alchemist's Supplies", bagpipes: "Bagpipes", brewer: "Brewer's Supplies", calligrapher: "Calligrapher's Supplies",
  card: "Playing Cards", carpenter: "Carpenter's Tools", cartographer: "Cartographer's Tools", chess: "Dragonchess", cobbler: "Cobbler's Tools",
  cook: "Cook's Utensils", dice: "Dice Set", disg: "Disguise Kit", drum: "Drum", dulcimer: "Dulcimer", flute: "Flute", forg: "Forgery Kit",
  glassblower: "Glassblower's Tools", herb: "Herbalism Kit", horn: "Horn", jeweler: "Jeweler's Tools", leatherworker: "Leatherworker's Tools",
  lute: "Lute", lyre: "Lyre", mason: "Mason's Tools", navg: "Navigator's Tools", painter: "Painter's Supplies", panflute: "Pan Flute",
  pois: "Poisoner's Kit", potter: "Potter's Tools", shawm: "Shawm", smith: "Smith's Tools", thief: "Thieves' Tools", tinker: "Tinker's Tools",
  viol: "Viol", weaver: "Weaver's Tools", woodcarver: "Woodcarver's Tools", art: "Artisan's Tools", game: "Gaming Set", music: "Musical Instrument",
  vehicle: "Vehicles", air: "Air Vehicles", land: "Land Vehicles", space: "Space Vehicles", water: "Water Vehicles"
};

export function abilityList() {
  const a = cfg().abilities ?? {};
  const keys = Object.keys(a).length ? Object.keys(a) : ["str", "dex", "con", "int", "wis", "cha"];
  return keys.map((key) => ({ key, label: label(a[key], key.toUpperCase()) }));
}
export const abilityLabel = (key) => abilityList().find((a) => a.key === key)?.label ?? String(key ?? "").toUpperCase();

export function skillList() {
  const s = cfg().skills ?? {};
  return Object.keys(s).map((key) => ({ key, label: label(s[key], key), ability: s[key]?.ability }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function toolLabel(key) {
  try {
    const T = globalThis.dnd5e?.documents?.Trait;
    const l = T?.keyLabel?.(`tool:${key}`) ?? T?.keyLabel?.(key, { trait: "tool" });
    if (l && typeof l === "string" && !l.includes("tool:")) return l;
  } catch (e) { /* fall through */ }
  const c = cfg();
  return label(c.tools?.[key], null) ?? label(c.toolProficiencies?.[key], null) ?? label(c.vehicleTypes?.[key], null)
    ?? TOOL_FALLBACK[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Tools the given actors are proficient with (union). */
export function toolList(actors) {
  const keys = new Set();
  for (const a of actors) for (const [k, t] of Object.entries(a?.system?.tools ?? {})) if (num(t?.value) > 0 || num(t?.prof?.multiplier) > 0) keys.add(k);
  return [...keys].map((key) => ({ key, label: toolLabel(key) })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Player characters the GM can call on, each with the user who will roll. */
export function candidates() {
  const users = game.users?.filter?.((u) => !u.isGM) ?? [];
  const out = [];
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character") continue;
    let user = users.find((u) => u.character?.id === actor.id);
    user ??= users.find((u) => { try { return actor.testUserPermission(u, "OWNER"); } catch (e) { return false; } });
    if (!user) continue;
    out.push({ actor, user, assigned: user.character?.id === actor.id, online: !!user.active });
  }
  return out.sort((a, b) => (b.assigned - a.assigned) || (b.online - a.online) || a.actor.name.localeCompare(b.actor.name));
}

export function classLine(actor) {
  const classes = (actor.items?.filter?.((i) => i.type === "class") ?? [])
    .sort((a, b) => num(b.system?.levels) - num(a.system?.levels));
  const total = num(actor.system?.details?.level) || classes.reduce((n, c) => n + num(c.system?.levels), 0);
  if (!classes.length) return total ? `LV ${total}` : "";
  const sub = (c) => {
    let s = null;
    try { s = c.subclass; } catch (e) { /* older dnd5e */ }
    s ??= actor.items.find((i) => i.type === "subclass" && i.system?.classIdentifier && i.system.classIdentifier === c.system?.identifier);
    return s?.name;
  };
  if (classes.length === 1) { const s = sub(classes[0]); return `LV ${total} ${classes[0].name}${s ? ` · ${s}` : ""}`; }
  return `LV ${total} ` + classes.map((c) => { const s = sub(c); return `${c.name}${s ? ` (${s})` : ""} ${num(c.system?.levels)}`; }).join(" / ");
}

function hasEffect(actor, rx) {
  const list = actor.appliedEffects ?? actor.effects ?? [];
  for (const e of list) { if (e?.disabled || e?.isSuppressed) continue; if (rx.test(e?.name ?? e?.label ?? "")) return true; }
  return false;
}
/** d4 bonuses the actor currently has, by effect name. Bless helps saves, Guidance helps checks. */
export function detectBoons(actor) {
  return { bless: hasEffect(actor, /\bbless\b/i), guidance: hasEffect(actor, /\bguidance\b/i) };
}
export const boonApplies = (boon, type) => (boon === "bless" ? type === "save" : type !== "save");

function profOf(obj, value, actor) {
  const pb = num(actor.system?.attributes?.prof);
  const mult = num(obj?.multiplier ?? value);
  const flat = Number.isFinite(Number(obj?.flat)) ? Number(obj.flat) : Math.floor(mult * pb);
  return { mult, flat };
}
const profLabel = (m) => (m >= 2 ? "EXPERT" : m >= 1 ? "PROFICIENT" : "HALF PROFICIENT");
const signed = (n) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

/** Default ability for a skill/tool on this actor. */
export function defaultAbility(actor, type, key) {
  if (type === "skill") return actor.system?.skills?.[key]?.ability ?? cfg().skills?.[key]?.ability ?? "dex";
  if (type === "tool") return actor.system?.tools?.[key]?.ability ?? cfg().tools?.[key]?.ability ?? "int";
  return key;
}

/**
 * Work out one participant's roll.
 * spec: { type: "check"|"save"|"skill"|"tool", key, ability?, adv: -1|0|1, bless, guidance, bonus }
 */
export function buildRoll(actor, spec) {
  const sys = actor.system ?? {};
  const abilities = sys.abilities ?? {};
  const type = spec.type;
  let abl, total, prof = { mult: 0, flat: 0 }, title;

  if (type === "check" || type === "save") {
    abl = spec.key;
    const a = abilities[abl] ?? {};
    const mod = num(a.mod);
    if (type === "check") {
      prof = profOf(a.checkProf, 0, actor);
      total = mod + prof.flat + num(a.checkBonus);
      title = `${abilityLabel(abl)} Check`;
    } else {
      prof = profOf(a.saveProf, a.proficient, actor);
      const sv = typeof a.save === "object" && a.save ? a.save.value : a.save;
      total = Number.isFinite(Number(sv)) ? Number(sv) : mod + prof.flat;
      title = `${abilityLabel(abl)} Saving Throw`;
    }
  } else {
    const entry = (type === "skill" ? sys.skills : sys.tools)?.[spec.key];
    const base = defaultAbility(actor, type, spec.key);
    abl = spec.ability || base;
    prof = profOf(entry?.prof, entry?.value, actor);
    const baseMod = num(abilities[base]?.mod);
    const t = Number.isFinite(Number(entry?.total)) ? Number(entry.total) : baseMod + prof.flat;
    total = t - baseMod + num(abilities[abl]?.mod);
    const name = type === "skill" ? label(cfg().skills?.[spec.key], spec.key) : toolLabel(spec.key);
    title = `${abilityLabel(abl)} ${name} Check`;
  }

  const mod = num(abilities[abl]?.mod);
  const other = total - mod - prof.flat;
  const bonus = num(spec.bonus);
  const parts = [{ value: signed(mod), label: abilityLabel(abl).toUpperCase() }];
  if (prof.mult > 0) parts.push({ value: signed(prof.flat), label: profLabel(prof.mult) });
  if (other) parts.push({ value: signed(other), label: "BONUS" });
  if (bonus) parts.push({ value: signed(bonus), label: "SITUATIONAL" });

  const d4 = [];
  if (spec.bless && boonApplies("bless", type)) d4.push("BLESS");
  if (spec.guidance && boonApplies("guidance", type)) d4.push("GUIDANCE");
  for (const b of d4) parts.push({ value: "+1d4", label: b, die: true });

  return { title, parts, mod: total + bonus, modText: signed(total + bonus), adv: num(spec.adv), d4 };
}

/* ---------- Dice So Nice colours ---------- */
const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}/i.test(c);
const first = (c) => (Array.isArray(c) ? c.find(isHex) : c);

/** The user's Dice So Nice colours, or the Grim default. Runs on the GM, result is sent to everyone. */
export function diceLook(user, useDsn = true) {
  const look = { ...DEFAULT_LOOK };
  if (!useDsn || !user || !game.modules?.get?.("dice-so-nice")?.active) return look;
  try {
    let app = null;
    try { app = game.dice3d?.constructor?.APPEARANCE?.(user); } catch (e) { /* use the raw flag */ }
    app ??= user.getFlag?.("dice-so-nice", "appearance");
    const g = { ...(app?.global ?? app ?? {}), ...(app?.d20 ?? {}) };
    let body = g.diceColor, lab = g.labelColor, edge = g.edgeColor || g.outlineColor;
    if (g.colorset && g.colorset !== "custom") {
      const sets = game.dice3d?.exports?.COLORSETS ?? game.dice3d?.DiceFactory?.constructor?.COLORSETS;
      const cs = sets?.[g.colorset];
      if (cs) { body = first(cs.background) ?? body; lab = first(cs.foreground) ?? lab; edge = first(cs.edge) ?? first(cs.outline) ?? edge; }
    }
    if (isHex(body)) look.body = body.slice(0, 7);
    if (isHex(lab)) look.label = lab.slice(0, 7);
    if (isHex(edge)) look.edge = edge.slice(0, 7);
    else if (isHex(body)) look.edge = look.label;
    look.dsn = true;
  } catch (e) { console.warn(`${MODULE_ID} | could not read Dice So Nice colours`, e); }
  return look;
}
