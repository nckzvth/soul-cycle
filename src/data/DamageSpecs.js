import { BALANCE } from "./Balance.js";
import { Phials } from "./Phials.js";

const ELEMENT = {
  physical: "physical",
  fire: "fire",
  air: "air",
  lightning: "lightning",
  occult: "occult",
};

// DamageSpec factories. These describe damage; DamageSystem computes/applies it.
const DamageSpecs = {
  // --- Player weapons ---
  repeaterShot() {
    return {
      id: "player:repeaterShot",
      base: 0,
      coeff: BALANCE.player.repeater.damageMult,
      canCrit: false, // keep disabled to avoid unintended rebalance; enable later
      tags: ["weapon", "repeater", "projectile"],
      element: ELEMENT.air,
      snapshot: true,
    };
  },

  repeaterGust() {
    return {
      id: "player:repeaterGust",
      base: 0,
      coeff: BALANCE.player.repeater.damageMult * 0.25,
      canCrit: false,
      tags: ["weapon", "repeater", "aoe"],
      element: ELEMENT.air,
      snapshot: true,
    };
  },

  repeaterDebtPop() {
    return {
      id: "player:repeaterDebtPop",
      base: 0,
      coeff: BALANCE.player.repeater.damageMult * 0.6,
      canCrit: false,
      tags: ["weapon", "repeater", "occult", "aoe"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  staffZap() {
    return {
      id: "player:staffZap",
      base: 0,
      coeff: BALANCE.player.staff.damageMult,
      canCrit: false,
      tags: ["weapon", "staff", "chain"],
      element: ELEMENT.lightning,
      snapshot: true,
    };
  },

  staffOvercharge() {
    return {
      id: "player:staffOvercharge",
      base: 0,
      // Tuned by `staffOverchargeCoeffMult` stateMods; default is a modest portion of zap.
      coeff: BALANCE.player.staff.damageMult * 0.35,
      canCrit: false,
      tags: ["weapon", "staff"],
      element: ELEMENT.lightning,
      snapshot: true,
    };
  },

  staffOverloadDetonation() {
    return {
      id: "player:staffOverloadDetonation",
      base: 0,
      coeff: BALANCE.player.staff.damageMult * 0.8,
      canCrit: false,
      tags: ["weapon", "staff", "aoe"],
      element: ELEMENT.lightning,
      snapshot: true,
    };
  },

  hammerOrbit() {
    return {
      id: "player:hammerOrbit",
      base: 0,
      coeff: BALANCE.player.hammer.damageMult,
      canCrit: false,
      tags: ["weapon", "hammer", "melee"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  hammerBurnTick() {
    return {
      id: "player:hammerBurnTick",
      base: 0,
      coeff: BALANCE.skills.hammer.burnCoeff,
      canCrit: false,
      tags: ["weapon", "hammer", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  hammerTrailTick() {
    return {
      id: "player:hammerTrailTick",
      base: 0,
      coeff: BALANCE.skills.hammer.trailCoeff,
      canCrit: false,
      tags: ["weapon", "hammer", "aoe", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  hammerIgniteFlare() {
    return {
      id: "player:hammerIgniteFlare",
      base: 0,
      coeff: BALANCE.skills.hammer.igniteCoeff,
      canCrit: false,
      tags: ["weapon", "hammer", "aoe"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  hammerPyreBurst() {
    return {
      id: "player:hammerPyreBurst",
      base: 0,
      coeff: BALANCE.skills.hammer.pyreBurstCoeff,
      canCrit: false,
      tags: ["weapon", "hammer", "aoe"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  hammerSoulBrandPop() {
    return {
      id: "player:hammerSoulBrandPop",
      base: 0,
      coeff: BALANCE.skills.hammer.soulBrandCoeff,
      canCrit: false,
      tags: ["weapon", "hammer", "occult", "aoe"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  scytheSwipe() {
    return {
      id: "player:scytheSwipe",
      base: 0,
      coeff: BALANCE.player.scythe.damageMult,
      canCrit: false,
      tags: ["weapon", "scythe", "melee"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  scytheHarvest() {
    return {
      id: "player:scytheHarvest",
      base: 0,
      coeff: BALANCE.player.scythe.damageMult * 1.15,
      canCrit: false,
      tags: ["weapon", "scythe", "melee"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  scytheGolemSlam() {
    return {
      id: "player:scytheGolemSlam",
      base: 0,
      coeff: BALANCE.skills?.scythe?.golemSlamCoeff ?? (BALANCE.player.scythe.damageMult * 0.7),
      canCrit: false,
      tags: ["weapon", "scythe", "summon", "melee"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  // --- Perks ---
  shockwave() {
    return {
      id: "perk:shockwave",
      base: 0,
      coeff: BALANCE.combat.shockwaveDamageMult,
      canCrit: false,
      tags: ["perk", "aoe"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  soulBlastBurnTick() {
    return {
      id: "perk:soulBlastBurnTick",
      base: 0,
      coeff: BALANCE.combat.soulBlastBurnDamageMult,
      canCrit: false,
      tags: ["perk", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  staticMineTick() {
    // Old behavior: (power * staticMineDamageMult) * staticMine.damageMultiplier * dt
    return {
      id: "perk:staticMineTick",
      base: 0,
      coeff: BALANCE.combat.staticMineDamageMult * BALANCE.projectiles.staticMine.damageMultiplier,
      canCrit: false,
      tags: ["perk", "aoe", "dot"],
      element: ELEMENT.lightning,
      snapshot: true,
    };
  },

  wispHit() {
    // Old behavior: (power * wispDamageMult) * wisp.damageMultiplier
    return {
      id: "perk:wispHit",
      base: 0,
      coeff: BALANCE.combat.wispDamageMult * BALANCE.projectiles.wisp.damageMultiplier,
      canCrit: false,
      tags: ["perk", "projectile"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  soulTempestHit() {
    return {
      id: "perk:soulTempestHit",
      base: 0,
      coeff: BALANCE.combat.soulTempestDamageMult,
      canCrit: false,
      tags: ["perk", "projectile"],
      element: ELEMENT.air,
      snapshot: true,
    };
  },

  soulTempestSplitHit() {
    return {
      id: "perk:soulTempestSplitHit",
      base: 0,
      coeff: BALANCE.combat.soulTempestSplitDamageMult,
      canCrit: false,
      tags: ["perk", "projectile"],
      element: ELEMENT.air,
      snapshot: true,
    };
  },

  orbitalWispHit() {
    return {
      id: "perk:orbitalWispHit",
      base: 0,
      coeff: BALANCE.combat.orbitalWispDamageMult,
      canCrit: false,
      tags: ["perk", "projectile"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  orbitalWispLightning() {
    return {
      id: "perk:orbitalWispLightning",
      base: 0,
      coeff: BALANCE.combat.orbitalWispLightningDamageMult,
      canCrit: false,
      tags: ["perk", "chain"],
      element: ELEMENT.lightning,
      snapshot: true,
    };
  },

  // --- Phials ---
  ashenHaloTick(stacks) {
    // Old behavior: ticks every 0.5s; damage per tick = DPS * 0.5
    const dps = Phials.ashenHalo.baseDamagePerSecond + Phials.ashenHalo.damagePerStack * (stacks - 1);
    return {
      id: "phial:ashenHaloTick",
      base: dps * 0.5,
      coeff: 0,
      canCrit: false,
      tags: ["phial", "aoe", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  aegisPulse(stacks) {
    const dmg = Phials.witchglassAegis.pulseBaseDamage + Phials.witchglassAegis.pulseDamagePerStack * (stacks - 1);
    return {
      id: "phial:aegisPulse",
      base: dmg,
      coeff: 0,
      canCrit: false,
      tags: ["phial", "aoe"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  titheExplosion(stacks) {
    // Flat damage (uncapped AoE): stacks scale trigger cadence + radius, not damage.
    const dmg = Phials.titheEngine.baseExplosionDamage;
    return {
      id: "phial:titheExplosion",
      base: dmg,
      coeff: 0,
      canCrit: false,
      tags: ["phial", "aoe"],
      element: ELEMENT.occult,
      snapshot: true,
    };
  },

  blindingStepBurn(stacks) {
    const burnPerSecond = Phials.blindingStep.baseBurnDamagePerSecond + Phials.blindingStep.burnDamagePerStack * (stacks - 1);
    // Existing burn ticks once per second for this exact amount.
    return {
      id: "phial:blindingStepBurn",
      base: burnPerSecond,
      coeff: 0,
      canCrit: false,
      tags: ["phial", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  // --- Enemy → player ---
  enemyContact(enemyType, isBuffed) {
    // Mirrors current hard-coded values in `src/entities/Enemy.js` to avoid rebalance.
    // DPS-like for most enemies; caller decides whether to pass dt.
    const table = {
      enemy: isBuffed ? 10 : 5,
      walker: isBuffed ? 15 : 10,
      spitter: isBuffed ? 6 : 3,
      anchor: isBuffed ? 8 : 4,
      charger: isBuffed ? 20 : 15,
    };
    return {
      id: `enemy:contact:${enemyType}`,
      base: table[enemyType] ?? table.enemy,
      coeff: 0,
      canCrit: false,
      tags: ["enemy", "contact"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  enemyProjectile(isBuffed, level) {
    return {
      id: "enemy:projectile",
      base: isBuffed ? BALANCE.projectiles.enemy.buffedDamage : BALANCE.projectiles.enemy.damage,
      coeff: 0,
      flat: level,
      canCrit: false,
      tags: ["enemy", "projectile"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  hazardTick() {
    return {
      id: "enemy:hazardTick",
      base: BALANCE.projectiles.hazard.damage,
      coeff: 0,
      canCrit: false,
      tags: ["enemy", "hazard", "dot"],
      element: ELEMENT.fire,
      snapshot: true,
    };
  },

  bossProjectile(phase, variant = "dungeon") {
    const cfg = variant === "field" ? BALANCE.fieldBoss : BALANCE.boss;
    const dmg = phase === 2 ? cfg.phase2.projectileDamage : cfg.phase1.projectileDamage;
    return {
      id: `boss:${variant}:projectile:p${phase}`,
      base: dmg,
      coeff: 0,
      canCrit: false,
      tags: ["boss", "projectile"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },
};

export default DamageSpecs;
