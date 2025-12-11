// src/entities/Boss.js
import { dist2 } from '../core/Utils.js';
import UI from '../systems/UI.js';
import { BALANCE } from '../data/Balance.js';

class Boss {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = BALANCE.boss.hp;
        this.hpMax = BALANCE.boss.hp;
        this.r = BALANCE.boss.radius;
        this.dead = false;
        this.attackTimer = 0;
        this.phase = 1;
        this.flash = 0;
        this.isBoss = true;
    }

    update(dt, p, dungeonState) {
        if (this.dead) return;
        if (this.flash > 0) this.flash -= dt;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack(p, dungeonState);
            this.attackTimer = this.phase === 1 ? BALANCE.boss.phase1.attackInterval : BALANCE.boss.phase2.attackInterval;
        }

        if (this.hp < this.hpMax / 2 && this.phase === 1) {
            this.phase = 2;
            console.log("Boss phase 2!");
        }
    }

    attack(p, dungeonState) {
        const projectileCount = this.phase === 1 ? BALANCE.boss.phase1.projectileCount : BALANCE.boss.phase2.projectileCount;
        const projectileSpeed = this.phase === 1 ? BALANCE.boss.phase1.projectileSpeed : BALANCE.boss.phase2.projectileSpeed;
        const projectileDamage = this.phase === 1 ? BALANCE.boss.phase1.projectileDamage : BALANCE.boss.phase2.projectileDamage;

        for (let i = 0; i < projectileCount; i++) {
            const angle = (i / projectileCount) * Math.PI * 2;
            dungeonState.shots.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * projectileSpeed,
                vy: Math.sin(angle) * projectileSpeed,
                life: 3,
                isBossShot: true,
                update: function(dt, state) {
                    this.x += this.vx * dt;
                    this.y += this.vy * dt;
                    this.life -= dt;

                    // Check collision with player
                    if (dist2(this.x, this.y, p.x, p.y) < (p.r + 5)**2) {
                        p.takeDamage(projectileDamage);
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
    }
}

export default Boss;