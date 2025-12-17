import { Phials } from "../data/Phials.js";
import { BALANCE } from "../data/Balance.js";

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function without(arr, value) {
  const idx = arr.indexOf(value);
  if (idx < 0) return arr;
  const copy = arr.slice();
  copy.splice(idx, 1);
  return copy;
}

function getOwnedPhialIds(player) {
  if (!player?.phials) return [];
  return Array.from(player.phials.keys());
}

function isCapped(player, id) {
  const cap = BALANCE?.progression?.phials?.maxStacks;
  if (typeof cap !== "number" || !Number.isFinite(cap)) return false;
  const stacks = typeof player?.getPhialStacks === "function" ? player.getPhialStacks(id) : (player?.phials?.get(id) || 0);
  return stacks >= cap;
}

const PhialOfferSystem = {
  getPhialOffers(player, count = 3) {
    const allIds = Object.values(Phials).map(p => p.id);
    const owned = getOwnedPhialIds(player);
    const ownedSet = new Set(owned);
    let newPool = allIds.filter(id => !ownedSet.has(id));
    let upgradePool = owned.filter(id => !isCapped(player, id));

    const offers = [];
    const haveThree = owned.length >= 3;

    while (offers.length < count) {
      let pick = null;

      if (haveThree) {
        pick = pickRandom(upgradePool);
        if (!pick) break;
        upgradePool = without(upgradePool, pick);
      } else {
        const wantUpgrade = upgradePool.length > 0 && Math.random() < 0.35;
        if (wantUpgrade) {
          pick = pickRandom(upgradePool);
          if (!pick && newPool.length > 0) pick = pickRandom(newPool);
        } else {
          pick = pickRandom(newPool);
          if (!pick && upgradePool.length > 0) pick = pickRandom(upgradePool);
        }

        if (!pick) break;
        newPool = without(newPool, pick);
        upgradePool = without(upgradePool, pick);
      }

      if (pick && !offers.includes(pick)) offers.push(pick);
    }

    return offers;
  },
};

export default PhialOfferSystem;
