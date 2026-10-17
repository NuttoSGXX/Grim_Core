// Grim Core: the settings window.

import { PRESETS, TARGETS, DEFAULT_THEME, normalize, getTheme, paletteFor, accentOf, isActive, applyTheme, saveTheme } from "./engine.js";
import { isHex } from "./color.js";

const { ApplicationV2 } = foundry.applications.api;
const L = (key) => game.i18n.localize(`GRIMCORE.${key}`);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SWATCHES = ["ink", "panel-1", "iron", "wine", "blood", "ember", "accent-soft", "ash", "bone"];

export class GrimCorePanel extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "grim-core-panel",
    classes: ["grim-core-app"],
    window: { title: "GRIMCORE.Title", icon: "fa-solid fa-palette", resizable: false },
    position: { width: 520, height: "auto" }
  };

  #draft = null;

  get draft() {
    return (this.#draft ??= normalize(foundry.utils.deepClone(getTheme())));
  }

  /* ------------------------------ rendering ------------------------------ */

  async _renderHTML() {
    const t = this.draft;
    const root = document.createElement("div");
    root.className = "gc-body";
    const card = (id) => {
      const p = id === "custom" ? paletteFor({ ...t, preset: "custom" }) : paletteFor({ preset: id });
      return `<button type="button" class="gc-card${t.preset === id ? " is-on" : ""}" data-preset="${id}" aria-pressed="${t.preset === id}">
        <span class="gc-chip" style="background:linear-gradient(135deg, ${p["panel-1"]} 0 50%, ${p.blood} 50% 100%); border-color:${p.iron}"></span>
        <b>${L(`Preset.${id}`)}</b><small>${L(`PresetHint.${id}`)}</small></button>`;
    };
    const custom = t.preset === "custom";
    root.innerHTML = `
      <p class="gc-lead">${L("Lead")}</p>

      <h3>${L("Section.Theme")}</h3>
      <div class="gc-cards">${[...PRESETS, "custom"].map(card).join("")}</div>

      <fieldset class="gc-custom"${custom ? "" : " hidden"}>
        <label class="gc-row"><span>${L("Custom.Accent")}</span>
          <span class="gc-color"><input type="color" name="accentPick" value="${esc(t.accent)}"><input type="text" name="accent" value="${esc(t.accent)}" maxlength="7" spellcheck="false"></span></label>
        <label class="gc-row"><span>${L("Custom.Base")}</span>
          <select name="base"><option value="dark"${t.base === "dark" ? " selected" : ""}>${L("Custom.Dark")}</option><option value="light"${t.base === "light" ? " selected" : ""}>${L("Custom.Light")}</option></select></label>
        <label class="gc-row"><span>${L("Custom.Tint")}</span>
          <span class="gc-range"><input type="range" name="tint" min="0" max="200" step="5" value="${t.tint}"><output>${t.tint}%</output></span></label>
        <p class="gc-hint">${L("Custom.Hint")}</p>
      </fieldset>

      <div class="gc-preview" data-preview></div>

      <h3>${L("Section.Modules")}</h3>
      <ul class="gc-mods">
        ${TARGETS.map((m) => {
          const on = isActive(m.id);
          return `<li class="${on ? "" : "is-missing"}"><label><input type="checkbox" name="follow" value="${m.id}"${!t.off.includes(m.id) && on ? " checked" : ""}${on ? "" : " disabled"}>
            <span>${esc(m.title)}</span></label><em>${on ? L(m.setting ? "Mod.Theme" : m.accent ? "Mod.Accent" : "Mod.Panel") : L("Mod.Missing")}</em></li>`;
        }).join("")}
      </ul>

      <footer class="gc-foot">
        <button type="button" data-act="reset">${L("Reset")}</button>
        <button type="button" data-act="apply" class="gc-primary">${L("Apply")}</button>
      </footer>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender() {
    const root = this.element.querySelector(".gc-body");
    if (!root) return;
    root.addEventListener("click", (ev) => this.#onClick(ev));
    root.addEventListener("input", (ev) => this.#onInput(ev, root));
    this.#preview(root);
  }

  _onClose(options) {
    this.#draft = null;
    applyTheme(); // drop any unsaved preview
    return super._onClose?.(options);
  }

  /** Show the draft: swatches, and the panel itself wears the draft colours. */
  #preview(root) {
    const t = this.draft;
    const p = paletteFor(t);
    const box = root.querySelector("[data-preview]");
    if (box) {
      box.innerHTML = SWATCHES.map((k) => `<i title="${k} ${p[k]}" style="background:${p[k]}"></i>`).join("") +
        `<span class="gc-sample" style="background:linear-gradient(${p["pri-1"]}, ${p["pri-2"]}); color:${p["on-accent"]}; border-color:${p.ember}">${L("Sample")}</span>`;
    }
    applyTheme(t);
    const chip = root.querySelector('.gc-card[data-preset="custom"] .gc-chip');
    if (chip) {
      const c = paletteFor({ ...t, preset: "custom" });
      chip.style.background = `linear-gradient(135deg, ${c["panel-1"]} 0 50%, ${c.blood} 50% 100%)`;
      chip.style.borderColor = c.iron;
    }
  }

  /* ------------------------------- events ------------------------------- */

  #onInput(ev, root) {
    const el = ev.target;
    const t = this.draft;
    if (el.name === "accentPick") {
      t.accent = el.value;
      root.querySelector('[name="accent"]').value = el.value;
    } else if (el.name === "accent") {
      if (!isHex(el.value)) return;
      t.accent = el.value.length === 4 ? "#" + [...el.value.slice(1)].map((c) => c + c).join("") : el.value;
      root.querySelector('[name="accentPick"]').value = t.accent;
    } else if (el.name === "base") {
      t.base = el.value;
    } else if (el.name === "tint") {
      t.tint = Number(el.value);
      el.nextElementSibling.textContent = `${t.tint}%`;
    } else if (el.name === "follow") {
      t.off = el.checked ? t.off.filter((id) => id !== el.value) : [...new Set([...t.off, el.value])];
    } else return;
    this.#preview(root);
  }

  async #onClick(ev) {
    const preset = ev.target.closest("[data-preset]")?.dataset.preset;
    if (preset) {
      const t = this.draft;
      if (preset === "custom" && t.preset !== "custom") {
        // Start a custom theme from whatever is on screen.
        t.accent = accentOf(t);
        t.base = t.preset === "amethyst" ? "light" : "dark";
      }
      t.preset = preset;
      return this.render();
    }
    const act = ev.target.closest("[data-act]")?.dataset.act;
    if (act === "reset") {
      this.#draft = normalize({ ...DEFAULT_THEME, off: this.draft.off });
      return this.render();
    }
    if (act === "apply") {
      const failed = await saveTheme(this.draft);
      if (failed.length) ui.notifications.warn(game.i18n.format("GRIMCORE.Failed", { list: failed.join(", ") }));
      else ui.notifications.info(L("Applied"));
    }
  }
}

