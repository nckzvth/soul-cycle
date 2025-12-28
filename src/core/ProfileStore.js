// Versioned profile persistence for Soul-Cycle.
// Phase 2: scaffolding only (meta progression not implemented yet).

const PROFILE_STORAGE_KEY = "soulcycle:profile";
const PROFILE_BACKUP_KEY = "soulcycle:profile:backup";
const CURRENT_SCHEMA_VERSION = 3;

function normalizeWeaponCls(cls) {
  const c = String(cls || "").toLowerCase();
  if (c === "pistol") return "repeater";
  return c;
}

function safeParseJson(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeStringifyJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "unknown";
  }
}

export function createDefaultProfile() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: nowIso(),
    updatedAt: nowIso(),

    settings: {
      cameraZoom: null,
    },

    armory: {
      // Current loadout schema is intentionally minimal; Phase 5 will expand it.
      // Keep keys stable; prefer adding fields rather than renaming.
      loadout: {
        weaponCls: null,
        gearBySlot: {},
      },

      // Phase 3: global attunement selection for attribute mastery activation modes.
      // Stored as AttributeId string or null when unset.
      attunement: null,

      // Pre-run perk sockets (Phase 5): reserve schema now.
      // Level 15 relic slot is reserved; behavior may be deferred.
      perkSocketsByWeapon: {},
    },

    mastery: {
      // Phase 6 will implement progression rules; schema lives now.
      attributes: {
        Might: { xp: 0, level: 0, unlocks: [] },
        Will: { xp: 0, level: 0, unlocks: [] },
        Alacrity: { xp: 0, level: 0, unlocks: [] },
        Constitution: { xp: 0, level: 0, unlocks: [] },
      },

      // Phase 3+: attribute mastery tree unlocks (data-driven).
      // `selectedExclusive` is reserved for exclusiveGroup resolution; unlock UX will define exact semantics.
      attributeTrees: {
        Might: { unlocked: [], selectedExclusive: {} },
        Will: { unlocked: [], selectedExclusive: {} },
        Alacrity: { unlocked: [], selectedExclusive: {} },
        Constitution: { unlocked: [], selectedExclusive: {} },
      },

      weapons: {
        // Keyed by WeaponId; storing as object keeps JSON friendly.
        Hammer: { xp: 0, level: 0, unlocks: [] },
        Staff: { xp: 0, level: 0, unlocks: [] },
        Repeater: { xp: 0, level: 0, unlocks: [] },
        Scythe: { xp: 0, level: 0, unlocks: [] },
      },
    },

    history: {
      // Phase 6+: recent run summaries for tuning/telemetry (kept small).
      recentRuns: [],
    },
  };
}

