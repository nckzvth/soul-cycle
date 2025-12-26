import { dist2 } from "../core/Utils.js";
import { BALANCE } from "../data/Balance.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import ParticleSystem from "../systems/Particles.js";
import { color as c } from "../data/ColorTuning.js";

export class GolemTauntPulse {
  constructor(state, x, y, radius) {
    this.state = state;
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.r = Math.max(10, Number(radius) || 75);
    this.t = 0;
    this.life = 0.38;
  }

  update(dt) {
    this.t += Math.max(0, Number(dt) || 0);
    return this.t <= this.life;
  }

  draw(ctx, s) {
    const p = s(this.x, this.y);
    const progress = Math.max(0, Math.min(1, this.t / Math.max(0.001, this.life)));
    const alpha = Math.max(0, 1 - progress);
    const r = this.r * (0.35 + 0.9 * progress);

    ctx.save();
    ctx.globalAlpha *= alpha;

    const ink = c("fx.ink", Math.min(1, alpha * 0.35)) || "ink";
    const core = c("fx.bloodBright", Math.min(1, alpha * 0.65)) || "bloodBright";

    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, c("fx.bloodBright", 0) || "transparent");
    grad.addColorStop(0.55, c("fx.bloodBright", alpha * 0.10) || core);
    grad.addColorStop(1, c("fx.bloodBright", 0) || "transparent");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim for readability on bright ground.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = core;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

export function applySharedGolemTaunt(state, dt) {
  if (!state) return;
  if (!Array.isArray(state.minions)) state.minions = [];
  if (!Array.isArray(state.enemies)) state.enemies = [];
  state.shots = Array.isArray(state.shots) ? state.shots : [];

  const cfg = BALANCE.skills?.scythe || {};
  const radius = Math.max(0, Number(cfg.golemTauntRadius ?? 75) || 0);
  const duration = Math.max(0, Number(cfg.golemTauntDurationSec ?? 5) || 0);
  const period = Math.max(0.1, Number(cfg.golemTauntPeriodSec ?? 10) || 10);
  const bossesEnabled = !!cfg.golemTauntBossesEnabled;
  if (radius <= 0 || duration <= 0) return;

  const golems = state.minions.filter((m) => m && m.isMinion && !m.dead && m.kind === "golem");
  if (golems.length === 0) {
    state._golemTauntCd = null;
    return;
  }

  if (typeof state._golemTauntCd !== "number") state._golemTauntCd = 0.6; // first pulse soon after you have golems
  state._golemTauntCd = Math.max(0, state._golemTauntCd - Math.max(0, Number(dt) || 0));
  if (state._golemTauntCd > 0) return;
  state._golemTauntCd = period;

  const now = Number(state?.game?.time) || 0;
  const rad2 = radius * radius;

  // Pulse VFX per golem (so players can read "taunt fired" origin).
  for (const g of golems) {
    state.shots.push(new GolemTauntPulse(state, g.x, g.y, radius));
    ParticleSystem.emit(
      g.x,
      g.y,
      c("fx.bloodBright", 0.9) || { token: "bloodBright", alpha: 0.9 },
      10,
      140,
      2.8,
      0.30
    );
  }

  // Apply taunt to enemies within radius of any golem.
  for (const e of state.enemies) {
    if (!e || e.dead) continue;
    if (!bossesEnabled && e.isBoss) continue;

    let best = null;
    let bestD2 = Infinity;
    for (const g of golems) {
      const d2 = dist2(e.x, e.y, g.x, g.y);
      if (d2 <= rad2 && d2 < bestD2) {
        bestD2 = d2;
        best = g;
      }
    }
    if (!best) continue;

    e.aggroTarget = best;
    e.aggroUntil = now + duration;
    e.tauntFxTimer = 0; // re-seed vfx cadence

    // Quick highlight burst on taunted enemies.
    ParticleSystem.emit(
      e.x,
      e.y - (e.r || 0) * 0.4,
      c("fx.bloodBright", 0.85) || { token: "bloodBright", alpha: 0.85 },
      6,
      110,
      2.2,
      0.25,
      null,
      { rim: true, rimColor: c("fx.ink", 0.45) || "ink", rimWidth: 1 }
    );
  }
}

export class GolemMinion {
  constructor(state, owner, x, y, { aspect = "Stone" } = {}) {
    this.isMinion = true;
    this.kind = "golem";
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.r = 14;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;

    this.aspect = aspect; // "Stone" | "Bone"
    this.hpMax = 40;
    this.hp = this.hpMax;
    this.stats = { damageTakenMult: (BALANCE.skills?.scythe?.golemDamageTakenMult ?? 0.5) };

    this.attackCd = 0;
    this.target = null;
    this.state = state;

    this.orbitT = 0;
    const dx = (Number(x) || 0) - (Number(owner?.x) || 0);
    const dy = (Number(y) || 0) - (Number(owner?.y) || 0);
    const baseAng = Math.atan2(dy, dx);
    this.orbitAngle = Number.isFinite(baseAng) ? baseAng : 0;
  }

