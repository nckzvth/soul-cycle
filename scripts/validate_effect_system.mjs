import EffectSystem, { validateEffectDef } from "../src/systems/EffectSystem.js";
import { getPhialEffectsById } from "../src/data/PhialEffectDefs.js";

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

// Index build sanity
EffectSystem.reset();
EffectSystem.setActiveSources([
  { sourceId: "ashenHalo", kind: "phial", stacks: 1, effects: byId.ashenHalo || [] },
]);
EffectSystem.trigger(EffectSystem.TRIGGERS.tick, { player: {}, state: {}, dt: 0.016 }, { shadow: true });

console.log(`validate_effect_system: OK (defs=${count})`);

