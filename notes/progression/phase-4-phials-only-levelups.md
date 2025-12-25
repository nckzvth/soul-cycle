# Phase 4: In-run level-ups become phials-only (flagged; reversible)

## What ships now

### Flag-gated leveling rule
- `progression.phialsOnlyLevelUps` (default `false`) controls whether level-ups grant:
  - **Legacy**: 1 attribute pick + 1 weapon upgrade pick + 1 phial pick
  - **New**: phial pick only
- Implemented in `src/entities/Player.js` (`giveXp()`).

### Flag-gated UI (phials-only)
- `src/systems/UI.js` renders the level-up modal as:
  - Legacy: attributes + weapon upgrade + phials
  - Phials-only: **phials row only**
- Safety conversion: if the flag is toggled mid-run, any pending attribute/weapon picks are converted into phial picks so the player cannot get stuck with hidden rows.

## What is deferred
- Any changes to phial offer UX/rarity presentation (this phase uses existing `PhialOfferSystem` behavior).
- Any conversion of existing *content* to tagged defs (strict tagging is handled in earlier phases and will flip later).

## Activation path later
1. Enable `progression.phialsOnlyLevelUps=1` via:
   - `?flags=progression.phialsOnlyLevelUps=1`, or
   - `localStorage["flag:progression.phialsOnlyLevelUps"]="1"`
2. Playtest run pacing and ensure:
   - level-ups always surface phial choices
   - after 3 unique phials are chosen, subsequent offers are upgrades only (handled by `PhialOfferSystem`)
3. Add a small run-sim test later (Phase 6+ tooling) to track offered ids and ensure invariants.

