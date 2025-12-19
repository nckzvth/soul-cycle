import { SLOTS } from "../data/Constants.js";
import { clamp, dist2 } from "../core/Utils.js";
import { keys, mouse } from "../core/Input.js";
import UI from "../systems/UI.js";
import { BALANCE } from "../data/Balance.js";
import Game from "../core/Game.js";
import { Phials } from "../data/Phials.js";
import { HammerProjectile, AegisPulse, DashTrail, TitheExplosion } from "./Projectile.js";
import ParticleSystem from "../systems/Particles.js";
import StatsSystem from "../systems/StatsSystem.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import StatusSystem from "../systems/StatusSystem.js";
import ProgressionSystem from "../systems/ProgressionSystem.js";

export default class PlayerObj {
    constructor() {
        this.isPlayer = true;
        // Physics & Transform
        this.x = 0; 
        this.y = 0; 
        this.r = 12; 
        
        // Stats
        this.hp = 100; this.hpMax = 100;
        this.lvl = 1; this.xp = 0; this.souls = 0;
        
        // Level Up Picks
        this.levelPicks = { attribute: 0, weapon: 0, phial: 0 };
        this.weaponRerollsUsed = 0;
        this.phialRerollsUsed = 0;
        this.levelUpOffers = {
            weapon: null,
            weaponMeta: { weaponCls: null },
            phial: null,
        };

        // Dash
        this.dashCharges = BALANCE.player.baseDashCharges;
        this.dashRechargeTimer = 0;
        this.dashKeyPressed = false; // Track if space was pressed last frame
        this.dashRechargeFlash = 0;  // Timer for the UI flash

        // Kill tracking
        this.killStats = {
            currentSession: 0,   // resets when returning to town
            lifetime: 0,         // never reset (unless you wipe profile)
            nonEliteSession: 0,
            bossesSession: 0
        };
        
        // Inventory
        this.inv = []; 
        this.gear = {}; 
        SLOTS.forEach(s => this.gear[s] = null);

        // Phials
        this.phials = new Map();
        this.phialShards = 0;
        this.recentPhialGains = new Map(); // Tracks animation timers for UI pop
        
        this.haloTimer = 0;
        this.salvoCharges = 0;
        this.salvoGlow = 0;
        this.aegisCooldownTimer = 0;
        this.aegisActiveTimer = 0;
        this.aegisDamageMultiplier = 1;
        this.titheKillsCounter = 0;
        this.titheCharges = 0;
        this.titheChargeGainedTimer = 0;

        // Temporary buffs
        this.soulMagnetTimer = 0;
        this.combatBuffs = { powerMult: 1.0 };
        this.combatBuffTimers = { powerMult: 0 };

        // Weapon state (run-reset). Used for "class" mechanics like pistol windup/cyclone.
        this.weaponState = {
            pistol: { windup: 0, gustCounter: 0, vortexBudget: 0, vortexBudgetTimer: 0, cycloneProcCd: 0, cycloneWindowTime: 0 },
            staff: { currentTime: 0, voltage: 0, currentVfxTimer: 0, voltageVfxTimer: 0, currentJustGained: false, circuitNext: "relay" },
            hammer: { heat: 0, igniteCd: 0, heatVfxTimer: 0 }
        };
        
        // Meta
        this.attr = { might: 0, alacrity: 0, will: 0, pts: 0 };
        this.totalAttr = { might: 0, alacrity: 0, will: 0 };
        this.perks = { might: false, alacrity: false, will: false };
        this.timers = { might: 0, alacrity: 0, will: 0 };
        this.activeOrbitalWisps = 0;
        
        this.skills = new Map(); 
        this.skillMeta = { exclusive: new Map(), flags: new Set() };
        this.stats = {};
        
        // Action States
        this.dashTimer = 0; 
        this.dashVec = { x: 0, y: 0 };
        this.dashHitList = [];
        this.rooted = 0;
        this.rootImmunity = 0;
        this.atkCd = 0;
        
        this.recalc();
    }

    // --- PHIAL METHODS ---

    addPhial(id) {
        if (!this.phials.has(id)) {
            this.phials.set(id, 0);
        }
        const maxStacks = BALANCE?.progression?.phials?.maxStacks;
        const current = this.phials.get(id) || 0;
        if (typeof maxStacks === "number" && Number.isFinite(maxStacks) && current >= maxStacks) {
            return;
        }
        this.phials.set(id, current + 1);
        this.recentPhialGains.set(id, 1.0); // Start pop animation timer (1.0s)
    }

    getPhialStacks(id) {
        return this.phials.get(id) || 0;
    }

    clearPhials() {
        this.phials.clear();
        this.recentPhialGains.clear();
        this.haloTimer = 0;
        this.salvoCharges = 0;
        this.salvoGlow = 0;
        this.aegisCooldownTimer = 0;
        this.aegisActiveTimer = 0;
        this.aegisDamageMultiplier = 1;
        if (this.stats) this.stats.damageTakenMult = 1;
        this.titheKillsCounter = 0;
        this.titheCharges = 0;
        this.titheChargeGainedTimer = 0;
    }

    clearSkills() {
        this.skills.clear();
        this.skillMeta = { exclusive: new Map(), flags: new Set() };
        this.weaponState = {
            pistol: { windup: 0, gustCounter: 0, vortexBudget: 0, vortexBudgetTimer: 0, cycloneProcCd: 0, cycloneWindowTime: 0 },
            staff: { currentTime: 0, voltage: 0, currentVfxTimer: 0, voltageVfxTimer: 0, currentJustGained: false, circuitNext: "relay" },
            hammer: { heat: 0, igniteCd: 0, heatVfxTimer: 0 }
        };
    }

