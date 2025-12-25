# Phase 6: Meta progression (masteries + 70/30 XP distribution; flagged; reversible)

## What ships now

### RunResult capture + end-of-run events
- `src/systems/MasterySystem.js` provides `computeRunResult(game, { endReason, state })`.
- `src/core/Game.js` calls `Game.endRun(endReason, state)` from:
  - death (`src/entities/Player.js`)
  - return-to-town forfeit (`Game.abortRunToTown`)
  - restart (`Game.restartRunInPlace`)
  - Field completion (`src/states/FieldState.js`)
  - Dungeon completion/fail (`src/states/DungeonState.js`)
- Run history is always appended to `Game.profile.history.recentRuns` (bounded by `BALANCE.progression.mastery.recentRunsMax`).

### Mastery XP + 70/30 distribution (flagged)
- Flag: `progression.metaMasteryEnabled` (default `false`)
- When enabled on run end:
  - A single `masteryXp` value is computed from performance using `BALANCE.progression.mastery.*`
  - Attribute XP distribution:
    - 70% goes to the equipped weapon’s `primaryAttribute`
    - 30% goes to attributes based on picked phials’ `tags.attributeTag` weights (proportional to stacks)
    - If no phials have attribute tags yet, the 30% falls back to the weapon’s primary attribute
  - Weapon mastery:
    - 100% of `masteryXp` goes to the equipped weapon’s mastery track
- Data lives in `Game.profile.mastery.attributes` and `Game.profile.mastery.weapons`.

### Attribute mastery passive bonuses (flagged)
- `src/core/Game.js` copies mastery levels onto the player as `p.metaMasteryLevels`.
- `src/systems/StatsSystem.js` applies small passive bonuses when meta is enabled:
  - Might mastery: small `powerMult` bonus per level
  - Will mastery: small `soulGain` bonus per level
  - Alacrity mastery: small `attackSpeed` + `moveSpeedMult` bonus per level
  - Constitution mastery: small `hp` bonus per level

### Weapon mastery gates perk socket options (no schema changes)
- `src/data/PerkSockets.js` now supports `unlockAtWeaponMasteryLevel` per option.
- `src/systems/UI.js` disables locked perks in the Armory sockets view when meta progression is enabled.
- `src/entities/Player.js` also enforces eligibility when activating milestone perks (locked selections won’t grant).

### Content scaffolding for 30% share
- `src/data/Phials.js` now includes minimal `tags.attributeTag` assignments (non-strict; safe to retune).

## What is deferred
- “Behavior milestones” and richer weighting for the 30% choice share (still proportional-to-stacks).
- Actual Attribute Mastery passive effect hooks (the effect system plumbing exists; specific unlock effects will be added later).
- Weapon-exclusive phials/variants (schema supports; content comes later).

## Rollback safety
- With `progression.metaMasteryEnabled` off:
  - no XP is granted
  - no unlock gating is applied
  - RunResults are still recorded to `history.recentRuns` for tuning/debugging

## Validation
- `npm run validate:mastery`
- `npm run validate:sockets`
