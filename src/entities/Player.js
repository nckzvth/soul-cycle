import { SLOTS } from "../data/Constants.js";
import { clamp, dist2 } from "../core/Utils.js";
import { keys, mouse } from "../core/Input.js";
import UI from "../systems/UI.js";
import { BALANCE } from "../data/Balance.js";
import Game from "../core/Game.js";
import { Phials } from "../data/Phials.js";
import { HammerProjectile, AegisPulse, DashTrail, TitheExplosion, ScytheSlash } from "./Projectile.js";
import ParticleSystem from "../systems/Particles.js";
import StatsSystem from "../systems/StatsSystem.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import StatusSystem from "../systems/StatusSystem.js";
import ProgressionSystem from "../systems/ProgressionSystem.js";
import { color as c } from "../data/ColorTuning.js";
import Assets from "../core/Assets.js";
import SpriteSheet from "../render/SpriteSheet.js";
import Animation from "../render/Animation.js";
import { PLAYER_SPRITE_CONFIG } from "../data/PlayerSprites.js";
import EffectSystem from "../systems/EffectSystem.js";
import { FeatureFlags } from "../core/FeatureFlags.js";
import { buildActivePhialEffectSources } from "../data/PhialEffectDefs.js";
import { ProfileStore } from "../core/ProfileStore.js";
import { getWeaponConfigByCls, normalizeWeaponCls } from "../data/Weapons.js";
import { LevelToSocketLevel, getUnlockedSkillIdsForSocket } from "../data/PerkSockets.js";
import { SKILLS } from "../data/Skills.js";
import { StatusId } from "../data/Vocabulary.js";
import { GolemMinion } from "./Minions.js";
import { buildAttributeMasteryEffectSources, isMasteryGameplayActive } from "../systems/AttributeMasterySystem.js";

function triggerActivePhialEffects(player, trigger, ctx, { shadow } = {}) {
    try {
        let mastery = [];
        if (isMasteryGameplayActive(ctx?.state)) {
            // Runs build mastery sources once at run start; training arena needs them live-updated.
            if (ctx?.state?.isTrainingArena) {
                if (!Game.profile) {
                    try { Game.profile = ProfileStore.load(); } catch { /* ignore */ }
                }
                mastery = buildAttributeMasteryEffectSources(player, Game.profile, ctx.state);
                player._attributeMasteryEffectSources = mastery;
            } else if (Array.isArray(player?._attributeMasteryEffectSources)) {
                mastery = player._attributeMasteryEffectSources;
            }
        }
        EffectSystem.setActiveSources([...buildActivePhialEffectSources(player), ...mastery]);
        EffectSystem.trigger(trigger, ctx, { shadow: !!shadow });
    } catch {
        // Never allow effect validation to crash gameplay.
    }
}

let _skillById = null;
function getSkillDefById(id) {
    if (!_skillById) {
        _skillById = new Map();
        for (const sk of SKILLS) _skillById.set(sk.id, sk);
    }
    return _skillById.get(id) || null;
}

function grantSkillOnce(player, skillId) {
    if (!player?.skills || !skillId) return false;
    if ((player.skills.get(skillId) || 0) > 0) return false;
    player.skills.set(skillId, 1);

    const picked = getSkillDefById(skillId);
    if (picked) {
        player.skillMeta = player.skillMeta || { exclusive: new Map(), flags: new Set() };
        if (picked.exclusiveGroup && picked.exclusiveKey) {
            player.skillMeta.exclusive.set(picked.exclusiveGroup, picked.exclusiveKey);
            player.skillMeta.flags.add(`${picked.exclusiveGroup}:${picked.exclusiveKey}`);
        }
        if (Array.isArray(picked.flagAdds)) {
            picked.flagAdds.forEach(f => player.skillMeta.flags.add(f));
        }
    }
    return true;
}

function applyArmoryMilestonePerkIfAny(player, level) {
    if (!FeatureFlags.isOn("progression.preRunWeaponPerks")) return;
    const socketKey = LevelToSocketLevel[level];
    if (!socketKey) return;

    // Ensure profile is present.
    if (!Game.profile) {
        try { Game.profile = ProfileStore.load(); } catch { /* ignore */ }
    }
    const profile = Game.profile;

    const weaponCls = player?.gear?.weapon?.cls || null;
    const cfg = getWeaponConfigByCls(weaponCls);
    const weaponId = cfg?.weaponId || null;
    if (!weaponId) return;

    const selected = profile?.armory?.perkSocketsByWeapon?.[weaponId]?.[socketKey] || null;
    if (!selected) return;

    const metaEnabled = FeatureFlags.isOn("progression.metaMasteryEnabled");
    const weaponMasteryLevel = metaEnabled ? (profile?.mastery?.weapons?.[weaponId]?.level || 0) : 0;
    const eligible = getUnlockedSkillIdsForSocket(weaponId, socketKey, { weaponMasteryLevel, metaEnabled });
    if (!eligible.includes(selected)) return;

    const granted = grantSkillOnce(player, selected);
    if (granted) {
        const sk = getSkillDefById(selected);
        UI.toast(sk?.name ? `PERK ONLINE: ${sk.name}` : "PERK ONLINE");
    }
}

