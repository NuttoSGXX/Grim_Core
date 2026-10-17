// The GM's request panel: what to roll, how hard, and who rolls.
import { TIER_DC, pickLine } from "./lines.js";
import {
  MAX_PLAYERS, abilityList, skillList, toolList, candidates, classLine, detectBoons, boonApplies,
  buildRoll, diceLook
} from "./data.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPES = [["check", "Ability"], ["save", "Save"], ["skill", "Skill"], ["tool", "Tool"]];
const ADV = [[-1, "Dis", "Disadvantage"], [0, "—", "Normal"], [1, "Adv", "Advantage"]];
const opt = (list, cur) => list.map((o) => `<option value="${esc(o.key)}"${o.key === cur ? " selected" : ""}>${esc(o.label)}</option>`).join("");

export class Panel {
  /** @param hooks { load(), save(cfg), loadPos(), savePos(pos), useDsn(), start(req, secret) } */
  constructor(hooks) {
    this.hooks = hooks;
    const saved = hooks.load?.() ?? {};
    this.s = { mode: "same", type: "skill", key: "prc", ability: "", adv: 0, tier: "medium", dc: 15, hideDc: false, ...saved, rows: {} };
    this.el = null;
  }

  get open() { return !!this.el; }
  toggle() { this.open ? this.close() : this.show(); }

  show() {
    if (this.el) return;
    this.cands = candidates();
    // start with characters whose player is online and assigned
    let picked = this.cands.filter((c) => c.assigned && c.online);
    if (!picked.length) picked = this.cands.filter((c) => c.assigned);
    if (!picked.length) picked = this.cands;
    const on = new Set(picked.slice(0, MAX_PLAYERS).map((c) => c.actor.id));
    for (const c of this.cands) this.s.rows[c.actor.id] = { ...(this.s.rows[c.actor.id] ?? {}), on: on.has(c.actor.id) };
    this.el = document.createElement("div");
    this.el.id = "grim-fateroll-panel";
    this.el.className = "gfr-panel";
    const pos = this.hooks.loadPos?.() ?? {};
    this.el.style.left = `${Math.max(0, Math.min(window.innerWidth - 200, pos.left ?? 120))}px`;
    this.el.style.top = `${Math.max(0, Math.min(window.innerHeight - 120, pos.top ?? 80))}px`;
    document.body.appendChild(this.el);
    this.bind();
    this.render();
  }

  close() { this.el?.remove(); this.el = null; }

  /* ---------- state helpers ---------- */
  keysFor(type, actors) {
    if (type === "skill") return skillList();
    if (type === "tool") return toolList(actors);
    return abilityList();
  }
  fixKey(type, key, actors) {
    const list = this.keysFor(type, actors);
    return list.some((o) => o.key === key) ? key : list[0]?.key ?? "";
  }
  selected() { return this.cands.filter((c) => this.s.rows[c.actor.id]?.on); }

  /** The effective roll spec for one character. */
  spec(c) {
    const s = this.s, r = s.rows[c.actor.id] ?? {};
    const each = s.mode === "each";
    const type = each ? r.type ?? s.type : s.type;
    const pool = each ? [c.actor] : this.selected().map((x) => x.actor);
    const key = this.fixKey(type, each ? r.key ?? s.key : s.key, pool);
    const ability = (each ? r.ability ?? "" : s.ability) || "";
    const boons = detectBoons(c.actor);
    const dc = each && Number.isFinite(r.dc) ? r.dc : s.dc;
    return {
      type, key, ability: type === "skill" || type === "tool" ? ability : "", adv: r.adv ?? s.adv,
      bless: r.bless ?? boons.bless, guidance: r.guidance ?? boons.guidance, bonus: r.bonus ?? 0, dc,
      valid: !!key
    };
  }

