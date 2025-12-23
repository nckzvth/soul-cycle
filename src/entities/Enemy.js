import { dist2, circleIntersectsAABB } from "../core/Utils.js";
import { Hazard, RootWave, EnemyProjectile } from "./Projectile.js";
import Telegraph from "../systems/Telegraph.js";
import CombatSystem from "../systems/CombatSystem.js";
import { BALANCE } from "../data/Balance.js";
import ParticleSystem from "../systems/Particles.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import StatusSystem from "../systems/StatusSystem.js";
import { color as c } from "../data/ColorTuning.js";
import Assets from "../core/Assets.js";
import SpriteSheet from "../render/SpriteSheet.js";
import Animation from "../render/Animation.js";
import { ENEMY_SPRITE_CONFIG, ENEMY_SPRITE_STATES, getEnemySpriteDef } from "../data/EnemySprites.js";

const _spriteCache = new Map();

const DEATH_FADE_SEC = 0.28;
const DEATH_DISSOLVE_INTERVAL = 0.05;

function _makeFlashCanvas(img, alphaThreshold = 18) {
    if (!img) return null;
    const w = img.width || 0;
    const h = img.height || 0;
    if (w <= 0 || h <= 0) return null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0);
    let data;
    try {
        data = ctx.getImageData(0, 0, w, h);
    } catch {
        return null;
    }
    const d = data.data;
    const t = Math.max(0, Math.min(255, Math.floor(alphaThreshold)));
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a <= t) {
            d[i + 3] = 0;
        } else {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
}

/**
 * @class Enemy
 * @description The base class for all enemy types in the game.
 */
export class Enemy {
    constructor(x, y, level, isElite = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.level = level;
        this.isElite = isElite;
        this.dead = false;

        // --- Generic Stats ---
        // These are set as defaults but are expected to be overridden by subclasses.
        this.hp = BALANCE.enemies.baseHp;
        this.hpMax = BALANCE.enemies.baseHp;
        this.speed = BALANCE.enemies.baseSpeed;
        this.r = BALANCE.enemies.baseRadius;
        this.soulValue = BALANCE.enemies.baseSoulValue;

        // --- State Variables ---
        this.flash = 0;
        this.isBuffed = false;
        this.stats = { damageTakenMult: 1.0, knockbackTakenMult: 1.0 };
        this.iframes = 0;
        this.applyFriction = true;
        this.friction = (BALANCE?.enemies?.friction ?? 0.92);
        this.blinded = 0;
        this.damageAccumulator = 0;
        StatusSystem.init(this);

        // Death presentation (corpse): plays die animation then fades/dissolves out.
        this.deathTimer = 0;
        this.deathAnimSec = 0;
        this.deathFadeSec = DEATH_FADE_SEC;
        this.deathVfxTimer = 0;

        // Sprite visuals
        this.spriteType = "enemy";
        this.spriteVariant = null;
        this._sprite = {
            enabled: true,
            dir: 0,
            state: ENEMY_SPRITE_STATES.idle,
            attackTimer: 0,
            specialTimer: 0,
            sheets: null, // shared via cache
            flashSheets: null, // shared via cache
            anims: null,  // per-instance
            scale: ENEMY_SPRITE_CONFIG.defaultScale,
        };

        // Apply elite multipliers for stats that are NOT typically overridden by subclasses (like radius).
        // HP is handled in the subclass constructors to ensure correct order of operations.
        if (this.isElite) {
            this.r *= BALANCE.enemies.eliteRadiusMult;
            this.soulValue *= BALANCE.enemies.eliteSoulMult;
        }
    }

    _getSpriteDef() {
        return getEnemySpriteDef(this.spriteType, this.spriteVariant);
    }

