# Phase 2: ProfileStore + feature flags (playable; reversible)

## What ships now

### Versioned profile persistence (schema + migrations)
- `src/core/ProfileStore.js`
  - JSON profile saved to `localStorage["soulcycle:profile"]`
  - Backup of previous blob at `localStorage["soulcycle:profile:backup"]`
  - `schemaVersion` and safe migration (currently `v1`)
  - Default schema includes scaffolding for:
    - `settings.cameraZoom`
    - `armory.loadout` (gear snapshot)
    - `armory.perkSocketsByWeapon` (Phase 5 sockets schema placeholder)
    - `mastery.attributes` and `mastery.weapons` (Phase 6 scaffold)
    - `history.recentRuns` (Phase 6+ telemetry scaffold)

### Safe wiring into the game (no run/gameplay changes)
- `src/core/Game.js`
  - Loads profile once in `init()` into `Game.profile` (fail-safe)
  - Uses profile camera zoom if present (non-gameplay setting)
  - Implements `Game.save()` (previously missing but referenced by UI) to persist:
    - `settings.cameraZoom`
    - `armory.loadout` snapshot of current `p.gear`

### Feature-flag scaffolding for upcoming phases
- `src/core/FeatureFlags.js` now reserves defaults for:
  - `progression.phialsOnlyLevelUps` (Phase 4)
  - `progression.preRunWeaponPerks` (Phase 5)
  - `progression.metaMasteryEnabled` (Phase 6)
  - `content.weaponIdRepeaterEnabled` (weapon rename/migration)

### Validation tooling
- `scripts/validate_profile_store.mjs` + `npm run validate:profile`

## What is deferred
- Auto-applying saved loadouts/armory to the runtime player on boot (Phase 5 Armory UI will control this explicitly).
- Any mastery rules (Phase 6).
- Any run telemetry population (Phase 6), beyond schema placeholders.

## Activation path later (no redesign required)
- Armory (Phase 5):
  - Populate `armory.perkSocketsByWeapon[weaponId]` with `{ level2, level5, level10, level15 }`.
  - Add a loadout apply step when leaving Town / starting run.
- Mastery + 70/30 XP (Phase 6):
  - Append `RunResult` summaries to `history.recentRuns` (keep bounded length).
  - Update `mastery.attributes` and `mastery.weapons` using the saved schema.
- Tests:
  - Extend `scripts/validate_profile_store.mjs` to cover migration edge cases and schema invariants.

