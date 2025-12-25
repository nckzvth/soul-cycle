import { Phials } from "../src/data/Phials.js";
import { SKILLS } from "../src/data/Skills.js";
import { validateTagSet } from "../src/data/TagValidation.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hasForbiddenTerms(text) {
  const s = String(text || "");
  // Hard rules: no Force; Storm/Earth/Water are not tags (but may appear in prose today).
  return /\bForce\b/i.test(s);
}

// Phase 0: content is not required to have tags yet. This script:
// - fails if forbidden terminology appears in IDs/names
// - validates tag sets only when present
let checked = 0;
let tagged = 0;

for (const ph of Object.values(Phials)) {
  checked++;
  invariant(!hasForbiddenTerms(ph.id), `Forbidden term in phial id: ${ph.id}`);
  invariant(!hasForbiddenTerms(ph.name), `Forbidden term in phial name: ${ph.name}`);
  if (ph.tags) {
    tagged++;
    validateTagSet(ph.tags, { context: { kind: "phial", id: ph.id } });
  }
}

for (const sk of SKILLS) {
  checked++;
  invariant(!hasForbiddenTerms(sk.id), `Forbidden term in perk/skill id: ${sk.id}`);
  invariant(!hasForbiddenTerms(sk.name), `Forbidden term in perk/skill name: ${sk.name}`);
  if (sk.tags) {
    tagged++;
    validateTagSet(sk.tags, { context: { kind: "perk", id: sk.id } });
  }
}

console.log(`validate_content: OK (checked=${checked}, tagged=${tagged})`);

