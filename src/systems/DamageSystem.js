import { BALANCE } from "../data/Balance.js";
import DamageSpecs from "../data/DamageSpecs.js";

function hasTag(spec, tag) {
  return Array.isArray(spec.tags) && spec.tags.includes(tag);
}

function rand() {
  return Math.random();
}

function roundDamage(value) {
  return Math.round(value);
}

function getCombatBuffMult(attacker, key) {
  const buffs = attacker?.combatBuffs;
  if (!buffs) return 1.0;
  const v = buffs[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 1.0;
}

const DamageSystem = {
  /**
   * Computes outgoing damage using a single canonical order.
   * If `context.snapshot` is provided, uses it instead of recomputing attacker-side stages.
   */
  computeOutgoing(attacker, target, spec, context = {}) {
    const attackerStats = attacker?.stats || {};
    const targetStats = target?.stats || {};

    let didCrit = false;

    // Snapshot can skip attacker-side stages (and crit roll) if caller supplies it.
    let amount = context.snapshot?.amountBeforeTarget;
    if (typeof amount !== "number") {
      const base = spec.base || 0;
      const coeff = spec.coeff || 0;
      const flat = spec.flat || 0;
      const power = attackerStats.power || 0;

      amount = base + power * coeff + flat;

      if (typeof context.dt === "number") amount *= context.dt;

      amount *= attackerStats.powerMult ?? 1.0;
      amount *= getCombatBuffMult(attacker, "powerMult");
      if (hasTag(spec, "dot")) amount *= attackerStats.dotMult ?? 1.0;
      if (hasTag(spec, "aoe")) amount *= attackerStats.aoeMult ?? 1.0;

      if (spec.canCrit) {
        const critChance = attackerStats.critChance ?? 0;
        didCrit = rand() < critChance;
        if (didCrit) amount *= attackerStats.critMult ?? 1.5;
      }

      // Global knob: applies to player outgoing only (matches prior `CombatSystem.applyDamage`).
      if (attacker?.isPlayer) amount *= BALANCE.combat.playerDamageMult;
    } else {
      didCrit = !!context.snapshot.didCrit;
    }

    // Target-side multiplier (buff aura etc.).
    amount *= targetStats.damageTakenMult ?? 1.0;

    const rounded = roundDamage(amount);
    return { amount: rounded, didCrit };
  },

  snapshotOutgoing(attacker, spec, context = {}) {
    const attackerStats = attacker?.stats || {};
    let didCrit = false;

    const base = spec.base || 0;
    const coeff = spec.coeff || 0;
    const flat = spec.flat || 0;
    const power = attackerStats.power || 0;
    let amount = base + power * coeff + flat;

    if (typeof context.dt === "number") amount *= context.dt;

    amount *= attackerStats.powerMult ?? 1.0;
    amount *= getCombatBuffMult(attacker, "powerMult");
    if (hasTag(spec, "dot")) amount *= attackerStats.dotMult ?? 1.0;
    if (hasTag(spec, "aoe")) amount *= attackerStats.aoeMult ?? 1.0;

    if (spec.canCrit) {
      const critChance = attackerStats.critChance ?? 0;
      didCrit = rand() < critChance;
      if (didCrit) amount *= attackerStats.critMult ?? 1.5;
    }

    if (attacker?.isPlayer) amount *= BALANCE.combat.playerDamageMult;

    return { amountBeforeTarget: amount, didCrit };
  },

  dealDamage(attacker, target, spec, meta = {}) {
    if (!target || target.dead) return { amount: 0, didCrit: false };

    const wasDead = !!target.dead || (typeof target.hp === "number" && target.hp <= 0);

    const snapshot = spec.snapshot ? meta.snapshot || this.snapshotOutgoing(attacker, spec, meta.context || {}) : meta.snapshot;
    const { amount, didCrit } = this.computeOutgoing(attacker, target, spec, {
      ...(meta.context || {}),
      snapshot,
    });

    if (amount <= 0) return { amount: 0, didCrit };

    // Apply to target.
    if (typeof target.takeDamage === "function") {
      target.takeDamage(amount, meta.state);
    } else {
      target.hp -= amount;
      if (target.hp <= 0) target.dead = true;
    }

    // Staff: Soul Circuit (occult upgrade) — killing marked/hexed foes grants "Current".
    // Kept here to avoid scattering kill math across projectiles/status sources.
    const nowDead = !!target.dead || (typeof target.hp === "number" && target.hp <= 0);
    if (!wasDead && nowDead && attacker?.isPlayer) {
      const weaponCls = attacker?.gear?.weapon?.cls;
      if (weaponCls === "staff" && (attacker.stats?.staffSoulCircuitEnable || 0) > 0) {
        const hadMark = !!target?.statuses?.has?.("staff:mark");
        const hadHex = !!target?.statuses?.has?.("staff:hex");
        if (hadMark || hadHex) {
          const cfg = BALANCE.skills?.staff || {};
          const base = cfg.currentDuration ?? 2.5;
          const mult = 1 + (attacker.stats?.staffCurrentDurationMult || 0);
          const duration = Math.max(0, base * mult);
          attacker.weaponState = attacker.weaponState || {};
          attacker.weaponState.staff = attacker.weaponState.staff || { currentTime: 0, voltage: 0, currentVfxTimer: 0, voltageVfxTimer: 0, currentJustGained: false };
          const prev = attacker.weaponState.staff.currentTime || 0;
          attacker.weaponState.staff.currentTime = Math.max(prev, duration);
          if (attacker.weaponState.staff.currentTime > prev + 1e-9) attacker.weaponState.staff.currentJustGained = true;
        }
      }
    }

    // Hammer: Pyre Burst — burning enemies explode on death (not just on-hit deaths).
    if (!wasDead && nowDead && attacker?.isPlayer) {
      const weaponCls = attacker?.gear?.weapon?.cls;
      if (weaponCls === "hammer" && (attacker.stats?.hammerPyreBurstEnable || 0) > 0) {
        const burning = !!target?.statuses?.has?.("hammer:burn");
        const state = meta.state;
        if (burning && state?.enemies && Array.isArray(state.enemies)) {
          const cfg = BALANCE.skills?.hammer || {};
          const vfx = cfg.vfx || {};
          const heat = attacker.weaponState?.hammer?.heat || 0;
          const heatMult = 1 + heat * (cfg.forgeHeatCoeffPerStack ?? 0.06);
          const burstSpecBase = DamageSpecs.hammerPyreBurst();
          const burstSpec = { ...burstSpecBase, coeff: burstSpecBase.coeff * heatMult };
          const burstSnapshot = this.snapshotOutgoing(attacker, burstSpec);
          const radius = cfg.pyreBurstRadius ?? 100;

          if (meta.particles) {
            meta.particles.emit(target.x, target.y, vfx.pyreColor ?? "rgba(255, 80, 0, 0.9)", vfx.pyreBurstCount ?? 22, vfx.pyreBurstSpeed ?? 220, 3.2, 0.45);
          }

          state.enemies.forEach(e2 => {
            if (!e2 || e2.dead) return;
            const dx = e2.x - target.x;
            const dy = e2.y - target.y;
            if (dx * dx + dy * dy < radius * radius) {
              this.dealDamage(attacker, e2, burstSpec, { state, snapshot: burstSnapshot, particles: meta.particles });
            }
          });
        }
      }
    }

    // Floating combat text (preserve existing behavior from CombatSystem.applyDamage()).
    const particles = meta.particles;
    if (particles && meta.showText !== false) {
      if (meta.isDoT && meta.dotTextMode === "perTick") {
        particles.emitText(target.x, target.y - (target.r || 0), amount, {
          color: "orange",
          size: 16,
          life: 0.6,
        });
      } else if (meta.isDoT && typeof target.damageAccumulator === "number") {
        target.damageAccumulator += amount;
        if (target.damageAccumulator > 5) {
          particles.emitText(target.x, target.y - (target.r || 0), target.damageAccumulator, {
            color: "orange",
            size: 16,
            life: 0.6,
          });
          target.damageAccumulator = 0;
        }
      } else {
        particles.emitText(target.x, target.y - (target.r || 0), amount, {
          color: "white",
          size: 20,
          life: 0.8,
        });
      }
    }

    // Knockback (preserve existing behavior from CombatSystem).
    if (attacker?.stats && target.vx !== undefined && target.vy !== undefined) {
      const a = Math.atan2(target.y - attacker.y, target.x - attacker.x);
      const kb = (attacker.stats.knockback ?? attacker.stats.kb ?? 0) + BALANCE.combat.knockbackBase;
      target.vx += Math.cos(a) * kb;
      target.vy += Math.sin(a) * kb;
    }

    // Post-hit hook for player procs (e.g., Tithe Engine, pistol cyclone proc).
    // Pass hit context so procs can gate on spec/tags without scattering logic.
    if (meta.triggerOnHit !== false && attacker?.onHit && meta.state) {
      attacker.onHit(target, meta.state, { spec, meta, result: { amount, didCrit } });
    }

    return { amount, didCrit };
  },

  computeIncoming(source, player, spec, context = {}) {
    const sourceStats = source?.stats || {};
    const base = spec.base || 0;
    const coeff = spec.coeff || 0;
    const flat = spec.flat || 0;
    const power = sourceStats.power || 0;

    // Base scaling (matches outgoing stage 1).
    let amount = base + power * coeff + flat;
    if (typeof context.dt === "number") amount *= context.dt;

    // Dash invulnerability (migrated from Player.takeDamage()).
    if (player?.dashTimer > 0) return { amount: 0, prevented: true };

    // Player-side mitigation multiplier (Aegis etc).
    const taken = player?.stats?.damageTakenMult ?? 1.0;
    amount *= taken;

    // For continuous damage (dt-scaled), preserve fractional damage. This matches prior behavior
    // where contact/hazard ticks subtracted floats (see `Enemy.handlePlayerCollision` and `Hazard.update`).
    if (typeof context.dt === "number") {
      return { amount, prevented: amount <= 0 };
    }

    const rounded = roundDamage(amount);
    return { amount: rounded, prevented: rounded <= 0 };
  },

  dealPlayerDamage(source, player, spec, meta = {}) {
    if (!player) return { amount: 0, prevented: true };
    const { amount, prevented } = this.computeIncoming(source, player, spec, meta.context || {});
    if (prevented || amount <= 0) return { amount: 0, prevented: true };

    player.hp -= amount;
    if (player.onDamageTaken) player.onDamageTaken(source, meta.state);

    if (meta.updateUI !== false && meta.ui?.render) meta.ui.render();

    // Death screen is still owned by Player.takeDamage; keep compatibility by calling it if present.
    if (player.hp <= 0) {
      player.hp = 0;
      if (typeof player.onDeath === "function") player.onDeath(meta.state);
    }

    return { amount, prevented: false };
  },
};

export default DamageSystem;
