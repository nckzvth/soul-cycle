import { dist2 } from "../core/Utils.js";
import { BALANCE } from "../data/Balance.js";

export class TitheExplosion {
    constructor(state, player, x, y, radius, stacks, damage) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.stacks = stacks;
        this.damage = damage;
        this.life = 0.6;
        this.currentRadius = 0;
        this.hitList = [];
    }

    update(dt) {
        this.life -= dt;
        this.currentRadius += (this.maxRadius / 0.6) * dt;

        this.state.enemies.forEach(e => {
            if (!e.dead && !this.hitList.includes(e)) {
                if (dist2(this.x, this.y, e.x, e.y) < (this.currentRadius + e.r) ** 2) {
                    this.state.combatSystem.hit(e, this.damage, this.player, this.state);
                    this.hitList.push(e);
                }
            }
        });

        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const alpha = this.life / 0.6;

        ctx.save();
        
        // Outer ring
        ctx.strokeStyle = `rgba(215, 196, 138, ${alpha})`;
        ctx.lineWidth = 2 + this.stacks;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner fill
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, this.currentRadius);
        gradient.addColorStop(0, `rgba(196, 75, 75, ${alpha * 0.5})`);
        gradient.addColorStop(1, `rgba(196, 75, 75, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class DashTrail {
    constructor(start, end, stacks) {
        this.start = start;
        this.end = end;
        this.stacks = stacks;
        this.life = 0.4;
    }

    update(dt) {
        this.life -= dt;
        return this.life > 0;
    }

    draw(ctx, s) {
        const start = s(this.start.x, this.start.y);
        const end = s(this.end.x, this.end.y);
        const alpha = this.life / 0.4;
        const width = 2 + this.stacks * 1.5;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "rgba(200, 230, 255, 0.8)";
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        if (this.stacks > 2) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class HammerProjectile {
    constructor(state, player, cx, cy, initialAngle, isSalvo = false) {
        this.state = state;
        this.player = player;
        this.cx = cx;
        this.cy = cy;
        this.rad = BALANCE.player.hammer.startRadius;
        this.ang = initialAngle;
        this.isSalvo = isSalvo;
        this.damage = this.player.stats.dmg * BALANCE.player.hammer.damageMult;
        if (this.isSalvo) {
            this.ang += Math.PI;
        }
    }

    update(dt) {
        const hb = BALANCE.player.hammer;
        this.rad += hb.radialSpeed * dt;
        this.ang += hb.angularSpeed * dt * (this.isSalvo ? -1 : 1);

        const hx = this.cx + Math.cos(this.ang) * this.rad;
        const hy = this.cy + Math.sin(this.ang) * this.rad;

        this.state.enemies.forEach(e => {
            if (!e.dead && dist2(hx, hy, e.x, e.y) < (hb.hitRadius + e.r) ** 2) {
                this.state.combatSystem.hit(e, this.damage, this.player, this.state);
            }
        });

        return this.rad < hb.maxRadius;
    }

    draw(ctx, s) {
        const hb = BALANCE.player.hammer;
        const hx = this.cx + Math.cos(this.ang) * this.rad;
        const hy = this.cy + Math.sin(this.ang) * this.rad;
        const hc = s(hx, hy);
        const r = hb.hitRadius;

        const grad = ctx.createRadialGradient(hc.x, hc.y, 0, hc.x, hc.y, r * 1.5);
        grad.addColorStop(0, this.isSalvo ? "rgba(180, 220, 255, 0.8)" : "rgba(255, 240, 220, 0.8)");
        grad.addColorStop(0.7, this.isSalvo ? "rgba(100, 180, 255, 0.5)" : "rgba(232, 123, 123, 0.5)");
        grad.addColorStop(1, this.isSalvo ? "rgba(100, 180, 255, 0.0)" : "rgba(232, 123, 123, 0.0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(hc.x, hc.y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.isSalvo ? "#64b4ff" : "#e87b7b";
        ctx.beginPath();
        ctx.arc(hc.x, hc.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class Projectile {
    constructor(state, player, x, y, vx, vy, life, damage, pierce = 0, bounce = 0, isSalvo = false) {
        this.state = state;
        this.player = player;
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life;
        this.damage = damage;
        this.pierce = pierce; this.bounce = bounce; this.hitList = [];
        this.isSalvo = isSalvo;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
        // Collision
        for (let e of this.state.enemies) {
            if (!e.dead && !this.hitList.includes(e) && dist2(this.x, this.y, e.x, e.y) < (15 + e.r) ** 2) {
                this.state.combatSystem.hit(e, this.damage, this.player, this.state);
                this.hitList.push(e);
                if (this.pierce > 0) this.pierce--;
                else if (this.bounce > 0) {
                    this.bounce--;
                    let t = this.state.findTarget(e, this.x, this.y);
                    if (t) {
                        let a = Math.atan2(t.y - this.y, t.x - this.x);
                        let spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                        this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
                        this.hitList = [];
                    } else return false;
                } else return false;
            }
        }
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = this.isSalvo ? "#a0ebff" : "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 6.28);
        ctx.fill();
        if (this.isSalvo) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#a0ebff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, 6.28);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

export class EnemyProjectile {
    constructor(x, y, angle, isBuffed, level) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * BALANCE.projectiles.enemy.speed;
        this.vy = Math.sin(angle) * BALANCE.projectiles.enemy.speed;
        this.life = BALANCE.projectiles.enemy.life;
        this.isBuffed = isBuffed;
        this.level = level;
    }

    update(dt, state) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        const pl = state.game.p;
        if (dist2(this.x, this.y, pl.x, pl.y) < (pl.r + 5) ** 2) {
            state.combatSystem.onPlayerHit(this, state);
            let raw = (this.isBuffed ? BALANCE.projectiles.enemy.buffedDamage : BALANCE.projectiles.enemy.damage) + this.level;
            pl.takeDamage(raw, this);
            return false;
        }
        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 6.28);
        ctx.fill();
    }
}

export class Shockwave {
    constructor(state, player, x, y, dmg) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.r = 0; 
        this.dmg = dmg; 
        this.life = BALANCE.projectiles.shockwave.life; 
    }
    update(dt) {
        this.r += dt * BALANCE.projectiles.shockwave.speed; this.life -= dt;
        this.state.enemies.forEach(e => {
            if (dist2(this.x, this.y, e.x, e.y) < (this.r + e.r) ** 2 && !e.hitByWave) {
                this.state.combatSystem.hit(e, this.dmg, this.player, this.state);
                e.kb = 30; e.hitByWave = true;
            }
        });
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.strokeStyle = `rgba(255,100,100,${this.life * 2})`;
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, this.r, 0, 6.28); ctx.stroke();
    }
}

export class RootWave {
    constructor(state, x, y) { this.state = state; this.x = x; this.y = y; this.r = 0; this.life = BALANCE.projectiles.rootWave.life; }
    update(dt) {
        this.r += dt * BALANCE.projectiles.rootWave.speed; this.life -= dt;
        const p = this.state.game.p;
        if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2 && p.dashTimer <= 0) {
            this.state.combatSystem.rootPlayer(p, BALANCE.projectiles.rootWave.duration);
        }
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.strokeStyle = `rgba(255,255,255,${this.life * 2})`;
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, this.r, 0, 6.28); ctx.stroke();
    }
}

export class StaticMine {
    constructor(state, player, x, y, dmg) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.dmg = dmg; 
        this.life = BALANCE.projectiles.staticMine.life; 
    }
    update(dt) {
        this.life -= dt;
        this.state.enemies.forEach(e => {
            if (dist2(this.x, this.y, e.x, e.y) < BALANCE.projectiles.staticMine.radius ** 2) {
                this.state.combatSystem.hit(e, this.dmg * BALANCE.projectiles.staticMine.damageMultiplier * dt, this.player, this.state);
            }
        });
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = "#6baae0"; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
}

export class Wisp {
    constructor(state, player, x, y, dmg) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.dmg = dmg; 
        this.life = BALANCE.projectiles.wisp.life; 
        this.target = null; 
    }
    update(dt) {
        this.life -= dt;
        if (!this.target || this.target.dead) this.target = this.state.findTarget(null, this.x, this.y);
        if (this.target) {
            let angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * BALANCE.projectiles.wisp.speed * dt; this.y += Math.sin(angle) * BALANCE.projectiles.wisp.speed * dt;
            if (dist2(this.x, this.y, this.target.x, this.target.y) < 20 * 20) {
                this.state.combatSystem.hit(this.target, this.dmg * BALANCE.projectiles.wisp.damageMultiplier, this.player, this.state);
                return false;
            }
        } else {
            this.y -= 100 * dt;
        }
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = "#6b8cc4"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.28); ctx.fill(); }
}

export class Hazard {
    constructor(state, x, y, life) {
        this.state = state;
        this.x = x; this.y = y; this.life = life;
    }
    update(dt) {
        this.life -= dt;
        if (dist2(this.x, this.y, this.state.game.p.x, this.state.game.p.y) < (this.state.game.p.r + 5)**2) {
            this.state.combatSystem.onPlayerHit(this, this.state);
            this.state.game.p.takeDamage(BALANCE.projectiles.hazard.damage * dt, this);
        }
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = `rgba(255, 0, 0, ${this.life / 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, 6.28);
        ctx.fill();
    }
}

export class AegisPulse {
    constructor(state, player, x, y, radius, stacks, damage) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.stacks = stacks;
        this.damage = damage;
        this.life = 0.5; // Duration of the pulse visual
        this.currentRadius = 0;
        this.hitList = [];
    }

    update(dt) {
        this.life -= dt;
        this.currentRadius += (this.maxRadius / 0.5) * dt;

        this.state.enemies.forEach(e => {
            if (!e.dead && !this.hitList.includes(e)) {
                if (dist2(this.x, this.y, e.x, e.y) < (this.currentRadius + e.r) ** 2) {
                    this.state.combatSystem.hit(e, this.damage, this.player, this.state);
                    this.hitList.push(e);
                }
            }
        });

        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const alpha = this.life * 2; // Fade out
        
        ctx.save();
        ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring for higher stacks
        if (this.stacks > 1) {
            ctx.strokeStyle = `rgba(150, 200, 255, ${alpha * 0.7})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.currentRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Tiny shards
        const shardCount = 6 + this.stacks * 2;
        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2 + this.life * 5;
            const dist = this.currentRadius;
            const sx = p.x + Math.cos(angle) * dist;
            const sy = p.y + Math.sin(angle) * dist;
            
            ctx.fillStyle = `rgba(220, 240, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
