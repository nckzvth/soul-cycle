// Feature flags are used to ship incremental, reversible milestones.
// Phase 0: add plumbing only; no gameplay behavior should change by default.

const DEFAULTS = Object.freeze({
  // Content validation (Phase 0+)
  "content.useVocabularyValidationStrict": true,

  // Phase 1: allow disabling Constitution rollout quickly if needed.
  "progression.constitutionEnabled": true,

  // Phase 2+: progression migration flags (default off; reversible)
  "progression.phialsOnlyLevelUps": true,
  "progression.preRunWeaponPerks": true,
  "progression.metaMasteryEnabled": true,

  // Phase 2+: weapon identity migration (default off; reversible)
  // Stage 5: Repeater is canonical; still accepts legacy "pistol" saves/items via normalization.
  "content.weaponIdRepeaterEnabled": true,

  // Phase 3: shared EffectSystem (shadow mode first)
  "progression.effectSystemShadow": false,
  "progression.effectSystemEnabled": true,
});

function readQueryFlags() {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("flags");
    if (!raw) return {};
    const out = {};
    for (const part of raw.split(",")) {
      const [k, v] = part.split("=");
      if (!k) continue;
      out[k] = v == null ? "1" : v;
    }
    return out;
  } catch {
    return {};
  }
}

function readStorageFlag(key) {
  try {
    return window.localStorage?.getItem?.(`flag:${key}`) ?? null;
  } catch {
    return null;
  }
}

function coerceBool(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "1" || s === "true" || s === "on" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "off" || s === "no") return false;
  return null;
}

const QUERY = readQueryFlags();

export const FeatureFlags = {
  defaults: DEFAULTS,

  isOn(key) {
    const fromQuery = QUERY[key];
    const q = coerceBool(fromQuery);
    if (q != null) return q;

    const fromStorage = readStorageFlag(key);
    const s = coerceBool(fromStorage);
    if (s != null) return s;

    return !!DEFAULTS[key];
  },

  set(key, on) {
    try {
      window.localStorage?.setItem?.(`flag:${key}`, on ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  },
};
