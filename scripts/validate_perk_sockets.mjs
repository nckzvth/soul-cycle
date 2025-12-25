import { validatePerkSocketLibrary, getSkillDef, WEAPON_SOCKET_LIBRARY, PerkSocketLevel, getSocketOptions } from "../src/data/PerkSockets.js";
import { WeaponId } from "../src/data/Weapons.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

validatePerkSocketLibrary();

// Basic consistency checks: ensure skills match weapon class expectations for current runtime.
const weaponClsById = {
  [WeaponId.Hammer]: "hammer",
  [WeaponId.Staff]: "staff",
  // Runtime is still "pistol" today; WeaponId is Repeater.
  [WeaponId.Repeater]: "pistol",
  [WeaponId.Scythe]: "scythe",
};

for (const [weaponId, lib] of Object.entries(WEAPON_SOCKET_LIBRARY)) {
  const expectedCls = weaponClsById[weaponId] || null;
  invariant(!!expectedCls, `Missing expected cls mapping for ${weaponId}`);
  for (const socket of Object.values(PerkSocketLevel)) {
    const list = getSocketOptions(weaponId, socket);
    for (const { id: skillId } of list) {
      const sk = getSkillDef(skillId);
      invariant(sk, `Missing skill def for ${skillId}`);
      invariant(sk.cls === expectedCls, `Skill ${skillId} has cls=${sk.cls}, expected ${expectedCls} for ${weaponId}`);
    }
  }
}

console.log("validate_perk_sockets: OK");
