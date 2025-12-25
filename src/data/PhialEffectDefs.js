// Phase 3: effect definitions in JS (not data-only yet), used in shadow mode by default.
// These defs must preserve current behavior; activation will happen behind flags in later phases.

import { dist2 } from "../core/Utils.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "./DamageSpecs.js";
import { Phials } from "./Phials.js";

function hasStacks(ctx, phialId) {
  return (ctx?.stacks || 0) > 0 && ctx?.sourceId === phialId;
}

export function buildActivePhialEffectSources(player) {
  const out = [];
  if (!player?.phials) return out;

  for (const [id, stacks] of player.phials.entries()) {
    if (!stacks) continue;
    const effects = PHIAL_EFFECTS_BY_ID[id] || [];
    out.push({ sourceId: id, kind: "phial", stacks, effects });
  }
  return out;
}

// Notes:
// - `act` functions intentionally use the same core helpers as legacy code.
// - Shadow mode will count would-run occurrences without mutating gameplay.
const PHIAL_EFFECTS_BY_ID = {
  [Phials.ashenHalo.id]: [
    {
      id: "phial:ashenHalo:tick",
      trigger: "tick",
      when: (ctx) => {
        if (!hasStacks(ctx, Phials.ashenHalo.id)) return false;
        // Mirror legacy timer gate: we rely on the existing haloTimer for now.
        return (ctx?.player?.haloTimer || 0) <= 0;
      },
      act: (ctx) => {
        const p = ctx.player;
        const state = ctx.state;
        const stacks = ctx.stacks;
        if (!p || !state?.enemies || stacks <= 0) return;

        // Mirror legacy behavior exactly (uses Player.haloTimer as the cadence).
        p.haloTimer = 0.5;

        const radius = Phials.ashenHalo.baseRadius + Phials.ashenHalo.radiusPerStack * (stacks - 1);
        const spec = DamageSpecs.ashenHaloTick(stacks);
        const snapshot = DamageSystem.snapshotOutgoing(p, spec);
        state.enemies.forEach((enemy) => {
          if (!enemy || enemy.dead) return;
          if (dist2(p.x, p.y, enemy.x, enemy.y) < radius * radius) {
            DamageSystem.dealDamage(p, enemy, spec, { state, snapshot, triggerOnHit: true, particles: ctx.particles });
          }
        });
      },
    },
  ],
};

export function getPhialEffectsById() {
  return PHIAL_EFFECTS_BY_ID;
}