  /* ---------- rendering ---------- */
  render() {
    if (!this.el) return;
    const s = this.s;
    const scroll = this.el.querySelector(".gfr-list")?.scrollTop ?? 0;
    const sel = this.selected();
    const each = s.mode === "each";
    s.key = this.fixKey(s.type, s.key, sel.map((c) => c.actor));
    const keys = this.keysFor(s.type, sel.map((c) => c.actor));
    const abl = [{ key: "", label: "Default ability" }, ...abilityList()];
    const segs = (name, list, cur) => list.map(([v, l, t]) => `<button type="button" class="${String(v) === String(cur) ? "on" : ""}" data-set="${name}" data-val="${v}" title="${esc(t ?? l)}">${esc(l)}</button>`).join("");

    const rollRow = each ? `<p class="gfr-hint">Each character gets their own roll below. Difficulty and DC here are the defaults.</p>` : `
      <div class="gfr-field">
        <label>Roll</label>
        <div class="gfr-seg">${segs("type", TYPES, s.type)}</div>
      </div>
      <div class="gfr-field gfr-two">
        ${keys.length ? `<select data-set="key">${opt(keys, s.key)}</select>` : `<div class="gfr-empty">No one selected is proficient with a tool.</div>`}
        ${s.type === "skill" || s.type === "tool" ? `<select data-set="ability">${opt(abl, s.ability)}</select>` : ""}
      </div>`;

    const rows = this.cands.map((c) => {
      const id = c.actor.id, r = s.rows[id] ?? {}, sp = this.spec(c);
      let mod = "", err = "";
      if (r.on) { if (sp.valid) { try { mod = buildRoll(c.actor, sp).modText; } catch (e) { mod = "?"; } } else err = "no tool"; }
      const boon = (k, l) => boonApplies(k, sp.type) ? `<button type="button" class="gfr-chip ${sp[k] ? "on" : ""}" data-row="${id}" data-toggle="${k}" title="${l}: adds 1d4">${l} d4</button>` : "";
      const own = keys && each ? this.keysFor(sp.type, [c.actor]) : [];
      const eachRow = each && r.on ? `
        <div class="gfr-rowspec">
          <select data-row="${id}" data-rset="type">${opt(TYPES.map(([key, label]) => ({ key, label })), sp.type)}</select>
          ${own.length ? `<select data-row="${id}" data-rset="key">${opt(own, sp.key)}</select>` : `<div class="gfr-empty">No tool proficiency</div>`}
          ${sp.type === "skill" || sp.type === "tool" ? `<select data-row="${id}" data-rset="ability">${opt(abl, sp.ability)}</select>` : ""}
          <label class="gfr-mini">DC<input type="number" data-row="${id}" data-rset="dc" value="${sp.dc}" min="1" max="40"></label>
        </div>` : "";
      return `
        <div class="gfr-prow ${r.on ? "on" : ""} ${c.online ? "" : "is-offline"}">
          <div class="gfr-prow-main">
            <button type="button" class="gfr-check" data-row="${id}" data-toggle="on" aria-pressed="${!!r.on}"></button>
            <img src="${esc(c.actor.img || "icons/svg/mystery-man.svg")}" alt="">
            <div class="gfr-who"><b>${esc(c.actor.name)}</b><span>${esc(c.user.name)}${c.online ? "" : " · offline"} · ${esc(classLine(c.actor))}</span></div>
            ${r.on ? `
              <span class="gfr-mod ${err ? "is-err" : ""}">${esc(err || mod)}</span>
              <div class="gfr-seg gfr-seg-sm">${segs(`radv:${id}`, ADV, sp.adv)}</div>` : ""}
          </div>
          ${r.on ? `<div class="gfr-prow-extra">${boon("bless", "Bless")}${boon("guidance", "Guidance")}
            <label class="gfr-mini">Bonus<input type="number" data-row="${id}" data-rset="bonus" value="${sp.bonus || 0}" min="-20" max="20"></label></div>` : ""}
          ${eachRow}
        </div>`;
    }).join("");

    const count = sel.length;
    const bad = sel.some((c) => !this.spec(c).valid);
    const disabled = !count || count > MAX_PLAYERS || bad;
    const why = !count ? "Choose at least one character" : count > MAX_PLAYERS ? `Up to ${MAX_PLAYERS} characters` : bad ? "Someone has no valid roll" : "";

    this.el.innerHTML = `
      <div class="gfr-panel-head" data-drag>
        <span class="gfr-mark"></span><h2>Grim FateRoll</h2>
        <button type="button" class="gfr-x" data-close title="Close">×</button>
      </div>
      <div class="gfr-panel-body">
        <div class="gfr-seg gfr-mode">${segs("mode", [["same", "Everyone rolls the same"], ["each", "Different roll each"]], s.mode)}</div>
        ${rollRow}
        <div class="gfr-field">
          <label>Roll mode</label>
          <div class="gfr-seg">${segs("adv", [[-1, "Disadvantage"], [0, "Normal"], [1, "Advantage"]], s.adv)}</div>
        </div>
        <div class="gfr-field">
          <label>Difficulty</label>
          <div class="gfr-seg gfr-tiers">${segs("tier", [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], s.tier)}</div>
        </div>
        <div class="gfr-field gfr-dcrow">
          <label class="gfr-dcbox">DC<input type="number" data-set="dc" value="${s.dc}" min="1" max="40"></label>
          <button type="button" class="gfr-switch ${s.hideDc ? "on" : ""}" data-set="hideDc" data-val="${s.hideDc ? "" : "1"}"><i></i>Hide DC from players</button>
        </div>
        <div class="gfr-listhead"><span>Who rolls</span><span class="${count > MAX_PLAYERS ? "is-err" : ""}">${count} / ${MAX_PLAYERS}</span>
          <button type="button" data-all="1">All</button><button type="button" data-all="">None</button></div>
        <div class="gfr-list">${rows || `<div class="gfr-empty">No player-owned characters found. Give a player Owner permission on a character.</div>`}</div>
      </div>
      <div class="gfr-panel-foot">
        <span class="gfr-why">${esc(why)}</span>
        <button type="button" class="gfr-go" data-go ${disabled ? "disabled" : ""}>Call the Roll</button>
      </div>`;
    const list = this.el.querySelector(".gfr-list"); if (list) list.scrollTop = scroll;
  }