    _ensureSpriteAssets() {
        const sp = this._sprite;
        if (!sp?.enabled) return false;
        const def = this._getSpriteDef();
        if (!def) return false;

        // Per-type scale (can be overridden per enemy instance if needed).
        sp.scale = typeof def.scale === "number" ? def.scale : (ENEMY_SPRITE_CONFIG.defaultScale || 2.0);

        if (sp.sheets && sp.anims) return true;

        const cacheKey = `${def.baseKey}`;
        let cached = _spriteCache.get(cacheKey);
        if (!cached) {
            const sheets = {};
            const flashSheets = {};
            for (const [state, st] of Object.entries(def.states || {})) {
                const img = Assets.getImage(`${def.baseKey}${st.suffix}`);
                if (!img) return false;
                sheets[state] = new SpriteSheet(img, {
                    frameWidth: ENEMY_SPRITE_CONFIG.frameWidth,
                    frameHeight: ENEMY_SPRITE_CONFIG.frameHeight,
                });

                const flashCanvas = _makeFlashCanvas(img, 18);
                if (flashCanvas) {
                    flashSheets[state] = new SpriteSheet(flashCanvas, {
                        frameWidth: ENEMY_SPRITE_CONFIG.frameWidth,
                        frameHeight: ENEMY_SPRITE_CONFIG.frameHeight,
                    });
                }
            }
            cached = { sheets, flashSheets };
            _spriteCache.set(cacheKey, cached);
        }

        sp.sheets = cached.sheets;
        sp.flashSheets = cached.flashSheets;
        sp.anims = {};
        for (const [state, st] of Object.entries(def.states || {})) {
            sp.anims[state] = new Animation({
                fps: st.fps ?? 10,
                frameCount: ENEMY_SPRITE_CONFIG.framesPerDir,
                loop: st.loop !== false,
            });
        }
        return true;
    }

    _setSpriteState(next) {
        const sp = this._sprite;
        if (!sp?.enabled) return;
        if (sp.state === next) return;
        sp.state = next;
        if (!this._ensureSpriteAssets()) return;
        sp.anims?.[next]?.reset?.();
    }

    _getDieAnimDurationSec() {
        const def = this._getSpriteDef();
        const st = def?.states?.[ENEMY_SPRITE_STATES.die];
        const fps = st?.fps ?? 12;
        const frames = ENEMY_SPRITE_CONFIG.framesPerDir ?? 8;
        return Math.max(0.05, frames / Math.max(0.01, fps));
    }

    _beginDeath(state) {
        if (this.deathTimer > 0) return;
        this.dead = true;
        this.vx = 0;
        this.vy = 0;
        this.applyFriction = false;
        this.iframes = 9999;

        this.deathAnimSec = this._getDieAnimDurationSec();
        this.deathFadeSec = DEATH_FADE_SEC;
        this.deathTimer = this.deathAnimSec + this.deathFadeSec;
        this.deathVfxTimer = 0;

        this._setSpriteState(ENEMY_SPRITE_STATES.die);
        this._sprite?.anims?.[ENEMY_SPRITE_STATES.die]?.reset?.();
    }

    _updateDeath(dt, state) {
        this.deathTimer = Math.max(0, (this.deathTimer || 0) - Math.max(0, dt || 0));
        this._setSpriteState(ENEMY_SPRITE_STATES.die);
        this._sprite?.anims?.[ENEMY_SPRITE_STATES.die]?.update?.(dt);

        // Dissolve near the end (subtle ink motes).
        if ((this.deathTimer || 0) > 0 && (this.deathTimer || 0) <= (this.deathFadeSec || DEATH_FADE_SEC)) {
            this.deathVfxTimer = (this.deathVfxTimer || 0) - dt;
            while ((this.deathVfxTimer || 0) <= 0) {
                this.deathVfxTimer += DEATH_DISSOLVE_INTERVAL;
                const rr = (this.r || 12) * 0.75;
                const px = this.x + (Math.random() - 0.5) * rr * 2;
                const py = this.y + (Math.random() - 0.5) * rr * 2;
                ParticleSystem.emit(px, py, c("fx.ink", 0.5) || "ink", 1, 55, 2.0, 0.45);
            }
        }
    }

    triggerAttack(duration = 0.25) {
        const sp = this._sprite;
        if (!sp?.enabled) return;
        sp.attackTimer = Math.max(sp.attackTimer || 0, Math.max(0, duration));
    }

    triggerSpecial(duration = 0.35) {
        const sp = this._sprite;
        if (!sp?.enabled) return;
        sp.specialTimer = Math.max(sp.specialTimer || 0, Math.max(0, duration));
    }

