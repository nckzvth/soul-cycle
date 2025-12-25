// Phase 3: effect definitions in JS (not data-only yet), used in shadow mode by default.
// These defs must preserve current behavior; activation will happen behind flags in later phases.

import { clamp, dist2 } from "../core/Utils.js";
import DamageSystem from "../systems/DamageSystem.js";
import StatusSystem from "../systems/StatusSystem.js";
import DamageSpecs from "./DamageSpecs.js";
import { Phials } from "./Phials.js";
import { AegisPulse, TitheExplosion } from "../entities/Projectile.js";

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
      id: "phial:ashenHalo:cooldown",
      trigger: "tick",
      when: (ctx) => hasStacks(ctx, Phials.ashenHalo.id),
      act: (ctx) => {
        const p = ctx.player;
        const dt = Math.max(0, Number(ctx.dt || 0));
        if (!p || dt <= 0) return;
        p.haloTimer = (p.haloTimer || 0) - dt;
      },
    },
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

  [Phials.witchglassAegis.id]: [
    {
      id: "phial:witchglassAegis:tick",
      trigger: "tick",
      when: (ctx) => hasStacks(ctx, Phials.witchglassAegis.id),
      act: (ctx) => {
        const p = ctx.player;
        const dt = Math.max(0, Number(ctx.dt || 0));
        if (!p || dt <= 0) return;

        if ((p.aegisCooldownTimer || 0) > 0) p.aegisCooldownTimer = Math.max(0, (p.aegisCooldownTimer || 0) - dt);
        if ((p.aegisActiveTimer || 0) > 0) {
          p.aegisActiveTimer = Math.max(0, (p.aegisActiveTimer || 0) - dt);
          if ((p.aegisActiveTimer || 0) <= 0) {
            p.aegisDamageMultiplier = 1;
            if (p.stats) p.stats.damageTakenMult = 1;
          }
        }
      },
    },
    {
      id: "phial:witchglassAegis:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => {
        if (!hasStacks(ctx, Phials.witchglassAegis.id)) return false;
        const p = ctx.player;
        return !!p && (p.aegisCooldownTimer || 0) <= 0;
      },
      act: (ctx) => {
        const p = ctx.player;
        const state = ctx.state;
        const stacks = ctx.stacks;
        if (!p || !state || stacks <= 0) return;

        p.aegisCooldownTimer = Phials.witchglassAegis.internalCooldown;
        const reduction = clamp(
          Phials.witchglassAegis.baseDamageReduction + Phials.witchglassAegis.damageReductionPerStack * (stacks - 1),
          0,
          0.9
        );
        p.aegisDamageMultiplier = 1 - reduction;
        if (p.stats) p.stats.damageTakenMult = p.aegisDamageMultiplier;
        p.aegisActiveTimer = Phials.witchglassAegis.baseDuration + Phials.witchglassAegis.durationPerStack * (stacks - 1);

        const radius = Phials.witchglassAegis.pulseBaseRadius + Phials.witchglassAegis.pulseRadiusPerStack * (stacks - 1);
        const spec = DamageSpecs.aegisPulse(stacks);
        const snapshot = DamageSystem.snapshotOutgoing(p, spec);

        state.shots = Array.isArray(state.shots) ? state.shots : [];
        state.shots.push(new AegisPulse(state, p, p.x, p.y, radius, stacks, spec, snapshot));
      },
    },
  ],

  [Phials.soulSalvo.id]: [
    {
      id: "phial:soulSalvo:tick",
      trigger: "tick",
      when: (ctx) => hasStacks(ctx, Phials.soulSalvo.id),
      act: (ctx) => {
        const p = ctx.player;
        const dt = Math.max(0, Number(ctx.dt || 0));
        if (!p || dt <= 0) return;

        if ((p.salvoGlow || 0) > 0) p.salvoGlow = (p.salvoGlow || 0) - dt;
        if ((p.salvoProcCd || 0) > 0) p.salvoProcCd = Math.max(0, (p.salvoProcCd || 0) - dt);
        if ((p.salvoDuration || 0) > 0) {
          p.salvoDuration = Math.max(0, (p.salvoDuration || 0) - dt);
          if ((p.salvoDuration || 0) <= 0) p.salvoCharges = 0;
        }
        if ((p.salvoCharges || 0) <= 0 && (p.salvoDuration || 0) > 0) p.salvoDuration = 0;
      },
    },
    {
      id: "phial:soulSalvo:gaugeFill",
      trigger: "gaugeFill",
      when: (ctx) => hasStacks(ctx, Phials.soulSalvo.id),
      act: (ctx) => {
        const p = ctx.player;
        const stacks = ctx.stacks;
        if (!p || stacks <= 0) return;

        const cfg = Phials.soulSalvo || {};
        const grantOnlyWhenEmpty = cfg.grantOnlyWhenEmpty !== false;
        const activeCharges = (p.salvoCharges || 0) > 0;
        const onCd = (p.salvoProcCd || 0) > 0;
        if ((grantOnlyWhenEmpty && activeCharges) || onCd) {
          p.salvoGlow = Math.max(p.salvoGlow || 0, 0.35);
          return;
        }

        const chargesToAdd = (cfg.baseChargesPerFill || 0) + (cfg.chargesPerStack || 0) * (stacks - 1);
        const maxCharges = (cfg.maxChargesBase || chargesToAdd) + (cfg.maxChargesPerStack || 0) * (stacks - 1);
        p.salvoCharges = Math.max(0, Math.min(maxCharges, chargesToAdd));
        p.salvoDuration = Math.max(0, cfg.durationSec || 5.0);
        p.salvoProcCd = Math.max(0, cfg.procIcdSec || 8.0);
        p.salvoGlow = 2.0;
      },
    },
  ],

  [Phials.blindingStep.id]: [
    {
      id: "phial:blindingStep:dash",
      trigger: "dash",
      when: (ctx) => hasStacks(ctx, Phials.blindingStep.id),
      act: (ctx) => {
        const p = ctx.player;
        const state = ctx.state;
        const stacks = ctx.stacks;
        if (!p || !state?.enemies || stacks <= 0) return;

        p.dashHitList = Array.isArray(p.dashHitList) ? p.dashHitList : [];

        const blindDuration =
          Phials.blindingStep.baseBlindDuration +
          Math.floor((stacks - 1) / 2) * Phials.blindingStep.blindDurationPerTwoStacks;
        const burnDuration = Phials.blindingStep.baseBurnDuration;
        const knockback = clamp(
          Phials.blindingStep.baseKnockback + Phials.blindingStep.knockbackPerStack * (stacks - 1),
          0,
          Phials.blindingStep.maxKnockback
        );
        const burnSpec = stacks >= 2 ? DamageSpecs.blindingStepBurn(stacks) : null;

        state.enemies.forEach((enemy) => {
          if (!enemy || enemy.dead) return;
          if (p.dashHitList.includes(enemy)) return;
          if (dist2(p.x, p.y, enemy.x, enemy.y) >= Phials.blindingStep.dashAffectRadius * Phials.blindingStep.dashAffectRadius) return;

          p.dashHitList.push(enemy);
          enemy.blinded = blindDuration;

          const angle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
          enemy.vx += Math.cos(angle) * knockback;
          enemy.vy += Math.sin(angle) * knockback;

          if (stacks >= 2) {
            StatusSystem.applyStatus(enemy, "burn", {
              source: p,
              stacks: 1,
              duration: burnDuration,
              tickInterval: 1.0,
              spec: burnSpec,
              snapshotPolicy: "snapshot",
              triggerOnHit: false,
              dotTextMode: "perTick",
            });
          }
        });
      },
    },
  ],

  [Phials.titheEngine.id]: [
    {
      id: "phial:titheEngine:tick",
      trigger: "tick",
      when: (ctx) => hasStacks(ctx, Phials.titheEngine.id),
      act: (ctx) => {
        const p = ctx.player;
        const dt = Math.max(0, Number(ctx.dt || 0));
        if (!p || dt <= 0) return;

        if ((p.titheChargeGainedTimer || 0) > 0) p.titheChargeGainedTimer = (p.titheChargeGainedTimer || 0) - dt;

        if ((p.titheHotTimer || 0) > 0) {
          p.titheHotTimer = Math.max(0, (p.titheHotTimer || 0) - dt);
          p.titheHotTickTimer = (p.titheHotTickTimer || 0) - dt;

          const tickInterval = Math.max(0.05, p.titheHotTickInterval || 0.5);
          while ((p.titheHotTimer || 0) > 0 && (p.titheHotTickTimer || 0) <= 0) {
            p.titheHotTickTimer += tickInterval;
            const heal = Math.min(p.titheHotRemainingHeal || 0, p.titheHotHealPerTick || 0);
            if (heal > 0) {
              p.hp = Math.min(p.hpMax, p.hp + heal);
              p.titheHotRemainingHeal = Math.max(0, (p.titheHotRemainingHeal || 0) - heal);
            }
            if ((p.titheHotRemainingHeal || 0) <= 0) break;
          }

          if ((p.titheHotTimer || 0) <= 0 || (p.titheHotRemainingHeal || 0) <= 0) {
            p.titheHotTimer = 0;
            p.titheHotRemainingHeal = 0;
          }
        }
      },
    },
    {
      id: "phial:titheEngine:kill",
      trigger: "kill",
      when: (ctx) => {
        if (!hasStacks(ctx, Phials.titheEngine.id)) return false;
        const enemy = ctx.enemy;
        return !!enemy && enemy?.lastHitSpecId !== "phial:titheExplosion";
      },
      act: (ctx) => {
        const p = ctx.player;
        const enemy = ctx.enemy;
        const stacks = ctx.stacks;
        if (!p || !enemy || stacks <= 0) return;

        ctx.particles?.emit?.(enemy.x, enemy.y, "p3", 1, 100, 2, 2.0, p);

        p.titheKillsCounter = (p.titheKillsCounter || 0) + 1;
        const requiredKills = clamp(
          Phials.titheEngine.baseKillsRequired - Phials.titheEngine.killsReductionPerStack * (stacks - 1),
          Phials.titheEngine.minKillsRequired,
          Phials.titheEngine.baseKillsRequired
        );
        if ((p.titheKillsCounter || 0) >= requiredKills) {
          p.titheKillsCounter -= requiredKills;
          p.titheCharges = (p.titheCharges || 0) + 1;
          p.titheChargeGainedTimer = 1.0;
        }
      },
    },
    {
      id: "phial:titheEngine:hit",
      trigger: "hit",
      when: (ctx) => {
        if (!hasStacks(ctx, Phials.titheEngine.id)) return false;
        const p = ctx.player;
        const state = ctx.state;
        const target = ctx.target;
        return !!p && !!state && !!target && (p.titheCharges || 0) > 0;
      },
      act: (ctx) => {
        const p = ctx.player;
        const state = ctx.state;
        const target = ctx.target;
        const stacks = ctx.stacks;
        if (!p || !state || !target || stacks <= 0) return;

        p.titheCharges--;

        const radius = Phials.titheEngine.baseExplosionRadius + Phials.titheEngine.radiusPerStack * (stacks - 1);
        const spec = DamageSpecs.titheExplosion(stacks);
        const snapshot = DamageSystem.snapshotOutgoing(p, spec);

        state.shots = Array.isArray(state.shots) ? state.shots : [];
        state.shots.push(new TitheExplosion(state, p, target.x, target.y, radius, stacks, spec, snapshot));
      },
    },
  ],
};

export function getPhialEffectsById() {
  return PHIAL_EFFECTS_BY_ID;
}
