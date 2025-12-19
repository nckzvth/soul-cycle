// src/entities/Boss.js
import { dist2 } from '../core/Utils.js';
import UI from '../systems/UI.js';
import { BALANCE } from '../data/Balance.js';
import DamageSystem from '../systems/DamageSystem.js';
import DamageSpecs from '../data/DamageSpecs.js';
import StatusSystem from '../systems/StatusSystem.js';

class Boss {
    constructor(x, y, options = {}) {
        const variant = options.variant === "field" ? "field" : "dungeon";
        const cfg = variant === "field" ? BALANCE.fieldBoss : BALANCE.boss;

        this.x = x;
        this.y = y;
        this.variant = variant;
        this.hp = cfg.hp;
        this.hpMax = cfg.hp;
        this.r = cfg.radius;
        this.dead = false;
        this.attackTimer = 0;
        this.phase = 1;
        this.flash = 0;
        this.isBoss = true;
        this.isFieldBoss = variant === "field";
        this.stats = { damageTakenMult: 1.0 };
        this.damageAccumulator = 0;
        StatusSystem.init(this);
    }

    update(dt, p, dungeonState) {
        if (this.dead) return;
        if (this.flash > 0) this.flash -= dt;

        StatusSystem.update(this, dt, dungeonState);

        // Movement (dungeon boss should reposition; field boss currently stays as an arena gate).
        if (this.variant === "dungeon" && p) {
            const cfg = BALANCE.boss || {};
            const moveSpeed = cfg.moveSpeed ?? 55;
            const keepAway = cfg.keepAwayRadius ?? 140;
            const dx = p.x - this.x;
            const dy = p.y - this.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > keepAway * keepAway) {
                const d = Math.sqrt(d2) || 1;
                this.x += (dx / d) * moveSpeed * dt;
                this.y += (dy / d) * moveSpeed * dt;
            } else if (d2 > 0.0001) {
                // Light orbit when close.
                const d = Math.sqrt(d2) || 1;
                const ox = -dy / d;
                const oy = dx / d;
                this.x += ox * (moveSpeed * 0.45) * dt;
                this.y += oy * (moveSpeed * 0.45) * dt;
            }

            // Clamp to dungeon bounds if provided.
            const b = dungeonState?.bounds;
            if (b && typeof b.x === "number" && typeof b.y === "number" && typeof b.w === "number" && typeof b.h === "number") {
                this.x = Math.max(b.x + this.r, Math.min(b.x + b.w - this.r, this.x));
                this.y = Math.max(b.y + this.r, Math.min(b.y + b.h - this.r, this.y));
            }
        }

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack(p, dungeonState);
            const cfg = this.variant === "field" ? BALANCE.fieldBoss : BALANCE.boss;
            this.attackTimer = this.phase === 1 ? cfg.phase1.attackInterval : cfg.phase2.attackInterval;
        }

        if (this.hp < this.hpMax / 2 && this.phase === 1) {
            this.phase = 2;
            console.log("Boss phase 2!");
        }
    }

    takeDamage(dmg, state) {
        this.hp -= dmg;
        this.flash = 0.15;
        if (this.hp <= 0) {
            this.dead = true;
            // TODO: Handle boss death logic, e.g., victory screen, loot drops
        }
    }

    attack(p, dungeonState) {
        const cfg = this.variant === "field" ? BALANCE.fieldBoss : BALANCE.boss;
        const projectileCount = this.phase === 1 ? cfg.phase1.projectileCount : cfg.phase2.projectileCount;
        const projectileSpeed = this.phase === 1 ? cfg.phase1.projectileSpeed : cfg.phase2.projectileSpeed;
        const spec = DamageSpecs.bossProjectile(this.phase, this.variant);
        const source = this;

        for (let i = 0; i < projectileCount; i++) {
            const angle = (i / projectileCount) * Math.PI * 2;
            dungeonState.shots.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                life: 3,
                isBossShot: true,
                spec,
                update: function(dt, state) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.life -= dt;

                    // Check collision with player
                    if (dist2(this.x, this.y, p.x, p.y) < (p.r + 5)**2) {
                        DamageSystem.dealPlayerDamage(source, p, this.spec, { state, ui: UI });
                        return false; // Projectile is destroyed on hit
                    }

                    return this.life > 0;
                },
                draw: function(ctx, s) {
                    let p = s(this.x, this.y);
                    ctx.fillStyle = 'red';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.globalAlpha = this.flash > 0 ? 0.5 : 1;
        ctx.fillStyle = this.flash > 0 ? 'white' : 'purple';
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Health bar
        const barWidth = 100;
        const barHeight = 10;
        const barX = p.x - barWidth / 2;
        const barY = p.y - this.r - 20;
        
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const hpRatio = this.hp / this.hpMax;
        ctx.fillStyle = 'red';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        
        ctx.strokeStyle = 'white';
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

export default Boss;