    // --- STATE INTERFACE ---

    /**
     * Main loop called by the active State.
     * @param {number} dt - Delta time
     * @param {object} scene - The current state (Field/Dungeon) for spawning projectiles
     * @param {boolean} allowCombat - If false (Town), disables shooting/abilities
     */
    update(dt, scene, allowCombat = true) {
        // 1. Handle Status Effects
        if (this.rooted > 0) {
            this.rooted -= dt;
        }
        if (this.rootImmunity > 0) {
            this.rootImmunity -= dt;
        }

        // 2. Handle Passive Perks & Phials
        if (allowCombat) {
            this.updatePerks(dt, scene);
            this.updatePhials(dt, scene);
        }
        
        // Update Phial UI Timers
        for (const [id, time] of this.recentPhialGains) {
            if (time > 0) {
                this.recentPhialGains.set(id, time - dt * 3); // Speed up the pop decay
            } else {
                this.recentPhialGains.delete(id);
            }
        }

        // 3. Cooldowns & Regen
        if (this.atkCd > 0) this.atkCd -= dt;
        if (this.soulMagnetTimer > 0) this.soulMagnetTimer = Math.max(0, this.soulMagnetTimer - dt);
        if (this.combatBuffTimers.powerMult > 0) {
            this.combatBuffTimers.powerMult = Math.max(0, this.combatBuffTimers.powerMult - dt);
            if (this.combatBuffTimers.powerMult <= 0) this.combatBuffs.powerMult = 1.0;
        }
        if (this.dashCharges < BALANCE.player.baseDashCharges) {
            this.dashRechargeTimer += dt;
            if (this.dashRechargeTimer >= BALANCE.player.dashRechargeTime) {
                this.dashRechargeTimer = 0;
                this.dashCharges++;
                this.dashRechargeFlash = 0.5; // Trigger flash
            }
        }
        if (this.dashRechargeFlash > 0) {
            this.dashRechargeFlash -= dt;
        }

        // 4. Movement
        this.processMovement(dt, scene);
        if (this.rooted <= 0) {
            if (this.dashTimer > 0) {
                this.processDash(dt, scene);
            }
        }
        
        // 5. Combat
        if (allowCombat) {
            this.updateWeaponStates(dt, scene);
            this.processCombat(dt, scene);
        }
    }

    updateWeaponStates(dt, scene) {
        const pistolState = this.weaponState?.pistol;
        if (pistolState && pistolState.cycloneProcCd > 0) pistolState.cycloneProcCd = Math.max(0, pistolState.cycloneProcCd - dt);
        if (pistolState && pistolState.cycloneWindowTime > 0) pistolState.cycloneWindowTime = Math.max(0, pistolState.cycloneWindowTime - dt);

        // Hammer forge heat (keystone): build heat while any enemy is burning from hammer.
        const hammerState = this.weaponState?.hammer;
        if (hammerState) {
            if (hammerState.igniteCd > 0) hammerState.igniteCd -= dt;

            if ((this.stats.hammerForgePactEnable || 0) > 0 && scene?.enemies) {
                const cfg = BALANCE.skills?.hammer || {};
                const vfx = cfg.vfx || {};
                const anyBurning = scene.enemies.some(e => e?.statuses?.has("hammer:burn"));
                if (anyBurning) {
                    hammerState.heat += dt * (cfg.forgeHeatGainPerSecond ?? 0.6);
                } else {
                    hammerState.heat -= dt * (cfg.forgeHeatDecayPerSecond ?? 0.9);
                }
                const max = cfg.forgeHeatMax ?? 6;
                hammerState.heat = clamp(hammerState.heat, 0, max);

                if (hammerState.heat > 0) {
                    hammerState.heatVfxTimer -= dt;
                    if (hammerState.heatVfxTimer <= 0) {
                        hammerState.heatVfxTimer = vfx.heatInterval ?? 0.14;
                        const radius = vfx.heatRadius ?? 20;
                        const x = this.x + (Math.random() - 0.5) * radius * 2;
                        const y = this.y + (Math.random() - 0.5) * radius * 2;
                        const baseCount = vfx.heatBaseCount ?? 1;
                        const count = Math.max(1, Math.round(baseCount + (vfx.heatCountPerHeat ?? 0.5) * hammerState.heat));
                        ParticleSystem.emit(x, y, vfx.heatColor ?? "rgba(255, 120, 0, 0.65)", count, 0, vfx.heatSize ?? 2.0, vfx.heatLife ?? 0.16, null, { anchoredTo: this });
                    }
                } else {
                    hammerState.heatVfxTimer = 0;
                }
            } else {
                hammerState.heat = 0;
                hammerState.heatVfxTimer = 0;
            }
        }

        // Staff "Current" buff timer (Soul Circuit).
        const staffState = this.weaponState?.staff;
        if (staffState && staffState.currentTime > 0) {
            staffState.currentTime = Math.max(0, staffState.currentTime - dt);
        }

        // Staff Voltage (upgrade): decays over time; built on successful zaps.
        if (staffState) {
            const cfg = BALANCE.skills?.staff || {};
            const vfx = cfg.vfx || {};

            if (staffState.currentJustGained) {
                staffState.currentJustGained = false;
                ParticleSystem.emit(this.x, this.y, vfx.currentBurstColor ?? "rgba(160, 235, 255, 0.95)", vfx.currentBurstCount ?? 16, 160, 3.2, 0.45);
                ParticleSystem.emitText(this.x, this.y - this.r - 16, "CURRENT", { color: vfx.currentTextColor ?? "rgba(160, 235, 255, 0.95)", size: 14, life: 0.7 });
            }

            if (staffState.currentTime > 0) {
                staffState.currentVfxTimer -= dt;
                if (staffState.currentVfxTimer <= 0) {
                    staffState.currentVfxTimer = vfx.currentInterval ?? 0.12;
                    const radius = vfx.currentRadius ?? 22;
                    const x = this.x + (Math.random() - 0.5) * radius * 2;
                    const y = this.y + (Math.random() - 0.5) * radius * 2;
                    ParticleSystem.emit(x, y, vfx.currentColor ?? "rgba(160, 235, 255, 0.8)", vfx.currentCount ?? 1, 0, vfx.currentSize ?? 2.2, vfx.currentLife ?? 0.18, null, { anchoredTo: this });
                }
            } else {
                staffState.currentVfxTimer = 0;
            }

            if ((this.stats.staffVoltageEnable || 0) > 0) {
                const decay = cfg.voltageDecayPerSecond ?? 0.9;
                staffState.voltage = Math.max(0, (staffState.voltage || 0) - dt * decay);
            } else {
                staffState.voltage = 0;
            }

            if ((staffState.voltage || 0) > 0) {
                staffState.voltageVfxTimer -= dt;
                if (staffState.voltageVfxTimer <= 0) {
                    staffState.voltageVfxTimer = vfx.voltageInterval ?? 0.16;
                    const radius = vfx.voltageRadius ?? 18;
                    const x = this.x + (Math.random() - 0.5) * radius * 2;
                    const y = this.y + (Math.random() - 0.5) * radius * 2;
                    const intensity = Math.min(6, Math.max(1, Math.round(staffState.voltage)));
                    const baseCount = vfx.voltageCount ?? 1;
                    const perStack = vfx.voltageCountPerStack;
                    const count = typeof perStack === "number"
                        ? Math.max(1, Math.round(baseCount + perStack * (intensity - 1)))
                        : intensity;
                    ParticleSystem.emit(x, y, vfx.voltageColor ?? "rgba(240, 240, 140, 0.85)", count, 0, vfx.voltageSize ?? 2.0, vfx.voltageLife ?? 0.16, null, { anchoredTo: this });
                }
            } else {
                staffState.voltageVfxTimer = 0;
            }
        }
    }

