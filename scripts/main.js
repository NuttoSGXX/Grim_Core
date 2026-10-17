// Grim FateRoll: wiring. Settings, GM button, socket sync and the roll itself.
import { MODULE_ID, SOCKET } from "./data.js";
import { Overlay } from "./overlay.js";
import { Panel } from "./panel.js";

const state = { req: null, secret: null, overlay: null, panel: null, timer: null };
const get = (k) => game.settings.get(MODULE_ID, k);
const emit = (data) => game.socket.emit(SOCKET, data);

/* ---------- settings ---------- */
Hooks.once("init", () => {
  const reg = (key, data) => game.settings.register(MODULE_ID, key, data);
  reg("dim", { name: "Backdrop darkness (%)", hint: "How dark the screen fades while a roll is called. 80 keeps the scene faintly visible.", scope: "world", config: true, type: Number, range: { min: 40, max: 95, step: 5 }, default: 80 });
  reg("accent", { name: "Sigil colour", hint: "Hex colour of the magic circles, for everyone. Default is Grim red #c8141e.", scope: "world", config: true, type: String, default: "#c8141e" });
  reg("useDsn", { name: "Use Dice So Nice colours", hint: "Tint each player's die with their own Dice So Nice colours when that module is active.", scope: "world", config: true, type: Boolean, default: true });
  reg("postToChat", { name: "Post results to chat", hint: "Write a result card to the chat log after each roll.", scope: "world", config: true, type: Boolean, default: true });
  reg("autoClose", { name: "Auto close (seconds)", hint: "Close the screen this long after everyone has rolled. 0 means the GM closes it by hand.", scope: "world", config: true, type: Number, range: { min: 0, max: 30, step: 1 }, default: 0 });
  reg("sound", { name: "Dice sound", scope: "client", config: true, type: Boolean, default: true });
  reg("lowFx", { name: "Reduced effects", hint: "Turn off particles and glow on this computer if the screen stutters.", scope: "client", config: true, type: Boolean, default: false });
  reg("lastConfig", { scope: "client", config: false, type: Object, default: {} });
  reg("panelPos", { scope: "client", config: false, type: Object, default: {} });

  game.keybindings.register(MODULE_ID, "open", {
    name: "Open Grim FateRoll", hint: "GM only. Opens the roll request panel.",
    editable: [{ key: "KeyR", modifiers: ["Alt"] }], restricted: true,
    onDown: () => { openPanel(); return true; }
  });
});

Hooks.once("ready", () => {
  game.socket.on(SOCKET, onSocket);
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { open: openPanel, close: () => game.user.isGM && endRequest(), state };
});

// GM button in the Token controls (Foundry V13+ uses a record, older cores an array)
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user?.isGM) return;
  const tool = { name: "grimFateroll", title: "Grim FateRoll", icon: "fa-solid fa-dice-d20", button: true, visible: true };
  if (Array.isArray(controls)) {
    controls.find((c) => c.name === "token")?.tools?.push({ ...tool, onClick: openPanel });
  } else {
    const group = controls.tokens ?? controls.token;
    if (group?.tools) group.tools.grimFateroll = { ...tool, order: Object.keys(group.tools).length, onChange: () => openPanel() };
  }
});

/* ---------- GM panel ---------- */
function openPanel() {
  if (!game.user.isGM) return;
  if (game.system?.id !== "dnd5e") ui.notifications?.warn("Grim FateRoll is built for the dnd5e system.");
  state.panel ??= new Panel({
    load: () => get("lastConfig"),
    save: (cfg) => game.settings.set(MODULE_ID, "lastConfig", cfg),
    loadPos: () => get("panelPos"),
    savePos: (pos) => game.settings.set(MODULE_ID, "panelPos", pos),
    useDsn: () => get("useDsn"),
    start: startRequest
  });
  state.panel.toggle();
}

async function startRequest(req, secret) {
  req.dim = get("dim"); req.accent = get("accent");
  emit({ t: "start", req });
  await begin(req, secret);
}

function endRequest() {
  if (!state.req) return;
  emit({ t: "close", id: state.req.id });
  finish();
}

