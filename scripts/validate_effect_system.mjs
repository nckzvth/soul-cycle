import EffectSystem, { validateEffectDef } from "../src/systems/EffectSystem.js";
import { getPhialEffectsById } from "../src/data/PhialEffectDefs.js";
import { ATTRIBUTE_MASTERY_TREES } from "../src/data/AttributeMasteryTrees.js";
import { getAttributeMasteryEffectsByNodeId } from "../src/data/AttributeMasteryEffectDefs.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

const byId = getPhialEffectsById();
invariant(byId && typeof byId === "object", "Expected phial effects map");

let count = 0;
for (const [phialId, defs] of Object.entries(byId)) {
  if (!Array.isArray(defs)) throw new Error(`Effects for ${phialId} must be an array`);
  for (const def of defs) {
    validateEffectDef(def);
    count++;
  }
}

// Mastery effect defs sanity (Phase 6).
let masteryCount = 0;
for (const tree of Object.values(ATTRIBUTE_MASTERY_TREES)) {
  for (const node of tree?.nodes || []) {
    const defs = getAttributeMasteryEffectsByNodeId(node.id);
    if (!Array.isArray(defs)) throw new Error(`Mastery effects for ${node.id} must be an array`);
    for (const def of defs) {
      validateEffectDef(def);
      masteryCount++;
    }
  }
}

// Index build sanity
EffectSystem.reset();
EffectSystem.setActiveSources([
  { sourceId: "ashenHalo", kind: "phial", stacks: 1, effects: byId.ashenHalo || [] },
]);
EffectSystem.trigger(EffectSystem.TRIGGERS.tick, { player: {}, state: {}, dt: 0.016 }, { shadow: true });

console.log(`validate_effect_system: OK (phialDefs=${count}, masteryDefs=${masteryCount})`);
