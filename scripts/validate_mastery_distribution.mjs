import { createDefaultProfile } from "../src/core/ProfileStore.js";
import { applyMetaProgression } from "../src/systems/MasterySystem.js";
import { AttributeId } from "../src/data/Vocabulary.js";
import { WeaponId } from "../src/data/Weapons.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

const profile = createDefaultProfile();

const runResult = {
  schemaVersion: 1,
  runId: 1,
  mode: "field",
  endReason: "fieldComplete",
  durationSec: 120,
  reachedLevel: 6,
  kills: 50,
  weaponCls: "hammer",
  weaponId: WeaponId.Hammer,
  weaponPrimaryAttribute: AttributeId.Might,
  soulsStart: 0,
  soulsEnd: 100,
  soulsDelta: 100,
  pickedPhials: [
    { id: "ashenHalo", stacks: 2, attributeTag: AttributeId.Might },
    { id: "blindingStep", stacks: 1, attributeTag: AttributeId.Alacrity },
  ],
};

const before = JSON.parse(JSON.stringify(profile));
const res = applyMetaProgression(profile, runResult);
invariant(res.gained === true, "Expected gained=true");
invariant(typeof res.masteryXp === "number" && res.masteryXp > 0, "Expected masteryXp>0");

// Ensure weapon mastery advanced
invariant(profile.mastery.weapons[WeaponId.Hammer].xp !== before.mastery.weapons[WeaponId.Hammer].xp, "Expected weapon xp change");

// Ensure attributes advanced (at least Might; and Alacrity from choice share)
invariant(profile.mastery.attributes[AttributeId.Might].xp !== before.mastery.attributes[AttributeId.Might].xp, "Expected Might xp change");
invariant(profile.mastery.attributes[AttributeId.Alacrity].xp !== before.mastery.attributes[AttributeId.Alacrity].xp, "Expected Alacrity xp change");

// recentRuns appended with masteryXp
invariant(Array.isArray(profile.history.recentRuns) && profile.history.recentRuns.length >= 1, "Expected recentRuns to append");
invariant(profile.history.recentRuns[0].masteryXp === res.masteryXp, "Expected masteryXp stored on recentRuns[0]");

console.log("validate_mastery_distribution: OK");

