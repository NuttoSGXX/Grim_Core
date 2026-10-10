# Grim Core

One settings panel for every Grim module (Foundry VTT v13 / v14).

Pick a theme in **Game Settings → Configure Settings → Grim Core → Open Grim Core** and press
**Apply to all**. Every active Grim module changes together, for the GM and every player.

| Module | What follows |
| --- | --- |
| Grim Almanac, Grim Theater of Mind, Grim Pulse, Grim Jukebox, Stage Pacer | Full theme |
| Grim FateRoll | Sigil (accent) colour |
| Grim VN Stage, Grim Encounter | GM panel colours |

## Themes

- **Crimson, Ash, Amethyst, Abyss**: the four built-in Grim themes. Grim Core writes each
  module's own theme setting (Abyss is called Sapphire in Almanac and Theater).
- **Custom**: any accent colour, on dark or light surfaces. Grim Core reads each module's colour
  tokens from its stylesheet and recolours them, so new tokens in later module versions are picked
  up without updating Grim Core. Colours that carry a meaning (friendly / hostile, signal lamps,
  Natural 20 gold) are left alone.

Untick a module under **Modules that follow** to leave it on its own setting.

## Macro API

```js
const core = game.modules.get("grim-core").api;
core.open();
core.setTheme({ preset: "abyss" });
core.setTheme({ preset: "custom", accent: "#2fa37a", base: "dark", tint: 100 });
core.palette(); // current colours, e.g. { blood: "#18956d", bone: "#d7e5df", ... }
```

## Adding another Grim module

Add one line to `TARGETS` in `scripts/engine.js` (module id, its theme setting, its CSS token prefix).

## Install

Unzip into `Data/modules/grim-core/`, or use the manifest URL once a release is published:
`https://github.com/NuttoSGXX/Grim_Core/releases/latest/download/module.json`
