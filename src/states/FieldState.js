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
import { BALANCE } from '../data/Balance.js';
import { Phials } from '../data/Phials.js';
import ParticleSystem from '../systems/Particles.js';
import LootSystem from '../systems/LootSystem.js';

const WAVE_DURATION = BALANCE.waves.waveDuration;

const SPAWN_TABLE = {
    1: [{ type: 'walker', weight: 1, soulValue: 1 }],
    2: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 1, soulValue: 2 }],
    3: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 1, soulValue: 2 }],
    4: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 2, soulValue: 2 }, { type: 'anchor', weight: 1, soulValue: 5 }],
    5: [{ type: 'walker', weight: 2, soulValue: 1 }, { type: 'charger', weight: 2, soulValue: 2 }, { type: 'spitter', weight: 2, soulValue: 2 }, { type: 'anchor', weight: 2, soulValue: 5 }],
};

const PHIAL_ICONS = {
    ashenHalo: "🔆",
    soulSalvo: "➕",
    witchglassAegis: "🛡️",
    blindingStep: "✨",
    titheEngine: "🩸"
};

function drawPill(ctx, x, y, width, height, radius, text) {
    ctx.fillStyle = 'rgba(20,24,35,0.9)';
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, y + height / 2);
}

class FieldState extends State {
    constructor(game) {
        super(game);
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.pickups = [];
        this.chains = [];
        this.dungeonPortal = null;

        this.waveIndex = 1;
        this.waveTimer = WAVE_DURATION;
        this.waveElapsed = 0;
        this.spawnTimer = 0;

        this.killsThisWave = 0;
        this.soulGauge = 0;
        this.elitesToSpawn = 0;
        this.gaugeFlash = 0;
        
        this.soulGaugeThreshold = BALANCE.waves.baseSoulGaugeThreshold;
        this.showKillCounter = true;
        
        this.combatSystem = CombatSystem; // Expose CombatSystem to entities
    }

    enter() {
        console.log("Entering Field State");
        this.waveIndex = 1;
        this.waveTimer = WAVE_DURATION;
        this.waveElapsed = 0;
        this.spawnTimer = 0;

        this.killsThisWave = 0;
        this.soulGauge = 0;
        this.elitesToSpawn = 0;
        this.dungeonPortal = null;
        this.showKillCounter = true;
        this.pickups = [];
    }

    exit() {
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.pickups = [];
        this.chains = [];
        this.showKillCounter = false;
    }

    update(dt) {
        const p = this.game.p;

        if (this.gaugeFlash > 0) {
            this.gaugeFlash -= dt * 2;
        }

        // 1. UPDATE PLAYER (Handles input, physics, combat)
        p.update(dt, this, true);

        // 2. WAVE LOGIC
        this.waveTimer -= dt;
        this.waveElapsed += dt;

        if (this.waveTimer <= 0) {
            if (this.waveIndex < 5) {
                this.waveIndex++;
                this.waveTimer = WAVE_DURATION;
                this.waveElapsed = 0;
                this.spawnTimer = 0;
                this.killsThisWave = 0;

                this.soulGaugeThreshold =
                    BALANCE.waves.baseSoulGaugeThreshold +
                    BALANCE.waves.soulGaugeThresholdPerWave * (this.waveIndex - 1);
            } else if (!this.dungeonPortal) {
                this.dungeonPortal = new Interactable(p.x + 100, p.y, 50, 50, () => {
                    this.game.stateManager.switchState(new DungeonState(this.game));
                });
            }
        }

        // 3. SPAWN (ramping, capped per wave)
        const wavesCfg = BALANCE.waves;

        // Wave progress in [0, 1]
        const t = Math.max(0, Math.min(1, this.waveElapsed / wavesCfg.waveDuration));

        // Per-wave cap, clamped by global hard cap
        const waveCap = Math.min(
            wavesCfg.baseWaveEnemyCap + wavesCfg.enemyCapPerWave * (this.waveIndex - 1),
            wavesCfg.hardEnemyCap
        );

        // How many enemies we are allowed to add right now
        const active = this.enemies.length;
        const allowed = Math.max(0, waveCap - active);

        // Only bother if there is room
        if (allowed > 0) {
            // Spawn interval ramps from baseSpawnInterval -> minSpawnInterval over the wave
            const maxInterval = wavesCfg.baseSpawnInterval;
            const minInterval = wavesCfg.minSpawnInterval;
            const currentInterval = maxInterval + (minInterval - maxInterval) * t;

            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                // Batch size ramps up as the wave progresses
                const baseBatch = wavesCfg.baseBatchSize;
                const maxBatch = baseBatch + wavesCfg.batchSizeRamp;
                const batchSize = Math.round(baseBatch + (maxBatch - baseBatch) * t);

                const toSpawn = Math.min(allowed, batchSize);

                for (let i = 0; i < toSpawn; i++) {
                    this.spawnEnemy(); // normal enemies only; elites are handled separately
                }

                // Schedule next spawn tick
                this.spawnTimer += currentInterval;
            }
        } else {
            // If we're at cap, keep timer from spiraling negative
            this.spawnTimer = 0;
        }

