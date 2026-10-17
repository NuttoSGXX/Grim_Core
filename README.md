# Grim Core

**v1.0.0** · Foundry VTT V13–V14 · © DM Bank

Discord: https://discord.gg/XWfgWKpxJp

---

One settings panel for every Grim module. Pick a colour theme here and every active Grim module changes with it, for the GM and every player.

## How to use

1. Open **Game Settings → Configure Settings → Grim Core → Open Grim Core** (GM only).
2. Pick a theme and press **Apply to all**.

| Module | What follows |
| --- | --- |
| Grim Almanac, Grim Theater of Mind, Grim Pulse, Grim Jukebox, Stage Pacer, Grim Target | Full theme |
| Grim FateRoll | Sigil (accent) colour |
| Grim VN Stage | GM panel colours |
| Grim Encounter | Launcher panel and the initiative screen (cards, buttons) |

## Themes

- **Crimson, Ash, Amethyst, Abyss** — the four built-in Grim themes (Abyss is the theme Almanac and Theater call Sapphire).
- **Custom** — any accent colour, on dark or light surfaces, with a slider for how much of the accent shows in backgrounds. Colours that carry a meaning (friendly / hostile, signal lamps, Natural 20 gold) are left alone.

Untick a module under **Modules that follow** to leave it on its own colours. **Back to Crimson** restores the default theme.

Grim Core works with any number of Grim modules installed; the ones that are not active are listed as Not active.

## Macro API

```js
const core = game.modules.get("grim-core").api;
core.open();
core.setTheme({ preset: "abyss" });
core.setTheme({ preset: "custom", accent: "#2fa37a", base: "dark", tint: 100 });
core.palette(); // current colours, e.g. { blood: "#18956d", bone: "#d7e5df", ... }
```

## Install

**With the manifest URL (recommended)**

1. In Foundry, go to **Setup → Add-on Modules → Install Module**.
2. Paste this into **Manifest URL** and press **Install**:
   ```
   https://github.com/NuttoSGXX/Grim_Core/releases/latest/download/module.json
   ```
3. Enable the module under Manage Modules in your world.

**By hand**

1. Download `module.zip` from the [latest release](https://github.com/NuttoSGXX/Grim_Core/releases/latest) and unzip it into a folder named `grim-core`.
2. Move the `grim-core` folder into Foundry's `Data/modules/` (find the location under Setup → Configuration → User Data Path).
3. Check that `Data/modules/grim-core/module.json` exists, then restart Foundry and enable the module.

Players install nothing; only the machine hosting the game needs the module. On The Forge, install it with the same manifest URL.

**Updating:** use **Update** on the module in Foundry's Add-on Modules tab. Your world's settings are kept.

## Terms of use

© 2026 DM Bank. All rights reserved.

- Free to download and use.
- Do not sell this module or its files.

## Contact / support

Discord: https://discord.gg/XWfgWKpxJp