  healPctMax(pct) {
    const p = Math.max(0, Math.min(1, Number(pct) || 0));
    if (p <= 0) return;
    this.hp = Math.min(this.hpMax, this.hp + this.hpMax * p);
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return;
    this.hp -= dmg;
    if (this.hp <= 0) this.dead = true;
  }

  update(dt, state) {
    if (this.dead) return false;
    const p = this.owner;
    if (!p) return false;

    if (this.attackCd > 0) this.attackCd = Math.max(0, this.attackCd - dt);
    this.orbitT += Math.max(0, Number(dt) || 0);

    const cfg = BALANCE.skills?.scythe || {};
    const acquireRange = Math.max(0, Number(cfg.golemAcquireRange ?? 360) || 0);
    const leashRange = Math.max(acquireRange, Number(cfg.golemLeashRange ?? (acquireRange * 1.2)) || acquireRange);
    const orbitRadius = Math.max(0, Number(cfg.golemOrbitRadius ?? 78) || 0);
    const orbitWobble = Math.max(0, Number(cfg.golemOrbitWobble ?? 16) || 0);
    const orbitOmega = Number(cfg.golemOrbitAngularSpeed ?? 1.3) || 1.3;

    const enemies = state?.enemies || [];
    // Targeting: only acquire/keep enemies near the player so golems stay in-proximity.
    const acquireR2 = acquireRange * acquireRange;
    const leashR2 = leashRange * leashRange;
    if (this.target && (this.target.dead || dist2(p.x, p.y, this.target.x, this.target.y) > leashR2)) {
      this.target = null;
    }
    if (!this.target && acquireRange > 0) {
      let best = null;
      let bestD2 = Infinity;
      for (const e of enemies) {
        if (!e || e.dead) continue;
        if (dist2(p.x, p.y, e.x, e.y) > acquireR2) continue;
        const d2 = dist2(this.x, this.y, e.x, e.y);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = e;
        }
      }
      this.target = best;
    }
    const target = this.target;

    // Move: follow target, else orbit the player loosely.
    const speed = Math.max(30, Number(cfg.golemMoveSpeed ?? 180) || 180);
    let tx = p.x;
    let ty = p.y;
    if (target) {
      tx = target.x;
      ty = target.y;
    } else if (orbitRadius > 0) {
      const desiredR = orbitRadius + Math.sin(this.orbitT * 2.0 + this.orbitAngle) * orbitWobble;
      const ang = this.orbitAngle + this.orbitT * orbitOmega;
      tx = p.x + Math.cos(ang) * desiredR;
      ty = p.y + Math.sin(ang) * desiredR;
    }

    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;

