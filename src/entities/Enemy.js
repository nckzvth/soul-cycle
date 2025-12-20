import { dist2 } from "../core/Utils.js";
import { Hazard, RootWave, EnemyProjectile } from "./Projectile.js";
import Telegraph from "../systems/Telegraph.js";
import CombatSystem from "../systems/CombatSystem.js";
import { BALANCE } from "../data/Balance.js";
import ParticleSystem from "../systems/Particles.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import StatusSystem from "../systems/StatusSystem.js";
import { PALETTE } from "../data/Palette.js";

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

        // Apply elite multipliers for stats that are NOT typically overridden by subclasses (like radius).
        // HP is handled in the subclass constructors to ensure correct order of operations.
        if (this.isElite) {
            this.r *= BALANCE.enemies.eliteRadiusMult;
            this.soulValue *= BALANCE.enemies.eliteSoulMult;
        }
    }

    update(dt, player, fieldState) {
        if (this.dead) return;

        this.flash -= dt;
        this.iframes -= dt;
        
        // Handle Blind
        if (this.blinded > 0) {
            this.blinded -= dt;
            if (Math.random() < 0.1) {
                ParticleSystem.emit(this.x, this.y, PALETTE.parchment, 1, 30, 2, 0.5);
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

        if (dist2(this.x, this.y, player.x, player.y) < (this.r + player.r + 5) ** 2) {
            this.handlePlayerCollision(player, fieldState, dt);
        }

        this.applySeparation(player, fieldState.enemies, fieldState);
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

        const playerDist2 = dist2(this.x, this.y, player.x, player.y);
        const playerCombinedRadii = (this.r + player.r) ** 2;
        if (playerDist2 < playerCombinedRadii && playerDist2 > 0) {
            const d = Math.sqrt(playerDist2);
            const overlap = (this.r + player.r) - d;
            const pushX = (this.x - player.x) / d * overlap * separationForce;
            const pushY = (this.y - player.y) / d * overlap * separationForce;
            this.x += pushX;
            this.y += pushY;
        }
    }

    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("enemy", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = this.isElite ? PALETTE.chartreuse : (this.flash > 0 ? PALETTE.parchment : this.color);
        if (this.blinded > 0) {
            ctx.globalAlpha = 0.5;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.r, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    takeDamage(amount, state) {
        if (this.iframes > 0) return;
        this.hp -= amount;
        this.flash = 0.2;
        if (this.hp <= 0) {
            this.dead = true;
        }
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
        
        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        if (typeof cfg.friction === "number" && Number.isFinite(cfg.friction)) this.friction = cfg.friction;
        this.r = cfg.radius ?? this.r;
        this.color = cfg.color ?? PALETTE.blood;
        this.stats.knockbackTakenMult = cfg.knockbackTakenMult ?? 1.0;
        this.eliteSkillCd = 5;
        this.rooting = 0;
    }

    handlePlayerCollision(player, fieldState, dt) {
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
        let p = s(this.x, this.y);
        let baseColor = this.isElite ? [139, 196, 90] : [106, 36, 48]; // chartreuse / blood
        if (!this.isElite && this.variant === "thrall") baseColor = [74, 106, 78]; // moss
        if (!this.isElite && this.variant === "brute") baseColor = [74, 47, 42]; // rotwood
        if (!this.isElite && this.variant === "cursed") baseColor = [75, 43, 87]; // violet
        if (this.rooting > 0) {
            const t = 1 - (this.rooting / BALANCE.projectiles.rootWave.life);
            const r = Math.floor(baseColor[0] * (1 - t) + 239 * t);
            const g = Math.floor(baseColor[1] * (1 - t) + 230 * t);
            const b = Math.floor(baseColor[2] * (1 - t) + 216 * t);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
            ctx.fillStyle = this.flash > 0 ? PALETTE.parchment : `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`;
        }
        if (this.blinded > 0) {
            ctx.globalAlpha = 0.5;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.r, 0, 6.28);
        ctx.fill();
        ctx.globalAlpha = 1;
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
        this.color = PALETTE.moss;
        this.state = 0;
        this.timer = 0;
    }

    performAI(dt, player, fieldState) {
        // Formation packs: used for bat-pack style chargers (synced charge cadence).
        if (this.packId && fieldState?.chargerPacks && Array.isArray(fieldState.chargerPacks)) {
            const pack = fieldState.chargerPacks.find(p => p && p.id === this.packId);
            if (pack) {
                if (pack.phase === "windup") {
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
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("charger", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState });
        this.iframes = 0.5;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = this.isElite ? PALETTE.chartreuse : (this.flash > 0 || this.state === 1 ? PALETTE.parchment : this.color);
        ctx.beginPath();
        ctx.moveTo(p.x + 10, p.y);
        ctx.lineTo(p.x - 8, p.y + 8);
        ctx.lineTo(p.x - 8, p.y - 8);
        ctx.fill();
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
        this.color = PALETTE.ember;
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
                fieldState.shots.push(new EnemyProjectile(this.x, this.y, a, this.isBuffed, this.level));
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
                for (let i = 0; i < 8; i++) {
                    let angle = a + (i - 3.5) * 0.1;
                    fieldState.shots.push(new EnemyProjectile(this.x, this.y, angle, this.isBuffed, this.level));
                }
            } else {
                fieldState.shots.push(new EnemyProjectile(this.x, this.y, a, this.isBuffed, this.level));
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
        this.color = PALETTE.iron;
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
        ctx.strokeStyle = "rgba(108, 199, 194, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.auraRad, 0, 6.28);
        ctx.stroke();
    }
}
