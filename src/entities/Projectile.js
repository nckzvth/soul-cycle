import { dist2 } from "../core/Utils.js";
import CombatSystem from "../systems/CombatSystem.js"; // Import CombatSystem

export class Projectile {
    constructor(state, x, y, vx, vy, life, pierce = 0, bounce = 0) {
        this.state = state;
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life;
        this.pierce = pierce; this.bounce = bounce; this.hitList = [];
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
        // Collision
        for (let e of this.state.enemies) {
            if (!e.dead && !this.hitList.includes(e) && dist2(this.x, this.y, e.x, e.y) < (15 + e.r) ** 2) {
                // Call CombatSystem.hit instead of this.state.hit
                CombatSystem.hit(e, this.state.game.p.stats.dmg, this.state.game.p, this.state);
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
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill(); }
}

export class Shockwave {
    constructor(state, x, y, dmg) { this.state = state; this.x = x; this.y = y; this.r = 0; this.dmg = dmg; this.life = 0.5; }
    update(dt) {
        this.r += dt * 400; this.life -= dt;
        this.state.enemies.forEach(e => {
            if (dist2(this.x, this.y, e.x, e.y) < (this.r + e.r) ** 2 && !e.hitByWave) {
                // Call CombatSystem.hit instead of this.state.hit
                CombatSystem.hit(e, this.dmg, this.state.game.p, this.state);
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

export class StaticMine {
    constructor(state, x, y, dmg) { this.state = state; this.x = x; this.y = y; this.dmg = dmg; this.life = 3.0; }
    update(dt) {
        this.life -= dt;
        this.state.enemies.forEach(e => {
            if (dist2(this.x, this.y, e.x, e.y) < 25 * 25) {
                // Call CombatSystem.hit instead of this.state.hit
                CombatSystem.hit(e, this.dmg * 3 * dt, this.state.game.p, this.state);
            }
        });
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = "#6baae0"; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
}

export class Wisp {
    constructor(state, x, y, dmg) { this.state = state; this.x = x; this.y = y; this.dmg = dmg; this.life = 4.0; this.target = null; }
    update(dt) {
        this.life -= dt;
        if (!this.target || this.target.dead) this.target = this.state.findTarget(null, this.x, this.y);
        if (this.target) {
            let angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * 350 * dt; this.y += Math.sin(angle) * 350 * dt;
            if (dist2(this.x, this.y, this.target.x, this.target.y) < 20 * 20) {
                // Call CombatSystem.hit instead of this.state.hit
                CombatSystem.hit(this.target, this.dmg * 1.5, this.state.game.p, this.state);
                return false;
            }
        } else {
            this.y -= 100 * dt;
        }
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = "#6b8cc4"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.28); ctx.fill(); }
}