    _updateSprite(dt, player) {
        const sp = this._sprite;
        if (!sp?.enabled) return;

        sp.attackTimer = Math.max(0, (sp.attackTimer || 0) - Math.max(0, dt || 0));
        sp.specialTimer = Math.max(0, (sp.specialTimer || 0) - Math.max(0, dt || 0));

        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > 1e-6) {
                const a = Math.atan2(dy, dx);
                const oct = Math.PI / 4;
                sp.dir = ((Math.round(a / oct) % ENEMY_SPRITE_CONFIG.dirCount) + ENEMY_SPRITE_CONFIG.dirCount) % ENEMY_SPRITE_CONFIG.dirCount;
            }
        }

        const hasSpecial = !!this._getSpriteDef()?.states?.[ENEMY_SPRITE_STATES.special];
        const moving = (this.vx * this.vx + this.vy * this.vy) > 6;
        if (sp.specialTimer > 0 && hasSpecial) this._setSpriteState(ENEMY_SPRITE_STATES.special);
        else if (sp.attackTimer > 0) this._setSpriteState(ENEMY_SPRITE_STATES.attack);
        else if (moving) this._setSpriteState(ENEMY_SPRITE_STATES.run);
        else this._setSpriteState(ENEMY_SPRITE_STATES.idle);

        if (this._ensureSpriteAssets()) sp.anims?.[sp.state]?.update?.(dt);
    }

    _drawSprite(ctx, p, { flashAlpha = 0 } = {}) {
        const sp = this._sprite;
        if (!sp?.enabled) return false;
        if (!this._ensureSpriteAssets()) return false;

        const sheet = sp.sheets?.[sp.state] || sp.sheets?.[ENEMY_SPRITE_STATES.idle];
        const anim = sp.anims?.[sp.state] || sp.anims?.[ENEMY_SPRITE_STATES.idle];
        if (!sheet?.image || !anim) return false;
        if (sheet.image.complete === false) return false;

        const frameIndex = (sp.dir * ENEMY_SPRITE_CONFIG.framesPerDir) + (anim.frame ?? 0);

        const fw = sheet.frameWidth;
        const fh = sheet.frameHeight;
        const scale = sp.scale * (this.isElite ? (ENEMY_SPRITE_CONFIG.elite.scaleMult ?? 1.15) : 1);
        const dw = fw * scale;
        const dh = fh * scale;
        const dx = p.x - dw / 2;
        const dy = p.y - dh / 2;

        if (this.isElite) {
            const a = ENEMY_SPRITE_CONFIG.elite.glowAlpha ?? 0.28;
            const r = (this.r || 12) * (ENEMY_SPRITE_CONFIG.elite.glowRadiusMult ?? 1.7);
            ctx.save();
            ctx.globalAlpha *= a;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, c("enemy.body.elite", 0.55) || c("e1", 0.55) || "rgba(111,29,92,0.55)");
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const prevSmoothing = ctx.imageSmoothingEnabled;
        if (ENEMY_SPRITE_CONFIG.pixelArt) ctx.imageSmoothingEnabled = false;
        sheet.drawFrame(ctx, frameIndex, dx, dy, dw, dh);

        // Hit flash: tint the sprite itself (not a circle under it).
        if (flashAlpha > 0) {
            const flashSheet = sp.flashSheets?.[sp.state] || sp.flashSheets?.[ENEMY_SPRITE_STATES.idle];
            if (flashSheet) {
                ctx.save();
                ctx.globalAlpha *= Math.max(0, Math.min(1, flashAlpha));
                ctx.globalCompositeOperation = "screen";
                flashSheet.drawFrame(ctx, frameIndex, dx, dy, dw, dh);
                ctx.restore();
            }
        }

        ctx.imageSmoothingEnabled = prevSmoothing;
        return true;
    }

    update(dt, player, fieldState) {
        if (this.dead) {
            this._updateDeath(dt, fieldState);
            return;
        }

        this.flash -= dt;
        this.iframes -= dt;
        
        // Handle Blind
        if (this.blinded > 0) {
            this.blinded -= dt;
            if (Math.random() < 0.1) {
                ParticleSystem.emit(this.x, this.y, c("fx.uiText") || "parchment", 1, 30, 2, 0.5);
            }
        }

        StatusSystem.update(this, dt, fieldState);

        if (this.applyFriction) {
            const f = typeof this.friction === "number" && Number.isFinite(this.friction) ? this.friction : 0.92;
            this.vx *= f;
            this.vy *= f;
        }

        // Only run AI movement if NOT blinded
        if (this.blinded <= 0) {
            this.performAI(dt, player, fieldState);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        const hb = player?.getCollisionAABB?.(5) || { x: player.x - (player.r || 12), y: player.y - (player.r || 12), w: (player.r || 12) * 2, h: (player.r || 12) * 2 };
        if (circleIntersectsAABB(this.x, this.y, this.r + 5, hb.x, hb.y, hb.w, hb.h)) this.handlePlayerCollision(player, fieldState, dt);

        this.applySeparation(player, fieldState.enemies, fieldState);

        this._updateSprite(dt, player);
    }
    
    applySeparation(player, allEnemies, state) {
        const separationForce = 0.5;

        const useGrid = !!state && (allEnemies?.length || 0) >= 90;
        if (useGrid) {
            const cellSize = state._sepCellSize ?? 70;
            const frame = state._frameId ?? 0;
            if (state._sepGridFrame !== frame || !state._sepGrid) {
                const grid = new Map();
                for (const e of allEnemies) {
                    if (!e || e.dead) continue;
                    const cx = Math.floor(e.x / cellSize);
                    const cy = Math.floor(e.y / cellSize);
                    const key = `${cx},${cy}`;
                    let bucket = grid.get(key);
                    if (!bucket) { bucket = []; grid.set(key, bucket); }
                    bucket.push(e);
                }
                state._sepGrid = grid;
                state._sepGridFrame = frame;
                state._sepCellSize = cellSize;
            }

            const cx = Math.floor(this.x / cellSize);
            const cy = Math.floor(this.y / cellSize);
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    const bucket = state._sepGrid.get(`${cx + ox},${cy + oy}`);
                    if (!bucket) continue;
                    for (const other of bucket) {
                        if (this === other || other.dead) continue;
                        const d2 = dist2(this.x, this.y, other.x, other.y);
                        const combinedRadii = (this.r + other.r) ** 2;
                        if (d2 < combinedRadii && d2 > 0) {
                            const d = Math.sqrt(d2);
                            const overlap = (this.r + other.r) - d;
                            const pushX = (this.x - other.x) / d * overlap * separationForce;
                            const pushY = (this.y - other.y) / d * overlap * separationForce;
                            this.x += pushX;
                            this.y += pushY;
                        }
                    }
                }
            }
        } else {
            allEnemies.forEach(other => {
                if (this === other || other.dead) return;
                const d2 = dist2(this.x, this.y, other.x, other.y);
                const combinedRadii = (this.r + other.r) ** 2;
                if (d2 < combinedRadii && d2 > 0) {
                    const d = Math.sqrt(d2);
                    const overlap = (this.r + other.r) - d;
                    const pushX = (this.x - other.x) / d * overlap * separationForce;
                    const pushY = (this.y - other.y) / d * overlap * separationForce;
                    this.x += pushX;
                    this.y += pushY;
                }
            });
        }

        // No separation against player: player shouldn't be able to "push" enemies around by walking.
    }

    handlePlayerCollision(player, fieldState, dt) {
        this.triggerAttack(0.18);
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("enemy", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const prevAlpha = ctx.globalAlpha;
        if (this.blinded > 0) ctx.globalAlpha *= 0.5;

        // Corpse fade/dissolve is handled purely in rendering.
        if (this.dead && (this.deathTimer || 0) > 0) {
            const fadeSec = Math.max(0.001, this.deathFadeSec || DEATH_FADE_SEC);
            if ((this.deathTimer || 0) <= fadeSec) {
                ctx.globalAlpha *= Math.max(0, Math.min(1, (this.deathTimer || 0) / fadeSec));
            }
        }

        const flashA = (!this.dead && this.flash > 0) ? Math.max(0, Math.min(1, this.flash / 0.2)) : 0;
        if (!this._drawSprite(ctx, p, { flashAlpha: flashA })) {
            // Fallback: circle
            ctx.fillStyle = this.flash > 0
                ? (c("fx.flash") || c("fx.uiText") || "parchment")
                : (this.isElite
                    ? (c("enemy.body.elite") || "e1")
                    : (c(this.colorRole) || c("enemy.body.standard") || "e2"));
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.r, 0, 6.28);
            ctx.fill();
        }

        ctx.globalAlpha = prevAlpha;
    }

    takeDamage(amount, state) {
        if (this.iframes > 0) return;
        this.hp -= amount;
        this.flash = 0.2;
        if (this.hp <= 0 && !this.dead) this._beginDeath(state);
    }

    performAI(dt, player, fieldState) { }
}