function deriveDefaultAttunementFromWeaponCls(weaponCls) {
  const w = normalizeWeaponCls(weaponCls);
  if (w === "hammer") return "Might";
  if (w === "staff") return "Will";
  if (w === "repeater") return "Alacrity";
  if (w === "scythe") return "Constitution";
  return null;
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function sanitizeStringMap(value) {
  if (!isProfileObject(value)) return {};
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof k !== "string" || !k.trim()) continue;
    if (typeof v !== "string" || !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

function migrate0to1(raw) {
  const next = createDefaultProfile();
  if (raw && typeof raw === "object") {
    // Preserve any legacy keys without depending on them.
    next.settings = { ...next.settings, ...(raw.settings || {}) };
    next.armory = { ...next.armory, ...(raw.armory || {}) };
    next.mastery = { ...next.mastery, ...(raw.mastery || {}) };
    next.history = { ...next.history, ...(raw.history || {}) };
  }
  next.schemaVersion = 1;
  next.updatedAt = nowIso();
  return next;
}

function migrate1to2(raw) {
  const next = isProfileObject(raw) ? { ...raw } : migrate0to1(raw);

  next.armory = isProfileObject(next.armory) ? { ...next.armory } : {};
  next.armory.loadout = isProfileObject(next.armory.loadout) ? { ...next.armory.loadout } : {};

  if (next.armory.loadout.weaponCls) {
    next.armory.loadout.weaponCls = normalizeWeaponCls(next.armory.loadout.weaponCls);
  }

  const gearBySlot = next.armory.loadout.gearBySlot;
  if (isProfileObject(gearBySlot) && isProfileObject(gearBySlot.weapon)) {
    const weaponSnap = { ...gearBySlot.weapon };
    if (weaponSnap.cls) weaponSnap.cls = normalizeWeaponCls(weaponSnap.cls);
    next.armory.loadout.gearBySlot = { ...gearBySlot, weapon: weaponSnap };
  }

  // Normalize recent run snapshots for UI/telemetry consistency.
  if (next.history && Array.isArray(next.history.recentRuns)) {
    next.history = { ...next.history };
    next.history.recentRuns = next.history.recentRuns.map((rr) => {
      if (!isProfileObject(rr)) return rr;
      const out = { ...rr };
      if (out.weaponCls) out.weaponCls = normalizeWeaponCls(out.weaponCls);
      return out;
    });
  }

  next.schemaVersion = 2;
  next.updatedAt = nowIso();
  return next;
}

function migrate2to3(raw) {
  const next = isProfileObject(raw) ? { ...raw } : migrate1to2(raw);

  next.armory = isProfileObject(next.armory) ? { ...next.armory } : {};
  next.armory.loadout = isProfileObject(next.armory.loadout) ? { ...next.armory.loadout } : {};

  // Default attunement when absent: weapon primary attribute (or null if no weapon snapshot).
  const att = next.armory.attunement;
  if (typeof att !== "string" || !att.trim()) {
    const weaponCls =
      next.armory.loadout.weaponCls ||
      (isProfileObject(next.armory.loadout.gearBySlot) && isProfileObject(next.armory.loadout.gearBySlot.weapon)
        ? next.armory.loadout.gearBySlot.weapon.cls
        : null);
    next.armory.attunement = deriveDefaultAttunementFromWeaponCls(weaponCls);
  }

  next.mastery = isProfileObject(next.mastery) ? { ...next.mastery } : {};
  const trees = isProfileObject(next.mastery.attributeTrees) ? { ...next.mastery.attributeTrees } : {};

  for (const attrId of ["Might", "Will", "Alacrity", "Constitution"]) {
    const tree = isProfileObject(trees[attrId]) ? { ...trees[attrId] } : {};
    tree.unlocked = sanitizeStringArray(tree.unlocked);
    tree.selectedExclusive = sanitizeStringMap(tree.selectedExclusive);
    trees[attrId] = tree;
  }

  next.mastery.attributeTrees = trees;

  next.schemaVersion = 3;
  next.updatedAt = nowIso();
  return next;
}

function migrateProfile(raw) {
  const v = Number(raw?.schemaVersion || 0);
  if (v === CURRENT_SCHEMA_VERSION) return raw;

  if (v <= 0) return migrate2to3(migrate1to2(migrate0to1(raw)));
  if (v === 1) return migrate2to3(migrate1to2(raw));
  if (v === 2) return migrate2to3(raw);

  // Unknown future version: do not attempt destructive migration.
  return raw;
}

function isProfileObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export const ProfileStore = {
  storageKey: PROFILE_STORAGE_KEY,
  schemaVersion: CURRENT_SCHEMA_VERSION,

  load() {
    let rawText = null;
    try {
      rawText = window.localStorage?.getItem?.(PROFILE_STORAGE_KEY) ?? null;
    } catch {
      rawText = null;
    }

    const parsed = safeParseJson(rawText);
    if (!isProfileObject(parsed)) return createDefaultProfile();

    const migrated = migrateProfile(parsed);
    if (!isProfileObject(migrated)) return createDefaultProfile();

    // If migration produced a different version, persist it safely.
    if (Number(migrated.schemaVersion || 0) !== Number(parsed.schemaVersion || 0)) {
      try {
        this.save(migrated, { backupPrevious: true });
      } catch {
        // Non-fatal; runtime can proceed with in-memory profile.
      }
    }

    return migrated;
  },

  save(profile, opts = {}) {
    const { backupPrevious = true } = opts;
    const next = isProfileObject(profile) ? profile : createDefaultProfile();

    next.schemaVersion = CURRENT_SCHEMA_VERSION;
    next.updatedAt = nowIso();

    const json = safeStringifyJson(next);
    if (!json) throw new Error("Failed to serialize profile");

    try {
      if (backupPrevious) {
        const prev = window.localStorage?.getItem?.(PROFILE_STORAGE_KEY);
        if (typeof prev === "string" && prev.length > 0) {
          window.localStorage?.setItem?.(PROFILE_BACKUP_KEY, prev);
        }
      }
      window.localStorage?.setItem?.(PROFILE_STORAGE_KEY, json);
    } catch (e) {
      throw new Error(`Failed to write profile: ${String(e?.message || e)}`);
    }
  },
};