/* ---------- shared flow ---------- */
async function begin(req, secret = null) {
  await finish();
  state.req = req; state.secret = secret;
  state.overlay = new Overlay(req, {
    isGM: game.user.isGM, userId: game.user.id, secret,
    dim: req.dim, accent: /^#[0-9a-f]{3,8}$/i.test(req.accent ?? "") ? req.accent : null,
    lowFx: get("lowFx"), sound: get("sound"), playSound,
    onRoll: (p) => roll(req, p),
    onClose: endRequest,
    onDismiss: finish,
    onReveal: () => { if (!state.secret) return; emit({ t: "reveal", id: req.id, dcs: state.secret }); state.overlay?.reveal(state.secret); },
    onAllRolled: () => {
      const s = game.user.isGM ? Number(get("autoClose")) : 0;
      if (s > 0) state.timer = setTimeout(() => state.req?.id === req.id && endRequest(), s * 1000 + 2500);
    }
  });
}

async function finish() {
  clearTimeout(state.timer);
  const o = state.overlay;
  state.overlay = null; state.req = null; state.secret = null;
  if (o) await o.close();
}

function onSocket(msg) {
  if (!msg?.t) return;
  if (msg.t === "start") return begin(msg.req);
  if (!state.req || msg.id !== state.req.id) return;
  if (msg.t === "roll") state.overlay?.showResult(msg.actorId, msg.result);
  else if (msg.t === "reveal") state.overlay?.reveal(msg.dcs ?? {});
  else if (msg.t === "close") finish();
}

/* ---------- rolling ---------- */
async function roll(req, p) {
  const n = p.adv ? 2 : 1;
  let d20, d4;
  try {
    const formula = [`${n}d20`, ...p.d4.map(() => "1d4")].join(" + ");
    const r = await new Roll(formula).evaluate({ allowInteractive: false });
    d20 = r.dice[0].results.map((x) => x.result);
    d4 = r.dice.slice(1).map((d) => d.results[0].result);
  } catch (e) {
    console.warn(`${MODULE_ID} | Roll failed, using fallback`, e);
    const rnd = (f) => Math.floor(Math.random() * f) + 1;
    d20 = Array.from({ length: n }, () => rnd(20)); d4 = p.d4.map(() => rnd(4));
  }
  const kept = p.adv > 0 ? Math.max(...d20) : p.adv < 0 ? Math.min(...d20) : d20[0];
  const total = kept + d4.reduce((a, b) => a + b, 0) + p.mod;
  const result = { d20, kept, d4, total, nat: kept === 20 ? 20 : kept === 1 ? 1 : 0 };
  if (state.req?.id !== req.id) return;
  emit({ t: "roll", id: req.id, actorId: p.actorId, result });
  state.overlay?.showResult(p.actorId, result);
  if (get("postToChat")) setTimeout(() => postChat(req, p, result), 2300);
}

function playSound() {
  try {
    const helper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    helper?.play({ src: "sounds/dice.wav", volume: 0.6, autoplay: true, loop: false }, false);
  } catch (e) { /* silent */ }
}

function postChat(req, p, res) {
  try {
    const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s)) : String(s).replace(/[&<>"]/g, "");
    const dice = p.adv ? res.d20.map((v) => (v === res.kept ? `<b>${v}</b>` : `<s>${v}</s>`)).join(" / ") : `<b>${res.kept}</b>`;
    const d4 = res.d4.map((v, i) => ` + ${v} <small>(${esc(p.d4[i] ?? "d4")})</small>`).join("");
    const dc = p.dc;
    const out = dc == null ? "" : `<div class="gfr-chat-out ${res.total >= dc ? "ok" : "no"}">${res.total >= dc ? "Success" : "Failure"} · DC ${dc}</div>`;
    const nat = res.nat === 20 ? `<div class="gfr-chat-nat n20">Natural 20</div>` : res.nat === 1 ? `<div class="gfr-chat-nat n1">Natural 1</div>` : "";
    const adv = p.adv > 0 ? " · Advantage" : p.adv < 0 ? " · Disadvantage" : "";
    const content = `<div class="gfr-chat"><div class="gfr-chat-title">${esc(p.title)}${adv}</div>${nat}
      <div class="gfr-chat-total">${res.total}</div>
      <div class="gfr-chat-formula">${dice}${d4} ${esc(p.modText.replace(/^([+−])/, "$1 "))}</div>${out}</div>`;
    const actor = game.actors.get(p.actorId);
    ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
  } catch (e) { console.warn(`${MODULE_ID} | chat card failed`, e); }
}
