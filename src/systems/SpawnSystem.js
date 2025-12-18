import { BALANCE } from "../data/Balance.js";
import { Walker, Charger, Spitter, Anchor } from "../entities/Enemy.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const SpawnSystem = {
  getSpawnSpec(spawnId) {
    const spawns = BALANCE?.spawns || {};
    return spawns?.[spawnId] || null;
  },

  createEnemyFromSpec(spec, x, y, enemyLevel, isElite) {
    if (!spec || !spec.enemyType) return null;
    const type = spec.enemyType;

    switch (type) {
      case "walker":
        return new Walker(x, y, enemyLevel, isElite, spec.variant || "walker");
      case "charger":
        return new Charger(x, y, enemyLevel, isElite);
      case "spitter":
        return new Spitter(x, y, enemyLevel, isElite);
      case "anchor":
        return new Anchor(x, y, enemyLevel, isElite);
      default:
        return null;
    }
  },

  applyTierScaling(enemy, tierId, context = {}) {
    if (!enemy || !tierId) return;
    const tiers = BALANCE?.progression?.enemyTiers || {};
    const tier = tiers?.[tierId];
    if (!tier) return;

    const playerLevel = Math.max(1, Math.floor(safeNumber(context.playerLevel, 1)));
    const eliteMult = enemy.isElite ? safeNumber(tier.eliteHpBonusMult, 1.0) : 1.0;

    const coeff = safeNumber(tier.hpBonusPerPlayerLevel, 0);
    const maxBonus = safeNumber(tier.hpMaxBonus, 0);
    const bonusHp = clamp(coeff * playerLevel, 0, maxBonus) * eliteMult;

    if (bonusHp > 0 && typeof enemy.hpMax === "number" && typeof enemy.hp === "number") {
      enemy.hpMax += bonusHp;
      enemy.hp += bonusHp;
    }

    if (enemy.stats) {
      if (typeof tier.knockbackTakenMult === "number" && Number.isFinite(tier.knockbackTakenMult)) {
        enemy.stats.knockbackTakenMult *= tier.knockbackTakenMult;
      }
      if (typeof tier.damageTakenMult === "number" && Number.isFinite(tier.damageTakenMult)) {
        enemy.stats.damageTakenMult *= tier.damageTakenMult;
      }
    }

    enemy.spawnTier = tierId;
  },
};

export default SpawnSystem;
