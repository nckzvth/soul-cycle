import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";
import { clamp, dist2 } from "../core/Utils.js";
import { keys, mouse } from "../core/Input.js";
import UI from "../systems/UI.js";
import { BALANCE } from "../data/Balance.js";
import Game from "../core/Game.js";
import { Phials } from "../data/Phials.js";
import { HammerProjectile, AegisPulse, DashTrail, TitheExplosion } from "./Projectile.js";
import ParticleSystem from "../systems/Particles.js";

export default class PlayerObj {
    constructor() {
        // Physics & Transform
        this.x = 0; 
        this.y = 0; 
        this.r = 12; 
        
        // Stats
        this.hp = 100; this.hpMax = 100;
        this.lvl = 1; this.xp = 0; this.souls = 0;

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
        
        // Meta
        this.attr = { might: 0, alacrity: 0, will: 0, pts: 0 };
        this.totalAttr = { might: 0, alacrity: 0, will: 0 };
        this.perks = { might: false, alacrity: false, will: false };
        this.timers = { might: 0, alacrity: 0, will: 0 };
        
        this.skills = new Set(); 
        this.stats = {};
        
        // Action States
        this.dashTimer = 0; 
        this.dashVec = { x: 0, y: 0 };
        this.dashHitList = [];
        this.rooted = 0;
        this.atkCd = 0;
        
        this.recalc();
    }

    // --- PHIAL METHODS ---

    addPhial(id) {
        if (!this.phials.has(id)) {
            this.phials.set(id, 0);
        }
        this.phials.set(id, this.phials.get(id) + 1);
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
        this.titheKillsCounter = 0;
        this.titheCharges = 0;
        this.titheChargeGainedTimer = 0;
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
        if (this.rooted <= 0) {
            if (this.dashTimer > 0) {
                this.processDash(dt, scene);
            } else {
                this.processMovement(dt, scene);
            }
        }
        
        // 5. Combat
        if (allowCombat) {
            this.processCombat(dt, scene);
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
            }
            this.dashKeyPressed = true;
        } else {
            this.dashKeyPressed = false;
        }

