import State from '../core/State.js';
import TownState from './TownState.js';
import Boss from '../entities/Boss.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';
import CombatSystem from '../systems/CombatSystem.js';
import LootSystem from '../systems/LootSystem.js';
import { LootDrop as Drop, HealthOrb, SoulMagnet } from '../entities/Pickups.js';
import UI from '../systems/UI.js';
import ParticleSystem from '../systems/Particles.js';
import ProgressionSystem from '../systems/ProgressionSystem.js';
import { Walker, Charger, Spitter, Anchor } from "../entities/Enemy.js";
import { SoulOrb as Soul } from "../entities/Pickups.js";
import { BALANCE } from "../data/Balance.js";
import SpawnSystem from "../systems/SpawnSystem.js";
import SoulOrbMergeSystem from "../systems/SoulOrbMergeSystem.js";
import { PALETTE } from "../data/Palette.js";

class DungeonState extends State {
    constructor(game) {
        super(game);
        this.isRun = true;
        this.boss = null;
        this.enemies = [];
        this.shots = []; 
        this.drops = [];
        this.souls = [];
        this.townPortal = null;
        this.chains = [];
        // Room bounds
        this.bounds = { x: 0, y: 0, w: 800, h: 600 };
        this.room = "entry"; // "entry" | "boss"
        this.bossDoor = null;
        this.showKillCounter = true;
        this.timer = 0;
        this.timerMax = 0;
        this.elapsed = 0;
        this.riftScore = 0; // legacy name; used as dungeon progress score
        this.soulGauge = 0;
        this.soulGaugeThreshold = 0;
        this.gaugeFlash = 0;
        this.progressThresholds = null;
        this.spawnCredit = 0;
        this.hardEnemyCap = 220;
        this._frameId = 0;
        this._sepGrid = null;
        this._sepGridFrame = -1;
        this._sepCellSize = 70;
        
        this.combatSystem = CombatSystem; // Expose CombatSystem to entities
    }

    getRestartState(game) {
        return new DungeonState(game);
    }

    enter() {
        console.log("Entering Dungeon State");
        const p = this.game.p;
        // Encapsulated Teleport
        p.teleport(400, 500);
        p.recalc();
        p.activeOrbitalWisps = 0;

        this.room = "entry";
        this.boss = null;
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.townPortal = null;
        this.showKillCounter = true;
        this.timerMax = ProgressionSystem.getDungeonDurationSec();
        this.timer = this.timerMax;
        this.elapsed = 0;
        this.riftScore = 0;
        this.soulGauge = 0;
        this.gaugeFlash = 0;
        this.progressThresholds = BALANCE.progression?.dungeon?.scoreThresholds || [120, 260, 420];
        // Soul Gauge is a separate mechanic from "Dungeon Progress"; keep consistent with Field.
        this.soulGaugeThreshold = BALANCE.waves.baseSoulGaugeThreshold;
        this.bossDoor = null;
        this.spawnCredit = 0;
        this._frameId = 0;
        this._sepGrid = null;
        this._sepGridFrame = -1;
        UI.updateLevelUpPrompt();
        this.game.beginRunTracking?.();
    }

    enterBossRoom() {
        const p = this.game.p;
        this.room = "boss";
        this.enemies = [];
        this.shots = [];
        this.drops = [];
        this.souls = [];
        this.chains = [];
        this.townPortal = null;

        const w = this.bounds.w;
        const h = this.bounds.h;
        p.teleport(w / 2, h - 100);
        p.recalc();
        p.activeOrbitalWisps = 0;

        this.boss = new Boss(w / 2, 120);
        this.enemies = [this.boss];
        UI.toast("BOSS ROOM");
    }

    exit() {
        this.showKillCounter = false;
    }

