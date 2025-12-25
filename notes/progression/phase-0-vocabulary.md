# Phase 0: Controlled vocabulary + tag validation (no gameplay change)

## What ships now

### Controlled vocabulary (binding)
- `src/data/Vocabulary.js`
  - `AttributeId`, `RiteId`, `AspectId`
  - `DeliveryTagId`, `MechanicTagId`, `TargetTagId`
  - `StatusId` (separate from tags; controlled vocabulary)
  - `ATTRIBUTE_TO_RITE` (source of truth)
  - `ASPECTS_BY_RITE` (aspect validity matrix; source of truth)

### Validation plumbing (fail-fast, strict end-goal)
- `src/data/TagValidation.js`
  - `validateTagSet(tagSet)` rejects unknown tag values and enforces:
    - attribute→rite consistency
    - aspect-by-rite validity
    - per-bucket cardinality limits
  - `validateWeaponConfig(weaponConfig)` enforces:
    - exactly one `primaryAttribute`
    - **no authored `riteTag`** on weapons
- `src/data/ContentValidation.js`
  - `isStrictVocabularyValidationEnabled()` reads `FeatureFlags`
  - `validateTaggedDef(def)` is a thin helper intended for future load-time checks

### Feature flag scaffold
- `src/core/FeatureFlags.js`
  - `content.useVocabularyValidationStrict` defaults to `false` (Phase 0 is gameplay-neutral)
  - Query override supported via `?flags=content.useVocabularyValidationStrict=1`
  - Local override supported via `localStorage["flag:content.useVocabularyValidationStrict"] = "1"`

### Validation scripts (developer tooling)
- `scripts/validate_vocab.mjs`
- `scripts/validate_tag_validation.mjs`
- `scripts/validate_content.mjs`

These are wired in `package.json` as:
- `npm run validate:vocab`
- `npm run validate:tags`
- `npm run validate:content`

## What is deferred (but the path is preserved)
- Tagging existing content defs (phials/perks/weapons) and then flipping strict mode on by default.
- Runtime validation of content at load time (we ship the modules now; Phase 1+ will decide the exact integration point).

## Activation path later (no redesign required)
1. Add `tags: { ... }` to phials/perks/weapon configs.
2. Run the validation scripts (or add CI wiring).
3. Flip default `content.useVocabularyValidationStrict` to `true` once all content passes.
4. (Optional) Add a small “content load validator” pass in game init that calls `validateTaggedDef()` on all defs.