    /** Reset stats for Town entry */
    fullHeal() {
        this.recalc();
        this.hp = this.stats.hp;
        this.rooted = 0;
        this.dashTimer = 0;
        this.atkCd = 0;
        this.dashCharges = BALANCE.player.baseDashCharges;
        this.dashRechargeTimer = 0;
        this.weaponRerollsUsed = 0;
        this.phialRerollsUsed = 0;
        if (this.levelUpOffers) {
            this.levelUpOffers.weapon = null;
            this.levelUpOffers.weaponMeta = { weaponCls: null };
            this.levelUpOffers.phial = null;
        }
        this.activeOrbitalWisps = 0;
    }

    /** Move player without physics interpolation */
    teleport(x, y) {
        this.x = x;
        this.y = y;
        this.dashTimer = 0;
    }

    // --- INTERNAL LOGIC ---

    processMovement(dt, scene) {
        let mx = 0, my = 0;
        if (keys["KeyW"]) my--; 
        if (keys["KeyS"]) my++;
        if (keys["KeyA"]) mx--; 
        if (keys["KeyD"]) mx++;

        // Normalize Vector
        if (mx !== 0 || my !== 0) {
            let l = Math.sqrt(mx * mx + my * my);
            mx /= l; my /= l;
        }

        // Dash Trigger
        if (keys["Space"]) {
            if (!this.dashKeyPressed && this.dashCharges > 0) {
                this.dashCharges--;
                this.dashTimer = BALANCE.player.dashDuration;
                this.dashVec = { x: mx, y: my };
                this.dashHitList = []; // Clear hit list on new dash
                this.rooted = 0; // Break root
                this.rootImmunity = BALANCE.player.rootImmunityDuration;
            }
            this.dashKeyPressed = true;
        } else {
            this.dashKeyPressed = false;
        }

        if (this.dashTimer <= 0 && this.rooted <= 0) {
            // Standard Walk
            let spd = BALANCE.player.walkBaseSpeed * (this.stats.moveSpeedMult || (1 + this.stats.move));
            this.x += mx * spd * dt; 
            this.y += my * spd * dt;
        }
    }

    processDash(dt, scene) {
        const startPos = { x: this.x, y: this.y };
        this.dashTimer -= dt;
        // Dash speed is fixed high velocity
        this.x += this.dashVec.x * BALANCE.player.dashSpeed * dt; 
        this.y += this.dashVec.y * BALANCE.player.dashSpeed * dt;
        const endPos = { x: this.x, y: this.y };

        const blindStacks = this.getPhialStacks(Phials.blindingStep.id);
        if (blindStacks > 0) {
            scene.shots.push(new DashTrail(startPos, endPos, blindStacks));
            this.onDash(scene); // Call onDash continuously
        }
    }