    update(dt) {
        this._frameId++;
        const p = this.game.p;
        this.elapsed += dt;
        this.timer -= dt;
        this.gaugeFlash = Math.max(0, (this.gaugeFlash || 0) - dt * 2);

        // Dungeon timer expiry: fail if you haven't completed.
        if (this.timer <= 0 && !this.townPortal) {
            UI.toast("DUNGEON FAILED");
            this.game.stateManager.switchState(new TownState(this.game));
            return;
        }

        // 1. UPDATE PLAYER (Combat Enabled)
        p.update(dt, this, true);

        ParticleSystem.update(dt);

        // 2. WALLS (Clamp Position)
        const c = this.game?.canvas;
        if (c) {
            this.bounds.w = c.width;
            this.bounds.h = c.height;
        }
        p.x = Math.max(this.bounds.x + 12, Math.min(this.bounds.x + this.bounds.w - 12, p.x));
        p.y = Math.max(this.bounds.y + 12, Math.min(this.bounds.y + this.bounds.h - 12, p.y));

        // Boss door always exists in the entry room (you can rush boss for less loot).
        if (this.room === "entry") {
            if (!this.bossDoor) {
                this.bossDoor = new Interactable(this.bounds.w / 2 - 60, 40, 120, 45, () => {
                    this.enterBossRoom();
                });
            }
            this.bossDoor.x = this.bounds.w / 2 - 60;
            this.bossDoor.y = 40;
            this.bossDoor.width = 120;
            this.bossDoor.height = 45;
        }

        // 3. BOSS/ENEMIES
        // Reset per-frame buff state; Anchors re-apply during enemy updates and it must persist into shot updates.
        this.enemies.forEach(e => {
            if (!e) return;
            e.isBuffed = false;
            if (e.stats) e.stats.damageTakenMult = 1.0;
        });

        // Spawn dungeon mobs only in the entry room (progress farming area).
        if (this.room === "entry") this.spawnMobs(dt);

        // Update all enemies (boss + mobs).
        this.enemies.forEach(e => e.update?.(dt, p, this));
        // Keep entities inside bounds (includes boss movement).
        const clampToBounds = (ent) => {
            if (!ent) return;
            const r = ent.r || 12;
            ent.x = Math.max(this.bounds.x + r, Math.min(this.bounds.x + this.bounds.w - r, ent.x));
            ent.y = Math.max(this.bounds.y + r, Math.min(this.bounds.y + this.bounds.h - r, ent.y));
        };
        this.enemies.forEach(clampToBounds);
        this.enemies = this.enemies.filter(e => {
            if (!e || e.dead) {
                if (e) this.onEnemyDeath(e);
                return false;
            }
            return true;
        });
        
        // 4. PROJECTILES
        // Use a standard for loop to handle projectiles spawning other projectiles (like TitheExplosion)
        for (let i = 0; i < this.shots.length; i++) {
            const b = this.shots[i];
            if (!b.update(dt, this)) {
                this.shots.splice(i, 1);
                i--;
            }
        }
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });
        this.drops = this.drops.filter(d => d.update(dt, p));
        this.souls = this.souls.filter(s => s.update(dt, p));
        this.souls = SoulOrbMergeSystem.merge(this.souls, dt, this);

        // 5. INTERACTION
        if (this.room === "entry" && this.bossDoor && keys['KeyF'] && this.bossDoor.checkInteraction(p)) {
            this.bossDoor.onInteract();
            return;
        }
        if (this.townPortal && keys['KeyF'] && this.townPortal.checkInteraction(p)) {
            this.townPortal.onInteract();
        }
    }

    onEnemyDeath(enemy) {
        const p = this.game.p;

        // Always record the kill
        p.registerKill(enemy);

        if (enemy === this.boss) {
            console.log("Boss defeated!");
            const tier = this.computeRewardTier();
            for (let i = 0; i < tier; i++) {
                this.drops.push(new Drop(this.boss.x, this.boss.y, LootSystem.loot(i === 0 ? "weapon" : null, { source: "dungeonBoss" })));
            }

            this.townPortal = new Interactable(this.boss.x, this.boss.y, 50, 50, () => {
                this.game.stateManager.switchState(new TownState(this.game));
            });
            CombatSystem.onRoomOrWaveClear(this);
            UI.toast(`DUNGEON CLEARED (T${tier})`);
            return;
        }

        // Regular rift mobs: grant XP and score.
        this.souls.push(new Soul(this, enemy.x, enemy.y));
        const v = enemy.soulValue || 1;
        const prev = this.riftScore;
        this.riftScore += v;
        // Soul Gauge (for phials like Soul Salvo): fills in dungeon too.
        this.soulGauge += v;
        if (this.soulGauge >= this.soulGaugeThreshold) {
            this.soulGauge = 0;
            p.onGaugeFill?.(this);
            this.gaugeFlash = 1.0;
        }

        // Limited sustain in rift (dialed separately later; reuse field dials for now).
        const healCfg = BALANCE?.progression?.healOrbs || {};
        const hpRatio = p.hpMax > 0 ? (p.hp / p.hpMax) : 1;
        const atFullHp = hpRatio >= 0.999;
        if (!atFullHp) {
            let chance = enemy.isElite ? (healCfg.eliteDropChance ?? 0.20) : (healCfg.nonEliteDropChance ?? 0.01);
            if (hpRatio >= (healCfg.highHpThreshold ?? 0.99)) chance *= (healCfg.highHpChanceMult ?? 0.15);
            if (!enemy.isBoss && Math.random() < chance) {
                this.drops.push(new HealthOrb(enemy.x, enemy.y));
            }
        }
        const magnetCfg = BALANCE?.progression?.soulMagnet || {};
        const magnetChance = magnetCfg.eliteDropChance ?? 0.0075;
        if (enemy.isElite && !enemy.isBoss && Math.random() < magnetChance) {
            this.drops.push(new SoulMagnet(enemy.x, enemy.y));
        }
    }

    findTarget(exclude, x, y) {
        let t = null;
        let min = 400 * 400;
        const ox = x ?? this.game.p.x;
        const oy = y ?? this.game.p.y;
        this.enemies.forEach(e => {
            if (!e || e.dead || e === exclude) return;
            const dx = e.x - ox;
            const dy = e.y - oy;
            const d2 = dx * dx + dy * dy;
            if (d2 < min) { min = d2; t = e; }
        });
        return t;
    }

    getSpawnPosition() {
        const p = this.game.p;
        const margin = 30;
        for (let i = 0; i < 12; i++) {
            const x = this.bounds.x + margin + Math.random() * (this.bounds.w - margin * 2);
            const y = this.bounds.y + margin + Math.random() * (this.bounds.h - margin * 2);
            const dx = x - p.x;
            const dy = y - p.y;
            if (dx * dx + dy * dy > 180 * 180) return { x, y };
        }
        return { x: this.bounds.x + 100, y: this.bounds.y + 100 };
    }

    spawnEnemy(type = null, isElite = false) {
        if (this.enemies.length >= this.hardEnemyCap) return;
        const { x, y } = this.getSpawnPosition();
        const lvl = ProgressionSystem.getEnemyLevelForDungeon(this);
        const pick = type || (() => {
            const t = this.elapsed;
            if (t < 60) return "thrall_t2";
            if (t < 180) {
                const r = Math.random();
                if (r < 0.55) return "thrall_t3";
                if (r < 0.80) return "thrall_t2";
                if (r < 0.90) return "charger";
                if (r < 0.98) return "spitter";
                return "anchor";
            }
            const r = Math.random();
            if (r < 0.50) return "thrall_t4";
            if (r < 0.78) return "thrall_t3";
            if (r < 0.88) return "charger";
            if (r < 0.96) return "spitter";
            return "anchor";
        })();

        const spec = SpawnSystem.getSpawnSpec(pick);
        let enemy = null;
        if (spec) {
            enemy = SpawnSystem.createEnemyFromSpec(spec, x, y, lvl, isElite);
            SpawnSystem.applyTierScaling(enemy, spec?.tier, { playerLevel: this.game?.p?.lvl ?? 1 });
        } else {
            // Back-compat fallback.
            switch (pick) {
                case "charger": enemy = new Charger(x, y, lvl, isElite); break;
                case "spitter": enemy = new Spitter(x, y, lvl, isElite); break;
                case "anchor": enemy = new Anchor(x, y, lvl, isElite); break;
                default: enemy = new Walker(x, y, lvl, isElite); break;
            }
        }
        if (!enemy) return;

        // Score weight (also matches how "fodder vs elites" should feel).
        const table = { thrall_t2: 1, thrall_t3: 1, thrall_t4: 1, walker: 1, charger: 2, spitter: 2, anchor: 5 };
        enemy.soulValue = (table[pick] ?? 1) * (isElite ? 3 : 1);
        this.enemies.push(enemy);
        CombatSystem.onEnemySpawn(enemy, this);
    }

    spawnMobs(dt) {
        // Spawn only in the entry room (progress farming area).
        if (this.room !== "entry") return;

        const baseAlive = 22;
        const maxAlive = 120;
        const alive = this.enemies.length;
        const desired = Math.min(maxAlive, baseAlive + Math.floor(this.elapsed / 30) * 4);

        if (alive >= desired) return;

        this.spawnCredit += 5 * dt;
        while (this.spawnCredit >= 1 && this.enemies.length < desired) {
            const eliteChance = Math.min(0.25, 0.05 + this.elapsed / 600);
            this.spawnEnemy(null, Math.random() < eliteChance);
            this.spawnCredit -= 1;
        }
    }

    computeRewardTier() {
        const timeLeft = Math.max(0, this.timer);
        const thresholds = BALANCE.progression?.dungeon?.scoreThresholds || [120, 260, 420];
        let tier = 1;
        thresholds.forEach((t, i) => {
            if (this.riftScore >= t) tier = Math.max(tier, i + 2);
        });
        if (timeLeft >= 60) tier += 1;
        return Math.max(1, Math.min(5, tier));
    }

    render(ctx) {
        const p = this.game.p;
        const w = ctx.canvas.width, h = ctx.canvas.height;
        // Static Camera
        const s = (x, y) => ({ x, y });

        // Boss room background should contrast the boss body (violet).
        ctx.fillStyle = this.room === "boss" ? PALETTE.abyss : PALETTE.slate;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = PALETTE.parchment; ctx.strokeRect(0, 0, w, h);

        this.enemies.forEach(e => { if (!e.dead) e.draw?.(ctx, s); });
        this.shots.forEach(shot => shot.draw(ctx, s));
        this.drops.forEach(d => d.draw(ctx, s));
        this.souls.forEach(o => o.draw(ctx, s));
        
        // Chains
        ctx.lineWidth = 2;
        this.chains.forEach(c => {
            let p1 = s(c.pts[0].x, c.pts[0].y);
            let p2 = s(c.pts[1].x, c.pts[1].y);
            ctx.strokeStyle = c.color ?? PALETTE.cyan;
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        p.draw(ctx, s);

        ParticleSystem.render(ctx, s);

        // Entry room: boss door.
        if (this.room === "entry" && this.bossDoor) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(this.bossDoor.x, this.bossDoor.y, this.bossDoor.width, this.bossDoor.height);
            ctx.strokeStyle = 'rgba(239,230,216,0.65)';
            ctx.strokeRect(this.bossDoor.x, this.bossDoor.y, this.bossDoor.width, this.bossDoor.height);
            ctx.fillStyle = PALETTE.parchment;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Boss Door', this.bossDoor.x + this.bossDoor.width / 2, this.bossDoor.y + 28);
            if (this.bossDoor.checkInteraction(p)) {
                ctx.font = '18px sans-serif';
                ctx.fillText('[F] Enter Boss Room', w / 2, 86);
            }
            ctx.restore();
            ctx.textAlign = 'start';
        }

        // Portal
        if (this.townPortal) {
            let portalPos = s(this.townPortal.x, this.townPortal.y);
            ctx.fillStyle = PALETTE.cyan;
            ctx.fillRect(portalPos.x, portalPos.y, this.townPortal.width, this.townPortal.height);
            if (this.townPortal.checkInteraction(p)) {
                ctx.fillStyle = PALETTE.parchment; ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("[F] to return to Town", w / 2, h - 50);
                ctx.textAlign = 'start';
            }
        }

        // Boss UI
        if (this.boss && !this.boss.dead) {
            ctx.fillStyle = PALETTE.blood; ctx.fillRect(w / 2 - 250, 20, 500 * (this.boss.hp / this.boss.hpMax), 20);
            ctx.strokeStyle = PALETTE.parchment; ctx.strokeRect(w / 2 - 250, 20, 500, 20);
        }

        // Rift UI is rendered in the DOM HUD (see `src/systems/UI.js`).
    }
}

export default DungeonState;
