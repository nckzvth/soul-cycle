import State from '../core/State.js';
import { dist2 } from "../core/Utils.js";
import { SLOTS } from "../data/Constants.js"; 
import { ITEMS } from "../data/Items.js";
import { LootDrop as Drop, SoulOrb as Soul, PhialShard } from "../entities/Pickups.js";
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
        this.game = game;
        this.p = game.p;
        this.combatSystem = CombatSystem;
        this.reset();
    }

    reset() {
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.pickups = [];
        this.chains = [];
        this.dungeonPortal = null;

        this.waveIndex = 0;
        this.waveTimer = 0;
        this.waveElapsed = 0;
        
        this.killsThisFrame = 0;
        this.killRateEMA = 0;
        this.killTimer = 0;

        this.directorCredit = 0;
        this.eventQueue = [];
        this.activeEvents = [];

        this.soulGauge = 0;
        this.elitesToSpawn = 0;
        this.gaugeFlash = 0;
        this.soulGaugeThreshold = BALANCE.waves.baseSoulGaugeThreshold;
    }

    enter() {
        console.log("Entering Field State");
        this.reset();
        this.startNextWave();
        this.p.activeOrbitalWisps = 0;
        UI.updateLevelUpPrompt();
    }

    exit() {
        this.reset();
    }

    startNextWave() {
        this.waveIndex++;
        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];
        if (!waveConfig) {
            // Last wave cleared
            if (!this.dungeonPortal) {
                this.dungeonPortal = new Interactable(this.p.x + 100, this.p.y, 50, 50, () => {
                    this.game.stateManager.switchState(new DungeonState(this.game));
                });
            }
            return;
        }

        this.waveTimer = waveConfig.duration;
        this.waveElapsed = 0;
        
        this.directorCredit = 0;
        this.eventQueue = [...waveConfig.events.map(e => ({ ...e, credit: 0 }))];
        this.activeEvents = [];

        this.soulGaugeThreshold =
            BALANCE.waves.baseSoulGaugeThreshold +
            BALANCE.waves.soulGaugeThresholdPerWave * (this.waveIndex - 1);
    }

    update(dt) {
        // --- Timers & State ---
        this.p.update(dt, this, true);
        if (this.gaugeFlash > 0) this.gaugeFlash -= dt * 2;
        this.waveTimer -= dt;
        this.waveElapsed += dt;

        // Kill Rate Calculation (EMA)
        this.killTimer += dt;
        if (this.killTimer >= 1.0) {
            const alpha = BALANCE.waves.director.emaAlpha;
            this.killRateEMA = alpha * this.killsThisFrame + (1 - alpha) * this.killRateEMA;
            this.killsThisFrame = 0;
            this.killTimer -= 1.0;
        }

        // Wave Progression
        if (this.waveTimer <= 0) {
            this.startNextWave();
        }

        // --- Spawning System ---
        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];
        const hardCap = BALANCE.waves.hardEnemyCap;
        const alive = this.enemies.length;

        // 1. Process Event Queue -> Active Events
        for (let i = this.eventQueue.length - 1; i >= 0; i--) {
            const event = this.eventQueue[i];
            if (this.waveElapsed >= event.delay) {
                this.activeEvents.push(event);
                this.eventQueue.splice(i, 1);
            }
        }

        // 2. Spawn from Active Events
        for (let i = this.activeEvents.length - 1; i >= 0; i--) {
            const event = this.activeEvents[i];
            event.credit += event.rate * dt;
            while (event.credit >= 1 && event.count > 0 && this.enemies.length < hardCap) {
                this.spawnEnemy(event.type);
                event.credit -= 1;
                event.count--;
            }
            if (event.count <= 0) {
                this.activeEvents.splice(i, 1);
            }
        }

        // 3. Spawn from Ambient Director
        if (waveConfig) {
            const { baseAlive, bufferSeconds, maxAlive } = waveConfig;
            const desired = Math.min(baseAlive + this.killRateEMA * bufferSeconds, maxAlive);
            const missing = desired - alive;

            if (missing > 0) {
                this.directorCredit += BALANCE.waves.director.fillRate * dt;
                while (this.directorCredit >= 1 && this.enemies.length < hardCap && this.enemies.length < desired) {
                    this.spawnEnemy(); // Spawn ambient enemy
                    this.directorCredit -= 1;
                }
            }
        }
        
        // --- Entity Updates ---
        Telegraph.update(dt);
        ParticleSystem.update(dt);
        // Reset per-frame buff state; Anchors re-apply during enemy updates and it must persist into shot updates.
        this.enemies.forEach(e => {
            e.isBuffed = false;
            if (e.stats) e.stats.damageTakenMult = 1.0;
        });
        
        this.enemies.forEach(e => e.update(dt, this.p, this));
        this.enemies = this.enemies.filter(e => {
            if(e.dead) {
                this.onEnemyDeath(e);
                return false;
            }
            return true;
        });

        while (this.elitesToSpawn > 0 && this.enemies.length < hardCap) {
            this.spawnEnemy(null, true);
            this.elitesToSpawn--;
        }

        for (let i = 0; i < this.shots.length; i++) {
            if (!this.shots[i].update(dt, this)) {
                this.shots.splice(i, 1);
                i--;
            }
        }

        this.drops = this.drops.filter(d => d.update(dt, this.p));
        this.souls = this.souls.filter(s => s.update(dt, this.p));
        this.pickups = this.pickups.filter(p => p.update(dt, this.game.p));
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });

        if (this.dungeonPortal && keys['KeyF'] && this.dungeonPortal.checkInteraction(this.p)) {
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
        this.souls.forEach(o => o.draw(ctx, s));
        this.enemies.forEach(e => { ctx.save(); e.draw(ctx, s); ctx.restore(); });

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

        ctx.lineWidth = 2;
        this.chains.forEach(c => {
            if (c.pts.length < 2) return;
            ctx.strokeStyle = c.color ?? (c.isSalvo ? "#a0ebff" : "#fff");
            ctx.beginPath(); ctx.moveTo(s(c.pts[0].x, c.pts[0].y).x, s(c.pts[0].x, c.pts[0].y).y);
            ctx.lineTo(s(c.pts[1].x, c.pts[1].y).x, s(c.pts[1].x, c.pts[1].y).y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        this.shots.forEach(b => b.draw(ctx, s));
        ParticleSystem.render(ctx, s);

        // UI
        ctx.fillStyle = 'white'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];
        if (waveConfig) {
            ctx.fillText(`Wave: ${this.waveIndex} / ${BALANCE.waves.sequence.length}`, w / 2, 30);
            ctx.fillText(`Time: ${Math.ceil(this.waveTimer)}`, w / 2, 60);
        } else {
            ctx.fillText(`All waves cleared!`, w / 2, 30);
        }
        ctx.textAlign = 'start';

        const gaugeX = w / 2 - 100;
        const gaugeY = h - 30;
        ctx.fillStyle = 'purple'; ctx.fillRect(gaugeX, gaugeY, 200, 20);
        ctx.fillStyle = 'magenta'; ctx.fillRect(gaugeX, gaugeY, (this.soulGauge / this.soulGaugeThreshold) * 200, 20);
        if (this.gaugeFlash > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.gaugeFlash})`;
            ctx.fillRect(gaugeX, gaugeY, 200, 20);
        }

        const shardText = `SHARDS: ${p.phialShards}`;
        const textMetrics = ctx.measureText(shardText);
        drawPill(ctx, gaugeX - textMetrics.width - 30, gaugeY, textMetrics.width + 20, 20, 10, shardText);
        
        const phialCount = p.phials.size;
        if (phialCount > 0) {
            const spacing = 30;
            const totalWidth = (phialCount - 1) * spacing;
            let iconX = (w / 2) - (totalWidth / 2);
            
            for (const [id, stacks] of p.phials) {
                const popTime = p.recentPhialGains.get(id) || 0;
                const scale = 1 + popTime * 0.5;
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
        this.p.registerKill(enemy);
        this.killsThisFrame++;
        this.souls.push(new Soul(enemy.x, enemy.y));
        if (enemy.isElite) {
            this.pickups.push(new PhialShard(enemy.x, enemy.y));
        }
        if (enemy.isElite || Math.random() < 0.3) {
            this.drops.push(new Drop(enemy.x, enemy.y, LootSystem.loot()));
        }
        
        this.soulGauge += enemy.soulValue || 1;
        if (this.soulGauge >= this.soulGaugeThreshold) {
            this.soulGauge = 0;
            this.elitesToSpawn++;
            this.p.onGaugeFill(this);
            this.gaugeFlash = 1.0;
        }
    }

    getSpawnPosition() {
        const p = this.p;
        const { minSpawnRadius, maxSpawnRadius, viewportMargin } = BALANCE.waves;
        const { width, height } = this.game.canvas;

        const view = {
            left: p.x - width / 2 - viewportMargin,
            right: p.x + width / 2 + viewportMargin,
            top: p.y - height / 2 - viewportMargin,
            bottom: p.y + height / 2 + viewportMargin,
        };

        let x, y;
        for (let i = 0; i < 10; i++) { // Max 10 attempts to find off-screen pos
            const a = Math.random() * 2 * Math.PI;
            const d = minSpawnRadius + Math.random() * (maxSpawnRadius - minSpawnRadius);
            x = p.x + Math.cos(a) * d;
            y = p.y + Math.sin(a) * d;

            if (x < view.left || x > view.right || y < view.top || y > view.bottom) {
                return { x, y }; // Found a valid off-screen position
            }
        }
        
        // Fallback if no valid position found after 10 tries (very rare)
        return { x, y };
    }

    spawnEnemy(type = null, isElite = false) {
        const p = this.p;
        const { x, y } = this.getSpawnPosition();

        let spawnInfo;
        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];
        if (!waveConfig) return;

        if (type) {
            spawnInfo = waveConfig.weights.find(w => w.type === type) || waveConfig.weights[0];
        } else {
            const totalWeight = waveConfig.weights.reduce((acc, s) => acc + s.weight, 0);
            let rand = Math.random() * totalWeight;
            for (const s of waveConfig.weights) {
                rand -= s.weight;
                if (rand <= 0) {
                    spawnInfo = s;
                    break;
                }
            }
        }
        
        if (!spawnInfo) spawnInfo = waveConfig.weights[0];

        let enemy;
        switch (spawnInfo.type) {
            case 'charger': enemy = new Charger(x, y, p.lvl, isElite); break;
            case 'spitter': enemy = new Spitter(x, y, p.lvl, isElite); break;
            case 'anchor': enemy = new Anchor(x, y, p.lvl, isElite); break;
            default: enemy = new Walker(x, y, p.lvl, isElite); break;
        }
        
        enemy.soulValue = spawnInfo.soulValue * (isElite ? 3 : 1);
        this.enemies.push(enemy);
        CombatSystem.onEnemySpawn(enemy, this);
    }



    findTarget(exclude, x, y) {
        let t = null, min = 400 * 400;
        let ox = x || this.p.x, oy = y || this.p.y;
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
