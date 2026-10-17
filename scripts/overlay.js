// The screen everyone sees: dimmed backdrop, flavour line, one sigil per player.
import { Die } from "./dice3d.js";
import { Sigil, cracksHTML } from "./circle.js";
import { Emitter } from "./fx.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const COLS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 3, 7: 4, 8: 4 };
const TIER_PIPS = { easy: 1, medium: 2, hard: 3 };
const GOLD = "#f5c451", DOOM = "#7a181d";
function mix(a, b, t) {
  const h = (c) => { c = c.replace("#", ""); if (c.length === 3) c = [...c].map((x) => x + x).join(""); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); };
  const A = h(a), B = h(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export class Overlay {
  /**
   * @param req   the shared request (see main.js)
   * @param ctx   { isGM, userId, secret, dim, accent, lowFx, sound, onRoll(player), onClose(), onReveal(), onDismiss() }
   */
  constructor(req, ctx) {
    this.req = req; this.ctx = ctx; this.cards = new Map(); this.closed = false;
    this.el = document.createElement("div");
    this.el.id = "grim-fateroll-overlay";
    this.el.className = `gfr-overlay gfr-tier-${req.tier} gfr-n${req.players.length}${ctx.isGM ? " gfr-gm" : ""}${ctx.lowFx ? " gfr-low" : ""}`;
    this.el.style.setProperty("--gfr-dim", String((ctx.dim ?? 80) / 100));
    if (ctx.accent) this.el.style.setProperty("--gfr-base", ctx.accent);
    this.render();
    document.body.appendChild(this.el);
    this.base = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ctx.accent ?? "") ? ctx.accent : "#c8141e";
    this._onResize = () => this.layout();
    window.addEventListener("resize", this._onResize);
    this.layout();
    // the rune and numeral fonts may still be loading; repaint once they arrive
    try {
      Promise.all([document.fonts.load('10px "GFR Runic"', "ᚠ"), document.fonts.load('700 10px "GFR Num"', "20")])
        .then(() => { if (!this.closed) this.paintAll(true); });
    } catch (e) { /* fonts API missing: system fonts are used */ }
    requestAnimationFrame(() => this.el.classList.add("is-open"));
  }

  render() {
    const { req, ctx } = this;
    const n = req.players.length;
    const pips = Array.from({ length: 3 }, (_, i) => `<i class="${i < TIER_PIPS[req.tier] ? "on" : ""}"></i>`).join("");
    this.el.innerHTML = `
      <div class="gfr-veil"></div>
      <header class="gfr-head">
        <div class="gfr-pips">${pips}</div>
        <div class="gfr-line">${esc(req.line)}</div>
        ${req.sameTitle ? `<div class="gfr-title"><span>${esc(req.sameTitle)}</span></div>` : ""}
      </header>
      <main class="gfr-stage"></main>
      <footer class="gfr-bar">
        ${ctx.isGM ? `
          <button type="button" data-act="rest">Roll Remaining</button>
          ${req.hideDc ? `<button type="button" data-act="reveal">Reveal DC</button>` : ""}
          <button type="button" data-act="close" class="gfr-end">End</button>` : ""}
      </footer>
      ${ctx.isGM ? "" : `<button type="button" class="gfr-dismiss" data-act="dismiss" title="Hide for me">×</button>`}`;

    const stage = this.el.querySelector(".gfr-stage");
    const cols = this.cols(n);
    let row = null;
    req.players.forEach((p, i) => {
      if (i % cols === 0) { row = document.createElement("div"); row.className = "gfr-row"; stage.appendChild(row); }
      row.appendChild(this.buildCard(p, i));
    });

    this.el.addEventListener("click", (ev) => {
      const act = ev.target.closest("[data-act]")?.dataset.act;
      if (act === "close") return ctx.onClose?.();
      if (act === "reveal") return ctx.onReveal?.();
      if (act === "dismiss") return ctx.onDismiss?.();
      if (act === "rest") return this.rollRemaining();
      const cardEl = ev.target.closest(".gfr-circle");
      if (cardEl) this.tryRoll(cardEl.closest(".gfr-card").dataset.actor);
    });
  }

  cols(n) {
    let c = COLS[n] ?? 4;
    const ratio = window.innerWidth / Math.max(1, window.innerHeight);
    if (ratio < 1.45 && n === 5) c = 3;
    if (ratio < 1.15 && n >= 4) c = n === 4 ? 2 : Math.min(c, 3);
    if (ratio < 0.8) c = Math.min(c, 2);
    return c;
  }

  buildCard(p, i) {
    const { ctx, req } = this;
    const mine = p.userId === ctx.userId;
    const can = ctx.isGM || mine;
    const dc = ctx.isGM && req.hideDc ? ctx.secret?.[p.actorId] ?? null : p.dc;
    const el = document.createElement("section");
    el.className = `gfr-card${mine ? " is-mine" : ""}${can ? " can-roll" : ""}`;
    el.dataset.actor = p.actorId;
    el.style.setProperty("--i", i);
    const advTxt = p.adv > 0 ? "Advantage" : p.adv < 0 ? "Disadvantage" : "";
    const parts = p.parts.map((x) => `<span class="gfr-part${x.die ? " is-die" : ""}"><b>${esc(x.value)}</b><em>${esc(x.label)}</em></span>`).join("");
    el.innerHTML = `
      ${req.sameTitle ? "" : `<div class="gfr-card-title">${esc(p.title)}</div>`}
      <div class="gfr-adv ${p.adv > 0 ? "is-adv" : p.adv < 0 ? "is-dis" : "is-none"}">${advTxt || "&nbsp;"}</div>
      <div class="gfr-circle">
        <div class="gfr-rays"></div>
        <div class="gfr-sigil-slot"></div>
        <div class="gfr-core"></div>
        <div class="gfr-dice"></div>
        <div class="gfr-total"></div>
        <div class="gfr-stamp"></div>
        <div class="gfr-prompt">${mine ? "Click to roll" : "Roll for them"}</div>
        ${cracksHTML()}
        <canvas class="gfr-fx"></canvas>
        <div class="gfr-dc"><div><span>DC</span><b></b></div></div>
      </div>
      <div class="gfr-name">${esc(p.name)}</div>
      <div class="gfr-class">${esc(p.classLine)}</div>
      <div class="gfr-parts">${parts}<span class="gfr-part is-sum"><b>${esc(p.modText)}</b><em>MODIFIER</em></span></div>`;

    const sigil = new Sigil(p.name);
    el.querySelector(".gfr-sigil-slot").replaceWith(sigil.el);
    const tray = el.querySelector(".gfr-dice");
    const d20 = Array.from({ length: p.adv ? 2 : 1 }, () => new Die("d20", p.look));
    const d4 = p.d4.map(() => new Die("d4", p.look));
    for (const d of d20) tray.appendChild(d.el);
    if (d4.length) { const col = document.createElement("div"); col.className = "gfr-d4s"; d4.forEach((d) => col.appendChild(d.el)); tray.appendChild(col); }
    tray.classList.add(`gfr-dice-${d20.length}`, d4.length ? "has-d4" : "no-d4");

    const card = { el, p, sigil, mine, d20, d4, dc, hidden: req.hideDc, fx: new Emitter(el.querySelector(".gfr-fx")), busy: false, rolled: false, result: null };
    this.cards.set(p.actorId, card);
    this.paintDc(card);
    return el;
  }

  paintDc(card) {
    const box = card.el.querySelector(".gfr-dc");
    box.querySelector("b").textContent = card.dc == null ? "??" : String(card.dc);
    box.classList.toggle("is-secret", card.hidden && card.dc != null);
    box.classList.toggle("is-unknown", card.dc == null);
  }

  layout() {
    const n = this.req.players.length;
    const W = window.innerWidth, H = window.innerHeight;
    const cols = this.cols(n), rows = Math.ceil(n / cols);
    // regroup rows if the column count changed with the window
    const stage = this.el.querySelector(".gfr-stage");
    const cards = [...stage.querySelectorAll(".gfr-card")];
    if (stage.dataset.cols !== String(cols)) {
      stage.dataset.cols = cols; stage.replaceChildren();
      let row = null;
      cards.forEach((c, i) => { if (i % cols === 0) { row = document.createElement("div"); row.className = "gfr-row"; stage.appendChild(row); } row.appendChild(c); });
    }
    const headH = (this.el.querySelector(".gfr-head")?.offsetHeight || 110) + 16;
    const availW = (W * 0.95) / cols, availH = (H - headH - 70) / rows;
    // a card is about 1.16 S wide with its gap, and 1.7 S tall (title, sigil, name, class, modifiers)
    const tall = this.req.sameTitle ? 1.62 : 1.78;
    let S = Math.min(availW / 1.16, availH / (tall + 0.1));
    S = Math.max(96, Math.min(S, n === 1 ? 440 : n === 2 ? 390 : 340));
    this.S = Math.round(S);
    this.el.style.setProperty("--gfr-s", `${this.S}px`);
    this.paintAll();
  }

  paintAll(force = false) { for (const c of this.cards.values()) this.paintSigil(c, force); }

  /** Sigil colour follows the outcome: red, pale on success, gold on a 20, dying crimson on a 1. */
  paintSigil(card, force = false) {
    const cl = card.el.classList;
    const win = cl.contains("is-success");
    const color = cl.contains("is-nat20") ? GOLD : cl.contains("is-nat1") ? DOOM : win ? mix(this.base, "#ff6a5c", 0.45) : this.base;
    card.sigil.paint(this.S || 240, color, this.ctx.lowFx ? 0 : win ? 1.8 : card.mine ? 1.4 : 1, force);
  }

  canRoll(card) { return (this.ctx.isGM || card.p.userId === this.ctx.userId) && !card.busy && !card.rolled; }

  tryRoll(actorId) {
    const card = this.cards.get(actorId);
    if (!card || !this.canRoll(card)) return;
    card.busy = true;
    card.el.classList.add("is-busy");
    this.ctx.onRoll?.(card.p);
  }

  async rollRemaining() {
    for (const card of this.cards.values()) {
      if (card.busy || card.rolled) continue;
      this.tryRoll(card.p.actorId);
      await wait(180);
    }
  }

  spin(card, rate) {
    try { card.el.querySelectorAll(".gfr-layer").forEach((l) => l.getAnimations().forEach((a) => (a.playbackRate = rate))); } catch (e) { /* cosmetic */ }
  }

  /** Play a roll result on one sigil. result: { d20:[..], kept, d4:[..], total, nat } */
  async showResult(actorId, result) {
    const card = this.cards.get(actorId);
    if (!card || card.rolled) return;
    card.rolled = true; card.busy = true; card.result = result;
    const el = card.el;
    el.classList.add("is-busy", "is-rolling");
    this.spin(card, 8);
    if (this.ctx.sound) this.ctx.playSound?.();
    await Promise.all([
      ...card.d20.map((d, i) => d.roll(result.d20[i] ?? result.kept)),
      ...card.d4.map((d, i) => d.roll(result.d4[i] ?? 1))
    ]);
    if (this.closed) return;
    el.classList.remove("is-rolling");
    // dim the die that advantage/disadvantage threw away
    if (card.d20.length === 2) {
      const keep = result.d20[0] === result.kept ? 0 : 1;
      card.d20[1 - keep].el.classList.add("is-dropped");
      card.d20[keep].el.classList.add("is-kept");
    }
    await wait(260);
    if (this.closed) return;
    el.querySelector(".gfr-total").textContent = String(result.total);
    el.classList.add("is-rolled");
    if (result.nat === 20) { el.classList.add("is-nat20"); this.spin(card, 2.4); if (!this.ctx.lowFx) card.fx.play("gold"); }
    else if (result.nat === 1) { el.classList.add("is-nat1"); this.spin(card, 0.22); if (!this.ctx.lowFx) card.fx.play("doom"); }
    else this.spin(card, 1);
    this.paintSigil(card);
    this.paintOutcome(card);
    this.checkDone();
  }

  paintOutcome(card) {
    if (!card.rolled || !card.result) return;
    const { el, result } = card;
    const stamp = el.querySelector(".gfr-stamp");
    let text = result.nat === 20 ? "Natural 20" : result.nat === 1 ? "Natural 1" : "";
    if (card.dc != null) {
      const ok = result.total >= card.dc;
      el.classList.add(ok ? "is-success" : "is-failure");
      if (!text) { text = ok ? "Success" : "Failure"; if (ok && !this.ctx.lowFx && !card._sparked) { card._sparked = true; card.fx.play("spark"); } }
    }
    stamp.textContent = text;
    this.paintSigil(card);
  }

  /** The GM lifted the veil: show every DC and outcome. */
  reveal(dcs) {
    for (const card of this.cards.values()) {
      if (dcs[card.p.actorId] == null) continue;
      card.dc = dcs[card.p.actorId]; card.hidden = false;
      this.paintDc(card);
      card.el.querySelector(".gfr-dc").classList.add("is-revealed");
      this.paintOutcome(card);
    }
    this.el.querySelector('[data-act="reveal"]')?.remove();
  }

  checkDone() {
    if ([...this.cards.values()].every((c) => c.rolled)) { this.el.classList.add("is-done"); this.ctx.onAllRolled?.(); }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener("resize", this._onResize);
    this.el.classList.remove("is-open");
    this.el.classList.add("is-closing");
    await wait(650);
    for (const c of this.cards.values()) { c.fx.destroy(); [...c.d20, ...c.d4].forEach((d) => d.destroy()); }
    this.el.remove();
  }
}
