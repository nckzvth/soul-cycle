import { BALANCE } from "./Balance.js";
import { Phials } from "./Phials.js";

const ELEMENT = {
  physical: "physical",
  fire: "fire",
  lightning: "lightning",
  occult: "occult",
};

// DamageSpec factories. These describe damage; DamageSystem computes/applies it.
const DamageSpecs = {
  // --- Player weapons ---
  pistolShot() {
    return {
      id: "player:pistolShot",
      base: 0,
      coeff: BALANCE.player.pistol.damageMult,
      canCrit: false, // keep disabled to avoid unintended rebalance; enable later
      tags: ["weapon", "projectile"],
      element: ELEMENT.physical,
      snapshot: true,
    };
  },

  staffZap() {
    return {
      id: "player:staffZap",
      base: 0,
      coeff: BALANCE.player.staff.damageMult,
      canCrit: false,
      tags: ["weapon", "chain"],
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
      tags: ["weapon", "melee"],
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
    const dmg = Phials.titheEngine.baseExplosionDamage + Phials.titheEngine.explosionDamagePerStack * (stacks - 1);
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

  bossProjectile(phase) {
    const dmg = phase === 2 ? BALANCE.boss.phase2.projectileDamage : BALANCE.boss.phase1.projectileDamage;
    return {
      id: `boss:projectile:p${phase}`,
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