    processCombat(dt, scene) {
        const w = this.gear.weapon;
        if (!w) return;

        // --- Pistol windup/cyclone base kit ---
        const pistolState = this.weaponState?.pistol;
        const usingPistol = w.cls === "pistol";
        const firingPistol = usingPistol && mouse.down && this.dashTimer <= 0;
        if (pistolState) {
            const skillsCfg = BALANCE.skills?.pistol || {};
            const gainBase = skillsCfg.windupGainPerSecond ?? 0.8;
            const decayBase = skillsCfg.windupDecayPerSecond ?? 1.2;

            const gainMult = 1 + (this.stats.pistolWindupGainMult || 0);
            const decayMult = Math.max(0.05, 1 + (this.stats.pistolWindupDecayMult || 0));

            if (firingPistol) pistolState.windup = Math.min(1, pistolState.windup + dt * gainBase * gainMult);
            else pistolState.windup = Math.max(0, pistolState.windup - dt * decayBase * decayMult);

            // Reaper's Vortex chaining budget (occult keystone limiter).
            if ((this.stats.pistolReapersVortexEnable || 0) > 0) {
                const budgetMax = skillsCfg.vortexChainBudget ?? 2;
                const regen = skillsCfg.vortexBudgetRegenPerSecond ?? 1.0;
                pistolState.vortexBudgetTimer += dt;
                while (pistolState.vortexBudgetTimer >= 1.0) {
                    pistolState.vortexBudgetTimer -= 1.0;
                    pistolState.vortexBudget = Math.min(budgetMax, pistolState.vortexBudget + regen);
                }
            } else {
                pistolState.vortexBudget = 0;
                pistolState.vortexBudgetTimer = 0;
            }
        }

        // Hammer: spiral projectile
        if (w.cls === "hammer") {
            if (mouse.down && this.atkCd <= 0) {
                const hb = BALANCE.player.hammer;
                let worldX, worldY;

                if ("bounds" in scene) {
                    worldX = mouse.x;
                    worldY = mouse.y;
                } else {
                    const wp = Game.screenToWorld(mouse.x, mouse.y);
                    worldX = wp.x;
                    worldY = wp.y;
                }

                let dx = worldX - this.x;
                let dy = worldY - this.y;
                const len = Math.hypot(dx, dy) || 1;
                dx /= len;
                dy /= len;

                const cx = this.x + dx * 20;
                const cy = this.y + dy * 20;
                const initialAngle = Math.atan2(dy, dx) + Math.PI / 2;

                // Enforce max hammers
                const existingHammers = scene.shots.filter(s => s instanceof HammerProjectile && !s.isSalvo);
                if (existingHammers.length >= hb.maxHammers) {
                    existingHammers.sort((a, b) => a.creationTime - b.creationTime);
                    const oldestHammer = existingHammers[0];
                    const index = scene.shots.indexOf(oldestHammer);
                    if (index > -1) {
                        scene.shots.splice(index, 1);
                    }
                }

                const cfg = BALANCE.skills?.hammer || {};
                const heat = this.weaponState?.hammer?.heat || 0;
                const heatMult = 1 + heat * (cfg.forgeHeatCoeffPerStack ?? 0.06);
                const specBase = DamageSpecs.hammerOrbit();
                const spec = { ...specBase, coeff: specBase.coeff * heatMult };
                const snapshot = DamageSystem.snapshotOutgoing(this, spec);
                scene.shots.push(new HammerProjectile(scene, this, cx, cy, initialAngle, spec, snapshot));
                const cdMult = Math.max(0.2, 1 + (this.stats.hammerCooldownMult || 0));
                this.atkCd = hb.cooldown * cdMult;
                this.onAttack(scene, { weaponCls: "hammer" });

                if (this.salvoCharges > 0) {
                    this.salvoCharges--;
                    scene.shots.push(new HammerProjectile(scene, this, cx, cy, initialAngle + Math.PI, spec, snapshot, true));
                }
            }
        }

        // Shooting (Pistol/Staff) - Don't shoot while dashing
        if (mouse.down && this.atkCd <= 0 && this.dashTimer <= 0) {
            let attackSpeed = this.stats.attackSpeed || (1 + this.stats.spd);
            if (usingPistol && pistolState) {
                const skillsCfg = BALANCE.skills?.pistol || {};
                const windupBonus = skillsCfg.windupAttackSpeedBonus ?? 2.0; // at full windup: +200%
                const mult = (1 + pistolState.windup * windupBonus);
                attackSpeed *= mult;
            }
            let rate = BALANCE.player.pistolBaseRate / attackSpeed;
            
            if (w.cls === "pistol") {
                scene.combatSystem.firePistol(this, scene);
                this.atkCd = rate;
                this.onAttack(scene, { weaponCls: "pistol" });
            } else if (w.cls === "staff") {
                scene.combatSystem.fireZap(this, scene);
                this.atkCd = rate * BALANCE.player.staffRateMult;
                this.onAttack(scene, { weaponCls: "staff" });
            }
        }
    }

