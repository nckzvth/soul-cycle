import { ProfileStore, createDefaultProfile } from "../src/core/ProfileStore.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Minimal localStorage shim for Node validation.
globalThis.window = globalThis.window || {};
const mem = new Map();
globalThis.window.localStorage = {
  getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  setItem(k, v) { mem.set(k, String(v)); },
  removeItem(k) { mem.delete(k); },
};

// Default profile sanity
const d = createDefaultProfile();
invariant(d.schemaVersion === 5, "default schemaVersion should be 5");
invariant(typeof d.wallet?.souls === "number", "wallet.souls should be numeric");
invariant(!!d.mastery?.attributes?.Constitution, "Constitution mastery scaffold missing");
invariant(!!d.mastery?.attributeTrees?.Might, "attributeTrees scaffold missing");
invariant(d.armory?.attunement === null, "default attunement should be null");
invariant(Array.isArray(d.history?.recentRuns), "recentRuns should exist");

// Save/load roundtrip
ProfileStore.save(d);
const loaded = ProfileStore.load();
invariant(loaded.schemaVersion === 5, "loaded schemaVersion should be 5");
invariant(typeof loaded.wallet?.souls === "number", "loaded wallet.souls should be numeric");

console.log("validate_profile_store: OK");
