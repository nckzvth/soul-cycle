import { BALANCE } from "../data/Balance.js";

function hasTag(spec, tag) {
  return Array.isArray(spec.tags) && spec.tags.includes(tag);
}

function rand() {
  return Math.random();
}

function roundDamage(value) {
  return Math.round(value);
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

    // Post-hit hook for player procs (e.g., Tithe Engine).
    if (meta.triggerOnHit !== false && attacker?.onHit && meta.state) attacker.onHit(target, meta.state);

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
