import { BALANCE } from "../data/Balance.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCfg() {
  return BALANCE?.pickups?.soul?.tiers || {};
}

function keyFor(cx, cy) {
  return `${cx},${cy}`;
}

const SoulOrbMergeSystem = {
  merge(orbs, dt, state) {
    const cfg = getCfg();
    if (!cfg.enabled) return orbs;
    if (!Array.isArray(orbs) || orbs.length === 0) return orbs;

    const interval = cfg.intervalSec ?? 0.35;
    if (!(interval > 0)) return orbs;

    state._soulMergeTimer = (state._soulMergeTimer ?? 0) - dt;
    if (state._soulMergeTimer > 0) return orbs;
    state._soulMergeTimer = interval;

    const onlyWhen = cfg.onlyWhenOrbsAtLeast ?? 0;
    if (orbs.length < onlyWhen) return orbs;

    const radius = cfg.radius ?? 140;
    const radius2 = radius * radius;
    const cellSize = Math.max(40, radius);
    const maxTier = clamp(cfg.maxTier ?? 5, 1, 99);
    const maxMerges = clamp(cfg.maxMergesPerTick ?? 4, 0, 999);
    const mergeAnimSec = cfg.mergeAnimSec ?? 0.25;
    const minOrbsToMerge = clamp(cfg.minOrbsToMerge ?? 8, 2, 999);
    const maxAbsorbPerMerge = clamp(cfg.maxAbsorbPerMerge ?? 25, 2, 999);
    if (maxMerges === 0) return orbs;

    const grid = new Map();
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (!o) continue;
      if (o.merge || (o._mergeRemaining || 0) > 0) continue;
      const cx = Math.floor(o.x / cellSize);
      const cy = Math.floor(o.y / cellSize);
      const k = keyFor(cx, cy);
      let bucket = grid.get(k);
      if (!bucket) { bucket = []; grid.set(k, bucket); }
      bucket.push(i);
    }

    let merges = 0;

    const tryMergeFromIndex = (i) => {
      const base = orbs[i];
      if (!base || base.merge || (base._mergeRemaining || 0) > 0) return false;
      const cx = Math.floor(base.x / cellSize);
      const cy = Math.floor(base.y / cellSize);

      const candidates = [];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = grid.get(keyFor(cx + ox, cy + oy));
          if (!bucket) continue;
          for (const idx of bucket) {
            const o = orbs[idx];
            if (!o) continue;
            if (o.merge || (o._mergeRemaining || 0) > 0) continue;
            const dx = o.x - base.x;
            const dy = o.y - base.y;
            if (dx * dx + dy * dy <= radius2) candidates.push(idx);
          }
        }
      }

      if (candidates.length < minOrbsToMerge) return false;

      // Prefer the biggest orb in the cluster as sink so consolidation "feels" directional.
      let keepIdx = candidates[0];
      let bestUnits = (orbs[keepIdx]?.unitCount ?? 1);
      for (let k = 1; k < candidates.length; k++) {
        const idx = candidates[k];
        const u = orbs[idx]?.unitCount ?? 1;
        if (u > bestUnits) { bestUnits = u; keepIdx = idx; }
      }

      // Merge up to maxAbsorbPerMerge orbs into sink (excluding sink itself).
      const take = [];
      for (let k = 0; k < candidates.length && take.length < maxAbsorbPerMerge; k++) {
        const idx = candidates[k];
        if (idx === keepIdx) continue;
        take.push(idx);
      }
      if (take.length === 0) return false;

      const keep = orbs[keepIdx];
      keep._mergeRemaining = take.length;
      keep._mergePendingXp = keep.xpValue || 0;
      keep._mergePendingUnits = keep.unitCount || 1;
      keep._mergeNextTier = null;

      for (let j = 0; j < take.length; j++) {
        const o = orbs[take[j]];
        if (!o) continue;
        o.merge = { target: keep, duration: mergeAnimSec, tLeft: mergeAnimSec };
      }
      merges++;
      return true;
    };

    // Prefer merging small-value orbs first (keeps the field readable).
    const order = [];
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (!o || o.merge || (o._mergeRemaining || 0) > 0) continue;
      order.push(i);
    }
    order.sort((a, b) => (orbs[a]?.unitCount ?? 1) - (orbs[b]?.unitCount ?? 1));

    for (let k = 0; k < order.length && merges < maxMerges; k++) {
      tryMergeFromIndex(order[k]);
    }

    return orbs;
  },
};

export default SoulOrbMergeSystem;