// --- SUBCLASSES ---

export class Walker extends Enemy {
    constructor(x, y, level, isElite, variant = null) {
        super(x, y, level, isElite);
        const v = variant || "walker";
        const variants = BALANCE.enemies?.walkerVariants || {};
        const cfg = variants[v] || BALANCE.enemies.walker;
        this.variant = v;
        this.spriteType = "walker";
        this.spriteVariant = v;
        this.colorRole = `enemy.walker.variant.${v}`;
        
        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        if (typeof cfg.friction === "number" && Number.isFinite(cfg.friction)) this.friction = cfg.friction;
        this.r = cfg.radius ?? this.r;
        this.stats.knockbackTakenMult = cfg.knockbackTakenMult ?? 1.0;
        this.eliteSkillCd = 5;
        this.rooting = 0;
    }

    handlePlayerCollision(player, fieldState, dt) {
        this.triggerAttack(0.22);
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("walker", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
        if (this.variant === "cursed") {
            player.rooted = Math.max(player.rooted || 0, 0.25);
        }
    }

    performAI(dt, player, fieldState) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.vx += Math.cos(angle) * this.speed * dt;
        this.vy += Math.sin(angle) * this.speed * dt;

        if (this.isElite) {
            this.eliteSkillCd -= dt;
            if (this.eliteSkillCd <= 0) {
                this.eliteSkillCd = 5;
                this.rooting = BALANCE.projectiles.rootWave.life;
            }
            if (this.rooting > 0) {
                this.rooting -= dt;
                if (this.rooting <= 0) {
                    fieldState.shots.push(new RootWave(fieldState, this.x, this.y));
                }
            }
        }
    }