        // 4. ENTITY UPDATES
        Telegraph.update(dt);
        ParticleSystem.update(dt);
        
        // Enemies
        this.enemies.forEach(e => e.update(dt, p, this)); // Keep passing 'this' for context
        this.enemies = this.enemies.filter(e => {
            if(e.dead) {
                this.onEnemyDeath(e);
                return false;
            }
            return true;
        });

        // Now process queued elite spawns *after* the filter reassigns this.enemies
        while (this.elitesToSpawn > 0) {
            this.spawnEnemy(true);
            this.elitesToSpawn--;
        }

        // Projectiles
        // Use a standard for loop to handle projectiles spawning other projectiles (like TitheExplosion)
        for (let i = 0; i < this.shots.length; i++) {
            const b = this.shots[i];
            if (!b.update(dt, this)) {
                this.shots.splice(i, 1);
                i--;
            }
        }

        // Drops
        this.drops = this.drops.filter(d => d.update(dt, p));
        this.souls = this.souls.filter(s => s.update(dt, p));
        this.pickups = this.pickups.filter(p => p.update(dt, this.game.p));
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
        this.pickups.forEach(p => p.draw(ctx, s));
        this.souls.forEach(o => {
            o.draw(ctx, s);
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
        ctx.lineWidth = 2;
        this.chains.forEach(c => {
            if (c.pts.length < 2) return;
            ctx.strokeStyle = c.isSalvo ? "#a0ebff" : "#fff";
            ctx.beginPath(); ctx.moveTo(s(c.pts[0].x, c.pts[0].y).x, s(c.pts[0].x, c.pts[0].y).y);
            ctx.lineTo(s(c.pts[1].x, c.pts[1].y).x, s(c.pts[1].x, c.pts[1].y).y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        this.shots.forEach(b => b.draw(ctx, s));
        ParticleSystem.render(ctx, s);

        // UI
        ctx.fillStyle = 'white'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`Wave: ${this.waveIndex} / 5`, w / 2, 30);
        ctx.fillText(`Time: ${Math.ceil(this.waveTimer)}`, w / 2, 60);
        ctx.textAlign = 'start';

        // Gauge
        const gaugeX = w / 2 - 100;
        const gaugeY = h - 30;
        ctx.fillStyle = 'purple'; ctx.fillRect(gaugeX, gaugeY, 200, 20);
        ctx.fillStyle = 'magenta'; ctx.fillRect(gaugeX, gaugeY, (this.soulGauge / this.soulGaugeThreshold) * 200, 20);
        if (this.gaugeFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.gaugeFlash})`;
            ctx.fillRect(gaugeX, gaugeY, 200, 20);
        }

        // Shard Counter
        const shardText = `SHARDS: ${p.phialShards}`;
        const textMetrics = ctx.measureText(shardText);
        drawPill(ctx, gaugeX - textMetrics.width - 30, gaugeY, textMetrics.width + 20, 20, 10, shardText);
        
        // Phial Icons
        const phialCount = p.phials.size;
        if (phialCount > 0) {
            const spacing = 30;
            const totalWidth = (phialCount - 1) * spacing;
            let iconX = (w / 2) - (totalWidth / 2);
            
            for (const [id, stacks] of p.phials) {
                const popTime = p.recentPhialGains.get(id) || 0;
                const scale = 1 + popTime * 0.5; // Pop effect
                const alpha = 0.5 + (1 - popTime) * 0.5;

                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.font = `${24 * scale}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(PHIAL_ICONS[id], iconX, gaugeY - 25);
                
                if (stacks > 1) {
                    ctx.font = '12px sans-serif';
                    ctx.fillStyle = 'white';
                    ctx.fillText(stacks, iconX + 10, gaugeY - 15);
                }
                
                ctx.restore();
                iconX += spacing;
            }
        }
    }

    onEnemyDeath(enemy) {
        const p = this.game.p;

        // Tell the player about the kill
        p.registerKill(enemy);

        this.souls.push(new Soul(enemy.x, enemy.y));
        if (enemy.isElite || Math.random() < 0.3) {
            this.drops.push(new Drop(enemy.x, enemy.y, LootSystem.loot()));
        }
        this.killsThisWave++;
        
        // --- Elite Spawning ---
        // Add to the soul gauge when an enemy dies.
        this.soulGauge += enemy.soulValue || 1;
        // If the gauge is full, queue an elite to spawn and reset the gauge.
        if (this.soulGauge >= this.soulGaugeThreshold) {
            this.soulGauge = 0;
            this.elitesToSpawn = (this.elitesToSpawn || 0) + 1;
            p.onGaugeFill(this);
            this.gaugeFlash = 1.0;
            console.log('Queued elite spawn, elitesToSpawn =', this.elitesToSpawn);
        }
    }

    spawnEnemy(isElite = false) {
        const p = this.game.p;
        let a = Math.random() * 6.28;
        let d = BALANCE.waves.spawnRadius;
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
}

export default FieldState;