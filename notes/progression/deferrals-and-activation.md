# Deferrals & activation paths (scaffolding ships now)

This doc is a Phase 0 guardrail: when something is deferred, we still ship the schema/hooks/flags/validation now so later activation does **not** require renaming, redesign, or refactoring core systems.

## Step 1: shipping posture + QA toggles

Start here before flipping any defaults: `notes/progression/step-1-shipping-posture.md`.

## Deferred: Level 15 relic slot behavior

### Ships now (Phase 0–5 scaffolding)
- A dedicated socket name in schema (`relic` / `level15`) is reserved in the planned `RunBuild` model.
- Tag buckets and validation support are already present (`deliveryTags`, `mechanicTags`, etc.).
- Feature flag is reserved: `progression.preRunWeaponPerks` gates the socketing system; a later flag can gate relic activation if needed.

### Deferred
- Actual relic-slot content (perk defs) and activation at level 15.
- UI polish and rarity/offer UX improvements.

### Activation path later
- Add `WeaponPerkDef`s that declare `socket: "relic"` and hook them into the Armory UI.
- Add milestone activation (level 15) in the run-start/milestone logic.
- Validate with `npm run validate:tags` + an additional `scripts/validate_content.mjs` when perk libraries are data-driven.

## Deferred: Deep offer/rarity UX rework

### Ships now (scaffolding)
- Feature flags and schema support for the new architecture exist (Phase 0: flags + vocab + validators).
- A unified “tagged content” model is supported by `src/data/Vocabulary.js` and `src/data/TagValidation.js`.

### Deferred
- Offer presentation, rarity visualization, and reroll UX iteration.

### Activation path later
- Swap offer generators to operate on tagged defs (phials/perks) and use tags for filtering/weighting.
- Add a small suite of scripted validations (offer invariants: no invalid tags, no “4th phial”, etc.).

## Deferred: Scythe dual-scythe fast-melee path (vs summoner-first)

### Ships now (scaffolding)
- Ossuary (Constitution) vocabulary and Aspect matrix include `Stone`, `Bone`, `Golemcraft`.
- Mechanic tags include summon hooks (`MinionCap`, `MinionHeal`, `MinionOnKill`) plus movement/control hooks.

### Deferred
- Content and balance for an alternate fast-melee path.

### Activation path later
- Add Scythe perk library entries that branch into the fast-melee path (using exclusive group gating, like current pistol pathing).
- Add validation + simple sim scripts for golem cap/heal scaling.

## RunResult shape (non-deferred requirement)

When Phase 6 lands, `RunResult` must capture enough to support 70/30 XP distribution and tuning across Town/Field/Dungeon without redesign:
- `endReason` (death, forfeit, fieldComplete, dungeonComplete, quit)
- `mode` (field vs dungeon)
- `weaponId` + weapon `primaryAttribute`
- `pickedPhials[]` including `{ id, stacks, attributeTag? }` (attributeTag can be derived later once content is tagged)