    draw(ctx, s) {
        super.draw(ctx, s);
        const p = s(this.x, this.y);

        if (this.flash <= 0 && this.rooting > 0) {
            const denom = BALANCE.projectiles.rootWave.life || 1;
            const t = 1 - (this.rooting / denom);
            const overlay = c("enemy.walker.rootOverlay", Math.max(0, Math.min(1, t)));
            if (overlay) {
                ctx.save();
                ctx.globalAlpha *= 0.55;
                ctx.fillStyle = overlay;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(8, this.r || 12) * 1.25, 0, 6.28);
                ctx.fill();
                ctx.restore();
            }
        }
    }
}

export class Charger extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        const cfg = BALANCE.enemies.charger;

        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        this.colorRole = "enemy.charger.body";
        this.spriteType = "charger";
        this.state = 0;
        this.timer = 0;
    }

    performAI(dt, player, fieldState) {
        // Formation packs: used for bat-pack style chargers (synced charge cadence).
        if (this.packId && fieldState?.chargerPacks && Array.isArray(fieldState.chargerPacks)) {
            const pack = fieldState.chargerPacks.find(p => p && p.id === this.packId);
            if (pack) {
                if (pack.phase === "windup") {
                    this.triggerSpecial(pack.phaseT || 0.65);
                    // Telegraph where the charge will go; keep it growing during windup.
                    this.applyFriction = true;
                    this.vx *= 0.5;
                    this.vy *= 0.5;

                    const a = pack.chargeAngle ?? Math.atan2(player.y - this.y, player.x - this.x);
                    const thick = 26;
                    const len = pack.maxChargeRange ?? 520;
                    if (this.packTelegraphSeq !== pack.chargeSeq) {
                        this.packTelegraphSeq = pack.chargeSeq;
                        Telegraph.create(this.x, this.y, len, thick, pack.phaseT || 0.65, 'rect', { rotation: a, grow: true, anchor: "start" });
                    }
                    return;
                }

                if (pack.phase === "charge") {
                    this.triggerAttack(0.35);
                    this.applyFriction = false;
                    if (this.packChargeSeq !== pack.chargeSeq) {
                        this.packChargeSeq = pack.chargeSeq;
                        const a = pack.chargeAngle ?? Math.atan2(player.y - this.y, player.x - this.x);
                        const spd = pack.chargeSpeed ?? BALANCE.enemies.charger.dashSpeed;
                        this.vx = Math.cos(a) * spd;
                        this.vy = Math.sin(a) * spd;
                    }
                    return;
                }

                // Formation mode: spring toward assigned offset around pack anchor.
                this.applyFriction = true;
                const off = this.packOffset || { x: 0, y: 0 };
                const tx = (pack.x ?? this.x) + off.x;
                const ty = (pack.y ?? this.y) + off.y;
                const dx = tx - this.x;
                const dy = ty - this.y;
                const stiffness = pack.stiffness ?? 7.0;
                this.vx += dx * stiffness * dt;
                this.vy += dy * stiffness * dt;
                return;
            }
        }

        let dx = player.x - this.x, dy = player.y - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        const packCfg = BALANCE?.progression?.fieldEvents?.chargerPack || {};
        const windupDuration = packCfg.windupDurationSec ?? 0.65;
        const chargeDuration = packCfg.chargeDurationSec ?? 0.65;
        const chargeSpeed = packCfg.chargeSpeed ?? BALANCE.enemies.charger.dashSpeed;
        const maxStart = packCfg.maxChargeStartDistance ?? 650;
        const maxRange = packCfg.maxChargeRange ?? 520;

        if (this.state === 0) { // Chase
            this.applyFriction = true;
            this.vx += (dx / dist) * this.speed * dt;
            this.vy += (dy / dist) * this.speed * dt;
            if (dist < 180) {
                this.state = 1;
                this.timer = this.isElite ? windupDuration : 0.6;
                this.chargeAngle = Math.atan2(dy, dx);
                this.telegraphSpawned = false;
            }
        } else if (this.state === 1) { // Prep
            this.triggerSpecial(this.timer);
            this.applyFriction = true;
            this.vx *= 0.5;
            this.vy *= 0.5;

            // Range gate to avoid unfair off-screen charges.
            if (dist > maxStart) {
                this.state = 0;
                this.timer = 0;
                this.chargeAngle = null;
                this.telegraphSpawned = false;
                return;
            }

            // Lock direction for readability (don't jitter with micro-movement).
            if (typeof this.chargeAngle !== "number") this.chargeAngle = Math.atan2(dy, dx);

            // Elite readable windup: show a growing lane during prep, then charge.
            if (this.isElite && !this.telegraphSpawned) {
                this.telegraphSpawned = true;
                const thick = 28;
                Telegraph.create(this.x, this.y, maxRange, thick, Math.max(0.05, this.timer), 'rect', {
                    rotation: this.chargeAngle,
                    grow: true,
                    anchor: "start",
                });
            }

            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 2;
                this.timer = this.isElite ? chargeDuration : 0.4;
                const ang = typeof this.chargeAngle === "number" ? this.chargeAngle : Math.atan2(dy, dx);
                const spd = this.isElite ? chargeSpeed : BALANCE.enemies.charger.dashSpeed;
                this.vx = Math.cos(ang) * spd;
                this.vy = Math.sin(ang) * spd;
            }
        } else { // Dash
            this.triggerAttack(this.timer);
            this.applyFriction = false;
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 0;
                this.chargeAngle = null;
            }
            if (this.isElite) {
                fieldState.shots.push(new Hazard(fieldState, this.x, this.y, 2));
            }
        }
    }

    handlePlayerCollision(player, fieldState, dt) {
        if (this.iframes > 0) return;
        this.triggerAttack(0.25);
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("charger", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState });
        this.iframes = 0.5;
    }

    draw(ctx, s) {
        super.draw(ctx, s);
    }
}

