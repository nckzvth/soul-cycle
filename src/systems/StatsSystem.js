import { clamp } from "../core/Utils.js";
import { BALANCE } from "../data/Balance.js";
import { SKILLS } from "../data/Skills.js";
import { FeatureFlags } from "../core/FeatureFlags.js";
import { applyMetaMasteryPassiveBonuses } from "./MasteryHelpers.js";

let SKILL_BY_ID = null;
function getSkillById() {
  if (SKILL_BY_ID) return SKILL_BY_ID;
  SKILL_BY_ID = new Map();
  for (const sk of SKILLS) SKILL_BY_ID.set(sk.id, sk);
  return SKILL_BY_ID;
}

function addNumber(stats, key, value) {
  if (!value) return;
  stats[key] = (stats[key] || 0) + value;
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function softCapAsymptote(value, cap, gain, k) {
  const v = toNumber(value);
  const c = toNumber(cap);
  if (c <= 0) return v;
  if (v <= c) return v;

  const g = toNumber(gain);
  const extra = v - c;
  const kk = toNumber(k) || 1.0;
  return c + g * (1 - Math.exp(-kk * extra));
}

/**
 * Canonical player stats schema (combat-relevant + existing non-combat keys used elsewhere).
 * This keeps UI/pickup code working while migrating combat off legacy fields.
 */
function createBasePlayerStats() {
  const bp = BALANCE.player;
  return {
    // Non-combat vitals/utility still used by UI/pickups
    hp: bp.baseHp,
    regen: bp.baseRegen,
    soulGain: bp.baseSoulGain,
    area: bp.baseArea,
    magnetism: bp.baseMagnetism,

    // Canonical combat schema
    power: bp.baseDmg,
    powerMult: 1.0,
    critChance: bp.baseCrit,
    critMult: bp.baseCritMult ?? 1.5,
    attackSpeed: 1.0,
    dotMult: 1.0,
    aoeMult: 1.0,
    damageTakenMult: 1.0,

    // Movement/knockback (canonical)
    moveSpeedMult: 1.0,
    knockback: bp.baseKb,

    // Existing skill knobs (canonical)
    chainCount: 0,
    chainRangeMult: 1.0,
    pierce: 0,
    bounce: 0,

    // Legacy keys (kept during migration; not used for damage math after refactor)
    dmg: bp.baseDmg,
    crit: bp.baseCrit,
    spd: bp.baseSpd,
    move: bp.baseMove,
    kb: bp.baseKb,
    hexPierce: 0,
    hexBounce: 0,
    chainJump: 0,
  };
}

function applyLegacyStat(stats, key, value) {
  const v = toNumber(value);
  if (!v) return;

  // Keep legacy accumulation for UI/debug text.
  addNumber(stats, key, v);

  // Canonical mappings / normalizations.
  if (key === "dmg") addNumber(stats, "power", v);
  if (key === "crit") addNumber(stats, "critChance", v);

  if (key === "kb" || key === "knockback") addNumber(stats, "knockback", v);
  if (key === "hexPierce") addNumber(stats, "pierce", v);
  if (key === "hexBounce") addNumber(stats, "bounce", v);

  if (key === "chainCount") addNumber(stats, "chainCount", v);
  if (key === "chainJump") addNumber(stats, "chainJump", v);

  // Mult-like legacy keys: accumulate as additive; finalize below.
  if (key === "dmgMult") addNumber(stats, "_powerMultAdd", v);
  if (key === "spd" || key === "atkSpd") addNumber(stats, "_attackSpeedAdd", v);
  if (key === "move") addNumber(stats, "_moveSpeedAdd", v);
}

const StatsSystem = {
  /**
   * Recomputes player stats in a canonical schema.
   * Preserves existing keys used elsewhere while centralizing multipliers for combat.
   */
  recalcPlayer(player) {
    const skillById = getSkillById();
    const constitutionEnabled = FeatureFlags.isOn("progression.constitutionEnabled");
    const t = {
      might: player.attr.might,
      alacrity: player.attr.alacrity,
      will: player.attr.will,
      constitution: constitutionEnabled ? (player.attr.constitution || 0) : 0,
    };
    for (const slot in player.gear) {
      const item = player.gear[slot];
      if (!item) continue;
      if (item.stats?.might) t.might += item.stats.might;
      if (item.stats?.alacrity) t.alacrity += item.stats.alacrity;
      if (item.stats?.will) t.will += item.stats.will;
      if (constitutionEnabled && item.stats?.constitution) t.constitution += item.stats.constitution;
    }
    player.totalAttr = t;

    const bp = BALANCE.player;
    const s = createBasePlayerStats();

    // Base scaling from level/attributes (legacy + canonical).
    s.hp = bp.baseHp + player.lvl * bp.hpPerLevel;
    s.hp += t.constitution * (bp.hpPerConstitution ?? 0);
    s.dmg = bp.baseDmg;
    s.power = bp.baseDmg;

    s.dmg += t.might * bp.dmgPerMight;
    s.power += t.might * bp.dmgPerMight;
    s.kb += t.might * bp.kbPerMight;
    s.knockback += t.might * bp.kbPerMight;

    s.spd += t.alacrity * bp.spdPerAlacrity;
    s.move += t.alacrity * bp.movePerAlacrity;
    s.area += t.will * bp.areaPerWill;
    s.soulGain += t.will * bp.soulGainPerWill;
    s.magnetism += t.will * BALANCE.pickups.soul.magnetism;

    // Perk tiers (keep booleans for compatibility, but drive gameplay with perkLevel).
    const perkLevel = {
      might: t.might >= (bp.perkThreshold2 ?? (bp.perkThreshold * 2)) ? 2 : (t.might >= bp.perkThreshold ? 1 : 0),
      alacrity: t.alacrity >= (bp.perkThreshold2 ?? (bp.perkThreshold * 2)) ? 2 : (t.alacrity >= bp.perkThreshold ? 1 : 0),
      will: t.will >= (bp.perkThreshold2 ?? (bp.perkThreshold * 2)) ? 2 : (t.will >= bp.perkThreshold ? 1 : 0),
      constitution: constitutionEnabled
        ? (t.constitution >= (bp.perkThreshold2 ?? (bp.perkThreshold * 2)) ? 2 : (t.constitution >= bp.perkThreshold ? 1 : 0))
        : 0,
    };
    player.perkLevel = perkLevel;
    player.perks = player.perks || { might: false, alacrity: false, will: false };
    player.perks.might = perkLevel.might >= 1;
    player.perks.alacrity = perkLevel.alacrity >= 1;
    player.perks.will = perkLevel.will >= 1;

    // Gear stats (legacy + canonical mapping where needed).
    for (const slot in player.gear) {
      const item = player.gear[slot];
      if (!item) continue;
      for (const k in item.stats || {}) applyLegacyStat(s, k, item.stats[k]);
    }

    // Skill mods (legacy keys, mapped into canonical via applyLegacyStat).
    player.skills.forEach((stacks, id) => {
      const skill = skillById.get(id);
      if (!skill) return;
      const dial = skill.dial || {};

      // Forward-looking dials: keep as numeric keys on player.stats for later weapon systems.
      if (dial.stateMods) {
        for (const k in dial.stateMods) addNumber(s, k, dial.stateMods[k] * stacks);
      }

      const mods = skill.mods || dial.mods || {};
      for (const k in mods) applyLegacyStat(s, k, mods[k] * stacks);
    });

    // Finalize canonical multipliers.
    const powerMultAdd = toNumber(s._powerMultAdd);
    s.powerMult = 1 + powerMultAdd;

    const attackSpeedAdd = toNumber(s._attackSpeedAdd) + toNumber(s.spd);
    s.attackSpeed = Math.max(0.05, 1 + attackSpeedAdd);

    const moveSpeedAdd = toNumber(s._moveSpeedAdd) + toNumber(s.move);
    s.moveSpeedMult = Math.max(0.05, 1 + moveSpeedAdd);

    s.chainRangeMult = 1 + toNumber(s.chainJump);

    s.critChance = clamp(s.critChance, 0, 1);
    s.critMult = Math.max(1.0, toNumber(s.critMult) || 1.5);

    // --- Phase 6: meta mastery passive bonuses (flagged) ---
    if (FeatureFlags.isOn("progression.metaMasteryEnabled") && player?.metaMasteryLevels) {
      applyMetaMasteryPassiveBonuses(s, player.metaMasteryLevels);
    }

    // --- Soft caps / guardrails (v1 pacing) ---
    const softCaps = BALANCE?.progression?.softCaps || {};
    const attackSpeedCap = toNumber(softCaps.attackSpeed);
    if (attackSpeedCap > 0) {
      s.attackSpeed = softCapAsymptote(s.attackSpeed, attackSpeedCap, attackSpeedCap * 0.5, 0.9);
    }

    const powerMultCap = toNumber(softCaps.powerMult);
    if (powerMultCap > 0) {
      s.powerMult = softCapAsymptote(s.powerMult, powerMultCap, powerMultCap * 0.5, 0.9);
    }

    const areaCap = toNumber(softCaps.area);
    if (areaCap > 0) {
      s.area = softCapAsymptote(s.area, areaCap, 1.0, 0.8);
    }

    const chainRangeCap = toNumber(softCaps.chainRangeMult);
    if (chainRangeCap > 0) {
      s.chainRangeMult = softCapAsymptote(s.chainRangeMult, chainRangeCap, 1.0, 0.9);
    }

    const pierceCap = toNumber(softCaps.pierce);
    if (pierceCap > 0) s.pierce = Math.min(s.pierce, pierceCap);

    const bounceCap = toNumber(softCaps.bounce);
    if (bounceCap > 0) s.bounce = Math.min(s.bounce, bounceCap);

    // Cleanup private accumulators to reduce UI noise.
    delete s._powerMultAdd;
    delete s._attackSpeedAdd;
    delete s._moveSpeedAdd;

    player.stats = s;

    // Maintain hpMax semantics.
    const oldMax = player.hpMax;
    player.hpMax = Math.round(s.hp);
    if (player.hpMax > oldMax) player.hp += player.hpMax - oldMax;
    player.hp = clamp(player.hp, 0, player.hpMax);
  },
};

export default StatsSystem;