export default class PlayerObj {
    constructor() {
        this.isPlayer = true;
        // Physics & Transform
        this.x = 0; 
        this.y = 0; 
        this.r = 12; 
        
        // Visuals (spritesheet-driven; collision stays circle-based via `r`)
        const spCfg = PLAYER_SPRITE_CONFIG;
        this._sprite = {
            enabled: true,
            scale: spCfg.scale,
            offset: { x: spCfg.offset.x, y: spCfg.offset.y },
            shadow: spCfg.shadow,
            pixelArt: spCfg.pixelArt,
            collisionLocalBounds: null,

            framesPerDir: spCfg.framesPerDir,
            dirCount: spCfg.dirCount,
            dir: 0,

            aim: { x: 1, y: 0 },
            move: { x: 0, y: 0 },

            state: "idle", // idle | run | runBack | strafeL | strafeR | attack | die
            attackTimer: 0,
            shot: { since: 999, hold: 0, frameOverride: null },

            sheets: null,
            anims: null,
        };
        
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
        this.maxDashCharges = BALANCE.player.baseDashCharges;
        this.dashCharges = BALANCE.player.baseDashCharges;
        this.dashRechargeTimer = 0;
        this._masteryDashRechargeMult = 1.0;
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
        this.salvoDuration = 0;
        this.salvoProcCd = 0;
        this.aegisCooldownTimer = 0;
        this.aegisActiveTimer = 0;
        this.aegisDamageMultiplier = 1;
        this.titheKillsCounter = 0;
        this.titheCharges = 0;
        this.titheChargeGainedTimer = 0;
        this.titheHotTimer = 0;
        this.titheHotTickTimer = 0;
        this.titheHotTickInterval = 0.5;
        this.titheHotHealPerTick = 0;
        this.titheHotRemainingHeal = 0;

        // Temporary buffs
        this.soulMagnetTimer = 0;
        this.combatBuffs = { powerMult: 1.0, moveSpeedMult: 1.0, attackSpeedMult: 1.0 };
        this.combatBuffTimers = { powerMult: 0 };
        this._masteryDamageTakenMultFactor = 1.0;

        // Weapon state (run-reset). Used for "class" mechanics like repeater windup/cyclone.
        this.weaponState = {
            repeater: { windup: 0, gustCounter: 0, vortexBudget: 0, vortexBudgetTimer: 0, cycloneProcCd: 0, cycloneWindowTime: 0 },
            staff: { currentTime: 0, voltage: 0, currentVfxTimer: 0, voltageVfxTimer: 0, currentJustGained: false, circuitNext: "relay" },
            hammer: { heat: 0, igniteCd: 0, heatVfxTimer: 0 },
            scythe: { comboStep: 0, comboTimer: 0 }
        };
        
        // Meta
        this.attr = { might: 0, alacrity: 0, will: 0, constitution: 0, pts: 0 };
        this.totalAttr = { might: 0, alacrity: 0, will: 0, constitution: 0 };
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
        this.salvoDuration = 0;
        this.salvoProcCd = 0;
        this.aegisCooldownTimer = 0;
        this.aegisActiveTimer = 0;
        this.aegisDamageMultiplier = 1;
        if (this.stats) this.stats.damageTakenMult = 1;
        this.titheKillsCounter = 0;
        this.titheCharges = 0;
        this.titheChargeGainedTimer = 0;
        this.titheHotTimer = 0;
        this.titheHotTickTimer = 0;
        this.titheHotHealPerTick = 0;
        this.titheHotRemainingHeal = 0;
    }

