# Phase 7: Scythe (Constitution / Ossuary) + golem summoner path (ships first)

## What ships now

### Weapon: Scythe (baseline kit)
- Weapon config already exists (primary attribute only):
  - `src/data/Weapons.js` declares Scythe as `primaryAttribute: Constitution` (rite derived to Ossuary).
- Combat kit implemented in `src/entities/Player.js` for `weapon.cls === "scythe"`:
  - Swipe, swipe, harvest 3-hit combo
  - Harvest applies `StatusId.Marked` (controlled status vocabulary)

### Marked deaths → soul capture → golems (with cap/overflow heal)
- Golem minion entity:
  - `src/entities/Minions.js` (`GolemMinion`)
- Field/Dungeon now maintain a `minions` list:
  - `src/states/FieldState.js`
  - `src/states/DungeonState.js`
- Marked enemy death hook:
  - Field/Dungeon call `player.onScytheMarkedDeath(state, enemy)` when the dead enemy has `StatusId.Marked`.
- Capture behavior (`src/entities/Player.js`):
  - If below cap: summon a Stone/Bone golem at the corpse position
  - If at cap: heal existing golems by a % of max HP instead

### Balance knobs
- `src/data/Balance.js`
  - `player.scythe.*` (cooldown, damageMult, range, combo reset)
  - `skills.scythe.*` (mark duration, golem cap, overflow heal %, golem slam coeff)

### Town weapon selection includes Scythe (placeholder art)
- `src/states/TownState.js` adds Scythe as a selectable weapon icon (reuses staff icon for now).
- Also updates the pistol label in town to “Repeater” (runtime `cls` remains `pistol` for compatibility).
- `src/core/Game.js#equipStartingWeapon` supports `repeater` alias and `scythe`.

### Perk library + sockets for Scythe (meaningful day one)
- New Scythe perks added to `src/data/Skills.js` (`cls: "scythe"`).
- Socket library includes Scythe options and weapon-mastery unlock thresholds:
  - `src/data/PerkSockets.js`
  - validated by `npm run validate:sockets`

## What is deferred
- Dedicated Scythe icon/animation assets (placeholder icon is used).
- Advanced golem AI/attack patterns and deeper balancing (current behavior is simple and stable).
- Dual-scythe fast-melee path (placeholder perk exists: `y_dual_scythe_path_stub`).

## Activation path later
- Add proper art:
  - add `scytheIcon` to `src/data/Art.js` + preload list
  - update `TownState.ensureWeaponIcons()` to use it
- Expand subclass paths:
  - implement behavior behind `scytheDualScythesEnable` and add more perks gated by weapon mastery
- Tighten tuning:
  - adjust `BALANCE.player.scythe.*` and `BALANCE.skills.scythe.*`
  - add additional validation/sim scripts for golem cap + overflow heal scaling

