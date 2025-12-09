// src/states/FieldState.js
import State from '../core/State.js';
import { RNG, dist2, lerp } from "../core/Utils.js";
import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp } from "../entities/Projectile.js";
import { LootDrop as Drop, SoulOrb as Soul } from "../entities/Pickups.js";
import { keys, mouse } from "../core/Input.js";
import UI from '../systems/UI.js';
import Interactable from '../entities/Interactable.js';
import DungeonState from './DungeonState.js';

class FieldState extends State {
    constructor(game) {
        super(game);
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.chains = [];
        this.atkCd = 0;
        this.hammerRad = 0;
        this.hammerAng = 0;
        this.vesselProgress = 0;
        this.dungeonPortal = null;
    }

    enter() {
        console.log("Entering Field State");
        this.vesselProgress = 0;
        this.dungeonPortal = null;
    }

    exit() {
        console.log("Exiting Field State");
        // Clean up all entities
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.chains = [];
    }

    update(dt) {
        const p = this.game.p;
        p.updatePerks(dt, this);

        // MOVEMENT
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

        // COMBAT
        if (this.atkCd > 0) this.atkCd -= dt;
        const w = p.gear.weapon;

        if (w && w.cls === "hammer") {
            if (mouse.down) {
                this.hammerRad = Math.min(100, this.hammerRad + dt * 300);
                this.runOrbit(dt);
            } else {
                if (this.hammerRad > 0) {
                    this.hammerRad -= dt * 400;
                    if (p.stats.singularity && this.hammerRad < 10 && this.hammerRad > 0) {
                        this.enemies.forEach(e => {
                            if (dist2(p.x, p.y, e.x, e.y) < 250 * 250) { e.vx += (p.x - e.x) * 3; e.vy += (p.y - e.y) * 3; }
                        });
                    }
                }
            }
            if (this.hammerRad > 20) {
                this.enemies.forEach(e => {
                    if (dist2(p.x, p.y, e.x, e.y) < 40 * 40 && e.iframes <= 0) {
                        this.hit(e, p.stats.dmg * 0.5);
                        e.vx += (e.x - p.x) * 5; e.vy += (e.y - p.y) * 5;
                        e.iframes = 0.5;
                    }
                });
            }
        }

        if (mouse.down && this.atkCd <= 0 && w) {
            let rate = 0.4 / (1 + p.stats.spd);
            if (w.cls === "pistol") { this.firePistol(); this.atkCd = rate; }
            else if (w.cls === "staff") { this.fireZap(); this.atkCd = rate * 1.5; }
        }

        // SPAWN
        if (Math.random() < dt && this.enemies.length < 30) this.spawnEnemy();

        // UPDATE ENTITIES
        this.enemies = this.enemies.filter(e => e.update(dt, p, this));

        let activeShots = [];
        this.shots.forEach(b => { if (b.update(dt, this)) activeShots.push(b); });
        this.shots = activeShots;

        this.drops = this.drops.filter(d => d.update(dt, p));
        this.souls = this.souls.filter(s => s.update(dt, p));
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });

        // Dungeon Portal Logic
        if (this.vesselProgress >= 100 && !this.dungeonPortal) {
            this.dungeonPortal = new Interactable(p.x + 100, p.y, 50, 50, () => {
                this.game.stateManager.switchState(new DungeonState(this.game));
            });
        }

        if (this.dungeonPortal && keys['KeyF'] && this.dungeonPortal.checkInteraction(p)) {
            this.dungeonPortal.onInteract();
        }
    }

    render(ctx) {
        const canvas = this.game.canvas;
        const w = canvas.width, h = canvas.height;
        const p = this.game.p;
        const s = (x, y) => ({ x: x - p.x + w / 2, y: y - p.y + h / 2 });

        ctx.fillStyle = "#080a10"; ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
        let ox = p.x % 50, oy = p.y % 50;
        ctx.beginPath();
        for (let x = 0; x < w; x += 50) { ctx.moveTo(x - ox, 0); ctx.lineTo(x - ox, h); }
        for (let y = 0; y < h; y += 50) { ctx.moveTo(0, y - oy); ctx.lineTo(w, y - oy); }
        ctx.stroke();

        this.drops.forEach(d => d.draw(ctx, s));

        this.souls.forEach(o => {
            let pos = s(o.x, o.y);
            ctx.fillStyle = "#d7c48a"; ctx.beginPath(); ctx.arc(pos.x, pos.y, 3, 0, 6.28); ctx.fill();
        });

        this.enemies.forEach(e => { ctx.save(); e.draw(ctx, s); ctx.restore(); });

        if (this.dungeonPortal) {
            let portalPos = s(this.dungeonPortal.x, this.dungeonPortal.y);
            ctx.fillStyle = 'purple';
            ctx.fillRect(portalPos.x, portalPos.y, 50, 50);
            if (this.dungeonPortal.checkInteraction(p)) {
                ctx.fillStyle = 'white';
                ctx.font = '18px sans-serif';
                ctx.fillText("[F] Enter Dungeon", portalPos.x - 20, portalPos.y - 10);
            }
        }

        let pc = s(p.x, p.y);
        ctx.fillStyle = "#6aae9d"; ctx.beginPath(); ctx.arc(pc.x, pc.y, 12, 0, 6.28); ctx.fill();
        if (this.hammerRad > 0) {
            let cnt = 1 + (p.stats.orbitBase || 0);
            for (let i = 0; i < cnt; i++) {
                let a = this.hammerAng + (i * 6.28 / cnt);
                ctx.fillStyle = "#e87b7b"; ctx.beginPath();
                ctx.arc(pc.x + Math.cos(a) * this.hammerRad, pc.y + Math.sin(a) * this.hammerRad, 8, 0, 6.28); ctx.fill();
            }
        }

        ctx.lineWidth = 2; ctx.strokeStyle = "#a0ebff";
        this.chains.forEach(c => {
            if (c.pts.length < 2) return;
            ctx.beginPath(); ctx.moveTo(s(c.pts[0].x, c.pts[0].y).x, s(c.pts[0].x, c.pts[0].y).y);
            ctx.lineTo(s(c.pts[1].x, c.pts[1].y).x, s(c.pts[1].x, c.pts[1].y).y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        this.shots.forEach(b => {
            if (b.draw) b.draw(ctx, s);
        });

        // UI for Soul Vessel
        ctx.fillStyle = 'purple';
        ctx.fillRect(w / 2 - 100, h - 30, 200, 20);
        ctx.fillStyle = 'magenta';
        ctx.fillRect(w / 2 - 100, h - 30, this.vesselProgress * 2, 20);
    }

    hit(e, dmg) {
        if (e.dead) return;
        const p = this.game.p;
        e.hp -= dmg; e.flash = 0.1;
        let a = Math.atan2(e.y - p.y, e.x - p.x);
        e.vx += Math.cos(a) * (p.stats.kb + 50);
        e.vy += Math.sin(a) * (p.stats.kb + 50);
        if (e.hp <= 0) { e.dead = true; this.onKill(e); }
    }

    onKill(e) {
        this.souls.push(new Soul(e.x, e.y));
        if (Math.random() < 0.3) {
            this.drops.push(new Drop(e.x, e.y, this.loot()));
        }
        this.game.p.giveXp(10);
        this.vesselProgress = Math.min(100, this.vesselProgress + 1);
    }

    spawnEnemy() {
        const p = this.game.p;
        let a = Math.random() * 6.28;
        let d = 450;
        let isDash = Math.random() < 0.2;
        this.enemies.push({
            x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: 0, vy: 0,
            hp: 20 + p.lvl * 5, hpMax: 20 + p.lvl * 5, r: 12, type: isDash ? 1 : 0,
            flash: 0, iframes: 0, dead: false,
            state: 0, timer: 0,
            update(dt, pl, fieldState) {
                if (this.dead) return false;
                this.flash -= dt; this.iframes -= dt;

                if (!(this.type === 1 && this.state === 2)) {
                    this.vx *= 0.92; this.vy *= 0.92;
                }
                this.x += this.vx * dt; this.y += this.vy * dt;

                let dx = pl.x - this.x, dy = pl.y - this.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1) dist = 1;

                if (this.type === 1) { // Dasher
                    if (this.state === 0) { // Chase
                        this.vx += (dx / dist) * 2000 * dt; this.vy += (dy / dist) * 2000 * dt;
                        if (dist < 180) { this.state = 1; this.timer = 0.6; }
                    } else if (this.state === 1) { // Charge
                        this.vx *= 0.5; this.vy *= 0.5; this.timer -= dt;
                        if (this.timer <= 0) {
                            this.state = 2; this.timer = 0.4;
                            let ang = Math.atan2(dy, dx);
                            this.vx = Math.cos(ang) * 800; this.vy = Math.sin(ang) * 800;
                        }
                    } else { // Dash
                        this.timer -= dt; if (this.timer <= 0) this.state = 0;
                    }
                } else { // Grunt
                    this.vx += (dx / dist) * 1500 * dt; this.vy += (dy / dist) * 1500 * dt;
                }

                if (dist < 20) {
                    let raw = 5 + pl.lvl;
                    pl.hp -= raw * dt;
                    if (pl.hp <= 0) {
                        pl.hp = 0;
                        fieldState.game.active = false;
                        document.getElementById('screen_death').classList.add('active');
                        document.getElementById('deathSouls').innerText = pl.souls;
                        document.getElementById('deathLvl').innerText = pl.lvl;
                    }
                    UI.dirty = true;
                }
                return true;
            },
            draw(ctx, s) {
                let p = s(this.x, this.y);
                ctx.translate(p.x, p.y);
                if (this.flash > 0) ctx.fillStyle = "#fff";
                else ctx.fillStyle = this.type === 1 ? (this.state === 1 ? "#fff" : "#a0f") : "#c44e4e";

                if (this.type === 1) { ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-8, 8); ctx.lineTo(-8, -8); ctx.fill(); }
                else { ctx.beginPath(); ctx.arc(0, 0, 12, 0, 6.28); ctx.fill(); }

                ctx.fillStyle = "#000"; ctx.fillRect(-10, -20, 20, 4);
                ctx.fillStyle = "#0f0"; ctx.fillRect(-10, -20, 20 * (this.hp / this.hpMax), 4);
                ctx.translate(-p.x, -p.y);
            }
        });
    }

    findTarget(exclude, x, y) {
        let t = null, min = 400 * 400;
        let ox = x || this.game.p.x, oy = y || this.game.p.y;
        this.enemies.forEach(e => {
            if (e !== exclude && !e.dead) {
                let d = dist2(ox, oy, e.x, e.y);
                if (d < min) { min = d; t = e; }
            }
        });
        return t;
    }

    loot(forceType) {
        try {
            const type = forceType || SLOTS[Math.floor(Math.random() * SLOTS.length)];
            const pool = ITEMS[type];
            if (!pool) throw "No pool";
            const tpl = pool[Math.floor(Math.random() * pool.length)];
            const rVal = Math.random();
            let rarity = "common", m = 1;
            if (rVal < 0.05) { rarity = "legendary"; m = 2.5; }
            else if (rVal < 0.15) { rarity = "epic"; m = 1.8; }
            else if (rVal < 0.30) { rarity = "rare"; m = 1.4; }
            else if (rVal < 0.60) { rarity = "uncommon"; m = 1.2; }
            let stats = {};
            for (let k in tpl.stats) stats[k] = Math.ceil(tpl.stats[k] * m);
            return { id: Math.random().toString(36), type, name: tpl.base, rarity, stats, cls: tpl.cls };
        } catch (e) { return { id: "err", type: "trinket", name: "Scrap", rarity: "common", stats: {} }; }
    }

    runOrbit(dt) {
        const p = this.game.p;
        const cnt = 1 + (p.stats.orbitBase || 0);
        this.hammerAng += dt * 5;
        for (let i = 0; i < cnt; i++) {
            let a = this.hammerAng + (i * 6.28 / cnt);
            let ox = p.x + Math.cos(a) * this.hammerRad;
            let oy = p.y + Math.sin(a) * this.hammerRad;
            this.enemies.forEach(e => {
                if (!e.dead && dist2(ox, oy, e.x, e.y) < (15 + e.r) ** 2 && e.iframes <= 0) {
                    this.hit(e, p.stats.dmg * 0.6); e.iframes = 0.2;
                }
            });
        }
    }

    firePistol() {
        const p = this.game.p;
        const w = this.game.screenToWorld(mouse.x, mouse.y);
        const a = Math.atan2(w.y - p.y, w.x - p.x);
        this.shots.push(new Proj(this,
            p.x, p.y, Math.cos(a) * 700, Math.sin(a) * 700, 1.5, p.stats.hexPierce || 0, p.stats.hexBounce || 0
        ));
    }

    fireZap() {
        const p = this.game.p;
        const maxChains = 1 + (p.stats.chainCount || 0);
        const range = 250 * (1 + (p.stats.chainJump || 0));
        let curr = { x: p.x, y: p.y };
        let visited = new Set();

        for (let i = 0; i < maxChains; i++) {
            let best = null, bestDist = range * range;
            this.enemies.forEach(e => {
                if (e.dead || visited.has(e)) return;
                let d = dist2(curr.x, curr.y, e.x, e.y);
                if (d < bestDist) { bestDist = d; best = e; }
            });

            if (best) {
                visited.add(best);
                this.hit(best, p.stats.dmg);
                this.chains.push({ t: 0.15, pts: [{ x: curr.x, y: curr.y }, { x: best.x, y: best.y }] });
                curr = best;
            } else break;
        }
    }
}

export default FieldState;