    onAttack(state, meta = {}) {
        const p = this;
        const t = p.totalAttr || p.attr;
        const bp = BALANCE.player;
        const perkVfx = BALANCE.perks || {};

        const computeChance = (val) => {
            const threshold = bp.perkThreshold ?? 25;
            const base = bp.perkProcBaseChance ?? 0.05;
            const perPick = bp.perkProcPerPickChance ?? 0.01;
            const softCap = bp.perkProcSoftCap ?? 0.35;
            const gain = bp.perkProcSoftCapGain ?? 0.20;
            const k = bp.perkProcSoftCapK ?? 0.35;

            const picks = Math.max(0, Math.floor((val - threshold) / 5));
            const pre = base + perPick * picks;
            if (pre <= softCap) return Math.max(0, Math.min(0.95, pre));

            const softCapPicks = Math.max(0, Math.floor((softCap - base) / perPick));
            const extra = Math.max(0, picks - softCapPicks);
            const post = softCap + gain * (1 - Math.exp(-k * extra));
            return Math.max(0, Math.min(0.95, post));
        };

        // Might: Soul Blast (shockwave)
        if ((p.perkLevel?.might || 0) >= 1) {
            const chance = computeChance(t.might || 0);
            if (Math.random() < chance) {
                const vfx = perkVfx.soulBlast?.vfx || {};
                ParticleSystem.emit(p.x, p.y, vfx.procColor ?? "rgba(215, 196, 138, 0.9)", vfx.procBurstCount ?? 12, vfx.procBurstSpeed ?? 140, vfx.procBurstSize ?? 3.0, vfx.procBurstLife ?? 0.35);
                ParticleSystem.emitText(p.x, p.y - p.r - 14, "SOUL BLAST", { color: vfx.textColor ?? "rgba(215, 196, 138, 0.95)", size: 14, life: 0.7 });
                state?.combatSystem?.fireShockwave?.(p, state, { perkTier: p.perkLevel.might });
            }
        }

        // Alacrity: Soul Tempest
        if ((p.perkLevel?.alacrity || 0) >= 1) {
            const chance = computeChance(t.alacrity || 0);
            if (Math.random() < chance) {
                const vfx = perkVfx.tempest?.vfx || {};
                ParticleSystem.emit(p.x, p.y, vfx.procColor ?? "rgba(120, 255, 220, 0.85)", 10, 130, 2.7, 0.3);
                ParticleSystem.emitText(p.x, p.y - p.r - 14, "TEMPEST", { color: vfx.textColor ?? "rgba(120, 255, 220, 0.95)", size: 14, life: 0.7 });
                state?.combatSystem?.fireSoulTempest?.(p, state, { perkTier: p.perkLevel.alacrity });
            }
        }

        // Will: Orbital Wisp (capped)
        if ((p.perkLevel?.will || 0) >= 1) {
            const chance = computeChance(t.will || 0);
            if (Math.random() < chance) {
                const cap = bp.perkWillMaxWisps ?? 3;
                if ((p.activeOrbitalWisps || 0) < cap) {
                    const vfx = perkVfx.orbitalWisp?.vfx || {};
                    ParticleSystem.emit(p.x, p.y, vfx.procColor ?? "rgba(160, 235, 255, 0.85)", 8, 120, 2.6, 0.28);
                    ParticleSystem.emitText(p.x, p.y - p.r - 14, "WISP", { color: vfx.textColor ?? "rgba(160, 235, 255, 0.95)", size: 14, life: 0.7 });
                    state?.combatSystem?.fireOrbitalWisp?.(p, state, { perkTier: p.perkLevel.will });
                }
            }
        }
    }

    recalc() {
        StatsSystem.recalcPlayer(this);
    }

    upAttr(k) {
        if (this.attr.pts > 0) {
            this.attr.pts--; this.attr[k]++;
            this.recalc();
            UI.renderInv();
            UI.render();
        }
    }
    
    giveXp(n) {
        this.xp += n;
        let req = ProgressionSystem.getXpRequired(this.lvl);
        while (this.xp >= req) {
            this.xp -= req;
            this.lvl++;
            this.levelPicks.attribute++;
            this.levelPicks.weapon++;
            this.levelPicks.phial++;
            this.hp = this.hpMax;
            UI.toast("LEVEL UP!");
            this.recalc();
            req = ProgressionSystem.getXpRequired(this.lvl);
            
            // Trigger VFX
            ParticleSystem.emit(this.x, this.y, 'gold', 20, 150, 4, 1.5);
            ParticleSystem.emit(this.x, this.y - this.r, 'gold', 1, 0, 300, 0.5, null, { beam: true, anchoredTo: this });
        }
        UI.dirty = true;
    }
    
    takeDamage(amount, source) {
        const spec = { id: "legacy:incoming", base: amount, coeff: 0, canCrit: false, tags: ["incoming"], element: "physical", snapshot: true };
        DamageSystem.dealPlayerDamage(source, this, spec, { state: Game.stateManager?.currentState, ui: UI });
    }

    onDeath() {
        document.getElementById('screen_death').classList.add('active');
        document.getElementById('deathSouls').innerText = this.souls;
        document.getElementById('deathLvl').innerText = this.lvl;

        const kills = this.killStats?.currentSession ?? 0;
        document.getElementById('deathKills').innerText = kills;
        Game.paused = true;
    }

    updatePerks(dt, state) {
        // Perks are now on-attack procs (see `onAttack`).
    }

    updatePhials(dt, state) {
        // Ashen Halo
        const haloStacks = this.getPhialStacks(Phials.ashenHalo.id);
        if (haloStacks > 0) {
            this.haloTimer -= dt;
            if (this.haloTimer <= 0) {
                this.haloTimer = 0.5;
                const radius = Phials.ashenHalo.baseRadius + Phials.ashenHalo.radiusPerStack * (haloStacks - 1);
                const spec = DamageSpecs.ashenHaloTick(haloStacks);
                const snapshot = DamageSystem.snapshotOutgoing(this, spec);
                state.enemies.forEach(enemy => {
                    if (dist2(this.x, this.y, enemy.x, enemy.y) < radius * radius) {
                        DamageSystem.dealDamage(this, enemy, spec, { state, snapshot, triggerOnHit: true, particles: ParticleSystem });
                    }
                });
            }
        }

        // Witchglass Aegis
        if (this.aegisCooldownTimer > 0) this.aegisCooldownTimer -= dt;
        if (this.aegisActiveTimer > 0) {
            this.aegisActiveTimer -= dt;
            if (this.aegisActiveTimer <= 0) {
                this.aegisDamageMultiplier = 1;
                if (this.stats) this.stats.damageTakenMult = 1;
            }
        }
        
        // Soul Salvo
        if (this.salvoGlow > 0) {
            this.salvoGlow -= dt;
        }

        // Tithe Engine
        if (this.titheChargeGainedTimer > 0) {
            this.titheChargeGainedTimer -= dt;
        }
    }

