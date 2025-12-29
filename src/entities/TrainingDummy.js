import StatusSystem from "../systems/StatusSystem.js";
import { color as c } from "../data/ColorTuning.js";

export class TrainingDummy {
  constructor(x, y, opts = {}) {
    this.isEnemy = true;
    this.isTrainingDummy = true;

    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.r = Math.max(10, Number(opts.r) || 18);

    this.vx = 0;
    this.vy = 0;
    this.speed = 0;

    this.isElite = !!opts.isElite;
    this.isBoss = !!opts.isBoss;

    this.hpMax = Math.max(1, Number(opts.hpMax) || (this.isBoss ? 6000 : this.isElite ? 2500 : 1200));
    this.hp = this.hpMax;
    this.dead = false;

    this.stats = {};
    this.statuses = new Map();
    this.damageAccumulator = 0;
    this.lastHitSpecId = null;
  }

  takeDamage(amount) {
    const dmg = Math.max(0, Number(amount) || 0);
    if (dmg <= 0) return;
    this.hp = Math.max(0, (Number(this.hp) || 0) - dmg);
    if (this.hp <= 0) this.dead = true;
  }

  revive() {
    this.dead = false;
    this.hp = this.hpMax;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0;
    if (this.statuses) this.statuses.clear();
  }

  update(dt, state) {
    const d = Math.max(0, Number(dt) || 0);
    if (d > 0) {
      // Mild damping so pulls/knockbacks settle.
      this.vx *= Math.pow(0.02, d);
      this.vy *= Math.pow(0.02, d);
      this.x += this.vx * d;
      this.y += this.vy * d;
    }

    try {
      StatusSystem.update(this, d, state);
    } catch {
      // ignore
    }
  }

  draw(ctx, s) {
    if (!ctx) return;
    const p = s(this.x, this.y);

    const hpPct = this.hpMax > 0 ? Math.max(0, Math.min(1, (this.hp || 0) / this.hpMax)) : 0;
    const body = this.isBoss ? (c("player.guard", 0.30) || c("fx.uiText", 0.25) || "rgba(235,235,235,0.25)") : (this.isElite ? (c("player.support", 0.28) || "rgba(90,210,210,0.25)") : (c("fx.uiText", 0.22) || "rgba(235,235,235,0.22)"));

    ctx.save();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = c("fx.ink", 0.35) || "rgba(12,13,18,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.r, 0, Math.PI * 2);
    ctx.stroke();

    // HP bar
    const w = this.r * 2.2;
    const h = 6;
    const x = p.x - w / 2;
    const y = p.y - this.r - 16;
    ctx.fillStyle = c("fx.ink", 0.55) || "rgba(12,13,18,0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c("player.core", 0.75) || "rgba(120,220,220,0.75)";
    ctx.fillRect(x, y, w * hpPct, h);
    ctx.restore();
  }
}

