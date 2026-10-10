// Grim Core: one panel that themes every Grim module at once.

import { MODULE_ID, DEFAULT_THEME, TARGETS, getTheme, applyTheme, saveTheme, paletteFor, isActive } from "./engine.js";
import { GrimCorePanel } from "./panel.js";

let panel = null;
function open() {
  if (!game.user.isGM) return ui.notifications.warn(game.i18n.localize("GRIMCORE.GMOnly"));
  panel ??= new GrimCorePanel();
  panel.render({ force: true });
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "theme", {
    scope: "world", config: false, type: Object, default: { ...DEFAULT_THEME },
    onChange: () => applyTheme()
  });
  game.settings.registerMenu(MODULE_ID, "panel", {
    name: "GRIMCORE.Title",
    label: "GRIMCORE.Open",
    hint: "GRIMCORE.MenuHint",
    icon: "fa-solid fa-palette",
    type: GrimCorePanel,
    restricted: true
  });
});

Hooks.once("ready", () => {
  applyTheme();
  // Stylesheets of other modules can finish loading a moment after "ready".
  setTimeout(() => applyTheme(), 1500);

  game.modules.get(MODULE_ID).api = {
    open,
    getTheme,
    /** setTheme({ preset: "abyss" }) or setTheme({ preset: "custom", accent: "#2fa37a" }) */
    setTheme: (theme) => saveTheme({ ...getTheme(), ...theme }),
    palette: () => paletteFor(getTheme()),
    modules: () => TARGETS.map((t) => ({ id: t.id, title: t.title, active: isActive(t.id) }))
  };
});