    onGaugeFill(state) {
        const salvoStacks = this.getPhialStacks(Phials.soulSalvo.id);
        if (salvoStacks > 0) {
            const chargesToAdd = Phials.soulSalvo.baseChargesPerFill + Phials.soulSalvo.chargesPerStack * (salvoStacks - 1);
            this.salvoCharges += chargesToAdd;
            this.salvoGlow = 2.0; // Glow for 2 seconds
        }
    }

    onHit(target, state, hit) {
        // --- Weapon upgrade hooks (keep phials independent) ---
        const weapon = this.gear.weapon;
        if (weapon?.cls === "pistol") {
            const skillsCfg = BALANCE.skills?.pistol || {};
            const pistolState = this.weaponState?.pistol;
            const spec = hit?.spec;
            const meta = hit?.meta || {};

            // Cyclone proc: chance on pistol bullet hits (not from Cyclone-burst bullets).
            const isPistolBullet =
                !!spec &&
                Array.isArray(spec.tags) &&
                spec.tags.includes("pistol") &&
                spec.tags.includes("projectile");
            if (isPistolBullet && meta.procSource !== "pistol:cycloneBurst" && pistolState && pistolState.cycloneProcCd <= 0) {
                const base = skillsCfg.cycloneProcChanceBase ?? 0.01;
                const add = this.stats.pistolCycloneProcChanceAdd || 0;
                const mult = 1 + (this.stats.pistolCycloneProcChanceMult || 0);
                const windupBonus = skillsCfg.cycloneProcWindupBonus ?? 1.5; // at full windup: +150% chance

                let chance = (base + add) * mult;
                chance *= (1 + (pistolState.windup || 0) * windupBonus);
                chance = Math.max(0, Math.min(1, chance));

                if (Math.random() < chance) {
                    const icd = skillsCfg.cycloneProcIcd ?? 0.2;
                    pistolState.cycloneProcCd = icd;
                    pistolState.cycloneWindowTime = skillsCfg.cycloneProcWindow ?? 0.5;

                    // Burst VFX
                    const vfx = skillsCfg.vfx || {};
                    ParticleSystem.emit(this.x, this.y, vfx.cycloneBurstColor ?? "rgba(190, 240, 255, 0.9)", vfx.cycloneBurstCount ?? 18, 180, 3, 0.4);
                    ParticleSystem.emitText(this.x, this.y - this.r - 16, "CYCLONE", { color: vfx.cycloneTextColor ?? "rgba(190, 240, 255, 0.95)", size: 14, life: 0.7 });

                    // Spawn the 360° spray.
                    state?.combatSystem?.firePistolCycloneBurst?.(this, state);

                    // Gust Spray (upgrade): cyclone bursts also emit a gust hit.
                    if ((this.stats.pistolGustEnable || 0) > 0) {
                        const gustSpecBase = DamageSpecs.pistolGust();
                        const coeffMult2 = 1 + (this.stats.pistolGustRateMult || 0);
                        const gustSpec = { ...gustSpecBase, coeff: gustSpecBase.coeff * coeffMult2 };
                        const gustSnapshot = DamageSystem.snapshotOutgoing(this, gustSpec);
                        const radius = skillsCfg.gustRadius ?? 70;
                        state?.enemies?.forEach(e => {
                            if (e.dead) return;
                            if (dist2(this.x, this.y, e.x, e.y) < radius * radius) {
                                DamageSystem.dealDamage(this, e, gustSpec, { state, snapshot: gustSnapshot, particles: ParticleSystem, triggerOnHit: false });
                            }
                        });
                    }
                }
            }

            // Apply Hex on pistol hits.
            if ((this.stats.pistolHexEnable || 0) > 0) {
                const duration = (skillsCfg.hexDuration ?? 3.0) * (1 + (this.stats.pistolHexDurationMult || 0));
                const maxStacks = (skillsCfg.hexMaxStacks ?? 5);
                const debtPopEnabled = (this.stats.pistolDebtPopEnable || 0) > 0;
                const debtCoeffMult = 1 + (this.stats.pistolDebtPopCoeffMult || 0);
                const vortexEnabled = (this.stats.pistolReapersVortexEnable || 0) > 0;

                const makePopSpec = () => {
                    const base = DamageSpecs.pistolDebtPop();
                    return { ...base, coeff: base.coeff * debtCoeffMult };
                };

                StatusSystem.applyStatus(target, "pistol:hex", {
                    source: this,
                    stacks: 1,
                    duration,
                    tickInterval: 9999,
                    spec: null,
                    snapshotPolicy: "snapshot",
                    stackMode: "add",
                    maxStacks,
                    vfx: {
                        interval: skillsCfg?.vfx?.hexInterval ?? 0.4,
                        color: skillsCfg?.vfx?.hexColor ?? "rgba(190, 120, 255, 0.85)",
                        count: skillsCfg?.vfx?.hexCount ?? 1,
                        countPerStack: skillsCfg?.vfx?.hexCountPerStack ?? 0.35,
                        size: skillsCfg?.vfx?.hexSize ?? 2.3,
                        life: skillsCfg?.vfx?.hexLife ?? 0.2,
                        applyBurstCount: skillsCfg?.vfx?.hexApplyBurstCount ?? 3,
                        applyBurstSpeed: skillsCfg?.vfx?.hexApplyBurstSpeed ?? 110,
                    },
                    onExpire: debtPopEnabled ? (tgt, st, stState) => {
                        const popSpec = makePopSpec();
                        const popSnapshot = DamageSystem.snapshotOutgoing(this, popSpec);
                        const radius = skillsCfg.debtPopRadius ?? 90;

                        // Primary pop.
                        stState?.enemies?.forEach(e => {
                            if (e.dead) return;
                            if (dist2(tgt.x, tgt.y, e.x, e.y) < radius * radius) {
                                DamageSystem.dealDamage(this, e, popSpec, { state: stState, snapshot: popSnapshot, particles: ParticleSystem });
                            }
                        });

                        // Vortex: chain one additional pop to a nearby hexed enemy (budget-limited).
                        if (vortexEnabled && pistolState && pistolState.cycloneWindowTime > 0 && pistolState.vortexBudget > 0) {
                            const chainRadius = skillsCfg.vortexChainRadius ?? 220;
                            let best = null, bestD2 = chainRadius * chainRadius;
                            stState?.enemies?.forEach(e => {
                                if (e.dead || e === tgt) return;
                                if (!StatusSystem.hasStatus(e, "pistol:hex")) return;
                                const d2 = dist2(tgt.x, tgt.y, e.x, e.y);
                                if (d2 < bestD2) { bestD2 = d2; best = e; }
                            });
                            if (best) {
                                pistolState.vortexBudget = Math.max(0, pistolState.vortexBudget - 1);
                                // Consume the chained hex to prevent double-pop later.
                                if (best.statuses) best.statuses.delete("pistol:hex");
                                stState?.enemies?.forEach(e => {
                                    if (e.dead) return;
                                    if (dist2(best.x, best.y, e.x, e.y) < radius * radius) {
                                        DamageSystem.dealDamage(this, e, popSpec, { state: stState, snapshot: popSnapshot, particles: ParticleSystem });
                                    }
                                });
                            }
                        }
                    } : null
                });
            }

            // Soul Pressure: hitting hexed targets sustains windup / extends the post-proc window.
            if ((this.stats.pistolSoulPressureEnable || 0) > 0 && pistolState && StatusSystem.hasStatus(target, "pistol:hex")) {
                const sustainMult = 1 + (this.stats.pistolCycloneSustainMult || 0);
                const windupGain = (skillsCfg.soulPressureWindupOnHit ?? 0.08) * sustainMult;
                const windowExtend = (skillsCfg.soulPressureCycloneExtend ?? 0.08) * sustainMult;
                pistolState.windup = Math.min(1, pistolState.windup + windupGain);
                if (pistolState.cycloneWindowTime > 0) pistolState.cycloneWindowTime += windowExtend;
            }
        }

        const titheStacks = this.getPhialStacks(Phials.titheEngine.id);
        if (titheStacks > 0 && this.titheCharges > 0) {
            this.titheCharges--;
            const radius =
                Phials.titheEngine.baseExplosionRadius +
                Phials.titheEngine.radiusPerStack * (titheStacks - 1);
            const spec = DamageSpecs.titheExplosion(titheStacks);
            const snapshot = DamageSystem.snapshotOutgoing(this, spec);
    
            state.shots.push(new TitheExplosion(
                state,
                this,
                target.x,
                target.y,
                radius,
                titheStacks,
                spec,
                snapshot
            ));
        }
    }

