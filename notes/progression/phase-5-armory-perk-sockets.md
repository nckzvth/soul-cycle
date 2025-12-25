# Phase 5: Armory perk sockets (pre-run buildcraft; playable; reversible)

## What ships now

### Armory-style Outfitter window (tabs/panels)
- `index.html` adds an Armory tab row inside the existing Outfitter modal:
  - Loadout
  - Weapon Perks (Phase 5)
  - Weapon Mastery (placeholder; Phase 6)
  - Attribute Mastery (placeholder; Phase 6)
  - Workshop (Later) (disabled placeholder)
- `src/systems/UI.js` drives tab switching and keeps existing Loadout behavior intact.

### Pre-run weapon perk sockets (usable day one)
- Flag: `progression.preRunWeaponPerks` (default `false`)
- When enabled:
  - `src/systems/UI.js` shows a “Weapon Perk Sockets” panel with:
    - weapon selector (Hammer/Staff/Repeater)
    - sockets for `level2`, `level5`, `level10`, and reserved `level15`
  - Sockets are persisted to the profile (`Game.profile.armory.perkSocketsByWeapon`).
  - First-time scaffold seeds defaults for `level2/5/10` so the system isn’t empty by default.

### Milestone activation (run-time)
- `src/entities/Player.js` activates the slotted perk automatically at run levels 2/5/10 (and reserves level 15):
  - On reaching the milestone level, grants the selected skill id once (no stacking)
  - Uses existing `SKILLS` + `StatsSystem` behavior so perks are meaningful immediately
  - If `progression.phialsOnlyLevelUps` is also enabled, level-ups remain phials-only

### Legacy migration safety
- `src/systems/UI.js` hides the in-run Weapon Upgrade row when `progression.preRunWeaponPerks` is on.
- Any pending weapon picks are converted into phial picks to prevent “hidden/stuck” picks.

### Minimal perk library (per weapon, per socket)
- `src/data/PerkSockets.js` defines `WEAPON_SOCKET_LIBRARY` with non-empty options for each weapon at `level2/5/10`.
- Validation:
  - `scripts/validate_perk_sockets.mjs`
  - `npm run validate:sockets`

## What is deferred
- Level 15 relic slot behavior/content (schema + UI are present now).
- Weapon Mastery / Attribute Mastery behavior and progression (panels are scaffolded now; Phase 6 will populate them).
- Pistol→Repeater runtime rename (Phase 5 uses a stable `WeaponId.Repeater` while runtime `cls` remains `pistol` for now).

## Activation path later
1. Turn on `progression.preRunWeaponPerks=1`.
2. Expand the socket library:
   - add more eligible perk ids per weapon/socket in `src/data/PerkSockets.js`
   - (later) gate entries by mastery unlocks (Phase 6)
3. Phase 6 populates mastery panels and uses the same saved `perkSocketsByWeapon` structure.
4. Phase 7 adds Scythe sockets by adding `WeaponId.Scythe` entries and validating with `npm run validate:sockets`.