  /* ---------- events ---------- */
  bind() {
    const el = this.el;
    el.addEventListener("click", (ev) => {
      const t = ev.target.closest("button"); if (!t) return;
      const s = this.s, d = t.dataset;
      if ("close" in d) return this.close();
      if ("go" in d) return this.start();
      if ("all" in d) { let n = 0; for (const c of this.cands) s.rows[c.actor.id].on = !!d.all && n++ < MAX_PLAYERS; return this.render(); }
      if (d.toggle) {
        const r = s.rows[d.row];
        if (d.toggle === "on") r.on = !r.on;
        else { const c = this.cands.find((x) => x.actor.id === d.row); r[d.toggle] = !this.spec(c)[d.toggle]; }
        return this.render();
      }
      if (d.set?.startsWith("radv:")) { s.rows[d.set.slice(5)].adv = Number(d.val); return this.render(); }
      if (d.set) {
        if (d.set === "adv") { s.adv = Number(d.val); for (const r of Object.values(s.rows)) delete r.adv; }
        else if (d.set === "hideDc") s.hideDc = !!d.val;
        else if (d.set === "tier") { s.tier = d.val; s.dc = TIER_DC[d.val] ?? s.dc; }
        else if (d.set === "type") { s.type = d.val; s.ability = ""; }
        else s[d.set] = d.val;
        this.persist(); this.render();
      }
    });
    el.addEventListener("change", (ev) => {
      const t = ev.target, d = t.dataset, s = this.s;
      if (d.rset) {
        const r = s.rows[d.row];
        if (d.rset === "dc" || d.rset === "bonus") { const v = parseInt(t.value, 10); r[d.rset] = Number.isFinite(v) ? v : undefined; }
        else { if (d.rset === "type") { delete r.key; r.ability = ""; } r[d.rset] = t.value; }
      } else if (d.set === "dc") { const v = parseInt(t.value, 10); if (Number.isFinite(v)) s.dc = Math.max(1, Math.min(40, v)); }
      else if (d.set) s[d.set] = t.value;
      else return;
      this.persist(); this.render();
    });
    // drag by the header
    el.addEventListener("pointerdown", (ev) => {
      if (!ev.target.closest("[data-drag]") || ev.target.closest("button")) return;
      const r = el.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      const move = (e) => {
        el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, e.clientX - ox))}px`;
        el.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy))}px`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        this.hooks.savePos?.({ left: parseInt(el.style.left, 10), top: parseInt(el.style.top, 10) });
      };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      ev.preventDefault();
    });
  }

  persist() {
    const { mode, type, key, ability, adv, tier, dc, hideDc } = this.s;
    this.hooks.save?.({ mode, type, key, ability, adv, tier, dc, hideDc });
  }

  start() {
    const s = this.s, sel = this.selected().slice(0, MAX_PLAYERS);
    if (!sel.length) return;
    const secret = {};
    const useDsn = this.hooks.useDsn?.() ?? true;
    const players = sel.map((c) => {
      const sp = this.spec(c);
      const roll = buildRoll(c.actor, sp);
      secret[c.actor.id] = sp.dc;
      return {
        actorId: c.actor.id, userId: c.user.id, name: c.actor.name, classLine: classLine(c.actor),
        ...roll, dc: s.hideDc ? null : sp.dc, look: diceLook(c.user, useDsn)
      };
    });
    const titles = new Set(players.map((p) => p.title));
    const req = {
      id: (globalThis.foundry?.utils?.randomID?.() ?? Math.random().toString(36).slice(2)),
      tier: s.tier, line: pickLine(s.tier), hideDc: !!s.hideDc,
      sameTitle: titles.size === 1 ? players[0].title : null, players
    };
    this.persist();
    this.close();
    this.hooks.start?.(req, secret);
  }
}