    onDash(state) {
        const blindStacks = this.getPhialStacks(Phials.blindingStep.id);
        if (blindStacks > 0) {
            const blindDuration = Phials.blindingStep.baseBlindDuration + Math.floor((blindStacks - 1) / 2) * Phials.blindingStep.blindDurationPerTwoStacks;
            const burnDuration = Phials.blindingStep.baseBurnDuration;
            const knockback = clamp(Phials.blindingStep.baseKnockback + Phials.blindingStep.knockbackPerStack * (blindStacks - 1), 0, Phials.blindingStep.maxKnockback);
            const burnSpec = blindStacks >= 2 ? DamageSpecs.blindingStepBurn(blindStacks) : null;
            
            state.enemies.forEach(enemy => {
                if (!this.dashHitList.includes(enemy) && dist2(this.x, this.y, enemy.x, enemy.y) < Phials.blindingStep.dashAffectRadius * Phials.blindingStep.dashAffectRadius) {
                    this.dashHitList.push(enemy);
                    enemy.blinded = blindDuration;
                    
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.vx += Math.cos(angle) * knockback;
                    enemy.vy += Math.sin(angle) * knockback;

                    if (blindStacks >= 2) {
                        StatusSystem.applyStatus(enemy, "burn", {
                            source: this,
                            stacks: 1,
                            duration: burnDuration,
                            tickInterval: 1.0,
                            spec: burnSpec,
                            snapshotPolicy: "snapshot",
                            triggerOnHit: false,
                            dotTextMode: "perTick"
                        });
                    }
                }
            });
        }
    }