        if (this.dashTimer <= 0) {
            // Standard Walk
            let spd = BALANCE.player.walkBaseSpeed * (1 + this.stats.move);
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

                scene.shots.push(new HammerProjectile(scene, this, cx, cy, initialAngle));
                this.atkCd = hb.cooldown;

                if (this.salvoCharges > 0) {
                    this.salvoCharges--;
                    scene.shots.push(new HammerProjectile(scene, this, cx, cy, initialAngle + Math.PI, true));
                }
            }
        }

        // Shooting (Pistol/Staff) - Don't shoot while dashing
        if (mouse.down && this.atkCd <= 0 && this.dashTimer <= 0) {
            let rate = BALANCE.player.pistolBaseRate / (1 + this.stats.spd);
            
            if (w.cls === "pistol") {
                scene.combatSystem.firePistol(this, scene);
                this.atkCd = rate;
            } else if (w.cls === "staff") {
                scene.combatSystem.fireZap(this, scene);
                this.atkCd = rate * BALANCE.player.staffRateMult;
            }
        }
    }

    recalc() {
        let t = { might: this.attr.might, alacrity: this.attr.alacrity, will: this.attr.will };
        for (let k in this.gear) if (this.gear[k]) {
            if (this.gear[k].stats.might) t.might += this.gear[k].stats.might;
            if (this.gear[k].stats.alacrity) t.alacrity += this.gear[k].stats.alacrity;
            if (this.gear[k].stats.will) t.will += this.gear[k].stats.will;
        }
        this.totalAttr = t;

        const bp = BALANCE.player;
        let s = {
            hp: bp.baseHp + (this.lvl * bp.hpPerLevel),
            dmg: bp.baseDmg,
            crit: bp.baseCrit,
            spd: bp.baseSpd,
            move: bp.baseMove,
            regen: bp.baseRegen,
            soulGain: bp.baseSoulGain,
            kb: bp.baseKb,
            area: bp.baseArea,
            magnetism: bp.baseMagnetism
        };

        s.dmg += t.might * bp.dmgPerMight;
        s.kb += t.might * bp.kbPerMight;
        s.spd += t.alacrity * bp.spdPerAlacrity;
        s.move += t.alacrity * bp.movePerAlacrity;
        s.area += t.will * bp.areaPerWill;
        s.soulGain += t.will * bp.soulGainPerWill;
        s.magnetism += t.will * BALANCE.pickups.soul.magnetism;

        this.perks.might = t.might >= bp.perkThreshold;
        this.perks.alacrity = t.alacrity >= bp.perkThreshold;
        this.perks.will = t.will >= bp.perkThreshold;

        for (let k in this.gear) if (this.gear[k]) for (let sk in this.gear[k].stats) s[sk] = (s[sk] || 0) + this.gear[k].stats[sk];
        SKILLS.forEach(sk => { if (this.skills.has(sk.id)) for (let k in sk.mods) s[k] = (s[k] || 0) + sk.mods[k]; });
        this.stats = s;

        let oldMax = this.hpMax; this.hpMax = Math.round(s.hp);
        if (this.hpMax > oldMax) this.hp += (this.hpMax - oldMax);
        this.hp = clamp(this.hp, 0, this.hpMax);
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
        this.xp += n; let req = Math.floor(10 * Math.pow(1.2, this.lvl - 1));
        if (this.xp >= req) { this.xp -= req; this.lvl++; this.attr.pts += 3; this.hp = this.hpMax; UI.toast("LEVEL UP!"); this.recalc(); }
        UI.dirty = true;
    }
    
    takeDamage(amount, source) {
        if (this.dashTimer > 0) return; // Invulnerable while dashing
        let finalDamage = amount * this.aegisDamageMultiplier;
        this.hp -= finalDamage;
        this.onDamageTaken(source);
        UI.render(); // Directly call render to ensure UI updates immediately
        if (this.hp <= 0) {
            this.hp = 0;
            document.getElementById('screen_death').classList.add('active');
            document.getElementById('deathSouls').innerText = this.souls;
            document.getElementById('deathLvl').innerText = this.lvl;

            const kills = this.killStats?.currentSession ?? 0;
            document.getElementById('deathKills').innerText = kills;
            Game.paused = true;
        }
    }

    updatePerks(dt, state) {
        if (this.perks.might) {
            this.timers.might -= dt;
            if (this.timers.might <= 0) { this.timers.might = 3.0; state.combatSystem.fireShockwave(this, state); }
        }
        if (this.perks.alacrity) {
            this.timers.alacrity -= dt;
            // Check keys here instead of local state for cleaner logic
            if (this.timers.alacrity <= 0 && (keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"])) { 
                this.timers.alacrity = 0.5; state.combatSystem.fireStaticMine(this, state); 
            }
        }
        if (this.perks.will) {
            this.timers.will -= dt;
            if (this.timers.will <= 0) { this.timers.will = 1.5; state.combatSystem.fireWisp(this, state); }
        }
    }

    updatePhials(dt, state) {
        // Ashen Halo
        const haloStacks = this.getPhialStacks(Phials.ashenHalo.id);
        if (haloStacks > 0) {
            this.haloTimer -= dt;
            if (this.haloTimer <= 0) {
                this.haloTimer = 0.5;
                const damage = (Phials.ashenHalo.baseDamagePerSecond + Phials.ashenHalo.damagePerStack * (haloStacks - 1)) * 0.5;
                const radius = Phials.ashenHalo.baseRadius + Phials.ashenHalo.radiusPerStack * (haloStacks - 1);
                state.enemies.forEach(enemy => {
                    if (dist2(this.x, this.y, enemy.x, enemy.y) < radius * radius) {
                        state.combatSystem.hit(enemy, damage, this, state);
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

    onHit(target, state) {
        const titheStacks = this.getPhialStacks(Phials.titheEngine.id);
        if (titheStacks > 0 && this.titheCharges > 0) {
            this.titheCharges--;
            const explosionDamage =
                Phials.titheEngine.baseExplosionDamage +
                Phials.titheEngine.explosionDamagePerStack * (titheStacks - 1);
            const radius =
                Phials.titheEngine.baseExplosionRadius +
                Phials.titheEngine.radiusPerStack * (titheStacks - 1);
    
            state.shots.push(new TitheExplosion(
                state,
                this,
                target.x,
                target.y,
                radius,
                titheStacks,
                explosionDamage
            ));
        }
    }

    onDash(state) {
        const blindStacks = this.getPhialStacks(Phials.blindingStep.id);
        if (blindStacks > 0) {
            const blindDuration = Phials.blindingStep.baseBlindDuration + Math.floor((blindStacks - 1) / 2) * Phials.blindingStep.blindDurationPerTwoStacks;
            const burnDamage = Phials.blindingStep.baseBurnDamagePerSecond + Phials.blindingStep.burnDamagePerStack * (blindStacks - 1);
            const burnDuration = Phials.blindingStep.baseBurnDuration;
            const knockback = clamp(Phials.blindingStep.baseKnockback + Phials.blindingStep.knockbackPerStack * (blindStacks - 1), 0, Phials.blindingStep.maxKnockback);
            
            state.enemies.forEach(enemy => {
                if (!this.dashHitList.includes(enemy) && dist2(this.x, this.y, enemy.x, enemy.y) < Phials.blindingStep.dashAffectRadius * Phials.blindingStep.dashAffectRadius) {
                    this.dashHitList.push(enemy);
                    enemy.blinded = blindDuration;
                    
                    const angle = Math.atan2(enemy.y - this.y, enemy.x - this.x);
                    enemy.vx += Math.cos(angle) * knockback;
                    enemy.vy += Math.sin(angle) * knockback;

                    if (blindStacks >= 2) {
                        enemy.burns = { duration: burnDuration, damage: burnDamage, timer: 1 };
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
            this.aegisActiveTimer = Phials.witchglassAegis.baseDuration + Phials.witchglassAegis.durationPerStack * (aegisStacks - 1);

            const pulseDamage = Phials.witchglassAegis.pulseBaseDamage + Phials.witchglassAegis.pulseDamagePerStack * (aegisStacks - 1);
            const radius = Phials.witchglassAegis.pulseBaseRadius + Phials.witchglassAegis.pulseRadiusPerStack * (aegisStacks - 1);
            Game.stateManager.currentState.shots.push(new AegisPulse(Game.stateManager.currentState, this, this.x, this.y, radius, aegisStacks, pulseDamage));
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
        if (titheStacks > 0) {
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
        UI.dirty = true;
    }
}