export class Spitter extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        const cfg = BALANCE.enemies.spitter;

        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        this.colorRole = "enemy.spitter.body";
        this.spriteType = "spitter";
        this.r = 10;
        this.shootCd = 2;
    }

    performAI(dt, player, fieldState) {
        // Bounty pattern: orbiting ring that shoots on cadence.
        if (this.orbit && typeof this.orbit.cx === "number" && typeof this.orbit.cy === "number") {
            const o = this.orbit;
            const omega = o.omega ?? 1.35;
            o.angle = (o.angle ?? 0) + omega * dt;
            const tx = o.cx + Math.cos(o.angle) * (o.radius ?? 220);
            const ty = o.cy + Math.sin(o.angle) * (o.radius ?? 220);
            const dx = tx - this.x;
            const dy = ty - this.y;
            this.vx += dx * 6.0 * dt;
            this.vy += dy * 6.0 * dt;

            this.orbitShootCd = (this.orbitShootCd ?? 0) - dt;
            if (this.orbitShootCd <= 0) {
                this.orbitShootCd = o.shootInterval ?? 2.4;
                const a = Math.atan2(player.y - this.y, player.x - this.x);
                if (this.isElite) this.triggerSpecial(0.35);
                else this.triggerAttack(0.25);
                fieldState.shots.push(new EnemyProjectile(this.x, this.y, a, this.isBuffed, this.level, "spitter"));
            }
            return;
        }

        let dx = player.x - this.x, dy = player.y - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < BALANCE.enemies.spitter.retreatDistance) {
            this.vx -= (dx / dist) * this.speed * dt;
            this.vy -= (dy / dist) * this.speed * dt;
        } else {
            this.vx += (dx / dist) * this.speed * dt;
            this.vy += (dy / dist) * this.speed * dt;
        }

        this.shootCd -= dt;
        if (this.shootCd <= 0) {
            this.shootCd = 3;
            this.vx = 0;
            this.vy = 0;
            let a = Math.atan2(dy, dx);
            if (this.isElite) {
                this.triggerSpecial(0.4);
                for (let i = 0; i < 8; i++) {
                    let angle = a + (i - 3.5) * 0.1;
                    fieldState.shots.push(new EnemyProjectile(this.x, this.y, angle, this.isBuffed, this.level, "spitter"));
                }
            } else {
                this.triggerAttack(0.28);
                fieldState.shots.push(new EnemyProjectile(this.x, this.y, a, this.isBuffed, this.level, "spitter"));
            }
        }
    }

    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("spitter", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
    }
}

