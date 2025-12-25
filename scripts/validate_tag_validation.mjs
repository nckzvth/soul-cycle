import { validateTagSet, validateWeaponConfig } from "../src/data/TagValidation.js";
import { AspectId, AttributeId, RiteId } from "../src/data/Vocabulary.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Valid: attributeTag implies derived rite; aspects validated against derived rite when riteTag absent.
validateTagSet({
  attributeTag: AttributeId.Will,
  aspectTags: [AspectId.Tempest],
});

// Invalid: Tide cannot have Bone
let failed = false;
try {
  validateTagSet({
    riteTag: RiteId.Tide,
    aspectTags: [AspectId.Bone],
  });
} catch {
  failed = true;
}
invariant(failed, "Expected invalid aspect/rite combo to throw");

// Invalid: attributeTag and riteTag mismatch
failed = false;
try {
  validateTagSet({
    attributeTag: AttributeId.Might,
    riteTag: RiteId.Gale,
  });
} catch {
  failed = true;
}
invariant(failed, "Expected attributeTag→riteTag mismatch to throw");

// WeaponConfig: must not author riteTag
failed = false;
try {
  validateWeaponConfig({ weaponId: "w_test", primaryAttribute: AttributeId.Might, riteTag: RiteId.Cinder });
} catch {
  failed = true;
}
invariant(failed, "Expected WeaponConfig authored riteTag to throw");

validateWeaponConfig({ weaponId: "w_test", primaryAttribute: AttributeId.Alacrity });

console.log("validate_tag_validation: OK");

