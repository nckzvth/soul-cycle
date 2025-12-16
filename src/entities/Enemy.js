import { dist2 } from "../core/Utils.js";
import { Hazard, RootWave, EnemyProjectile } from "./Projectile.js";
import Telegraph from "../systems/Telegraph.js";
import CombatSystem from "../systems/CombatSystem.js";
import { BALANCE } from "../data/Balance.js";
import ParticleSystem from "../systems/Particles.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import StatusSystem from "../systems/StatusSystem.js";

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
        this.stats = { damageTakenMult: 1.0 };
        this.iframes = 0;
        this.applyFriction = true;
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
                ParticleSystem.emit(this.x, this.y, 'white', 1, 30, 2, 0.5);
            }
        }

        StatusSystem.update(this, dt, fieldState);

        if (this.applyFriction) {
            this.vx *= 0.92;
            this.vy *= 0.92;
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

        this.applySeparation(player, fieldState.enemies);
    }
    
    applySeparation(player, allEnemies) {
        const separationForce = 0.5;

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
        ctx.fillStyle = this.isElite ? 'gold' : (this.flash > 0 ? "#fff" : this.color);
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
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        const cfg = BALANCE.enemies.walker;
        
        this.hp = cfg.baseHp + level * cfg.hpPerLevel;
        if (this.isElite) {
            this.hp *= BALANCE.enemies.eliteHpMult;
        }
        this.hpMax = this.hp;

        this.speed = cfg.speed;
        this.color = "#c44e4e";
        this.eliteSkillCd = 5;
        this.rooting = 0;
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

    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        const spec = DamageSpecs.enemyContact("walker", this.isBuffed);
        DamageSystem.dealPlayerDamage(this, player, spec, { state: fieldState, context: { dt } });
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        let baseColor = this.isElite ? [255, 215, 0] : [196, 78, 78];
        if (this.rooting > 0) {
            const t = 1 - (this.rooting / BALANCE.projectiles.rootWave.life);
            const r = Math.floor(baseColor[0] * (1 - t) + 255 * t);
            const g = Math.floor(baseColor[1] * (1 - t));
            const b = Math.floor(baseColor[2] * (1 - t));
            ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
            ctx.fillStyle = this.flash > 0 ? "#fff" : `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`;
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
        this.color = "#a0f";
        this.state = 0;
        this.timer = 0;
    }

    performAI(dt, player, fieldState) {
        let dx = player.x - this.x, dy = player.y - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (this.state === 0) { // Chase
            this.applyFriction = true;
            this.vx += (dx / dist) * this.speed * dt;
            this.vy += (dy / dist) * this.speed * dt;
            if (dist < 180) {
                this.state = 1;
                this.timer = 0.6;
            }
        } else if (this.state === 1) { // Prep
            this.applyFriction = true;
            this.vx *= 0.5;
            this.vy *= 0.5;
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 2;
                this.timer = 0.4;
                let ang = Math.atan2(dy, dx);
                this.vx = Math.cos(ang) * BALANCE.enemies.charger.dashSpeed;
                this.vy = Math.sin(ang) * BALANCE.enemies.charger.dashSpeed;
                if (this.isElite) {
                    Telegraph.create(this.x, this.y, 20, 500, 0.4, 'rect', ang + Math.PI / 2);
                }
            }
        } else { // Dash
            this.applyFriction = false;
            this.timer -= dt;
            if (this.timer <= 0) this.state = 0;
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
        ctx.fillStyle = this.isElite ? 'gold' : (this.flash > 0 || this.state === 1 ? "#fff" : this.color);
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
        this.color = "orange";
        this.r = 10;
        this.shootCd = 2;
    }

    performAI(dt, player, fieldState) {
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
                    fieldState.shots.push(new EnemyProjectile(this.x, this.y, angle, this.isBuffed, player.lvl));
                }
            } else {
                fieldState.shots.push(new EnemyProjectile(this.x, this.y, a, this.isBuffed, player.lvl));
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
        this.color = "#4a4a6a";
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
        ctx.strokeStyle = "rgba(107, 140, 196, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.auraRad, 0, 6.28);
        ctx.stroke();
    }
}
