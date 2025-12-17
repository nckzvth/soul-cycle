import State from '../core/State.js';
import { dist2 } from "../core/Utils.js";
import { SLOTS } from "../data/Constants.js"; 
import { ITEMS } from "../data/Items.js";
import { LootDrop as Drop, SoulOrb as Soul, PhialShard, HealthOrb, SoulMagnet } from "../entities/Pickups.js";
import { keys } from "../core/Input.js";
import UI from '../systems/UI.js';
import Interactable from '../entities/Interactable.js';
import DungeonState from './DungeonState.js';
import TownState from './TownState.js';
import CombatSystem from '../systems/CombatSystem.js';
import Telegraph from '../systems/Telegraph.js';
import { Walker, Charger, Spitter, Anchor } from "../entities/Enemy.js";
import { BALANCE } from '../data/Balance.js';
import { Phials } from '../data/Phials.js';
import ParticleSystem from '../systems/Particles.js';
import LootSystem from '../systems/LootSystem.js';
import ProgressionSystem from '../systems/ProgressionSystem.js';
import Boss from '../entities/Boss.js';

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

function drawObjectiveArrow(ctx, w, angle, pulse, label, dist) {
    const cx = w / 2;
    const cy = 95;
    const size = 16 + 6 * pulse;
    const alpha = 0.5 + 0.5 * pulse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(215, 196, 138, 0.95)";
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.35 * pulse})`;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    const d = typeof dist === "number" ? ` (${Math.round(dist)}m)` : "";
    ctx.fillText(`${label}${d}`, cx, cy + 26);
    ctx.restore();
}

function drawBountyArrow(ctx, w, angle, pulse, label, dist) {
    const cx = w / 2;
    const cy = 140;
    const size = 14 + 6 * pulse;
    const alpha = 0.4 + 0.6 * pulse;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(255, 140, 60, 0.95)";
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.6, size * 0.6);
    ctx.lineTo(-size * 0.6, -size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = `rgba(255,200,160,${0.55 + 0.35 * pulse})`;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const d = typeof dist === "number" ? ` (${Math.round(dist)}m)` : "";
    ctx.fillText(`${label}${d}`, cx, cy + 22);
    ctx.restore();
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

        this.fieldElapsed = 0;
        this.fieldBoss = null;
        this.dungeonDecisionTimer = 0;
        this.fieldCleared = false;

        this.pendingMilestoneDrop = null;
        this.waveMilestones = { sixty: false, oneTwenty: false };

        this.objectives = [];
        this.objectiveTarget = null;
        this.objectiveCooldowns = { shrine: 0, chest: 0 };
        this.objectiveSpawnRollTimer = 0;

        this.bounty = null; // { x, y, t, remaining, id }
        this.bountyCooldown = 0;
        this.bountyRollTimer = 0;

        this.chargerPacks = [];
        this.nextChargerPackId = 1;
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
            // Field phase complete -> spawn the Field Boss gate.
            if (!this.fieldBoss && !this.fieldCleared) {
                const spawnX = this.p.x;
                const spawnY = this.p.y - 220;
                this.fieldBoss = new Boss(spawnX, spawnY, { variant: "field" });
                this.enemies.push(this.fieldBoss);
                UI.toast("FIELD BOSS!");
            }
            return;
        }

        this.waveTimer = waveConfig.duration;
        this.waveElapsed = 0;
        this.waveMilestones = { sixty: false, oneTwenty: false };
        
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
        this.fieldElapsed += dt;

        if (this.dungeonDecisionTimer > 0) {
            this.dungeonDecisionTimer = Math.max(0, this.dungeonDecisionTimer - dt);
            if (this.dungeonDecisionTimer <= 0) {
                this.dungeonPortal = null;
                if (this.fieldCleared) {
                    this.game.stateManager.switchState(new TownState(this.game));
                    return;
                }
            }
        }

        // Kill Rate Calculation (EMA)
        this.killTimer += dt;
        if (this.killTimer >= 1.0) {
            const alpha = BALANCE.waves.director.emaAlpha;
            this.killRateEMA = alpha * this.killsThisFrame + (1 - alpha) * this.killRateEMA;
            this.killsThisFrame = 0;
            this.killTimer -= 1.0;
        }

        // Wave Progression -> Field Boss gate after final wave.
        if (this.waveTimer <= 0 && !this.fieldBoss) {
            this.startNextWave();
        }

        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];

        // Field objectives spawn during waves (not during the Field Boss gate).
        if (waveConfig && !this.fieldBoss && !this.fieldCleared) {
            this.updateObjectives(dt);
            this.updateBounty(dt);
            this.updateChargerPacks(dt);
        } else {
            if (this.objectiveTarget && (this.fieldBoss || this.fieldCleared)) {
                this.objectiveTarget = null;
            }
        }

        // Wave milestone cadence (queue drops to attach to future elite deaths).
        if (waveConfig && !this.fieldBoss) {
            if (!this.waveMilestones.sixty && this.waveElapsed >= 60) {
                this.waveMilestones.sixty = true;
                this.pendingMilestoneDrop = this.pendingMilestoneDrop || "soulMagnet";
            }
            if (!this.waveMilestones.oneTwenty && this.waveElapsed >= 120) {
                this.waveMilestones.oneTwenty = true;
                this.pendingMilestoneDrop = this.pendingMilestoneDrop || "soulMagnet";
            }
        }

        // --- Spawning System ---
        const hardCap = BALANCE.waves.hardEnemyCap;
        const alive = this.enemies.length;

        // 1-2. Process queued spawns only during the Field phase (not during the Field Boss gate).
        if (!this.fieldBoss) {
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
        }

        // 3. Spawn from Ambient Director
        if (waveConfig && !this.fieldBoss) {
            const { baseAlive, bufferSeconds, maxAlive } = waveConfig;
            const dirCfg = BALANCE.progression?.director || {};
            const exp = dirCfg.killRateExponent ?? 0.6;
            const bonusCap = dirCfg.desiredBonusCap ?? 40;
            const bonus = Math.min(bonusCap, Math.pow(Math.max(0, this.killRateEMA), exp) * bufferSeconds);
            const desired = Math.min(baseAlive + bonus, maxAlive);
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

        while (!this.fieldBoss && this.elitesToSpawn > 0 && this.enemies.length < hardCap) {
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

        // Objective interaction
        if (keys['KeyF'] && this.objectives.length > 0) {
            for (let i = this.objectives.length - 1; i >= 0; i--) {
                const obj = this.objectives[i];
                if (obj?.interactable?.checkInteraction(this.p)) {
                    obj.interactable.onInteract();
                    this.objectives.splice(i, 1);
                    if (this.objectiveTarget === obj) this.objectiveTarget = null;
                }
            }
        }

        if (this.dungeonPortal && keys['KeyF'] && this.dungeonPortal.checkInteraction(this.p)) {
            this.dungeonPortal.onInteract();
        }
    }

    updateObjectives(dt) {
        const cfg = BALANCE?.progression?.fieldObjectives || {};

        this.objectiveCooldowns.shrine = Math.max(0, (this.objectiveCooldowns.shrine || 0) - dt);
        this.objectiveCooldowns.chest = Math.max(0, (this.objectiveCooldowns.chest || 0) - dt);
        this.objectiveSpawnRollTimer = Math.max(0, (this.objectiveSpawnRollTimer || 0) - dt);

        // Spawn one objective at a time to keep the arrow meaningful.
        if (this.objectives.length > 0) {
            if (!this.objectiveTarget) this.objectiveTarget = this.objectives[0];
            return;
        }

        // Only roll spawns periodically (avoid frame-perfect instant respawns).
        if (this.objectiveSpawnRollTimer > 0) return;
        this.objectiveSpawnRollTimer = 1.0;

        const trySpawn = (kind) => {
            const c = cfg[kind];
            if (!c) return false;
            if ((this.objectiveCooldowns[kind] || 0) > 0) return false;
            if (this.fieldElapsed < (c.spawnMinSec ?? 0)) return false;
            const chance = c.spawnChancePerRoll ?? 1.0;
            if (Math.random() > chance) return false;

            const a = Math.random() * Math.PI * 2;
            const minR = c.minSpawnRadius ?? 420;
            const maxR = c.maxSpawnRadius ?? 700;
            const d = minR + Math.random() * (maxR - minR);
            const x = this.p.x + Math.cos(a) * d;
            const y = this.p.y + Math.sin(a) * d;

            if (kind === "shrine") this.spawnShrine(x, y);
            if (kind === "chest") this.spawnChest(x, y);
            this.objectiveCooldowns[kind] = c.cooldownSec ?? 90;
            return true;
        };

        // Prefer chest if it is available and rolls true; otherwise shrine.
        if (trySpawn("chest")) return;
        trySpawn("shrine");
    }

    updateBounty(dt) {
        const cfg = BALANCE?.progression?.fieldEvents?.bounty;
        if (!cfg) return;

        // Tick active bounty.
        if (this.bounty) {
            this.bounty.t = Math.max(0, this.bounty.t - dt);
            if (this.bounty.t <= 0) {
                UI.toast("BOUNTY FAILED");
                this.bounty = null;
                this.bountyCooldown = cfg.cooldownSec ?? 70;
            }
            return;
        }

        this.bountyCooldown = Math.max(0, (this.bountyCooldown || 0) - dt);
        this.bountyRollTimer = Math.max(0, (this.bountyRollTimer || 0) - dt);
        if (this.bountyCooldown > 0) return;
        if (this.fieldElapsed < (cfg.spawnMinSec ?? 0)) return;

        // Roll spawn once per second.
        if (this.bountyRollTimer > 0) return;
        this.bountyRollTimer = 1.0;
        const chance = cfg.spawnChancePerRoll ?? 0.55;
        if (Math.random() > chance) return;

        const a = Math.random() * Math.PI * 2;
        const minR = cfg.minSpawnRadius ?? 420;
        const maxR = cfg.maxSpawnRadius ?? 780;
        const d = minR + Math.random() * (maxR - minR);
        const x = this.p.x + Math.cos(a) * d;
        const y = this.p.y + Math.sin(a) * d;

        const id = Math.random().toString(36).slice(2);
        const duration = cfg.durationSec ?? 20;
        UI.toast("BOUNTY");

        const pattern = cfg.pattern || "orbitingSpitters";
        if (pattern === "orbitingSpitters") {
            const pcfg = cfg.orbitingSpitters || {};
            const n = Math.max(3, pcfg.ringCount ?? 8);
            const r = pcfg.ringRadius ?? 220;
            const omega = pcfg.angularSpeed ?? 1.35;
            const shootInterval = pcfg.shootIntervalSec ?? 2.4;
            this.bounty = { x, y, t: duration, remaining: n, id, pattern };

            const base = Math.random() * Math.PI * 2;
            const dir = Math.random() < 0.5 ? -1 : 1;
            for (let i = 0; i < n; i++) {
                const a0 = base + (i / n) * Math.PI * 2;
                const sx = x + Math.cos(a0) * r;
                const sy = y + Math.sin(a0) * r;
                this.spawnEnemy("spitter", false, {
                    x: sx,
                    y: sy,
                    bountyId: id,
                    forceSingle: true,
                    orbit: {
                        cx: x,
                        cy: y,
                        radius: r,
                        omega: omega * dir,
                        angle: a0,
                        shootInterval,
                    },
                });
            }
            return;
        }

        // Fallback: simple pack near a point.
        const count = Math.max(1, cfg.count ?? 10);
        this.bounty = { x, y, t: duration, remaining: count, id, pattern: "pack" };
        for (let i = 0; i < count; i++) {
            const ox = (Math.random() - 0.5) * 140;
            const oy = (Math.random() - 0.5) * 140;
            const rr = Math.random();
            const type = rr < 0.75 ? "walker" : (rr < 0.9 ? "spitter" : "charger");
            this.spawnEnemy(type, false, { x: x + ox, y: y + oy, bountyId: id, forceSingle: true });
        }
    }

    completeBounty() {
        const cfg = BALANCE?.progression?.fieldEvents?.bounty;
        if (!cfg || !this.bounty) return;
        const x = this.bounty.x;
        const y = this.bounty.y;

        const healthOrbs = Math.max(0, cfg.rewardHealthOrbs ?? 1);
        const shardCount = Math.max(0, cfg.rewardPhialShards ?? 1);
        const soulOrbs = Math.max(0, cfg.rewardSoulOrbs ?? 18);

        for (let i = 0; i < healthOrbs; i++) this.pickups.push(new HealthOrb(x, y));
        for (let i = 0; i < shardCount; i++) this.pickups.push(new PhialShard(x, y));
        for (let i = 0; i < soulOrbs; i++) this.souls.push(new Soul(this, x, y));

        UI.toast("BOUNTY COMPLETE");
        this.bounty = null;
        this.bountyCooldown = cfg.cooldownSec ?? 70;
    }

    updateChargerPacks(dt) {
        const cfg = BALANCE?.progression?.fieldEvents?.chargerPack || {};
        for (let i = this.chargerPacks.length - 1; i >= 0; i--) {
            const pack = this.chargerPacks[i];

            // Cull dead members.
            pack.members = (pack.members || []).filter(e => e && !e.dead);
            if (pack.members.length === 0) {
                this.chargerPacks.splice(i, 1);
                continue;
            }

            // Drift pack anchor toward player.
            const dx = this.p.x - pack.x;
            const dy = this.p.y - pack.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = pack.formSpeed ?? cfg.formSpeed ?? 520;
            pack.x += (dx / dist) * speed * dt * 0.22;
            pack.y += (dy / dist) * speed * dt * 0.22;

            pack.chargeTimer -= dt;
            if (pack.chargeTimer <= 0) {
                pack.chargeTimer = pack.chargeInterval ?? cfg.chargeIntervalSec ?? 2.4;
                pack.chargeSeq = (pack.chargeSeq || 0) + 1;
                pack.phase = "charge";
                pack.phaseT = pack.chargeDuration ?? cfg.chargeDurationSec ?? 0.55;
                pack.chargeAngle = Math.atan2(this.p.y - pack.y, this.p.x - pack.x);
                pack.chargeSpeed = pack.chargeSpeed ?? cfg.chargeSpeed ?? 1050;
            }

            if (pack.phase === "charge") {
                pack.phaseT -= dt;
                if (pack.phaseT <= 0) pack.phase = "form";
            }
        }
    }

    spawnChargerPack(x, y) {
        const cfg = BALANCE?.progression?.fieldEvents?.chargerPack || {};
        const hardCap = BALANCE.waves.hardEnemyCap;
        const want = Math.max(3, cfg.size ?? 6);
        const room = Math.max(0, hardCap - this.enemies.length);
        const size = Math.max(0, Math.min(want, room));
        if (size <= 0) return;
        const lvl = ProgressionSystem.getEnemyLevelForField(this);
        const id = this.nextChargerPackId++;
        const members = [];

        // Line formation perpendicular to player direction.
        const ang = Math.atan2(this.p.y - y, this.p.x - x);
        const nx = Math.cos(ang + Math.PI / 2);
        const ny = Math.sin(ang + Math.PI / 2);
        const spacing = 28;

        for (let i = 0; i < size; i++) {
            const t = i - (size - 1) / 2;
            const px = x + nx * t * spacing;
            const py = y + ny * t * spacing;
            const c = new Charger(px, py, lvl, false);
            c.packId = id;
            c.packOffset = { x: nx * t * spacing, y: ny * t * spacing };
            members.push(c);
            this.enemies.push(c);
            CombatSystem.onEnemySpawn(c, this);
        }

        this.chargerPacks.push({
            id,
            x,
            y,
            members,
            phase: "form",
            chargeTimer: cfg.chargeIntervalSec ?? 2.4,
            chargeInterval: cfg.chargeIntervalSec ?? 2.4,
            chargeDuration: cfg.chargeDurationSec ?? 0.55,
            chargeSpeed: cfg.chargeSpeed ?? 1050,
            formSpeed: cfg.formSpeed ?? 520,
            stiffness: cfg.stiffness ?? 7.0,
            chargeSeq: 0,
            chargeAngle: ang,
        });
    }

    spawnShrine(x, y) {
        const cfg = BALANCE?.progression?.fieldObjectives?.shrine || {};
        const it = new Interactable(x, y, 40, 40, () => {
            const p = this.p;
            const sacrifice = (cfg.hpSacrificePctMax ?? 0.10) * p.hpMax;
            p.hp = Math.max(1, p.hp - sacrifice);

            const mult = cfg.powerMult ?? 1.30;
            const dur = cfg.durationSec ?? 20;
            p.combatBuffs = p.combatBuffs || { powerMult: 1.0 };
            p.combatBuffTimers = p.combatBuffTimers || { powerMult: 0 };
            p.combatBuffs.powerMult = Math.max(p.combatBuffs.powerMult || 1.0, mult);
            p.combatBuffTimers.powerMult = Math.max(p.combatBuffTimers.powerMult || 0, dur);
            UI.toast("SHRINE: POWER");
            UI.dirty = true;
        });

        const obj = { kind: "shrine", label: "Shrine", x, y, interactable: it };
        this.objectives.push(obj);
        this.objectiveTarget = obj;
    }

    spawnChest(x, y) {
        const cfg = BALANCE?.progression?.fieldObjectives?.chest || {};
        const it = new Interactable(x, y, 44, 44, () => {
            const p = this.p;
            const shards = cfg.bonusPhialShards ?? 2;
            const souls = cfg.bonusSouls ?? 25;
            p.phialShards += shards;
            p.souls += souls;

            // Grant 1 random phial if possible; fallback to extra shards.
            const cap = BALANCE?.progression?.phials?.maxStacks;
            const ids = Object.values(Phials).map(ph => ph.id);
            const eligible = typeof cap === "number" ? ids.filter(id => (p.getPhialStacks(id) || 0) < cap) : ids;
            if (eligible.length > 0) {
                const id = eligible[Math.floor(Math.random() * eligible.length)];
                p.addPhial(id);
                UI.toast("CHEST: PHIAL");
            } else {
                p.phialShards += 2;
                UI.toast("CHEST");
            }

            UI.dirty = true;
        });

        const obj = { kind: "chest", label: "Chest", x, y, interactable: it };
        this.objectives.push(obj);
        this.objectiveTarget = obj;
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

        // Objectives (shrines/chests)
        this.objectives.forEach(o => {
            const pos = s(o.x, o.y);
            ctx.save();
            const t = this.game.time;
            const pulse = Math.sin(t * 4) * 0.5 + 0.5;
            if (o.kind === "shrine") {
                ctx.fillStyle = `rgba(215, 196, 138, ${0.22 + 0.22 * pulse})`;
                ctx.strokeStyle = `rgba(215, 196, 138, ${0.65 + 0.25 * pulse})`;
            } else {
                ctx.fillStyle = `rgba(160, 235, 255, ${0.18 + 0.18 * pulse})`;
                ctx.strokeStyle = `rgba(160, 235, 255, ${0.70 + 0.20 * pulse})`;
            }
            ctx.lineWidth = 2;
            ctx.fillRect(pos.x, pos.y, o.interactable.width, o.interactable.height);
            ctx.strokeRect(pos.x, pos.y, o.interactable.width, o.interactable.height);
            if (o.interactable.checkInteraction(this.p)) {
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("[F] Interact", pos.x + o.interactable.width / 2, pos.y - 10);
                ctx.textAlign = 'start';
            }
            ctx.restore();
        });

        if (this.dungeonPortal) {
            let portalPos = s(this.dungeonPortal.x, this.dungeonPortal.y);
            ctx.fillStyle = 'purple';
            ctx.fillRect(portalPos.x, portalPos.y, 50, 50);
            if (this.dungeonPortal.checkInteraction(p)) {
                ctx.fillStyle = 'white'; ctx.font = '18px sans-serif';
                const extra = this.dungeonDecisionTimer > 0 ? ` (${Math.ceil(this.dungeonDecisionTimer)}s)` : "";
                ctx.fillText(`[F] Enter Dungeon${extra}`, portalPos.x - 20, portalPos.y - 10);
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

        // Field Boss health bar (keep visible during the fight).
        if (this.fieldBoss && !this.fieldBoss.dead) {
            ctx.fillStyle = 'red'; ctx.fillRect(w / 2 - 250, 20, 500 * (this.fieldBoss.hp / this.fieldBoss.hpMax), 20);
            ctx.strokeStyle = 'white'; ctx.strokeRect(w / 2 - 250, 20, 500, 20);
        }

        // UI
        ctx.fillStyle = 'white'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
        const waveConfig = BALANCE.waves.sequence[this.waveIndex - 1];
        const fieldTotal = ProgressionSystem.getFieldDurationSec();
        const fieldLeft = Math.max(0, fieldTotal - this.fieldElapsed);
        if (waveConfig) {
            ctx.fillText(`Wave: ${this.waveIndex} / ${BALANCE.waves.sequence.length}`, w / 2, 30);
            ctx.fillText(`Time: ${Math.ceil(this.waveTimer)}`, w / 2, 60);
            ctx.fillText(`Field: ${Math.ceil(fieldLeft)}s`, w / 2, 90);
        } else {
            if (this.fieldBoss) ctx.fillText(`FIELD BOSS`, w / 2, 30);
            else if (this.fieldCleared && this.dungeonDecisionTimer > 0) ctx.fillText(`Enter Dungeon? ${Math.ceil(this.dungeonDecisionTimer)}s`, w / 2, 30);
            else ctx.fillText(`Field cleared`, w / 2, 30);
        }
        ctx.textAlign = 'start';

        // Bounty HUD (no compass arrow): a timed kill goal that hunts you.
        if (this.bounty && !this.fieldBoss) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`BOUNTY: ${this.bounty.remaining} left • ${Math.ceil(this.bounty.t)}s`, w / 2, 120);
            ctx.restore();
        }

        // Objective compass arrow (always points to active objective).
        if (this.objectiveTarget) {
            const ox = this.objectiveTarget.x;
            const oy = this.objectiveTarget.y;
            const dx = ox - p.x;
            const dy = oy - p.y;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx * dx + dy * dy) / 50;
            const pulse = Math.sin(this.game.time * 4.0) * 0.5 + 0.5;
            drawObjectiveArrow(ctx, w, angle, pulse, this.objectiveTarget.label, dist);
        }

        // Bounty arrow (separate from objective arrow).
        if (this.bounty && !this.fieldBoss) {
            const dx = this.bounty.x - p.x;
            const dy = this.bounty.y - p.y;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx * dx + dy * dy) / 50;
            const pulse = Math.sin(this.game.time * 4.3) * 0.5 + 0.5;
            drawBountyArrow(ctx, w, angle, pulse, "Bounty", dist);
        }

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

        // Bounty tracking (no compass arrow): kill the marked pack within the time limit.
        if (this.bounty && enemy.bountyId && enemy.bountyId === this.bounty.id) {
            this.bounty.remaining = Math.max(0, (this.bounty.remaining || 0) - 1);
            if (this.bounty.remaining <= 0) {
                this.completeBounty();
            }
        }

        // During the Field Boss gate, disable drip XP from adds to prevent boss-fight farming.
        if (!enemy.isBoss && !this.fieldBoss) {
            this.souls.push(new Soul(this, enemy.x, enemy.y));
        }

        // Health orbs: primary sustain outside level-ups (dialed).
        const healCfg = BALANCE?.progression?.healOrbs || {};
        const hpRatio = this.p.hpMax > 0 ? (this.p.hp / this.p.hpMax) : 1;
        let chance = enemy.isElite ? (healCfg.eliteDropChance ?? 0.45) : (healCfg.nonEliteDropChance ?? 0.05);
        if (hpRatio >= (healCfg.highHpThreshold ?? 0.80)) chance *= (healCfg.highHpChanceMult ?? 0.25);
        if (!enemy.isBoss && Math.random() < chance) {
            this.pickups.push(new HealthOrb(enemy.x, enemy.y));
        }

        // Milestone reward: next elite drops a Soul Magnet.
        if (!this.fieldBoss && enemy.isElite && this.pendingMilestoneDrop === "soulMagnet") {
            this.pendingMilestoneDrop = null;
            this.pickups.push(new SoulMagnet(enemy.x, enemy.y));
        }

        if (enemy.isElite) {
            this.pickups.push(new PhialShard(enemy.x, enemy.y));
        }
        if (!this.fieldBoss && (enemy.isElite || Math.random() < 0.3)) {
            this.drops.push(new Drop(enemy.x, enemy.y, LootSystem.loot()));
        }

        if (!this.fieldBoss) {
            this.soulGauge += enemy.soulValue || 1;
            if (this.soulGauge >= this.soulGaugeThreshold) {
                this.soulGauge = 0;
                this.elitesToSpawn++;
                this.p.onGaugeFill(this);
                this.gaugeFlash = 1.0;
            }
        }

        if (enemy === this.fieldBoss) {
            this.fieldBoss = null;
            this.fieldCleared = true;
            this.dungeonDecisionTimer = ProgressionSystem.getFieldDungeonDecisionSec();
            if (!this.dungeonPortal) {
                this.dungeonPortal = new Interactable(this.p.x + 100, this.p.y, 50, 50, () => {
                    this.game.stateManager.switchState(new DungeonState(this.game));
                });
            }
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

    spawnEnemy(type = null, isElite = false, meta = null) {
        const p = this.p;
        const spawnPos = meta && typeof meta.x === "number" && typeof meta.y === "number" ? { x: meta.x, y: meta.y } : this.getSpawnPosition();
        const x = spawnPos.x;
        const y = spawnPos.y;

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

        // Charger formation packs (no arrow): often replace single charger spawns.
        const packCfg = BALANCE?.progression?.fieldEvents?.chargerPack || {};
        const packWaveGate = (this.waveIndex || 0) >= 2;
        const canPack = packWaveGate && !isElite && !(meta?.forceSingle) && spawnInfo.type === "charger" && !this.fieldBoss;
        if (canPack && Math.random() < (packCfg.chanceOnChargerSpawn ?? 1.0)) {
            this.spawnChargerPack(x, y);
            return;
        }

        let enemy;
        const lvl = ProgressionSystem.getEnemyLevelForField(this);
        switch (spawnInfo.type) {
            case 'charger': enemy = new Charger(x, y, lvl, isElite); break;
            case 'spitter': enemy = new Spitter(x, y, lvl, isElite); break;
            case 'anchor': enemy = new Anchor(x, y, lvl, isElite); break;
            default: enemy = new Walker(x, y, lvl, isElite); break;
        }
        
        enemy.soulValue = spawnInfo.soulValue * (isElite ? 3 : 1);
        if (meta?.bountyId) enemy.bountyId = meta.bountyId;
        if (meta?.orbit && spawnInfo.type === "spitter") {
            enemy.orbit = meta.orbit;
            enemy.orbitShootCd = 0;
        }
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
