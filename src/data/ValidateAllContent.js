import { Phials } from "./Phials.js";
import { SKILLS } from "./Skills.js";
import { validateTaggedDef, validateWeaponDef } from "./ContentValidation.js";
import { getWeaponConfigByCls } from "./Weapons.js";
import { validateAttributeMasteryTrees } from "./ValidateAttributeMasteryTrees.js";
import { validateAttributeMasteryEffects } from "./ValidateAttributeMasteryEffects.js";
import { validateAttributeMasteryLayout } from "./ValidateAttributeMasteryLayout.js";

function safeId(def) {
  return def?.id || def?.weaponId || null;
}

export function validateAllContent({ strict = false } = {}) {
  // Phials
  for (const ph of Object.values(Phials)) {
    validateTaggedDef(ph, { kind: "phial", strict });
  }

  // Perks / skills
  for (const sk of SKILLS) {
    validateTaggedDef(sk, { kind: "perk", strict });
  }

  // Weapons (validate known runtime classes)
  for (const weaponCls of ["hammer", "staff", "repeater", "scythe"]) {
    const cfg = getWeaponConfigByCls(weaponCls);
    if (!cfg) throw new Error(`Missing WeaponConfig for cls: ${weaponCls}`);
    validateWeaponDef(cfg, { strict: true });
  }

  // Basic ID sanity (helps catch accidental duplicates during content edits).
  const seen = new Set();
  for (const def of [...Object.values(Phials), ...SKILLS]) {
    const id = safeId(def);
    if (!id) continue;
    if (seen.has(id)) throw new Error(`Duplicate content id: ${id}`);
    seen.add(id);
  }

  // Attribute mastery: validate structure + Effects bindings.
  validateAttributeMasteryTrees();
  validateAttributeMasteryEffects();
  validateAttributeMasteryLayout();

  return true;
}
