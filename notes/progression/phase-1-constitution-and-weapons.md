# Phase 1: Constitution + weapon identity groundwork (playable; reversible)

## What ships now

### Constitution (4th attribute)
- Player/run state supports Constitution:
  - `src/entities/Player.js` adds `attr.constitution` and `totalAttr.constitution`.
  - Reset points updated:
    - `src/core/Game.js` (`resetRunProgression`)
    - `src/states/TownState.js` (`enter`)
- Stat scaling:
  - `src/systems/StatsSystem.js` includes Constitution in totals and applies `BALANCE.player.hpPerConstitution`.
  - `src/data/Balance.js` adds `hpPerConstitution` (per-point; picks add +5).
- UI:
  - `src/systems/UI.js` shows Constitution in the inventory attribute panel and as an attribute pick on level-up.
  - Pause “Build” panel lists Constitution tier as placeholder (“Tier I/II”) without committing to perk content yet.

### Reversible rollout flag
- `src/core/FeatureFlags.js` adds `progression.constitutionEnabled` (default `true`).
- When turned off:
  - Constitution is hidden in UI (inventory/build/level-up)
  - Constitution is ignored by stat totals and perk tiers

### Weapon identity groundwork (primaryAttribute-only)
- `src/data/Weapons.js` introduces `WeaponId` and per-weapon configs containing only `primaryAttribute`.
  - Rite is derived (never authored) via `validateWeaponConfig()` rules from Phase 0.
  - Includes a Repeater canonical identity and a `pistol` legacy alias (no runtime rename yet).

## What is deferred
- Wiring weapon configs into runtime gameplay (e.g., deriving a weapon’s rite for offers/XPs/perk libraries).
- Any Constitution-specific perk/mastery behaviors (this phase only establishes the attribute, UI visibility, and HP scaling).
- Pistol→Repeater UI/asset renames (kept as an alias layer for now).

## Activation path later (no redesign required)
- Weapon configs:
  - Start reading `getWeaponConfigByCls(p.gear.weapon.cls)` at the integration points (Phase 5/6) to derive primaryAttribute/rite.
  - Add Scythe config (already scaffolded) when the weapon ships (Phase 7).
- Constitution mastery/perks:
  - Implement mastery hooks/effects gated by meta progression (Phase 6) using `AttributeId.Constitution` / `RiteId.Ossuary`.
- Tests:
  - Continue running `npm run validate:vocab` and `npm run validate:tags`.
  - Add content tagging + strict mode flip once phials/perks/weapons are tagged (Phase 2–3).

