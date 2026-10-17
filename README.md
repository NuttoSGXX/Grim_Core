# Grim FateRoll

**v1.0.0** · Foundry VTT V13–V14 · dnd5e system · © DM Bank

Discord: https://discord.gg/XWfgWKpxJp

---

Cinematic roll requests for the **dnd5e** system. The GM calls for a roll. The screen fades to black (the scene stays faintly visible), and every chosen player gets a slowly turning dice sigil with their own die in the middle. Each player clicks their die to roll.

## How to use

Open the panel from the **d20 button in the Token controls**, or press **Alt + R** (GM only, rebindable in Configure Controls). A macro can call `game.modules.get("grim-fateroll").api.open()`.

1. **Everyone rolls the same / Different roll each.** In the second mode every character gets their own roll type, skill or tool, ability and DC.
2. **Roll.** Ability check, saving throw, skill, or tool. Tools list only what the selected characters are proficient with. Skills and tools can use a different ability.
3. **Roll mode.** Normal, advantage or disadvantage for everyone. Each character row can override it.
4. **Difficulty.** Easy, Medium or Hard picks the flavour line shown at the top and fills in DC 10 / 15 / 20. Type any DC you like afterwards.
5. **Hide DC from players.** Players see `DC ??` and only their total. The GM sees the real DC and pass/fail, and can press **Reveal DC**.
6. **Who rolls.** Up to 8 characters. Bless (saves) and Guidance (checks) are switched on automatically when the character has an active effect with that name, and add a d4. Each row also has a situational bonus.
7. **Call the Roll.**

During the roll the GM has three buttons at the bottom: **Roll Remaining** (rolls for anyone who has not clicked), **Reveal DC**, and **End**. The GM can also click any single die to roll it for that player.

## What players see

- A flavour line at the top, chosen at random from 10 per difficulty.
- The roll name, for example *Dexterity Saving Throw*.
- A sigil per character: the outer ring spells the character's name in runes.
- One d20, or two side by side for advantage / disadvantage, plus a d4 for each of Bless and Guidance.
- Under the sigil: name, level, class and subclass, then the modifier breakdown and the total modifier.
- **Natural 20**: the sigil turns gold with light rays and sparks. **Natural 1**: the sigil cracks, shakes and sheds ash.
- The layout adapts from 1 to 8 characters.

## Dice So Nice

The dice are drawn by this module so they stay inside the sigil. When Dice So Nice is active, each player's die takes its body, number and edge colours from that player's Dice So Nice appearance. Textures and 3D models are not copied.

## Settings

| Setting | Scope | Default |
| --- | --- | --- |
| Backdrop darkness (%) | World | 80 |
| Sigil colour | World | `#c8141e` |
| Use Dice So Nice colours | World | On |
| Post results to chat | World | On |
| Auto close (seconds) | World | 0 (GM closes by hand) |
| Dice sound | Client | On |
| Reduced effects | Client | Off |

With Grim Core active, the sigil colour follows Grim Core's theme.

## Notes

- A natural 20 or 1 gets the effect, but pass or fail is always decided by the total against the DC, as in the dnd5e rules for checks and saves.
- Modifiers come from the character sheet. Bonuses that are themselves dice, and features such as Reliable Talent or Halfling Luck, are not applied automatically. Use the row bonus for those.
- A player who joins or reloads while a roll is on screen will not see it. End it and call it again.

## Install

**With the manifest URL (recommended)**

1. In Foundry, go to **Setup → Add-on Modules → Install Module**.
2. Paste this into **Manifest URL** and press **Install**:
   ```
   https://github.com/NuttoSGXX/Grim_FateRoll/releases/latest/download/module.json
   ```
3. Enable the module under Manage Modules in your world.

**By hand**

1. Download `module.zip` from the [latest release](https://github.com/NuttoSGXX/Grim_FateRoll/releases/latest) and unzip it into a folder named `grim-fateroll`.
2. Move the `grim-fateroll` folder into Foundry's `Data/modules/` (find the location under Setup → Configuration → User Data Path).
3. Check that `Data/modules/grim-fateroll/module.json` exists, then restart Foundry and enable the module.

Players install nothing; only the machine hosting the game needs the module. On The Forge, install it with the same manifest URL.

**Updating:** use **Update** on the module in Foundry's Add-on Modules tab. Your world's settings are kept.

## Terms of use

© 2026 DM Bank. All rights reserved.

- Do not resell, share or redistribute this module or its files.
- You may use it as a tool for paid D&D games (commissions) and for livestreams.

The bundled fonts are licensed under the SIL Open Font License 1.1 (see the files in `fonts/`).

## Contact / support

Discord: https://discord.gg/XWfgWKpxJp