    const farFromPlayer = dist2(this.x, this.y, p.x, p.y) > 320 * 320;
    const farMult = Math.max(1, Number(cfg.golemReturnSpeedMult ?? 1.35) || 1.35);
    const moveSpeed = farFromPlayer ? speed * farMult : speed;
    if (d > 2) {
      this.x += nx * moveSpeed * dt;
      this.y += ny * moveSpeed * dt;
    }

    // Collision / separation: prevent golems from stacking on each other, the player, or enemies.
    // Keep it lightweight: minion caps are small so O(n^2) is fine.
    const pushAwayFrom = (ox, oy, combinedR, force) => {
      let dx = this.x - ox;
      let dy = this.y - oy;
      let d2 = dx * dx + dy * dy;
      if (d2 <= 1e-8) {
        const seed = (this.x * 12.9898 + this.y * 78.233 + (state?._frameId ?? 0) * 0.37) * 0.01;
        const frac = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1;
        const ang = frac * Math.PI * 2;
        dx = Math.cos(ang);
        dy = Math.sin(ang);
        d2 = 1;
      }
      const d = Math.sqrt(d2);
      if (d <= 1e-6) return false;
      const overlap = combinedR - d;
      if (overlap <= 0) return false;
      const m = Math.max(0, Math.min(1, Number(force) || 0));
      this.x += (dx / d) * overlap * m;
      this.y += (dy / d) * overlap * m;
      return true;
    };

    const selfR = Math.max(6, Number(this.r) || 14);
    // Avoid stacking on the player (only move minion).
    pushAwayFrom(p.x, p.y, selfR + Math.max(6, Number(p.r || 12)) + 3, 1.0);

    // Avoid stacking on other minions (only move this minion).
    const minions = state?.minions || [];
    for (const other of minions) {
      if (!other || other === this || other.dead || !other.isMinion) continue;
      const or = Math.max(6, Number(other.r) || 12);
      if (dist2(this.x, this.y, other.x, other.y) < (selfR + or) * (selfR + or)) {
        pushAwayFrom(other.x, other.y, selfR + or + 1, 0.7);
      }
    }

    // Avoid stacking directly inside enemies (only move minion).
    for (const e of enemies) {
      if (!e || e.dead) continue;
      const er = Math.max(6, Number(e.r) || 12);
      if (dist2(this.x, this.y, e.x, e.y) < (selfR + er) * (selfR + er)) {
        // Yield strongly to avoid "bulldozing" enemies via enemy-side separation.
        pushAwayFrom(e.x, e.y, selfR + er + 1, 0.9);
      }
    }

    // Slam when close to target.
    if (target && this.attackCd <= 0 && dist2(this.x, this.y, target.x, target.y) < 52 * 52) {
      this.attackCd = 1.0;
      const specBase = DamageSpecs.scytheGolemSlam();
      const mult = 1 + (p.stats?.scytheGolemSlamCoeffMult || 0);
      const spec = mult !== 1 ? { ...specBase, coeff: specBase.coeff * mult } : specBase;
      const snapshot = DamageSystem.snapshotOutgoing(p, spec);
      DamageSystem.dealDamage(p, target, spec, { state, snapshot, particles: ParticleSystem, triggerOnHit: true });

      // Small impact feedback.
      ParticleSystem.emit(this.x, this.y, c("player.guard", 0.85) || { token: "p4", alpha: 0.85 }, 8, 140, 2.6, 0.28);
    }

    if (this.hp <= 0) this.dead = true;
    return !this.dead;
  }

  draw(ctx, s) {
    const pos = s(this.x, this.y);
    ctx.save();
    const base = this.aspect === "Bone" ? (c("fx.uiText", 0.85) || "parchment") : (c("fx.uiMuted", 0.85) || "dust");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // HP ring
    const pct = this.hpMax > 0 ? Math.max(0, Math.min(1, this.hp / this.hpMax)) : 0;
    ctx.strokeStyle = c("player.guard", 0.85) || "p4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();
    ctx.restore();
  }
}
