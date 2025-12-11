// src/states/FieldState.js
import State from '../core/State.js';
import { RNG, dist2, lerp } from "../core/Utils.js";
import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";
import { LootDrop as Drop, SoulOrb as Soul } from "../entities/Pickups.js";
import { keys, mouse } from "../core/Input.js";
import UI from '../systems/UI.js';
import Interactable from '../entities/Interactable.js';
import DungeonState from './DungeonState.js';
import CombatSystem from '../systems/CombatSystem.js';
import Telegraph from '../systems/Telegraph.js';
import { Walker, Charger, Spitter, Anchor } from "../entities/Enemy.js";

const WAVE_DURATION = 60; // 60 seconds per wave

const SPAWN_TABLE = {
    1: [{ type: 'walker', weight: 1, soulValue: 1 }],
    2: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 1, soulValue: 2 }],
    3: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 1, soulValue: 2 }],
    4: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 2, soulValue: 2 }, { type: 'anchor', weight: 1, soulValue: 5 }],
    5: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 2, soulValue: 2 }, { type: 'anchor', weight: 2, soulValue: 5 }],
};

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
        this.dungeonPortal = null;

        // Wave properties
        this.waveIndex = 1;
        this.waveTimer = WAVE_DURATION;
        this.killsThisWave = 0;
        this.soulGauge = 0;
        this.soulGaugeThreshold = 10; // Initial threshold
    }

    enter() {
        console.log("Entering Field State");
        this.waveIndex = 1;
        this.waveTimer = WAVE_DURATION;
        this.killsThisWave = 0;
        this.soulGauge = 0;
        this.soulGaugeThreshold = 10;
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
        if (p.rooted > 0) {
            p.rooted -= dt;
        } else {
            p.updatePerks(dt, this);
        }

        // Wave logic
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            if (this.waveIndex < 5) {
                this.waveIndex++;
                this.waveTimer = WAVE_DURATION;
                this.killsThisWave = 0;
                // Increase threshold based on wave index
                this.soulGaugeThreshold = 10 * this.waveIndex;
            } else if (!this.dungeonPortal) {
                this.dungeonPortal = new Interactable(p.x + 100, p.y, 50, 50, () => {
                    this.game.stateManager.switchState(new DungeonState(this.game));
                });
            }
        }

        // MOVEMENT
        let mx = 0, my = 0;
        if (p.rooted <= 0) {
            if (keys["KeyW"]) my--; if (keys["KeyS"]) my++;
            if (keys["KeyA"]) mx--; if (keys["KeyD"]) mx++;
        }


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
                CombatSystem.runOrbit(p, this, dt);
            } else {
                if (this.hammerRad > 0) {
                    this.hammerRad -= dt * 400;
                    if (p.stats.singularity && this.hammerRad < 10 && this.hammerRad > 0) {
                        this.enemies.forEach(e => {
                            if (!e.dead && dist2(p.x, p.y, e.x, e.y) < 250 * 250) {
                                e.vx += (p.x - e.x) * 3; e.vy += (p.y - e.y) * 3;
                            }
                        });
                    }
                }
            }
        }

        if (mouse.down && this.atkCd <= 0 && w) {
            let rate = 0.4 / (1 + p.stats.spd);
            if (w.cls === "pistol") { CombatSystem.firePistol(p, this); this.atkCd = rate; }
            else if (w.cls === "staff") { CombatSystem.fireZap(p, this); this.atkCd = rate * 1.5; }
        }

        // SPAWN
        const spawnRate = 1 + (this.waveIndex * 0.5);
        if (Math.random() < dt * spawnRate && this.enemies.length < 30) this.spawnEnemy();

        // UPDATE ENTITIES
        Telegraph.update(dt);
        this.enemies.forEach(e => e.update(dt, p, this));
        this.enemies.forEach(e => {
            if (e.dead) this.onEnemyDeath(e);
        });
        this.enemies = this.enemies.filter(e => !e.dead);


        let activeShots = [];
        this.shots.forEach(b => { if (b.update(dt, this)) activeShots.push(b); });
        this.shots = activeShots;

        this.drops = this.drops.filter(d => d.update(dt, p));
        this.souls = this.souls.filter(s => s.update(dt, p));
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });

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

        Telegraph.render(ctx, s);

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

        // Wave UI
        ctx.fillStyle = 'white';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Wave: ${this.waveIndex} / 5`, w / 2, 30);
        ctx.fillText(`Time: ${Math.ceil(this.waveTimer)}`, w / 2, 60);
        ctx.textAlign = 'start';

        // Soul Gauge
        ctx.fillStyle = 'purple';
        ctx.fillRect(w / 2 - 100, h - 30, 200, 20);
        ctx.fillStyle = 'magenta';
        ctx.fillRect(w / 2 - 100, h - 30, (this.soulGauge / this.soulGaugeThreshold) * 200, 20);
    }

    onEnemyDeath(enemy) {
        this.souls.push(new Soul(enemy.x, enemy.y));
        if (enemy.isElite || Math.random() < 0.3) {
            this.drops.push(new Drop(enemy.x, enemy.y, this.loot()));
        }
        this.game.p.giveXp(10 * (enemy.isElite ? 3 : 1));
        this.killsThisWave++;
        this.soulGauge += enemy.soulValue || 1;
        if (this.soulGauge >= this.soulGaugeThreshold) {
            this.soulGauge = 0;
            this.spawnElite();
        }
    }

    spawnEnemy(isElite = false) {
        const p = this.game.p;
        let a = Math.random() * 6.28;
        let d = 450;
        let x = p.x + Math.cos(a) * d;
        let y = p.y + Math.sin(a) * d;

        const waveSpawns = SPAWN_TABLE[this.waveIndex];
        const totalWeight = waveSpawns.reduce((acc, s) => acc + s.weight, 0);
        let rand = Math.random() * totalWeight;
        let chosenSpawn;
        for (const spawn of waveSpawns) {
            rand -= spawn.weight;
            if (rand <= 0) {
                chosenSpawn = spawn;
                break;
            }
        }

        let enemy;
        switch (chosenSpawn.type) {
            case 'charger':
                enemy = new Charger(x, y, p.lvl, isElite);
                break;
            case 'spitter':
                enemy = new Spitter(x, y, p.lvl, isElite);
                break;
            case 'anchor':
                enemy = new Anchor(x, y, p.lvl, isElite);
                break;
            default: // walker
                enemy = new Walker(x, y, p.lvl, isElite);
                break;
        }
        
        enemy.soulValue = chosenSpawn.soulValue * (isElite ? 3 : 1);
        this.enemies.push(enemy);
        CombatSystem.onEnemySpawn(enemy, this);
    }

    spawnElite() {
        this.spawnEnemy(true);
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
}

export default FieldState;
