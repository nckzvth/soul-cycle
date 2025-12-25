# Phase 3: EffectSystem (shadow mode) + initial phial port

## What ships now

### EffectSystem core (indexed, trigger-driven)
- `src/systems/EffectSystem.js`
  - Fixed trigger set (`runStart`, `levelUp`, `tick`, `hit`, `kill`, `damageTaken`, `dash`, `gaugeFill`, `runEnd`)
  - Builds an index by trigger (no per-frame global scans)
  - Supports `shadow` mode to record what *would* run without mutating gameplay

### Phial effect defs (JS-friendly, not data-only yet)
- `src/data/PhialEffectDefs.js`
  - Introduces `buildActivePhialEffectSources(player)` adapter (sources = player.phials + effect defs)
  - Ports **Ashen Halo** tick behavior into an effect def (uses the same `DamageSystem` + `DamageSpecs` + `Phials` math as legacy code)
  - Other phials remain unported in Phase 3 (by design; incremental)

### Runtime wiring (safe, reversible)
- `src/core/FeatureFlags.js`
  - `progression.effectSystemShadow` (default `false`)
  - `progression.effectSystemEnabled` reserved for later activation (default `false`)
- `src/entities/Player.js`
  - Calls `EffectSystem.trigger(...)` for `tick`, `hit`, `dash`, `damageTaken`, `gaugeFill` **only when** `progression.effectSystemShadow` is on
  - Wrapped in `try/catch` to ensure effect validation never crashes gameplay

### Validation tooling
- `scripts/validate_effect_system.mjs` + `npm run validate:effects`

## What is deferred
- Enabling the effect system to apply gameplay mutations (`progression.effectSystemEnabled` remains off).
- Porting the remaining phials and weapon perks (will be done one-by-one with parity checks).
- Switching effect defs from JS functions to pure data (we keep the migration path open, but don’t force it now).

## Activation path later (no redesign required)
1. Turn on `progression.effectSystemShadow` during playtests to confirm trigger coverage (no gameplay change).
2. Port remaining phials to `src/data/PhialEffectDefs.js` and add validation cases for each.
3. Add a controlled cutover per phial/perk:
   - enable effect-based behavior for that source
   - disable the legacy hardcoded behavior for that same source (to prevent double-procs)
4. Once parity is reached across all sources, move toward `progression.effectSystemEnabled` as the default.

