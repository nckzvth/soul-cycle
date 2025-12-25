import { FeatureFlags } from "../core/FeatureFlags.js";
import { validateTagSet, validateWeaponConfig } from "./TagValidation.js";

export function isStrictVocabularyValidationEnabled() {
  return FeatureFlags.isOn("content.useVocabularyValidationStrict");
}

/**
 * Validates a tagged content definition (phial/perk/etc).
 * Phase 0: not wired into runtime gameplay; intended for content load-time checks and scripts.
 */
export function validateTaggedDef(def, opts = {}) {
  const { kind = "content", strict = isStrictVocabularyValidationEnabled() } = opts;
  if (!def || typeof def !== "object") return { ok: true, normalized: def };

  // TagSet is optional; in non-strict mode we allow missing tags while scaffolding rolls out.
  if (def.tags != null) {
    validateTagSet(def.tags, { context: { kind, id: def.id || def.weaponId || null } });
  } else if (strict) {
    // In strict mode, all gameplay-impacting defs should be tagged.
    // (Exact enforcement by content type happens in later phases.)
    throw new Error(`${kind} is missing required tags`);
  }

  return { ok: true, normalized: def };
}

export function validateWeaponDef(def, opts = {}) {
  const { strict = isStrictVocabularyValidationEnabled() } = opts;
  if (!def || typeof def !== "object") return { ok: true, normalized: def };
  // In strict mode we require WeaponConfig rules; in non-strict mode we still validate if present.
  if (def.primaryAttribute != null || strict) {
    return validateWeaponConfig(def, { context: { kind: "weapon", id: def.weaponId || def.id || null } });
  }
  return { ok: true, normalized: def };
}

