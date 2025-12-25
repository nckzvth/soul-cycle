# Step 1: Shipping posture + baseline (source-of-truth + QA toggles)

This step exists to prevent “flag soup” and unclear rollout. When a bug is found, the team should be able to answer:
- Which feature is on/off by default?
- How do I reproduce with a specific flag set?
- What is the one smoke route that must pass before we ship a flip?

## Goal: turn everything on (defaults end-state)

The target end-state is “new world fully active” with defaults flipped to enable the entire architecture by default, while still retaining override capability via `?flags=` and `localStorage` for emergency rollback and repro.

**End-state defaults (target):**
- `progression.constitutionEnabled=true` (already true)
- `progression.preRunWeaponPerks=true`
- `progression.phialsOnlyLevelUps=true`
- `progression.metaMasteryEnabled=true`
- `content.useVocabularyValidationStrict=true`
- `progression.effectSystemEnabled=true`
- `progression.effectSystemShadow=false` (shadow mode is a migration tool; end-state should not need it)
- `content.weaponIdRepeaterEnabled=true`

## Source of truth (where to look)

- Flag registry + defaults: `src/core/FeatureFlags.js`
- Flag usage callsites (primary):
  - `progression.constitutionEnabled`: `src/systems/StatsSystem.js`, `src/systems/UI.js`
  - `progression.phialsOnlyLevelUps`: `src/entities/Player.js`, `src/systems/UI.js`
  - `progression.preRunWeaponPerks`: `src/entities/Player.js`, `src/systems/UI.js`
  - `progression.metaMasteryEnabled`: `src/core/Game.js`, `src/systems/StatsSystem.js`, `src/systems/UI.js`
  - `content.useVocabularyValidationStrict`: `src/data/ContentValidation.js` (runtime wiring is part of Step 2)
  - `progression.effectSystemShadow`: `src/entities/Player.js` (shadow-trigger hooks)
  - `progression.effectSystemEnabled`: reserved for cutover (Step 4)
  - `content.weaponIdRepeaterEnabled`: reserved (Step 5; currently not wired)

## How QA/dev toggles flags (no code edits)

### Option A: URL query (preferred for repro notes)

`FeatureFlags` reads `?flags=` as a comma-separated list.

- Example (enable one flag): `/?flags=progression.preRunWeaponPerks=1`
- Example (enable multiple): `/?flags=progression.preRunWeaponPerks=1,progression.metaMasteryEnabled=1`
- Example (explicit off): `/?flags=progression.metaMasteryEnabled=0`

Notes:
- Values treated as “on”: `1,true,on,yes`
- Values treated as “off”: `0,false,off,no`

### Option B: localStorage (sticky across reloads)

Flags are stored as `flag:${key}` with `"1"`/`"0"`.

- Enable: `localStorage.setItem("flag:progression.preRunWeaponPerks","1")`
- Disable: `localStorage.setItem("flag:progression.preRunWeaponPerks","0")`
- Clear override: `localStorage.removeItem("flag:progression.preRunWeaponPerks")`

## Current defaults (today)

From `src/core/FeatureFlags.js`:
- `content.useVocabularyValidationStrict=true`
- `progression.constitutionEnabled=true`
- `progression.phialsOnlyLevelUps=true`
- `progression.preRunWeaponPerks=true`
- `progression.metaMasteryEnabled=true`
- `content.weaponIdRepeaterEnabled=true`
- `progression.effectSystemShadow=false`
- `progression.effectSystemEnabled=true`

## Rollout order (recommended)

Flip **one** flag per release/playtest cycle:
1. `progression.preRunWeaponPerks`
2. `progression.phialsOnlyLevelUps`
3. `progression.metaMasteryEnabled`
4. `content.useVocabularyValidationStrict` (only after Step 2 is green)
5. `progression.effectSystemEnabled` (only after Step 4 parity + cutover is complete)

## Default flip schedule (concrete proposal)

This is the “turn everything on” path expressed as staged default flips. Each stage should ship playable and be rollbackable by turning off the most-recently-flipped flag.

- **Stage 0 (today / baseline):** keep current defaults; only QA uses `?flags=` to activate features for verification.
  - Known-good repro string: `/?flags=`
  - Rollback: n/a
- **Stage 1 (Armory sockets default-on):** flip `progression.preRunWeaponPerks=true`
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1`
  - Rollback flag: `progression.preRunWeaponPerks`
- **Stage 2 (Phials-only level-ups default-on):** flip `progression.phialsOnlyLevelUps=true`
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1,progression.phialsOnlyLevelUps=1`
  - Rollback flag: `progression.phialsOnlyLevelUps`
- **Stage 3 (Meta mastery default-on):** flip `progression.metaMasteryEnabled=true`
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1,progression.phialsOnlyLevelUps=1,progression.metaMasteryEnabled=1`
  - Rollback flag: `progression.metaMasteryEnabled`
- **Stage 4 (Strict tags default-on):** flip `content.useVocabularyValidationStrict=true` after Step 2 content tagging + boot-time validation wiring is complete
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1,progression.phialsOnlyLevelUps=1,progression.metaMasteryEnabled=1,content.useVocabularyValidationStrict=1`
  - Rollback flag: `content.useVocabularyValidationStrict`
- **Stage 5 (EffectSystem cutover default-on):** flip `progression.effectSystemEnabled=true` after Step 4 parity + per-source cutover prevents double-procs
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1,progression.phialsOnlyLevelUps=1,progression.metaMasteryEnabled=1,content.useVocabularyValidationStrict=1,progression.effectSystemEnabled=1`
  - Rollback flag: `progression.effectSystemEnabled`
- **Stage 6 (Repeater migration default-on):** flip `content.weaponIdRepeaterEnabled=true` only once Step 5 is complete and saves/content are migrated
  - Known-good repro string: `/?flags=progression.preRunWeaponPerks=1,progression.phialsOnlyLevelUps=1,progression.metaMasteryEnabled=1,content.useVocabularyValidationStrict=1,progression.effectSystemEnabled=1,content.weaponIdRepeaterEnabled=1`
  - Rollback flag: `content.weaponIdRepeaterEnabled`

## Baseline smoke route (must pass before/after each flip)

Use the same route every time and attach the exact `?flags=` string to bug reports:
1. Start a run (Town → Field or Dungeon)
2. Reach level 2/5/10
3. If `progression.preRunWeaponPerks=1`: confirm socketed perk “PERK ONLINE” toasts at milestones
4. If `progression.phialsOnlyLevelUps=1`: confirm level-up UI shows phials only and you never get offered a 4th unique phial
5. End run via death and via completion/forfeit (when available)
6. If `progression.metaMasteryEnabled=1`: confirm run history updates and mastery levels change

## “Shipping defaults” decision table (fill in per release)

For each release, record:
- Date/version:
- Default flips made:
- Known-good repro string (copy/paste URL):
- Rollback plan (single flag to turn off):
