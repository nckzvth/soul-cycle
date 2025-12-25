import { AttributeId } from "./Vocabulary.js";
import { validateWeaponConfig } from "./TagValidation.js";

export const WeaponId = Object.freeze({
  Hammer: "Hammer",
  Staff: "Staff",
  Repeater: "Repeater",
  Scythe: "Scythe",
});

// Phase 1: configs are introduced without changing runtime behavior.
// Weapon "riteTag" is never authored; derived rite is computed from primaryAttribute.
const RAW_WEAPON_CONFIGS = Object.freeze({
  hammer: { weaponId: WeaponId.Hammer, primaryAttribute: AttributeId.Might },
  staff: { weaponId: WeaponId.Staff, primaryAttribute: AttributeId.Will },

  // Canonical weapon is Repeater; "pistol" remains a legacy runtime cls until renamed in gameplay/UI.
  repeater: { weaponId: WeaponId.Repeater, primaryAttribute: AttributeId.Alacrity },
  pistol: { weaponId: WeaponId.Repeater, primaryAttribute: AttributeId.Alacrity },

  scythe: { weaponId: WeaponId.Scythe, primaryAttribute: AttributeId.Constitution },
});

export function normalizeWeaponCls(cls) {
  const c = String(cls || "").toLowerCase();
  if (c === "pistol") return "repeater";
  return c;
}

export function getWeaponConfigByCls(cls) {
  const key = normalizeWeaponCls(cls);
  const cfg = RAW_WEAPON_CONFIGS[key] || null;
  if (!cfg) return null;
  return validateWeaponConfig(cfg, { context: { kind: "weapon", id: key } }).normalized;
}

