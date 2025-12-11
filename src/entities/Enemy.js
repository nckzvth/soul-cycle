import { dist2 } from "../core/Utils.js";
import { Hazard, RootWave, EnemyProjectile } from "./Projectile.js";
import Telegraph from "../systems/Telegraph.js";
import CombatSystem from "../systems/CombatSystem.js";

/**
 * @class Enemy
 * @description The base class for all enemy types in the game.
 * Handles common logic such as movement, physics, health, and rendering.
 * Subclasses should override the performAI and handlePlayerCollision methods.
 */
export class Enemy {
    /**
     * @param {number} x - The initial x-coordinate.
     * @param {number} y - The initial y-coordinate.
     * @param {number} level - The level of the enemy, used for scaling stats.
     * @param {boolean} [isElite=false] - Whether the enemy is an elite variant.
     */
    constructor(x, y, level, isElite = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.level = level;
        this.isElite = isElite;
        this.dead = false;

        // --- Default Stats (to be overridden in subclasses) ---
        this.hp = 10;
        this.hpMax = 10;
        this.speed = 100;
        this.r = 12; // radius
        this.color = "#fff";
        this.soulValue = 1;

        // --- State Variables ---
        this.flash = 0; // timer for the white flash effect when damaged
        this.isBuffed = false; // Flag set by Anchor enemies
        this.iframes = 0; // Invincibility frames after being hit
        this.applyFriction = true; // Flag to control whether friction is applied

        // Automatically scale stats for elite enemies
        if (this.isElite) {
            this.hp *= 2;
            this.hpMax *= 2;
            this.r *= 1.5;
            this.soulValue *= 3;
        }
    }

    /**
     * @description Main update loop for the enemy.
     * @param {number} dt - Delta time.
     * @param {PlayerObj} player - The player object.
     * @param {FieldState} fieldState - The state object for the current field, contains lists of entities.
     */
    update(dt, player, fieldState) {
        if (this.dead) return;

        this.flash -= dt;
        this.iframes -= dt;

        // 1. Friction & Physics (basic drag)
        if (this.applyFriction) {
            this.vx *= 0.92;
            this.vy *= 0.92;
        }

        // 2. Run subclass-specific AI
        this.performAI(dt, player, fieldState);

        // 3. Apply final velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // 4. Player Collision & Damage (Pre-separation)
        // FIX: Added a small buffer (+5) to the collision check.
        // This ensures that even if separation pushes the enemy to the exact edge of the player's radius,
        // they are still considered "close enough" to deal damage.
        if (dist2(this.x, this.y, player.x, player.y) < (this.r + player.r + 5) ** 2) {
            this.handlePlayerCollision(player, fieldState, dt);
        }

        // 5. Separation (Post-damage check)
        this.applySeparation(player, fieldState.enemies);

        // 6. Reset buff status for next frame
        this.isBuffed = false;
    }
    
    applySeparation(player, allEnemies) {
        const separationForce = 0.5; // How much to push apart per frame

        // Separation from other enemies
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

        // Separation from the player
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

    /**
     * @description Handles the logic for when an enemy collides with the player.
     * This is a generic fallback and should be overridden by subclasses for specific damage values.
     * @param {PlayerObj} player - The player object.
     * @param {FieldState} fieldState - The current field state.
     * @param {number} dt - Delta time.
     */
    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        // Removed player.lvl scaling to allow for specific damage tuning
        let rawDamage = (this.isBuffed ? 10 : 5);
        player.takeDamage(rawDamage * dt); 
    }

    /**
     * @description Renders the enemy on the canvas.
     * @param {CanvasRenderingContext2D} ctx - The rendering context.
     * @param {function} s - The screen space conversion function.
     */
    draw(ctx, s) {
        let p = s(this.x, this.y);
        // Elite enemies are gold, otherwise use assigned color. Flash white when hit.
        ctx.fillStyle = this.isElite ? 'gold' : (this.flash > 0 ? "#fff" : this.color);
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.r, 0, 6.28);
        ctx.fill();

        ctx.fillStyle = "#000";
        ctx.fillRect(p.x - 10, p.y - this.r - 8, 20, 4);
        ctx.fillStyle = "#0f0";
        ctx.fillRect(p.x - 10, p.y - this.r - 8, 20 * (this.hp / this.hpMax), 4);
    }

    takeDamage(amount) {
        if (this.iframes > 0) return;
        this.hp -= amount;
        this.flash = 0.2;
        if (this.hp <= 0) {
            this.dead = true;
        }
    }

    /**
     * @description Abstract method for AI behavior, to be implemented by subclasses.
     * @param {number} dt - Delta time.
     * @param {PlayerObj} player - The player object.
     * @param {FieldState} fieldState - The current field state.
     */
    performAI(dt, player, fieldState) { }
}

// --- SUBCLASSES ---

export class Walker extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        this.hp = 20 + level * 5;
        this.hpMax = this.hp;
        this.speed = 1500;
        this.color = "#c44e4e";
        this.eliteSkillCd = 5;
    }

    performAI(dt, player, fieldState) {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.vx += Math.cos(angle) * this.speed * dt;
        this.vy += Math.sin(angle) * this.speed * dt;

        if (this.isElite) {
            this.eliteSkillCd -= dt;
            if (this.eliteSkillCd <= 0) {
                this.eliteSkillCd = 5;
                fieldState.shots.push(new RootWave(fieldState, this.x, this.y));
            }
        }
    }

    /** @override */
    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        // Removed player.lvl scaling. Increased base damage to 10 DPS.
        let rawDamage = (this.isBuffed ? 15 : 10);
        player.takeDamage(rawDamage * dt);
    }
}

export class Charger extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        this.hp = 30 + level * 5;
        this.hpMax = this.hp;
        this.speed = 2000;
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
                this.vx = Math.cos(ang) * 800;
                this.vy = Math.sin(ang) * 800;
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

    /** @override */
    handlePlayerCollision(player, fieldState, dt) {
        if (this.iframes > 0) return;
        CombatSystem.onPlayerHit(this, fieldState);
        // Removed player.lvl scaling. Fixed burst damage.
        let rawDamage = (this.isBuffed ? 20 : 15);
        player.takeDamage(rawDamage);
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
        ctx.fillStyle = "#000";
        ctx.fillRect(p.x - 10, p.y - 20, 20, 4);
        ctx.fillStyle = "#0f0";
        ctx.fillRect(p.x - 10, p.y - 20, 20 * (this.hp / this.hpMax), 4);
    }
}

export class Spitter extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        this.hp = 15 + level * 5;
        this.hpMax = this.hp;
        this.speed = 500;
        this.color = "orange";
        this.r = 10;
        this.shootCd = 2;
    }

    performAI(dt, player, fieldState) {
        let dx = player.x - this.x, dy = player.y - this.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < 300) {
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

    /** @override */
    handlePlayerCollision(player, fieldState, dt) {
        CombatSystem.onPlayerHit(this, fieldState);
        // Removed player.lvl scaling.
        let rawDamage = (this.isBuffed ? 6 : 3);
        player.takeDamage(rawDamage * dt);
    }
}

export class Anchor extends Enemy {
    constructor(x, y, level, isElite) {
        super(x, y, level, isElite);
        this.hp = 50 + (level * 10);
        this.hpMax = this.hp;
        this.speed = 40;
        this.r = 15;
        this.color = "#4a4a6a";
        this.auraRad = 150;
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
        // Removed player.lvl scaling.
        let rawDamage = (this.isBuffed ? 8 : 4);
        player.takeDamage(rawDamage * dt);
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
