import { SKILLS } from "./Skills.js";
import { WeaponId } from "./Weapons.js";

export const PerkSocketLevel = Object.freeze({
  level2: "level2",
  level5: "level5",
  level10: "level10",
  level15: "level15", // reserved (relic slot later)
});

export const LevelToSocketLevel = Object.freeze({
  2: PerkSocketLevel.level2,
  5: PerkSocketLevel.level5,
  10: PerkSocketLevel.level10,
  15: PerkSocketLevel.level15,
});

function e(id, unlockAtWeaponMasteryLevel = 0) {
  return Object.freeze({ id, unlockAtWeaponMasteryLevel });
}

// Phase 5 requirement: each weapon must have meaningful, slottable perks at level 2/5/10.
// We intentionally avoid prerequisite-gated or mutually-exclusive path perks for now.
export const WEAPON_SOCKET_LIBRARY = Object.freeze({
  [WeaponId.Hammer]: Object.freeze({
    [PerkSocketLevel.level2]: Object.freeze([
      e("h_hot_iron", 0),
      e("h_wide_arc", 0),
      e("h_ember_brand", 2),
      e("h_forge_tempo", 4),
    ]),
    [PerkSocketLevel.level5]: Object.freeze([
      e("h_cinderwake", 0),
      e("h_coalheart", 2),
      e("h_smelters_reach", 4),
      e("h_ignition_threshold", 6),
    ]),
    [PerkSocketLevel.level10]: Object.freeze([
      e("h_keystone_forge_pact", 0),
      e("h_pyre_burst", 2),
      e("h_occult_soul_brand", 4),
      e("h_searing_spiral", 6),
    ]),
    [PerkSocketLevel.level15]: Object.freeze([]),
  }),

  [WeaponId.Repeater]: Object.freeze({
    [PerkSocketLevel.level2]: Object.freeze([
      e("p_windup_bearings", 0),
      e("p_recoil_discipline", 0),
      e("p_breath_control", 2),
    ]),
    [PerkSocketLevel.level5]: Object.freeze([
      e("p_gust_spray", 0),
      e("p_occult_hex_mag", 2),
      e("p_occult_soul_pressure", 4),
    ]),
    [PerkSocketLevel.level10]: Object.freeze([
      e("p_keystone_reapers_vortex", 0),
      e("p_occult_debt_pop", 2),
    ]),
    [PerkSocketLevel.level15]: Object.freeze([]),
  }),

  [WeaponId.Staff]: Object.freeze({
    [PerkSocketLevel.level2]: Object.freeze([
      e("s_conduction_mark", 0),
      e("s_arc_count", 0),
      e("s_synapse_capacity", 2),
      e("s_conductivity", 4),
    ]),
    [PerkSocketLevel.level5]: Object.freeze([
      e("s_overcharge", 0),
      e("s_voltage_build", 0),
      e("s_relay_efficiency", 2),
      e("s_occult_binding_hex", 4),
    ]),
    [PerkSocketLevel.level10]: Object.freeze([
      e("s_keystone_overload", 0),
      e("s_occult_soul_circuit", 2),
      e("s_fork_node", 4),
    ]),
    [PerkSocketLevel.level15]: Object.freeze([]),
  }),

  [WeaponId.Scythe]: Object.freeze({
    [PerkSocketLevel.level2]: Object.freeze([
      e("y_grave_reach", 0),
      e("y_harvest_brand", 0),
      e("y_golem_fortitude", 2),
    ]),
    [PerkSocketLevel.level5]: Object.freeze([
      e("y_ossuary_throng", 0),
      e("y_bone_mending", 0),
      e("y_reaping_edge", 2),
    ]),
    [PerkSocketLevel.level10]: Object.freeze([
      e("y_keystone_golemcraft", 0),
      e("y_reaping_edge", 4),
    ]),
    [PerkSocketLevel.level15]: Object.freeze([]),
  }),
});

let _skillById = null;
function getSkillById() {
  if (_skillById) return _skillById;
  _skillById = new Map();
  for (const sk of SKILLS) _skillById.set(sk.id, sk);
  return _skillById;
}

export function getEligibleSkillIdsForSocket(weaponId, socketLevel) {
  const weapon = WEAPON_SOCKET_LIBRARY[weaponId];
  if (!weapon) return [];
  const list = weapon[socketLevel];
  if (!Array.isArray(list)) return [];
  return list.map((entry) => (typeof entry === "string" ? entry : entry?.id)).filter(Boolean);
}

export function getSocketOptions(weaponId, socketLevel) {
  const weapon = WEAPON_SOCKET_LIBRARY[weaponId];
  if (!weapon) return [];
  const list = weapon[socketLevel];
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (typeof entry === "string") return { id: entry, unlockAtWeaponMasteryLevel: 0 };
      return { id: entry?.id, unlockAtWeaponMasteryLevel: Number(entry?.unlockAtWeaponMasteryLevel || 0) };
    })
    .filter((e2) => !!e2.id);
}

export function getUnlockedSkillIdsForSocket(weaponId, socketLevel, { weaponMasteryLevel = 0, metaEnabled = false } = {}) {
  const opts = getSocketOptions(weaponId, socketLevel);
  if (!metaEnabled) return opts.map(o => o.id);
  const lvl = Math.max(0, Math.floor(Number(weaponMasteryLevel || 0)));
  return opts.filter(o => (o.unlockAtWeaponMasteryLevel || 0) <= lvl).map(o => o.id);
}

export function getSkillDef(skillId) {
  return getSkillById().get(skillId) || null;
}

export function validatePerkSocketLibrary() {
  const byId = getSkillById();

  for (const weaponId of Object.values(WeaponId)) {
    const lib = WEAPON_SOCKET_LIBRARY[weaponId];
    if (!lib) continue;

    // Phase 5 required sockets must have at least 1 option.
    for (const required of [PerkSocketLevel.level2, PerkSocketLevel.level5, PerkSocketLevel.level10]) {
      const list = lib[required];
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error(`Perk socket library missing required options: ${weaponId}.${required}`);
      }
      // Also ensure at least one option is available at weapon mastery level 0.
      const options = getSocketOptions(weaponId, required);
      const anyStart = options.some(o => (o.unlockAtWeaponMasteryLevel || 0) <= 0);
      if (!anyStart) {
        throw new Error(`Perk socket library missing starting option (unlockAt=0): ${weaponId}.${required}`);
      }
    }

    for (const [socket, list] of Object.entries(lib)) {
      if (!Object.values(PerkSocketLevel).includes(socket)) throw new Error(`Unknown socket key: ${socket}`);
      if (!Array.isArray(list)) throw new Error(`Socket list must be an array: ${weaponId}.${socket}`);
      for (const entry of list) {
        const id = typeof entry === "string" ? entry : entry?.id;
        if (!id) throw new Error(`Socket entry missing id: ${weaponId}.${socket}`);
        const unlockAt = typeof entry === "string" ? 0 : Number(entry?.unlockAtWeaponMasteryLevel || 0);
        if (!(unlockAt >= 0)) throw new Error(`Invalid unlockAtWeaponMasteryLevel for ${weaponId}.${socket}.${id}`);

        const sk = byId.get(id);
        if (!sk) throw new Error(`Socket references unknown skill id: ${id}`);
      }
    }
  }

  return true;
}