export class Anchor extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        const cfg = BALANCE.enemies.anchor;

        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        this.r = 15;
        this.colorRole = "enemy.anchor.body";
        this.spriteType = "anchor";
        this.auraRad = cfg.auraRadius;
        this.eliteTimer = 0;
    }

    performAI(dt, player, fieldState) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.vx += Math.cos(angle) * this.speed * dt;
        this.vy += Math.sin(angle) * this.speed * dt;

        fieldState.enemies.forEach(e => {
            if (e !== this && !e.dead) {
                if (dist2(this.x, this.y, e.x, e.y) < this.auraRad ** 2) {
                    e.isBuffed = true;
                    e.stats.damageTakenMult = BALANCE.combat.buffedEnemyDamageTakenMult;
                }
            }
        });

        if (this.isElite) {
            this.eliteTimer -= dt;
            if (this.eliteTimer <= 0) {
                this.eliteTimer = 5;
                this.triggerSpecial(0.6);
                Telegraph.create(this.x, this.y, this.auraRad * 2, this.auraRad * 2, 1, 'circle');
                fieldState.enemies.forEach(e => {
                    if (e.isBuffed) e.hp = Math.min(e.hpMax, e.hp + 10);
                });
            }
        }
    }
    
    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("anchor", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
    }

    draw(ctx, s) {
        super.draw(ctx, s);
        let p = s(this.x, this.y);
        ctx.save();
        ctx.strokeStyle = c("enemy.anchor.aura") || c("enemy.body.deep") || "e3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.auraRad, 0, 6.28);
        ctx.stroke();
        ctx.restore();
    }
}
