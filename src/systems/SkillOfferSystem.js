import { SKILLS } from "../data/Skills.js";
import { BALANCE } from "../data/Balance.js";

const DEFAULT_RARITY_WEIGHTS = { common: 70, uncommon: 23, rare: 6, epic: 1 };
const RARITIES = ["common", "uncommon", "rare", "epic"];

function getRarityWeights() {
  return BALANCE?.skills?.rarityWeights || DEFAULT_RARITY_WEIGHTS;
}

function weightedPickKey(weights) {
  const entries = Object.entries(weights).filter(([, w]) => typeof w === "number" && w > 0);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

function getStacks(player, skillId) {
  return player?.skills?.get(skillId) || 0;
}

function hasFlag(player, flag) {
  return !!player?.skillMeta?.flags?.has(flag);
}

function isBlocked(skill, player) {
  if (Array.isArray(skill.blocksAny) && skill.blocksAny.some(f => hasFlag(player, f))) return true;
  if (Array.isArray(skill.requiresAny) && skill.requiresAny.length > 0) {
    if (!skill.requiresAny.some(f => hasFlag(player, f))) return true;
  }
  return false;
}

function isExcludedByPath(skill, player) {
  const group = skill.exclusiveGroup;
  if (!group) return false;
  const chosen = player?.skillMeta?.exclusive?.get(group);
  if (!chosen) return false;
  return skill.exclusiveKey && skill.exclusiveKey !== chosen;
}

function isEligible(skill, player, weaponCls) {
  if (!skill || skill.cls !== weaponCls) return false;
  const stacks = getStacks(player, skill.id);
  if (stacks >= (skill.max_stacks || 1)) return false;
  if (skill.isKeystone && stacks > 0) return false;
  if (isExcludedByPath(skill, player)) return false;
  if (isBlocked(skill, player)) return false;
  return true;
}

function buildPools(skills) {
  const pools = new Map();
  for (const r of RARITIES) pools.set(r, []);
  for (const sk of skills) {
    const r = sk.rarity || "common";
    if (!pools.has(r)) pools.set(r, []);
    pools.get(r).push(sk);
  }
  return pools;
}

function pickFromPool(pools, weights) {
  // Try a few weighted rarity rolls; fallback to any non-empty pool.
  for (let i = 0; i < 8; i++) {
    const rarity = weightedPickKey(weights);
    const pool = pools.get(rarity) || [];
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  for (const r of RARITIES) {
    const pool = pools.get(r) || [];
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

const SkillOfferSystem = {
  getWeaponOffers(player, weaponCls, count = 3) {
    if (!weaponCls) return [];

    const eligible = SKILLS.filter(sk => isEligible(sk, player, weaponCls));
    if (eligible.length === 0) return [];

    const weights = getRarityWeights();
    const pools = buildPools(eligible);

    const chosen = [];
    const chosenIds = new Set();
    while (chosen.length < count) {
      const pick = pickFromPool(pools, weights);
      if (!pick) break;
      if (chosenIds.has(pick.id)) {
        // Remove duplicates by shrinking pool.
        const pool = pools.get(pick.rarity || "common");
        if (pool) pools.set(pick.rarity || "common", pool.filter(s => s.id !== pick.id));
        continue;
      }
      chosen.push(pick);
      chosenIds.add(pick.id);
      // Remove to avoid repeated offers in the same roll.
      const pool = pools.get(pick.rarity || "common");
      if (pool) pools.set(pick.rarity || "common", pool.filter(s => s.id !== pick.id));
    }
    return chosen;
  },
};

export default SkillOfferSystem;

