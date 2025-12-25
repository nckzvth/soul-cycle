import { dist2 } from "../core/Utils.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import ParticleSystem from "../systems/Particles.js";
import { color as c } from "../data/ColorTuning.js";

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

    this.attackCd = 0;
    this.target = null;
    this.state = state;
  }

  healPctMax(pct) {
    const p = Math.max(0, Math.min(1, Number(pct) || 0));
    if (p <= 0) return;
    this.hp = Math.min(this.hpMax, this.hp + this.hpMax * p);
  }

  update(dt, state) {
    if (this.dead) return false;
    const p = this.owner;
    if (!p) return false;

    if (this.attackCd > 0) this.attackCd = Math.max(0, this.attackCd - dt);

    const enemies = state?.enemies || [];
    let best = null;
    let bestD2 = Infinity;
    for (const e of enemies) {
      if (!e || e.dead) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    this.target = best;

    // Move: follow target, else orbit the player loosely.
    const speed = 180;
    let tx = p.x;
    let ty = p.y;
    if (best) {
      tx = best.x;
      ty = best.y;
    }

    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;

    const farFromPlayer = dist2(this.x, this.y, p.x, p.y) > 320 * 320;
    const moveSpeed = farFromPlayer ? speed * 1.35 : speed;
    this.x += nx * moveSpeed * dt;
    this.y += ny * moveSpeed * dt;

    // Slam when close to target.
    if (best && this.attackCd <= 0 && bestD2 < 52 * 52) {
      this.attackCd = 1.0;
      const specBase = DamageSpecs.scytheGolemSlam();
      const mult = 1 + (p.stats?.scytheGolemSlamCoeffMult || 0);
      const spec = mult !== 1 ? { ...specBase, coeff: specBase.coeff * mult } : specBase;
      const snapshot = DamageSystem.snapshotOutgoing(p, spec);
      DamageSystem.dealDamage(p, best, spec, { state, snapshot, particles: ParticleSystem, triggerOnHit: true });

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
