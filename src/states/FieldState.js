import State from '../core/State.js';
import { dist2 } from "../core/Utils.js";
import { SLOTS } from "../data/Constants.js"; 
import { ITEMS } from "../data/Items.js";
import { LootDrop as Drop, SoulOrb as Soul } from "../entities/Pickups.js";
import { keys } from "../core/Input.js";
import UI from '../systems/UI.js';
import Interactable from '../entities/Interactable.js';
import DungeonState from './DungeonState.js';
import CombatSystem from '../systems/CombatSystem.js';
import Telegraph from '../systems/Telegraph.js';
import { Walker, Charger, Spitter, Anchor } from "../entities/Enemy.js";

const WAVE_DURATION = 60;

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
        this.dungeonPortal = null;

        this.waveIndex = 1;
        this.waveTimer = WAVE_DURATION;
        this.killsThisWave = 0;
        this.soulGauge = 0;
        this.soulGaugeThreshold = 10;
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
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.chains = [];
    }

    update(dt) {
        const p = this.game.p;

        // 1. UPDATE PLAYER (Handles input, physics, combat)
        p.update(dt, this, true);

        // 2. WAVE LOGIC
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            if (this.waveIndex < 5) {
                this.waveIndex++;
                this.waveTimer = WAVE_DURATION;
                this.killsThisWave = 0;
                this.soulGaugeThreshold = 10 * this.waveIndex;
            } else if (!this.dungeonPortal) {
                this.dungeonPortal = new Interactable(p.x + 100, p.y, 50, 50, () => {
                    this.game.stateManager.switchState(new DungeonState(this.game));
                });
            }
        }

        // 3. SPAWN
        const spawnRate = 1 + (this.waveIndex * 0.5);
        if (Math.random() < dt * spawnRate && this.enemies.length < 30) this.spawnEnemy();

        // 4. ENTITY UPDATES
        Telegraph.update(dt);
        
        // Enemies
        this.enemies.forEach(e => e.update(dt, p, this)); // Keep passing 'this' for context
        this.enemies = this.enemies.filter(e => {
            if(e.dead) {
                this.onEnemyDeath(e);
                return false;
            }
            return true;
        });

        // Projectiles
        let activeShots = [];
        this.shots.forEach(b => { if (b.update(dt, this)) activeShots.push(b); });
        this.shots = activeShots;

        // Drops
        this.drops = this.drops.filter(d => d.update(dt, p));
        this.souls = this.souls.filter(s => s.update(dt, p));
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });

        // Portal
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

        // Grid
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

        // Portal
        if (this.dungeonPortal) {
            let portalPos = s(this.dungeonPortal.x, this.dungeonPortal.y);
            ctx.fillStyle = 'purple';
            ctx.fillRect(portalPos.x, portalPos.y, 50, 50);
            if (this.dungeonPortal.checkInteraction(p)) {
                ctx.fillStyle = 'white'; ctx.font = '18px sans-serif';
                ctx.fillText("[F] Enter Dungeon", portalPos.x - 20, portalPos.y - 10);
            }
        }

        p.draw(ctx, s);

        // Chains
        ctx.lineWidth = 2; ctx.strokeStyle = "#a0ebff";
        this.chains.forEach(c => {
            if (c.pts.length < 2) return;
            ctx.beginPath(); ctx.moveTo(s(c.pts[0].x, c.pts[0].y).x, s(c.pts[0].x, c.pts[0].y).y);
            ctx.lineTo(s(c.pts[1].x, c.pts[1].y).x, s(c.pts[1].x, c.pts[1].y).y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        this.shots.forEach(b => b.draw(ctx, s));

        // UI
        ctx.fillStyle = 'white'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Wave: ${this.waveIndex} / 5`, w / 2, 30);
        ctx.fillText(`Time: ${Math.ceil(this.waveTimer)}`, w / 2, 60);
        ctx.textAlign = 'start';

        // Gauge
        ctx.fillStyle = 'purple'; ctx.fillRect(w / 2 - 100, h - 30, 200, 20);
        ctx.fillStyle = 'magenta'; ctx.fillRect(w / 2 - 100, h - 30, (this.soulGauge / this.soulGaugeThreshold) * 200, 20);
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
            case 'charger': enemy = new Charger(x, y, p.lvl, isElite); break;
            case 'spitter': enemy = new Spitter(x, y, p.lvl, isElite); break;
            case 'anchor': enemy = new Anchor(x, y, p.lvl, isElite); break;
            default: enemy = new Walker(x, y, p.lvl, isElite); break;
        }
        
        enemy.soulValue = chosenSpawn.soulValue * (isElite ? 3 : 1);
        this.enemies.push(enemy);
        CombatSystem.onEnemySpawn(enemy, this);
    }

    spawnElite() { this.spawnEnemy(true); }

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
        // Keep existing loot logic...
        // Copied from your source for completeness
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