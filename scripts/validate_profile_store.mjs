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
invariant(d.schemaVersion === 2, "default schemaVersion should be 2");
invariant(!!d.mastery?.attributes?.Constitution, "Constitution mastery scaffold missing");
invariant(Array.isArray(d.history?.recentRuns), "recentRuns should exist");

// Save/load roundtrip
ProfileStore.save(d);
const loaded = ProfileStore.load();
invariant(loaded.schemaVersion === 2, "loaded schemaVersion should be 2");

console.log("validate_profile_store: OK");
