// Versioned profile persistence for Soul-Cycle.
// Phase 2: scaffolding only (meta progression not implemented yet).

const PROFILE_STORAGE_KEY = "soulcycle:profile";
const PROFILE_BACKUP_KEY = "soulcycle:profile:backup";
const CURRENT_SCHEMA_VERSION = 1;

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

function migrateProfile(raw) {
  const v = Number(raw?.schemaVersion || 0);
  if (v === CURRENT_SCHEMA_VERSION) return raw;

  // v0 -> v1: adopt default shape and merge shallowly.
  if (v <= 0) {
    const next = createDefaultProfile();
    if (raw && typeof raw === "object") {
      // Preserve any legacy keys without depending on them.
      next.settings = { ...next.settings, ...(raw.settings || {}) };
      next.armory = { ...next.armory, ...(raw.armory || {}) };
      next.mastery = { ...next.mastery, ...(raw.mastery || {}) };
      next.history = { ...next.history, ...(raw.history || {}) };
    }
    next.schemaVersion = CURRENT_SCHEMA_VERSION;
    next.updatedAt = nowIso();
    return next;
  }

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
