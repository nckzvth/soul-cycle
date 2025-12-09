// src/states/DungeonState.js
import State from '../core/State.js';
import TownState from './TownState.js';
import Boss from '../entities/Boss.js';
import Interactable from '../entities/Interactable.js';
import { keys, mouse } from '../core/Input.js';
import { dist2 } from '../core/Utils.js';
import { Projectile as Proj } from '../entities/Projectile.js';
import UI from '../systems/UI.js';

class DungeonState extends State {
    constructor(game) {
        super(game);
        this.boss = new Boss(400, 200);
        this.enemies = [this.boss];
        this.shots = []; // For all projectiles in the scene
        this.townPortal = null;
        this.atkCd = 0;
        this.hammerRad = 0;
        this.hammerAng = 0;
        this.chains = [];
    }

    enter() {
        console.log("Entering Dungeon State");
        this.game.p.x = 400;
        this.game.p.y = 500;
        this.boss = new Boss(400, 200);
        this.enemies = [this.boss];
        this.shots = [];
        this.townPortal = null;
    }

    update(dt) {
        const p = this.game.p;
        p.updatePerks(dt, this);

        // Player movement
        let mx = 0, my = 0;
        if (keys["KeyW"]) my--; if (keys["KeyS"]) my++;
        if (keys["KeyA"]) mx--; if (keys["KeyD"]) mx++;

        if (p.dashTimer > 0) {
            p.dashTimer -= dt;
            p.x += p.dashVec.x * 800 * dt;
            p.y += p.dashVec.y * 800 * dt;
        } else {
            if (mx || my) {
                let l = Math.sqrt(mx * mx + my * my);
                mx /= l; my /= l;
            }
            if (keys["Space"] && p.sta >= 20 && (mx || my)) {
                p.sta -= 20; p.dashTimer = 0.2; p.dashVec = { x: mx, y: my };
            } else {
                let spd = 180 * (1 + p.stats.move);
                p.x += mx * spd * dt; p.y += my * spd * dt;
            }
        }
        p.sta = Math.min(100, p.sta + dt * 15);

        // Keep player within bounds
        p.x = Math.max(12, Math.min(788, p.x));
        p.y = Math.max(12, Math.min(588, p.y));

        // Update boss and projectiles
        if (!this.boss.dead) {
            this.boss.update(dt, p, this);
        }
        this.shots = this.shots.filter(s => s.update(dt, this));
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });


        // Player attacks
        if (this.atkCd > 0) this.atkCd -= dt;
        const w = p.gear.weapon;

        if (w && w.cls === "hammer") {
            if (mouse.down) {
                this.hammerRad = Math.min(100, this.hammerRad + dt * 300);
                this.runOrbit(dt);
            } else {
                if (this.hammerRad > 0) this.hammerRad -= dt * 400;
            }
            if (this.hammerRad > 20) {
                if (!this.boss.dead && dist2(p.x, p.y, this.boss.x, this.boss.y) < (this.boss.r + 20)**2) {
                    this.hit(this.boss, p.stats.dmg * 0.5);
                }
            }
        }

        if (mouse.down && this.atkCd <= 0 && w) {
            let rate = 0.4 / (1 + p.stats.spd);
            if (w.cls === "pistol") { this.firePistol(); this.atkCd = rate; }
            else if (w.cls === "staff") { this.fireZap(); this.atkCd = rate * 1.5; }
        }


        // Portal interaction
        if (this.townPortal && keys['KeyF'] && this.townPortal.checkInteraction(p)) {
            this.townPortal.onInteract();
        }
    }

    hit(target, dmg) {
        if (target.dead) return;
        target.hp -= dmg;
        target.flash = 0.1;
        if (target.hp <= 0) {
            target.dead = true;
            if (target === this.boss) {
                this.onBossDeath();
            }
        }
    }

    onBossDeath() {
        console.log("Boss defeated!");
        this.townPortal = new Interactable(this.boss.x, this.boss.y, 50, 50, () => {
            this.game.stateManager.switchState(new TownState(this.game));
        });
    }

    findTarget(exclude) {
        if (!this.boss.dead && this.boss !== exclude) {
            return this.boss;
        }
        return null;
    }

    firePistol() {
        const p = this.game.p;
        const w = this.game.screenToWorld(mouse.x, mouse.y);
        const a = Math.atan2(w.y - p.y, w.x - p.x);
        // Note: Pistol shots in dungeon don't have pierce/bounce logic from field
        this.shots.push(new Proj(this, p.x, p.y, Math.cos(a) * 700, Math.sin(a) * 700, 1.5));
    }

    fireZap() {
        const p = this.game.p;
        if (this.boss.dead) return;
        this.hit(this.boss, p.stats.dmg);
        this.chains.push({ t: 0.15, pts: [{ x: p.x, y: p.y }, { x: this.boss.x, y: this.boss.y }] });
    }
    
    runOrbit(dt) {
        const p = this.game.p;
        this.hammerAng += dt * 5;
        let a = this.hammerAng;
        let ox = p.x + Math.cos(a) * this.hammerRad;
        let oy = p.y + Math.sin(a) * this.hammerRad;
        if (!this.boss.dead && dist2(ox, oy, this.boss.x, this.boss.y) < (15 + this.boss.r) ** 2) {
            this.hit(this.boss, p.stats.dmg * 0.6);
        }
    }


    render(ctx) {
        const p = this.game.p;
        const canvas = this.game.canvas;
        const w = canvas.width;
        const h = canvas.height;

        // The dungeon is a fixed screen, no camera scroll
        const s = (x, y) => ({ x, y });

        ctx.fillStyle = '#4a2a5a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'white';
        ctx.strokeRect(0, 0, w, h);

        if (!this.boss.dead) {
            this.boss.draw(ctx, s);
        }

        this.shots.forEach(shot => shot.draw(ctx, s));
        
        ctx.lineWidth = 2; ctx.strokeStyle = "#a0ebff";
        this.chains.forEach(c => {
            if (c.pts.length < 2) return;
            ctx.beginPath(); ctx.moveTo(s(c.pts[0].x, c.pts[0].y).x, s(c.pts[0].x, c.pts[0].y).y);
            ctx.lineTo(s(c.pts[1].x, c.pts[1].y).x, s(c.pts[1].x, c.pts[1].y).y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });


        // Draw Player
        let pc = s(p.x, p.y);
        ctx.fillStyle = "#6aae9d";
        ctx.beginPath();
        ctx.arc(pc.x, pc.y, 12, 0, 6.28);
        ctx.fill();
        
        if (this.hammerRad > 0) {
            let a = this.hammerAng;
            ctx.fillStyle = "#e87b7b"; ctx.beginPath();
            ctx.arc(pc.x + Math.cos(a) * this.hammerRad, pc.y + Math.sin(a) * this.hammerRad, 8, 0, 6.28); ctx.fill();
        }


        if (this.townPortal) {
            this.townPortal.draw(ctx);
            if (this.townPortal.checkInteraction(p)) {
                ctx.fillStyle = 'white';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("[F] to return to Town", w / 2, h - 50);
                ctx.textAlign = 'start';
            }
        }

        // Boss HP Bar
        if (!this.boss.dead) {
            ctx.fillStyle = 'red';
            ctx.fillRect(w / 2 - 250, 20, 500 * (this.boss.hp / this.boss.hpMax), 20);
            ctx.strokeStyle = 'white';
            ctx.strokeRect(w / 2 - 250, 20, 500, 20);
        }
    }
}

export default DungeonState;