    clearSkills() {
        this.skills.clear();
        this.skillMeta = { exclusive: new Map(), flags: new Set() };
        this.weaponState = {
            repeater: { windup: 0, gustCounter: 0, vortexBudget: 0, vortexBudgetTimer: 0, cycloneProcCd: 0, cycloneWindowTime: 0 },
            staff: { currentTime: 0, voltage: 0, currentVfxTimer: 0, voltageVfxTimer: 0, currentJustGained: false, circuitNext: "relay" },
            hammer: { heat: 0, igniteCd: 0, heatVfxTimer: 0 },
            scythe: { comboStep: 0, comboTimer: 0 }
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
            if (!FeatureFlags.isOn("progression.effectSystemEnabled")) {
                this.updatePhials(dt, scene);
            }
        }

        // EffectSystem: when enabled, drives all shipped phial behavior; shadow mode remains a migration tool.
        if (allowCombat) {
            const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
            const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
            if (enabled || shadow) {
                triggerActivePhialEffects(this, EffectSystem.TRIGGERS.tick, { player: this, state: scene, dt, particles: ParticleSystem }, { shadow });
            }
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
        const maxDash = this.maxDashCharges || BALANCE.player.baseDashCharges;
        const rechargeMult =
            (typeof this._masteryDashRechargeMult === "number" && Number.isFinite(this._masteryDashRechargeMult))
                ? this._masteryDashRechargeMult
                : 1.0;
        if (this.dashCharges < maxDash) {
            this.dashRechargeTimer += dt * Math.max(0.05, rechargeMult);
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

        // 6. Visuals (aim-facing directional animation)
        this._updateSprite(dt, scene, allowCombat);
    }

    _ensureSpriteAssets() {
        const sp = this._sprite;
        if (!sp?.enabled) return false;
        if (sp.sheets && sp.anims) {
            if (!sp.collisionLocalBounds) {
                sp.collisionLocalBounds =
                    this._computeSpriteCollisionLocalBounds(sp.sheets.idle) ||
                    PLAYER_SPRITE_CONFIG.collision?.fallbackLocalBounds ||
                    null;
            }
            return true;
        }

        const cfg = PLAYER_SPRITE_CONFIG;
        const states = cfg?.states || {};

        // If preload hasn't finished (or assets missing), keep fallback rendering.
        const images = {};
        for (const [state, def] of Object.entries(states)) {
            const img = Assets.getImage(def.imageKey);
            if (!img) return false;
            images[state] = img;
        }

        sp.sheets = {};
        sp.anims = {};
        for (const [state, def] of Object.entries(states)) {
            sp.sheets[state] = new SpriteSheet(images[state], { frameWidth: cfg.frameWidth, frameHeight: cfg.frameHeight });
            sp.anims[state] = new Animation({ fps: def.fps, frameCount: cfg.framesPerDir, loop: def.loop });
        }

        // Compute a stable collision "footprint" box from alpha once images are ready.
        sp.collisionLocalBounds = this._computeSpriteCollisionLocalBounds(sp.sheets.idle) || cfg.collision?.fallbackLocalBounds || null;
        return true;
    }

    _computeSpriteCollisionLocalBounds(sheet) {
        const cfg = PLAYER_SPRITE_CONFIG;
        const cCfg = cfg.collision || {};
        if (cCfg.mode !== "alphaFootprint") return null;
        if (!sheet?.image?.complete) return null;

        const img = sheet.image;
        const fw = sheet.frameWidth;
        const fh = sheet.frameHeight;
        const yStart = Math.max(0, Math.min(fh - 1, Math.floor(fh * (cCfg.footprintYStartRatio ?? 0.55))));
        const alphaT = Math.max(0, Math.min(255, Math.floor(cCfg.alphaThreshold ?? 10)));

        // Offscreen scan (one-time). Keep it local to avoid global allocations.
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 1;
        canvas.height = img.height || 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        let data;
        try {
            data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        } catch {
            return null;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const w = canvas.width;
        const h = canvas.height;
        for (let y = 0; y < h; y++) {
            const ly = y % fh;
            if (ly < yStart) continue;
            const row = y * w * 4;
            for (let x = 0; x < w; x++) {
                const a = data[row + x * 4 + 3];
                if (a <= alphaT) continue;
                const lx = x % fw;
                if (lx < minX) minX = lx;
                if (lx > maxX) maxX = lx;
                if (ly < minY) minY = ly;
                if (ly > maxY) maxY = ly;
            }
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || maxX < minX || maxY < minY) return null;
        return { minX, minY, maxX, maxY };
    }

    getCollisionAABB(padding = 0) {
        const sp = this._sprite;
        const cfg = PLAYER_SPRITE_CONFIG;
        const fw = cfg.frameWidth;
        const fh = cfg.frameHeight;
        const scale = sp?.scale ?? cfg.scale ?? 1;
        const offX = sp?.offset?.x || 0;
        const offY = sp?.offset?.y || 0;

        const spriteX = this.x - (fw * scale) / 2 + offX;
        const spriteY = this.y - (fh * scale) / 2 + offY;

        const b = sp?.collisionLocalBounds || cfg.collision?.fallbackLocalBounds;
        const pad = Math.max(0, (cfg.collision?.paddingPx ?? 0) + (Number(padding) || 0));

        if (b && Number.isFinite(b.minX)) {
            const x = spriteX + b.minX * scale - pad;
            const y = spriteY + b.minY * scale - pad;
            const w = (b.maxX - b.minX + 1) * scale + pad * 2;
            const h = (b.maxY - b.minY + 1) * scale + pad * 2;
            return { x, y, w, h };
        }

        // Fallback: legacy circle as an AABB.
        const r = this.r || 12;
        return { x: this.x - r, y: this.y - r, w: r * 2, h: r * 2 };
    }

    _setSpriteState(next) {
        const sp = this._sprite;
        if (!sp || sp.state === next) return;
        sp.state = next;
        if (!this._ensureSpriteAssets()) return;
        const anim = sp.anims?.[next];
        anim?.reset?.();
    }

    _updateSprite(dt, scene, allowCombat) {
        const sp = this._sprite;
        if (!sp?.enabled) return;

        sp.attackTimer = Math.max(0, (sp.attackTimer || 0) - Math.max(0, dt || 0));
        if (sp.shot) {
            sp.shot.since = Math.max(0, (sp.shot.since ?? 999) + Math.max(0, dt || 0));
            sp.shot.frameOverride = null;
        }

        // Aim is always mouse-relative (world-space).
        let ax = sp.aim.x, ay = sp.aim.y;
        try {
            const wp = Game.screenToWorld(mouse.x, mouse.y);
            const dx = (wp.x - this.x);
            const dy = (wp.y - this.y);
            const d2 = dx * dx + dy * dy;
            if (d2 > 1e-6) {
                const inv = 1 / Math.sqrt(d2);
                ax = dx * inv;
                ay = dy * inv;
                sp.aim.x = ax;
                sp.aim.y = ay;
            }
        } catch {
            // Non-fatal: keep last aim vector.
        }

        // 8-way direction index. Note: canvas y+ is "down", so atan2 is clockwise.
        const angle = Math.atan2(ay, ax);
        const oct = Math.PI / 4;
        sp.dir = ((Math.round(angle / oct) % sp.dirCount) + sp.dirCount) % sp.dirCount; // East=0

        if (this.hp <= 0) {
            this._setSpriteState("die");
            this._ensureSpriteAssets();
            sp.anims?.die?.update?.(dt);
            return;
        }

        const weaponCls = normalizeWeaponCls(this.gear?.weapon?.cls);
        const ranged = !!allowCombat && (weaponCls === "repeater" || weaponCls === "staff");
        const meleeAttack = (sp.attackTimer || 0) > 0;
        const rangedAttack = ranged && (sp.shot?.since ?? 999) < (sp.shot?.hold ?? 0) && this.dashTimer <= 0;
        const attacking = rangedAttack || meleeAttack;

        // Movement vector: dash uses dashVec; otherwise input vector.
        const mvx = this.dashTimer > 0 ? (this.dashVec?.x || 0) : (sp.move.x || 0);
        const mvy = this.dashTimer > 0 ? (this.dashVec?.y || 0) : (sp.move.y || 0);
        const moving = (mvx * mvx + mvy * mvy) > 1e-6;

        if (attacking) {
            const state = "attack";
            this._setSpriteState("attack");

            if (rangedAttack && sp.framesPerDir > 1 && sp.shot) {
                const hold = Math.max(0.08, sp.shot.hold || 0.12);
                const t = Math.max(0, Math.min(0.999, (sp.shot.since || 0) / hold));
                sp.shot.frameOverride = Math.min(sp.framesPerDir - 1, Math.floor(t * sp.framesPerDir));
            }

            if (this._ensureSpriteAssets()) sp.anims?.attack?.update?.(dt);
            return;
        }

        if (!moving) {
            this._setSpriteState("idle");
            if (this._ensureSpriteAssets()) sp.anims?.idle?.update?.(dt);
            return;
        }

        // Locomotion relative to aim direction.
        const dot = mvx * ax + mvy * ay;
        const cross = mvx * ay - mvy * ax;
        const t = 0.35;

        if (dot <= -t) this._setSpriteState("runBack");
        else if (dot >= t) this._setSpriteState("run");
        else if (cross > 0) this._setSpriteState("strafeL");
        else this._setSpriteState("strafeR");

        if (!this._ensureSpriteAssets()) return;
        sp.anims?.[sp.state]?.update?.(dt);
    }

    _drawSprite(ctx, pc) {
        const sp = this._sprite;
        if (!sp?.enabled) return false;
        if (!this._ensureSpriteAssets()) return false;

        const state = this.hp <= 0 ? "die" : (sp.state || "idle");
        const sheet = sp.sheets[state] || sp.sheets.idle;

        if (!sheet?.image?.complete) return false;
        const anim = sp.anims[state] || sp.anims.idle;

        const localFrame =
            state === "attack" && typeof sp.shot?.frameOverride === "number"
                ? sp.shot.frameOverride
                : (anim?.frame ?? 0);
        const frameIndex = (sp.dir * sp.framesPerDir) + localFrame;

        const fw = sheet.frameWidth;
        const fh = sheet.frameHeight;
        const dw = fw * sp.scale;
        const dh = fh * sp.scale;

        const dx = pc.x - dw / 2 + (sp.offset?.x || 0);
        const dy = pc.y - dh / 2 + (sp.offset?.y || 0);

        if (sp.shadow) {
            ctx.save();
            ctx.globalAlpha *= 0.25;
            ctx.fillStyle = c("fx.ink") || "ink";
            ctx.beginPath();
            ctx.arc(pc.x, pc.y + this.r * 0.55, this.r * 0.95, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const prevSmoothing = ctx.imageSmoothingEnabled;
        if (sp.pixelArt) ctx.imageSmoothingEnabled = false;
        sheet.drawFrame(ctx, frameIndex, dx, dy, dw, dh);
        ctx.imageSmoothingEnabled = prevSmoothing;
        return true;
    }

    updateWeaponStates(dt, scene) {
        const repeaterState = this.weaponState?.repeater;
        if (repeaterState && repeaterState.cycloneProcCd > 0) repeaterState.cycloneProcCd = Math.max(0, repeaterState.cycloneProcCd - dt);
        if (repeaterState && repeaterState.cycloneWindowTime > 0) repeaterState.cycloneWindowTime = Math.max(0, repeaterState.cycloneWindowTime - dt);

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
                        ParticleSystem.emit(x, y, vfx.heatColor || { token: "ember", alpha: 0.65 }, count, 0, vfx.heatSize ?? 2.0, vfx.heatLife ?? 0.16, null, { anchoredTo: this });
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
                ParticleSystem.emit(this.x, this.y, vfx.currentBurstColor || { token: "p2", alpha: 0.95 }, vfx.currentBurstCount ?? 16, 160, 3.2, 0.45);
                ParticleSystem.emitText(this.x, this.y - this.r - 16, "CURRENT", { color: vfx.currentTextColor || { token: "p2", alpha: 0.95 }, size: 14, life: 0.7 });
            }

            if (staffState.currentTime > 0) {
                staffState.currentVfxTimer -= dt;
                if (staffState.currentVfxTimer <= 0) {
                    staffState.currentVfxTimer = vfx.currentInterval ?? 0.12;
                    const radius = vfx.currentRadius ?? 22;
                    const x = this.x + (Math.random() - 0.5) * radius * 2;
                    const y = this.y + (Math.random() - 0.5) * radius * 2;
                    ParticleSystem.emit(x, y, vfx.currentColor || { token: "p2", alpha: 0.8 }, vfx.currentCount ?? 1, 0, vfx.currentSize ?? 2.2, vfx.currentLife ?? 0.18, null, { anchoredTo: this });
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
                    ParticleSystem.emit(x, y, vfx.voltageColor || { token: "p1", alpha: 0.85 }, count, 0, vfx.voltageSize ?? 2.0, vfx.voltageLife ?? 0.16, null, { anchoredTo: this });
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
        if (this._sprite) {
            this._sprite.move.x = mx;
            this._sprite.move.y = my;
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
                this.onDash(scene, { phase: "start" });
            }
            this.dashKeyPressed = true;
        } else {
            this.dashKeyPressed = false;
        }

        if (this.dashTimer <= 0 && this.rooted <= 0) {
            // Standard Walk
            let spd = BALANCE.player.walkBaseSpeed * (this.stats.moveSpeedMult || (1 + this.stats.move));
            const moveMult = this.combatBuffs?.moveSpeedMult;
            if (typeof moveMult === "number" && Number.isFinite(moveMult)) spd *= moveMult;
            this.x += mx * spd * dt; 
            this.y += my * spd * dt;
        }
    }

    processDash(dt, scene) {
        const startPos = { x: this.x, y: this.y };
        const prevDashTimer = this.dashTimer;
        this.dashTimer -= dt;
        // Dash speed is fixed high velocity
        this.x += this.dashVec.x * BALANCE.player.dashSpeed * dt; 
        this.y += this.dashVec.y * BALANCE.player.dashSpeed * dt;
        const endPos = { x: this.x, y: this.y };

        const blindStacks = this.getPhialStacks(Phials.blindingStep.id);
        if (blindStacks > 0) {
            scene.shots.push(new DashTrail(startPos, endPos, blindStacks));
        }

        this.onDash(scene, { phase: "tick", startPos, endPos });
        if (prevDashTimer > 0 && this.dashTimer <= 0) {
            this.onDash(scene, { phase: "end", startPos, endPos });
        }
    }

    processCombat(dt, scene) {
        const w = this.gear.weapon;
        if (!w) return;
        const weaponCls = normalizeWeaponCls(w.cls);

        // Scythe combo state (swipe, swipe, harvest).
        const scytheState = this.weaponState?.scythe;
        if (scytheState && scytheState.comboTimer > 0) scytheState.comboTimer = Math.max(0, scytheState.comboTimer - dt);

        // --- Repeater windup/cyclone base kit ---
        const repeaterState = this.weaponState?.repeater;
        const usingRepeater = weaponCls === "repeater";
        const firingRepeater = usingRepeater && mouse.down && this.dashTimer <= 0;
        if (repeaterState) {
            const skillsCfg = BALANCE.skills?.repeater || {};
            const gainBase = skillsCfg.windupGainPerSecond ?? 0.8;
            const decayBase = skillsCfg.windupDecayPerSecond ?? 1.2;

            const gainMult = 1 + (this.stats.repeaterWindupGainMult || 0);
            const decayMult = Math.max(0.05, 1 + (this.stats.repeaterWindupDecayMult || 0));

            if (firingRepeater) repeaterState.windup = Math.min(1, repeaterState.windup + dt * gainBase * gainMult);
            else repeaterState.windup = Math.max(0, repeaterState.windup - dt * decayBase * decayMult);

            // Reaper's Vortex chaining budget (occult keystone limiter).
            if ((this.stats.repeaterReapersVortexEnable || 0) > 0) {
                const budgetMax = skillsCfg.vortexChainBudget ?? 2;
                const regen = skillsCfg.vortexBudgetRegenPerSecond ?? 1.0;
                repeaterState.vortexBudgetTimer += dt;
                while (repeaterState.vortexBudgetTimer >= 1.0) {
                    repeaterState.vortexBudgetTimer -= 1.0;
                    repeaterState.vortexBudget = Math.min(budgetMax, repeaterState.vortexBudget + regen);
                }
            } else {
                repeaterState.vortexBudget = 0;
                repeaterState.vortexBudgetTimer = 0;
            }
        }

        // Scythe: swipe-swipe-harvest (mark) melee combo.
        if (weaponCls === "scythe") {
            const cfg = BALANCE.player.scythe || {};
            const skillsCfg = BALANCE.skills?.scythe || {};

            const baseAttackSpeed = this.stats.attackSpeed || (1 + (this.stats.spd || 0));
            const atkBuff = this.combatBuffs?.attackSpeedMult;
            const attackSpeed = baseAttackSpeed * ((typeof atkBuff === "number" && Number.isFinite(atkBuff)) ? atkBuff : 1.0);
            const cdMult = Math.max(0.15, 1 + (this.stats.scytheCooldownMult || 0));
            const cooldown = (cfg.cooldown ?? 0.34) / Math.max(0.05, attackSpeed) * cdMult;

            if (mouse.down && this.atkCd <= 0 && this.dashTimer <= 0) {
                // Determine aim vector.
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

                const resetSec = cfg.comboResetSec ?? 1.0;
                if (!scytheState) this.weaponState.scythe = { comboStep: 0, comboTimer: 0 };
                const st = this.weaponState.scythe;
                if ((st.comboTimer || 0) <= 0) st.comboStep = 0;
                const step = st.comboStep || 0; // 0,1 = swipe; 2 = harvest
                st.comboStep = (step + 1) % 3;
                st.comboTimer = resetSec;

                const range = (cfg.range ?? 75) * (1 + (this.stats.scytheRangeMult || 0));
                const coneDot = step === 2 ? 0.25 : 0.05; // harvest narrower
                const spec = step === 2 ? DamageSpecs.scytheHarvest() : DamageSpecs.scytheSwipe();
                const coeffMult = 1 + (this.stats.scytheDamageCoeffMult || 0);
                const spec2 = coeffMult !== 1 ? { ...spec, coeff: spec.coeff * coeffMult } : spec;
                const snapshot = DamageSystem.snapshotOutgoing(this, spec2);

                const markDuration = (skillsCfg.markDurationSec ?? 6.0) * (1 + (this.stats.scytheMarkDurationMult || 0));
                const vfx = skillsCfg.vfx || {};

                // Visual slash feedback (Scythe currently has no dedicated sprite attack animation).
                // This is purely VFX and should track combo step and basic skill toggles.
                scene.shots = Array.isArray(scene.shots) ? scene.shots : [];
                scene.shots.push(new ScytheSlash(scene, this, {
                    dirX: dx,
                    dirY: dy,
                    step,
                    radius: range,
                    dual: (this.stats.scytheDualScythesEnable || 0) > 0,
                    range,
                    coneDot,
                    spec: spec2,
                    snapshot,
                    markDuration: step === 2 ? markDuration : 0,
                    markVfx: step === 2 ? {
                        interval: 0.35,
                        color: vfx.markColor || { token: "p4", alpha: 0.9 },
                        count: 1,
                        size: 2.6,
                        life: 0.22,
                        applyText: "MARKED",
                        applyBurstCount: 3,
                        applyBurstSpeed: 120,
                    } : null,
                }));

                // Brief additional recovery after the Harvest finisher.
                const harvestExtra = cfg.harvestCooldownExtraSec ?? 0.12;
                this.atkCd = step === 2 ? (cooldown + Math.max(0, harvestExtra)) : cooldown;
                if (this._sprite) this._sprite.attackTimer = Math.max(this._sprite.attackTimer || 0, 0.22);
                this.onAttack(scene, { weaponCls: "scythe" });
            }

            return;
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

        // Shooting (Repeater/Staff) - Don't shoot while dashing
        if (mouse.down && this.atkCd <= 0 && this.dashTimer <= 0) {
            let attackSpeed = this.stats.attackSpeed || (1 + this.stats.spd);
            const atkBuff = this.combatBuffs?.attackSpeedMult;
            if (typeof atkBuff === "number" && Number.isFinite(atkBuff)) attackSpeed *= atkBuff;
            if (usingRepeater && repeaterState) {
                const skillsCfg = BALANCE.skills?.repeater || {};
                const windupBonus = skillsCfg.windupAttackSpeedBonus ?? 2.0; // at full windup: +200%
                const mult = (1 + repeaterState.windup * windupBonus);
                attackSpeed *= mult;
            }
            let rate = BALANCE.player.repeaterBaseRate / attackSpeed;
            
            if (weaponCls === "repeater") {
                scene.combatSystem.fireRepeater(this, scene);
                this.atkCd = rate;
                this._triggerRangedShotAnim(rate);
                this.onAttack(scene, { weaponCls: "repeater" });
            } else if (weaponCls === "staff") {
                scene.combatSystem.fireZap(this, scene);
                this.atkCd = rate * BALANCE.player.staffRateMult;
                this._triggerRangedShotAnim(rate * BALANCE.player.staffRateMult);
                this.onAttack(scene, { weaponCls: "staff" });
            }
        }
    }

    _triggerRangedShotAnim(shotIntervalSec) {
        const sp = this._sprite;
        if (!sp?.enabled) return;
        const interval = Math.max(0.03, Number(shotIntervalSec) || 0.12);
        // Clamp so very fast repeaters don't look like a seizure strobe.
        const hold = Math.max(0.08, Math.min(0.22, interval * 0.9));
        sp.shot.since = 0;
        sp.shot.hold = hold;
        sp.shot.frameOverride = 0;
    }

    onAttack(state, meta = {}) {
        if (meta?.weaponCls === "hammer" && this._sprite) {
            // Hold a short "attack" state for melee swings (ranged uses mouse-hold).
            this._sprite.attackTimer = Math.max(this._sprite.attackTimer || 0, 0.35);
        }

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
	                ParticleSystem.emit(p.x, p.y, vfx.procColor || { token: "p2", alpha: 0.9 }, vfx.procBurstCount ?? 12, vfx.procBurstSpeed ?? 140, vfx.procBurstSize ?? 3.0, vfx.procBurstLife ?? 0.35);
	                ParticleSystem.emitText(p.x, p.y - p.r - 14, "SOUL BLAST", { color: vfx.textColor || { token: "p2", alpha: 0.95 }, size: 14, life: 0.7 });
	                state?.combatSystem?.fireShockwave?.(p, state, { perkTier: p.perkLevel.might });
	            }
	        }

        // Alacrity: Soul Tempest
	        if ((p.perkLevel?.alacrity || 0) >= 1) {
	            const chance = computeChance(t.alacrity || 0);
	            if (Math.random() < chance) {
	                const vfx = perkVfx.tempest?.vfx || {};
	                ParticleSystem.emit(p.x, p.y, vfx.procColor || { token: "p2", alpha: 0.85 }, 10, 130, 2.7, 0.3);
	                ParticleSystem.emitText(p.x, p.y - p.r - 14, "TEMPEST", { color: vfx.textColor || { token: "p2", alpha: 0.95 }, size: 14, life: 0.7 });
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
	                    ParticleSystem.emit(p.x, p.y, vfx.procColor || { token: "p2", alpha: 0.85 }, 8, 120, 2.6, 0.28);
	                    ParticleSystem.emitText(p.x, p.y - p.r - 14, "WISP", { color: vfx.textColor || { token: "p2", alpha: 0.95 }, size: 14, life: 0.7 });
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
            const phialsOnly = FeatureFlags.isOn("progression.phialsOnlyLevelUps");
            const preRunPerks = FeatureFlags.isOn("progression.preRunWeaponPerks");
            if (phialsOnly) {
                this.levelPicks.phial++;
            } else {
                this.levelPicks.attribute++;
                if (!preRunPerks) this.levelPicks.weapon++;
                this.levelPicks.phial++;
            }

            // Phase 5: pre-run perks activate automatically at milestone levels.
            if (preRunPerks) {
                try {
                    applyArmoryMilestonePerkIfAny(this, this.lvl);
                } catch {
                    // Never allow perk activation to break leveling.
                }
            }
            UI.toast("LEVEL UP!");
            const prevHp = this.hp;
            this.recalc();
            const healPct = BALANCE?.progression?.levelUpHealPctMaxHp ?? 0;
            if (healPct > 0) {
                this.hp = Math.min(this.hpMax, prevHp + this.hpMax * healPct);
            } else {
                this.hp = Math.min(this.hpMax, prevHp);
            }
            req = ProgressionSystem.getXpRequired(this.lvl);
            
            // Trigger VFX
            ParticleSystem.emit(this.x, this.y, 'p3', 20, 150, 4, 1.5);
            ParticleSystem.emit(this.x, this.y - this.r, 'p3', 1, 0, 300, 0.5, null, { beam: true, anchoredTo: this });
        }
        UI.dirty = true;
    }
    
    takeDamage(amount, source) {
        const spec = { id: "legacy:incoming", base: amount, coeff: 0, canCrit: false, tags: ["incoming"], element: "physical", snapshot: true };
        DamageSystem.dealPlayerDamage(source, this, spec, { state: Game.stateManager?.currentState, ui: UI });
    }

    onDeath() {
        try {
            Game?.endRun?.("death", Game.stateManager?.currentState);
        } catch {
            // ignore
        }
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
        if (this.salvoProcCd > 0) {
            this.salvoProcCd = Math.max(0, this.salvoProcCd - dt);
        }
        if (this.salvoDuration > 0) {
            this.salvoDuration = Math.max(0, this.salvoDuration - dt);
            if (this.salvoDuration <= 0) {
                this.salvoCharges = 0;
            }
        }
        // If you spend the last charge early, end the active window (ICD still applies).
        if ((this.salvoCharges || 0) <= 0 && (this.salvoDuration || 0) > 0) {
            this.salvoDuration = 0;
        }

        // Tithe Engine
        if (this.titheChargeGainedTimer > 0) {
            this.titheChargeGainedTimer -= dt;
        }

        // Tithe Harvest (heal-over-time)
        if ((this.titheHotTimer || 0) > 0) {
            this.titheHotTimer = Math.max(0, this.titheHotTimer - dt);
            this.titheHotTickTimer = (this.titheHotTickTimer || 0) - dt;

            const tickInterval = Math.max(0.05, this.titheHotTickInterval || 0.5);
            while (this.titheHotTimer > 0 && this.titheHotTickTimer <= 0) {
                this.titheHotTickTimer += tickInterval;
                const heal = Math.min(this.titheHotRemainingHeal || 0, this.titheHotHealPerTick || 0);
                if (heal > 0) {
                    this.hp = Math.min(this.hpMax, this.hp + heal);
                    this.titheHotRemainingHeal = Math.max(0, (this.titheHotRemainingHeal || 0) - heal);
                }
                if ((this.titheHotRemainingHeal || 0) <= 0) break;
            }

            if (this.titheHotTimer <= 0 || (this.titheHotRemainingHeal || 0) <= 0) {
                this.titheHotTimer = 0;
                this.titheHotRemainingHeal = 0;
            }
        }
    }

    applyTitheHarvest(stacks = 1) {
        const cfg = Phials?.titheEngine?.harvest || {};
        const n = Math.max(0, (stacks || 1) - 1);
        const noRefresh = cfg.noRefreshWhileActive !== false;

        // HoT (capped total healing per proc)
        if (!(noRefresh && (this.titheHotTimer || 0) > 0)) {
            const hpMax = this.hpMax || 0;
            const perTickPct =
                (cfg.hotHealPctMaxHpPerTickBase || 0) +
                (cfg.hotHealPctMaxHpPerTickPerStack || 0) * n;
            const maxTotalPctRaw =
                (cfg.hotMaxTotalHealPctBase || 0) +
                (cfg.hotMaxTotalHealPctPerStack || 0) * n;
            const cap = cfg.hotMaxTotalHealPctCap;
            const maxTotalPct = typeof cap === "number" ? Math.min(cap, maxTotalPctRaw) : maxTotalPctRaw;

            this.titheHotTickInterval = Math.max(0.05, cfg.hotTickSec || 0.5);
            this.titheHotHealPerTick = Math.max(0, hpMax * Math.max(0, perTickPct));
            this.titheHotRemainingHeal = Math.max(0, hpMax * Math.max(0, maxTotalPct));
            this.titheHotTimer = Math.max(0, cfg.hotDurationSec || 3.0);
            this.titheHotTickTimer = 0;
        }

        // Very short power buff (no refresh while active)
        if (!(noRefresh && (this.combatBuffTimers.powerMult || 0) > 0)) {
            const add =
                (cfg.buffPowerMultAddBase || 0) +
                (cfg.buffPowerMultAddPerStack || 0) * n;
            this.combatBuffs.powerMult = 1.0 + Math.max(0, add);
            this.combatBuffTimers.powerMult = Math.max(0, cfg.buffDurationSec || 1.25);
        }
    }

    onGaugeFill(state) {
        const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
        const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
        if (enabled || shadow) {
            triggerActivePhialEffects(this, EffectSystem.TRIGGERS.gaugeFill, { player: this, state, particles: ParticleSystem }, { shadow });
            if (enabled) return;
        }

        const salvoStacks = this.getPhialStacks(Phials.soulSalvo.id);
        if (salvoStacks > 0) {
            const cfg = Phials.soulSalvo || {};
            const grantOnlyWhenEmpty = cfg.grantOnlyWhenEmpty !== false;
            const activeCharges = (this.salvoCharges || 0) > 0;
            const onCd = (this.salvoProcCd || 0) > 0;
            if ((grantOnlyWhenEmpty && activeCharges) || onCd) {
                // Keep a small feedback pulse, but do not grant more charges.
                this.salvoGlow = Math.max(this.salvoGlow || 0, 0.35);
                return;
            }

            const chargesToAdd = (cfg.baseChargesPerFill || 0) + (cfg.chargesPerStack || 0) * (salvoStacks - 1);
            const maxCharges = (cfg.maxChargesBase || chargesToAdd) + (cfg.maxChargesPerStack || 0) * (salvoStacks - 1);
            this.salvoCharges = Math.max(0, Math.min(maxCharges, chargesToAdd));
            this.salvoDuration = Math.max(0, cfg.durationSec || 5.0);
            this.salvoProcCd = Math.max(0, cfg.procIcdSec || 8.0);
            this.salvoGlow = 2.0; // Strong glow for proc moment
        }
    }

    onHit(target, state, hit) {
        // --- Weapon upgrade hooks (keep phials independent) ---
        const weapon = this.gear.weapon;
        if (normalizeWeaponCls(weapon?.cls) === "repeater") {
            const skillsCfg = BALANCE.skills?.repeater || {};
            const repeaterState = this.weaponState?.repeater;
            const spec = hit?.spec;
            const meta = hit?.meta || {};

            // Cyclone proc: chance on repeater bullet hits (not from Cyclone-burst bullets).
            const isRepeaterBullet =
                !!spec &&
                Array.isArray(spec.tags) &&
                spec.tags.includes("repeater") &&
                spec.tags.includes("projectile");
            if (isRepeaterBullet && meta.procSource !== "repeater:cycloneBurst" && repeaterState && repeaterState.cycloneProcCd <= 0) {
                const base = skillsCfg.cycloneProcChanceBase ?? 0.01;
                const add = this.stats.repeaterCycloneProcChanceAdd || 0;
                const mult = 1 + (this.stats.repeaterCycloneProcChanceMult || 0);
                const windupBonus = skillsCfg.cycloneProcWindupBonus ?? 1.5; // at full windup: +150% chance

                let chance = (base + add) * mult;
                chance *= (1 + (repeaterState.windup || 0) * windupBonus);
                chance = Math.max(0, Math.min(1, chance));

                if (Math.random() < chance) {
                    const icd = skillsCfg.cycloneProcIcd ?? 0.2;
                    repeaterState.cycloneProcCd = icd;
                    repeaterState.cycloneWindowTime = skillsCfg.cycloneProcWindow ?? 0.5;

	                    // Burst VFX
	                    const vfx = skillsCfg.vfx || {};
	                    ParticleSystem.emit(this.x, this.y, vfx.cycloneBurstColor || { token: "p2", alpha: 0.9 }, vfx.cycloneBurstCount ?? 18, 180, 3, 0.4);
	                    ParticleSystem.emitText(this.x, this.y - this.r - 16, "CYCLONE", { color: vfx.cycloneTextColor || { token: "p1", alpha: 0.95 }, size: 14, life: 0.7 });

                    // Spawn the 360° spray.
                    state?.combatSystem?.fireRepeaterCycloneBurst?.(this, state);

                    // Gust Spray (upgrade): cyclone bursts also emit a gust hit.
                    if ((this.stats.repeaterGustEnable || 0) > 0) {
                        const gustSpecBase = DamageSpecs.repeaterGust();
                        const coeffMult2 = 1 + (this.stats.repeaterGustRateMult || 0);
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

            // Apply Hex on repeater hits.
            if ((this.stats.repeaterHexEnable || 0) > 0) {
                const duration = (skillsCfg.hexDuration ?? 3.0) * (1 + (this.stats.repeaterHexDurationMult || 0));
                const maxStacks = (skillsCfg.hexMaxStacks ?? 5);
                const debtPopEnabled = (this.stats.repeaterDebtPopEnable || 0) > 0;
                const debtCoeffMult = 1 + (this.stats.repeaterDebtPopCoeffMult || 0);
                const vortexEnabled = (this.stats.repeaterReapersVortexEnable || 0) > 0;

                const makePopSpec = () => {
                    const base = DamageSpecs.repeaterDebtPop();
                    return { ...base, coeff: base.coeff * debtCoeffMult };
                };

                StatusSystem.applyStatus(target, "repeater:hex", {
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
	                        color: skillsCfg?.vfx?.hexColor || { token: "arcaneDeep", alpha: 0.85 },
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
                        if (vortexEnabled && repeaterState && repeaterState.cycloneWindowTime > 0 && repeaterState.vortexBudget > 0) {
                            const chainRadius = skillsCfg.vortexChainRadius ?? 220;
                            let best = null, bestD2 = chainRadius * chainRadius;
                            stState?.enemies?.forEach(e => {
                                if (e.dead || e === tgt) return;
                                if (!StatusSystem.hasStatus(e, "repeater:hex")) return;
                                const d2 = dist2(tgt.x, tgt.y, e.x, e.y);
                                if (d2 < bestD2) { bestD2 = d2; best = e; }
                            });
                            if (best) {
                                repeaterState.vortexBudget = Math.max(0, repeaterState.vortexBudget - 1);
                                // Consume the chained hex to prevent double-pop later.
                                if (best.statuses) best.statuses.delete("repeater:hex");
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
            if ((this.stats.repeaterSoulPressureEnable || 0) > 0 && repeaterState && StatusSystem.hasStatus(target, "repeater:hex")) {
                const sustainMult = 1 + (this.stats.repeaterCycloneSustainMult || 0);
                const windupGain = (skillsCfg.soulPressureWindupOnHit ?? 0.08) * sustainMult;
                const windowExtend = (skillsCfg.soulPressureCycloneExtend ?? 0.08) * sustainMult;
                repeaterState.windup = Math.min(1, repeaterState.windup + windupGain);
                if (repeaterState.cycloneWindowTime > 0) repeaterState.cycloneWindowTime += windowExtend;
            }
        }

        // Phial effects: EffectSystem cutover lives here so weapon hooks above keep their legacy ordering.
        const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
        const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
        if (enabled || shadow) {
            triggerActivePhialEffects(this, EffectSystem.TRIGGERS.hit, { player: this, state, target, hit, particles: ParticleSystem }, { shadow });
            if (enabled) return;
        }

        // Legacy: Tithe Engine explosion (disabled once EffectSystem cutover is enabled).
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

    onDash(state, dash = null) {
        const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
        const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
        if (enabled || shadow) {
            triggerActivePhialEffects(this, EffectSystem.TRIGGERS.dash, { player: this, state, dash, particles: ParticleSystem }, { shadow });
            if (enabled) return;
        }
        if (dash?.phase && dash.phase !== "tick") return;
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
        const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
        const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
        if (enabled || shadow) {
            triggerActivePhialEffects(this, EffectSystem.TRIGGERS.damageTaken, { player: this, state: Game.stateManager?.currentState, source, particles: ParticleSystem }, { shadow });
            if (enabled) return;
        }
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

    // --- SCYTHE (Phase 7) ---
    onScytheMarkedDeath(state, enemy) {
        const w = this.gear?.weapon;
        if (!w || w.cls !== "scythe") return;
        if (!state) return;

        state.minions = Array.isArray(state.minions) ? state.minions : [];
        const alive = state.minions.filter(m => m && m.isMinion && !m.dead);

        const cfg = BALANCE.skills?.scythe || {};
        const cap = Math.max(0, Math.floor((cfg.golemCapBase ?? 3) + (this.stats.scytheGolemCapAdd || 0)));

        if (alive.length < cap) {
            const aspect = (alive.length % 2 === 0) ? "Stone" : "Bone";
            const golem = new GolemMinion(state, this, enemy?.x ?? this.x, enemy?.y ?? this.y, { aspect });

            // Scale baseline HP modestly with Constitution to reward investment.
            const con = this.totalAttr?.constitution || 0;
            const bonus = Math.max(0, Math.floor(con * 0.6));
            golem.hpMax = Math.max(10, golem.hpMax + bonus + (this.stats.scytheGolemHpAdd || 0));
            golem.hp = golem.hpMax;

            state.minions.push(golem);
            ParticleSystem.emit(golem.x, golem.y, c("player.guard", 0.9) || { token: "p4", alpha: 0.9 }, 10, 140, 2.8, 0.3);
            return;
        }

        const healPct = Math.max(0, (cfg.golemHealPctOverflow ?? 0.18) + (this.stats.scytheGolemHealPctAdd || 0));
        for (const m of alive) {
            if (m && typeof m.healPctMax === "function") m.healPctMax(healPct);
        }
        ParticleSystem.emit(enemy?.x ?? this.x, enemy?.y ?? this.y, c("player.guard", 0.75) || { token: "p4", alpha: 0.75 }, 8, 90, 2.4, 0.25);
    }

    draw(ctx, s) {
        let pc = s(this.x, this.y);
        
        // Ashen Halo
        const haloStacks = this.getPhialStacks(Phials.ashenHalo.id);
        if (haloStacks > 0) {
            const radius = Phials.ashenHalo.baseRadius + Phials.ashenHalo.radiusPerStack * (haloStacks - 1);
            const gradient = ctx.createRadialGradient(pc.x, pc.y, 0, pc.x, pc.y, radius);
            const pulse = Math.sin(Game.time * 5) * 0.1 + 0.9;
            gradient.addColorStop(0, c("fx.ember", 0) || "transparent");
            gradient.addColorStop(0.7, c("fx.ember", 0.1 * pulse) || "ember");
            gradient.addColorStop(1, c("fx.emberDeep", 0.3 * pulse) || "emberDeep");
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pc.x, pc.y, radius, 0, 6.28);
            ctx.fill();
        }

        // Witchglass Aegis
        if (this.aegisActiveTimer > 0) {
            const alpha = (this.aegisActiveTimer / (Phials.witchglassAegis.baseDuration + Phials.witchglassAegis.durationPerStack * (this.getPhialStacks(Phials.witchglassAegis.id) - 1))) * 0.8;
            const flicker = Math.random() > 0.2 ? alpha : alpha * 0.5;
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, flicker));
            // Guard/shield: P4 with an ink under-stroke for the rim rule.
            ctx.strokeStyle = c("fx.ink") || "ink";
            ctx.lineWidth = 4;
            const segments = 6;
            const segmentAngle = (Math.PI * 2) / segments;
            for (let i = 0; i < segments; i++) {
                ctx.beginPath();
                ctx.arc(pc.x, pc.y, this.r + 8, i * segmentAngle + segmentAngle * 0.1, (i + 1) * segmentAngle - segmentAngle * 0.1);
                ctx.stroke();
            }
            ctx.strokeStyle = c("player.guard") || "p4";
            ctx.lineWidth = 2;
            for (let i = 0; i < segments; i++) {
                ctx.beginPath();
                ctx.arc(pc.x, pc.y, this.r + 8, i * segmentAngle + segmentAngle * 0.1, (i + 1) * segmentAngle - segmentAngle * 0.1);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Player sprite (fallback to legacy circle marker if spritesheets not ready).
        if (!this._drawSprite(ctx, pc)) {
            // Legacy marker: P2 fill with mandatory ink rim.
            ctx.fillStyle = c("fx.ink") || "ink";
            ctx.beginPath();
            ctx.arc(pc.x, pc.y, 14, 0, 6.28);
            ctx.fill();
            ctx.fillStyle = c("player.core") || "p2";
            ctx.beginPath();
            ctx.arc(pc.x, pc.y, 12, 0, 6.28);
            ctx.fill();
        }

        // Salvo Glyphs
        if (this.salvoCharges > 0) {
            const angleStep = Math.PI * 2 / this.salvoCharges;
            for (let i = 0; i < this.salvoCharges; i++) {
                const angle = i * angleStep + Game.time * 2;
                const x = pc.x + Math.cos(angle) * 20;
                const y = pc.y + Math.sin(angle) * 20;
                ctx.save();
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = c("fx.ink") || "ink";
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = c("player.core") || "p2";
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // Tithe Charge Rune
        if (this.titheCharges > 0) {
            const alpha = this.titheChargeGainedTimer > 0 ? (this.titheChargeGainedTimer / 1.0) * 0.5 + 0.5 : 1.0;
            const angle = Game.time * 4;
            const x = pc.x + Math.cos(angle) * 30;
            const y = pc.y + Math.sin(angle) * 30;
            ctx.fillStyle = c("fx.bloodBright", alpha) || "bloodBright";
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

        const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
        const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
        if (enabled || shadow) {
            triggerActivePhialEffects(this, EffectSystem.TRIGGERS.kill, { player: this, state: Game.stateManager?.currentState, enemy, particles: ParticleSystem }, { shadow });
            if (enabled) {
                UI.dirty = true;
                return;
            }
        }

        const titheStacks = this.getPhialStacks(Phials.titheEngine.id);
        // Tithe Engine: prevent self-fueling from tithe explosion kill chains.
        const killedByTithe = enemy?.lastHitSpecId === "phial:titheExplosion";
        if (titheStacks > 0 && !killedByTithe) {
            ParticleSystem.emit(enemy.x, enemy.y, 'p3', 1, 100, 2, 2.0, this);
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