    onDamageTaken(source) {
        const aegisStacks = this.getPhialStacks(Phials.witchglassAegis.id);
        if (aegisStacks > 0 && this.aegisCooldownTimer <= 0) {
            this.aegisCooldownTimer = Phials.witchglassAegis.internalCooldown;
            const reduction = clamp(Phials.witchglassAegis.baseDamageReduction + Phials.witchglassAegis.damageReductionPerStack * (aegisStacks - 1), 0, 0.9);
            this.aegisDamageMultiplier = 1 - reduction;
            if (this.stats) this.stats.damageTakenMult = this.aegisDamageMultiplier;
            this.aegisActiveTimer = Phials.witchglassAegis.baseDuration + Phials.witchglassAegis.durationPerStack * (aegisStacks - 1);

            const radius = Phials.witchglassAegis.pulseBaseRadius + Phials.witchglassAegis.pulseRadiusPerStack * (aegisStacks - 1);
            const spec = DamageSpecs.aegisPulse(aegisStacks);
            const snapshot = DamageSystem.snapshotOutgoing(this, spec);
            Game.stateManager.currentState.shots.push(new AegisPulse(Game.stateManager.currentState, this, this.x, this.y, radius, aegisStacks, spec, snapshot));
        }
    }

    draw(ctx, s) {
        let pc = s(this.x, this.y);
        
        // Ashen Halo
        const haloStacks = this.getPhialStacks(Phials.ashenHalo.id);
        if (haloStacks > 0) {
            const radius = Phials.ashenHalo.baseRadius + Phials.ashenHalo.radiusPerStack * (haloStacks - 1);
            const gradient = ctx.createRadialGradient(pc.x, pc.y, 0, pc.x, pc.y, radius);
            const pulse = Math.sin(Game.time * 5) * 0.1 + 0.9;
            gradient.addColorStop(0, 'rgba(255, 120, 0, 0)');
            gradient.addColorStop(0.7, `rgba(255, 100, 0, ${0.1 * pulse})`);
            gradient.addColorStop(1, `rgba(255, 80, 0, ${0.3 * pulse})`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pc.x, pc.y, radius, 0, 6.28);
            ctx.fill();
        }

        // Witchglass Aegis
        if (this.aegisActiveTimer > 0) {
            const alpha = (this.aegisActiveTimer / (Phials.witchglassAegis.baseDuration + Phials.witchglassAegis.durationPerStack * (this.getPhialStacks(Phials.witchglassAegis.id) - 1))) * 0.8;
            const flicker = Math.random() > 0.2 ? alpha : alpha * 0.5;
            ctx.strokeStyle = `rgba(200, 230, 255, ${flicker})`;
            ctx.lineWidth = 2;
            const segments = 6;
            const segmentAngle = (Math.PI * 2) / segments;
            for (let i = 0; i < segments; i++) {
                ctx.beginPath();
                ctx.arc(pc.x, pc.y, this.r + 8, i * segmentAngle + segmentAngle * 0.1, (i + 1) * segmentAngle - segmentAngle * 0.1);
                ctx.stroke();
            }
        }

        ctx.fillStyle = "#6aae9d"; 
        ctx.beginPath(); 
        ctx.arc(pc.x, pc.y, 12, 0, 6.28); 
        ctx.fill();

        // Salvo Glyphs
        if (this.salvoCharges > 0) {
            const angleStep = Math.PI * 2 / this.salvoCharges;
            for (let i = 0; i < this.salvoCharges; i++) {
                const angle = i * angleStep + Game.time * 2;
                const x = pc.x + Math.cos(angle) * 20;
                const y = pc.y + Math.sin(angle) * 20;
                ctx.fillStyle = 'rgba(160, 235, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Tithe Charge Rune
        if (this.titheCharges > 0) {
            const alpha = this.titheChargeGainedTimer > 0 ? (this.titheChargeGainedTimer / 1.0) * 0.5 + 0.5 : 1.0;
            const angle = Game.time * 4;
            const x = pc.x + Math.cos(angle) * 30;
            const y = pc.y + Math.sin(angle) * 30;
            ctx.fillStyle = `rgba(215, 196, 138, ${alpha})`;
            ctx.font = '16px sans-serif';
            ctx.fillText('🩸', x, y);
        }
    }

    registerKill(enemy) {
        // Lifetime tally
        this.killStats.lifetime++;
        this.killStats.currentSession++;

        if (!enemy.isElite) {
            this.killStats.nonEliteSession++;
        }
        if (enemy.isBoss) {
            this.killStats.bossesSession++;
        }

        const titheStacks = this.getPhialStacks(Phials.titheEngine.id);
        // Tithe Engine: prevent self-fueling from tithe explosion kill chains.
        const killedByTithe = enemy?.lastHitSpecId === "phial:titheExplosion";
        if (titheStacks > 0 && !killedByTithe) {
            ParticleSystem.emit(enemy.x, enemy.y, 'gold', 1, 100, 2, 2.0, this);
            this.titheKillsCounter++;
            const requiredKills = clamp(Phials.titheEngine.baseKillsRequired - Phials.titheEngine.killsReductionPerStack * (titheStacks - 1), Phials.titheEngine.minKillsRequired, Phials.titheEngine.baseKillsRequired);
            if (this.titheKillsCounter >= requiredKills) {
                this.titheKillsCounter -= requiredKills;
                this.titheCharges++;
                this.titheChargeGainedTimer = 1.0;
            }
        }

        // Make sure HUD picks up the change
        UI.dirty = true;
    }

    resetKillSession() {
        this.killStats.currentSession = 0;
        this.killStats.nonEliteSession = 0;
        this.killStats.bossesSession = 0;
        this.weaponRerollsUsed = 0;
        UI.dirty = true;
    }
}
