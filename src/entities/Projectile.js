import { dist2 } from "../core/Utils.js";
import { BALANCE } from "../data/Balance.js";
import Game from "../core/Game.js";
import DamageSystem from "../systems/DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import ParticleSystem from "../systems/Particles.js";
import StatusSystem from "../systems/StatusSystem.js";
import { resolveColor } from "../render/Color.js";
import { color as tc } from "../data/ColorTuning.js";

const c = (token, alpha) => resolveColor({ token, alpha });

export class TitheExplosion {
    constructor(state, player, x, y, radius, stacks, spec, snapshot) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.stacks = stacks;
        this.spec = spec;
        this.snapshot = snapshot;
        this.life = 0.6;
        this.currentRadius = 0;
        this.hitList = [];
    }

    update(dt) {
        this.life -= dt;
        this.currentRadius += (this.maxRadius / 0.6) * dt;

        this.state.enemies.forEach(e => {
            if (!e.dead && !this.hitList.includes(e)) {
                if (dist2(this.x, this.y, e.x, e.y) < (this.currentRadius + e.r) ** 2) {
                    DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
                    this.hitList.push(e);
                }
            }
        });

        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const alpha = this.life / 0.6;

        ctx.save();
        
        // Outer ring
        ctx.strokeStyle = tc("fx.ember", alpha) || c("ember", alpha) || "ember";
        ctx.lineWidth = 2 + this.stacks;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner fill
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, this.currentRadius);
        gradient.addColorStop(0, tc("fx.emberDeep", alpha * 0.5) || c("emberDeep", alpha * 0.5) || "emberDeep");
        gradient.addColorStop(1, c("emberDeep", 0) || "transparent");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

export class DashTrail {
    constructor(start, end, stacks) {
        this.start = start;
        this.end = end;
        this.stacks = stacks;
        this.life = 0.4;
    }

    update(dt) {
        this.life -= dt;
        return this.life > 0;
    }

    draw(ctx, s) {
        const start = s(this.start.x, this.start.y);
        const end = s(this.end.x, this.end.y);
        const alpha = this.life / 0.4;
        const width = 2 + this.stacks * 1.5;

        ctx.save();
        ctx.globalAlpha = alpha;
        // Ink rim rule: draw an ink under-stroke for readability over varied backgrounds.
        ctx.strokeStyle = tc("fx.ink") || "ink";
        ctx.lineWidth = width + 2;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.strokeStyle = tc("player.core") || "p2";
        ctx.lineWidth = width;
        ctx.stroke();

        if (this.stacks > 2) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = tc("fx.uiText") || "parchment";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }
}

export class HammerProjectile {
    constructor(state, player, cx, cy, initialAngle, spec, snapshot, isSalvo = false) {
        this.state = state;
        this.player = player;
        this.cx = cx;
        this.cy = cy;
        this.rad = BALANCE.player.hammer.startRadius;
        this.ang = initialAngle;
        this.isSalvo = isSalvo;
        this.spec = spec;
        this.snapshot = snapshot;
        if (this.isSalvo) {
            this.ang += Math.PI;
        }
        this.spinTimer = BALANCE.player.hammer.spinTime;
        this.trailTimer = 0;
        this.atMaxRadius = false;
        this.creationTime = Game.time;
        this.markedForDeletion = false;
        this.hitList = [];
    }

    update(dt) {
        const hb = BALANCE.player.hammer;
        const cfg = BALANCE.skills?.hammer || {};
        const vfx = cfg.vfx || {};
        const stats = this.player.stats || {};
        const maxRadius = hb.maxRadius * (1 + (stats.hammerMaxRadiusMult || 0));
        const spinTime = hb.spinTime * (1 + (stats.hammerSpinTimeMult || 0));
        const hitRadius = hb.hitRadius + (stats.hammerHitRadiusAdd || 0);
        const trailEnabled = (stats.hammerTrailEnable || 0) > 0;

        if (this.atMaxRadius) {
            this.spinTimer -= dt;
        } else {
            this.rad += hb.radialSpeed * dt;
            if (this.rad >= maxRadius) {
                this.rad = maxRadius;
                this.atMaxRadius = true;
                this.spinTimer = spinTime;
            }
        }

        this.ang += hb.angularSpeed * dt * (this.isSalvo ? -1 : 1);

        const hx = this.cx + Math.cos(this.ang) * this.rad;
        const hy = this.cy + Math.sin(this.ang) * this.rad;

        // Cinderwake trail: drop short-lived fire zones along the orbit path.
        if (trailEnabled) {
            const baseInterval = cfg.trailTickInterval ?? 0.25;
            this.trailTimer -= dt;
            if (this.trailTimer <= 0) {
                this.trailTimer = baseInterval;
                const duration = (cfg.trailDuration ?? 1.2) * (1 + (stats.hammerTrailDurationMult || 0));
                const radius = cfg.trailRadius ?? 55;
                const trailSpec = DamageSpecs.hammerTrailTick();
                const heat = this.player.weaponState?.hammer?.heat || 0;
                const heatMult = 1 + heat * (cfg.forgeHeatCoeffPerStack ?? 0.06);
                const trailSnapshot = DamageSystem.snapshotOutgoing(this.player, { ...trailSpec, coeff: trailSpec.coeff * heatMult }, { dt: baseInterval });
                this.state.shots.push(new FireTrail(this.state, this.player, hx, hy, radius, duration, trailSpec, trailSnapshot, baseInterval));
            }
        }

        this.state.enemies.forEach(e => {
            if (!e.dead && !this.hitList.includes(e) && dist2(hx, hy, e.x, e.y) < (hitRadius + e.r) ** 2) {
                const heat = this.player.weaponState?.hammer?.heat || 0;
                const heatMult = 1 + heat * (cfg.forgeHeatCoeffPerStack ?? 0.06);
                // Coalheart: burning foes take more hammer hit damage (not burn DoT).
                const coal = (stats.hammerBurnDamageTakenMult || 0);
                const burning = StatusSystem.hasStatus(e, "hammer:burn");
                const hitSpec = (burning && coal > 0) ? { ...this.spec, coeff: this.spec.coeff * (1 + coal) } : this.spec;
                const hitSnapshot = hitSpec === this.spec ? this.snapshot : DamageSystem.snapshotOutgoing(this.player, hitSpec);
                DamageSystem.dealDamage(this.player, e, hitSpec, { state: this.state, snapshot: hitSnapshot, particles: ParticleSystem });

                // Baseline: hammer hits always apply a short burn.
                const duration = (cfg.burnDuration ?? 2.0) * (1 + (stats.hammerBurnDurationMult || 0));
                const tickIntervalBase = cfg.burnTickInterval ?? 1.0;
                const tickRateMult = 1 + (stats.hammerBurnTickRateMult || 0);
                const tickInterval = Math.max(0.1, tickIntervalBase / tickRateMult);

                const burnSpecBase = DamageSpecs.hammerBurnTick();
                const burnSpec = { ...burnSpecBase, coeff: burnSpecBase.coeff * heatMult };

	                StatusSystem.applyStatus(e, "hammer:burn", {
                    source: this.player,
                    stacks: 1,
                    duration,
                    tickInterval,
                    spec: burnSpec,
                    snapshotPolicy: "snapshot",
                    stackMode: "add",
                    maxStacks: 10,
                    dotTextMode: "perTick",
	                    vfx: {
	                        interval: vfx.burnInterval ?? 0.28,
	                        color: vfx.burnColor || { token: "ember", alpha: 0.85 },
	                        count: vfx.burnCount ?? 1,
	                        countPerStack: vfx.burnCountPerStack ?? 0.45,
	                        size: vfx.burnSize ?? 2.4,
	                        life: vfx.burnLife ?? 0.22,
	                        applyBurstCount: vfx.burnApplyBurstCount ?? 4,
	                        applyBurstSpeed: vfx.burnApplyBurstSpeed ?? 120,
	                    },
	                });

                // Ignition Threshold: flare when burn stacks reach a threshold (cooldown-limited).
                if ((stats.hammerIgniteEnable || 0) > 0) {
                    const stacks = StatusSystem.getStacks(e, "hammer:burn");
                    const threshold = cfg.igniteStacks ?? 4;
                    const hammerState = this.player.weaponState?.hammer;
                    if (hammerState && hammerState.igniteCd <= 0 && stacks >= threshold) {
                        hammerState.igniteCd = cfg.igniteInternalCooldown ?? 1.0;
	                        const flareSpec = DamageSpecs.hammerIgniteFlare();
                        const flareSnapshot = DamageSystem.snapshotOutgoing(this.player, { ...flareSpec, coeff: flareSpec.coeff * (1 + (stats.hammerIgniteCoeffMult || 0)) * heatMult });
                        const radius = cfg.pyreBurstRadius ?? 100;
	                        ParticleSystem.emit(e.x, e.y, vfx.igniteColor || { token: "ember", alpha: 0.9 }, vfx.igniteBurstCount ?? 16, vfx.igniteBurstSpeed ?? 170, 3.0, 0.35);
                        this.state.enemies.forEach(e2 => {
                            if (e2.dead) return;
                            if (dist2(e.x, e.y, e2.x, e2.y) < radius * radius) {
                                DamageSystem.dealDamage(this.player, e2, flareSpec, { state: this.state, snapshot: flareSnapshot, particles: ParticleSystem });
                            }
                        });
                    }
                }

                // Occult: Soul Brand delayed detonation.
                if ((stats.hammerSoulBrandEnable || 0) > 0) {
                    const duration = cfg.soulBrandDuration ?? 2.0;
                    const popSpecBase = DamageSpecs.hammerSoulBrandPop();
                    const coeffMult = 1 + (stats.hammerSoulBrandCoeffMult || 0);
                    const popSpec = { ...popSpecBase, coeff: popSpecBase.coeff * coeffMult * heatMult };
                    const popSnapshot = DamageSystem.snapshotOutgoing(this.player, popSpec);
                    const radius = cfg.soulBrandRadius ?? 90;
	                    StatusSystem.applyStatus(e, "hammer:soulBrand", {
                        source: this.player,
                        stacks: 1,
                        duration,
                        tickInterval: 9999,
                        spec: null,
                        snapshotPolicy: "snapshot",
                        stackMode: "max",
                        maxStacks: 1,
	                        vfx: {
	                            interval: vfx.soulBrandInterval ?? 0.28,
	                            color: vfx.soulBrandColor || { token: "arcaneDeep", alpha: 0.85 },
	                            count: vfx.soulBrandCount ?? 1,
	                            size: vfx.soulBrandSize ?? 2.4,
	                            life: vfx.soulBrandLife ?? 0.22,
	                            applyBurstCount: vfx.soulBrandApplyBurstCount ?? 4,
	                            applyBurstSpeed: vfx.soulBrandApplyBurstSpeed ?? 120,
	                        },
	                        onExpire: (tgt, st, stState) => {
	                            ParticleSystem.emit(tgt.x, tgt.y, vfx.soulBrandColor || { token: "arcaneDeep", alpha: 0.85 }, vfx.soulBrandPopBurstCount ?? 18, vfx.soulBrandPopBurstSpeed ?? 190, 3.0, 0.35);
	                            stState?.enemies?.forEach(e2 => {
	                                if (e2.dead) return;
                                if (dist2(tgt.x, tgt.y, e2.x, e2.y) < radius * radius) {
                                    DamageSystem.dealDamage(this.player, e2, popSpec, { state: stState, snapshot: popSnapshot, particles: ParticleSystem });
                                }
                            });
                        }
                    });
                }

                this.hitList.push(e);
            }
        });

        return !this.atMaxRadius || this.spinTimer > 0;
    }

    draw(ctx, s) {
        const hb = BALANCE.player.hammer;
        const hx = this.cx + Math.cos(this.ang) * this.rad;
        const hy = this.cy + Math.sin(this.ang) * this.rad;
        const hc = s(hx, hy);
	        const r = hb.hitRadius + ((this.player.stats?.hammerHitRadiusAdd) || 0);

	        const grad = ctx.createRadialGradient(hc.x, hc.y, 0, hc.x, hc.y, r * 1.5);
	        const glowToken = this.isSalvo ? "p2" : "ember";
	        grad.addColorStop(0, c(glowToken, 0.8) || tc("fx.uiText") || "parchment");
	        grad.addColorStop(0.7, c(glowToken, 0.5) || tc("fx.uiText") || "parchment");
	        grad.addColorStop(1, c(glowToken, 0.0) || "transparent");
	        ctx.fillStyle = grad;
	        ctx.beginPath();
	        ctx.arc(hc.x, hc.y, r * 1.5, 0, Math.PI * 2);
	        ctx.fill();

        ctx.fillStyle = this.isSalvo ? (tc("player.core") || "p2") : (tc("fx.ember") || "ember");
        ctx.beginPath();
        ctx.arc(hc.x, hc.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

export class FireTrail {
    constructor(state, player, x, y, radius, life, spec, snapshot, tickInterval) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.r = radius;
        this.life = life;
        this.spec = spec;
        this.snapshot = snapshot;
        this.tickInterval = tickInterval;
        this.tickTimer = 0;
        this.vfxTimer = 0;
    }

    update(dt) {
        const cfg = BALANCE.skills?.hammer || {};
        const vfx = cfg.vfx || {};
        this.life -= dt;
        this.tickTimer += dt;

        // Visual: flickering embers for the trail zone.
        this.vfxTimer -= dt;
	        if (this.vfxTimer <= 0 && this.life > 0) {
	            this.vfxTimer = vfx.trailInterval ?? 0.12;
	            const x = this.x + (Math.random() - 0.5) * this.r * 1.6;
	            const y = this.y + (Math.random() - 0.5) * this.r * 1.6;
	            ParticleSystem.emit(x, y, vfx.trailColor || { token: "ember", alpha: 0.6 }, vfx.trailCount ?? 2, 20, vfx.trailSize ?? 2.0, vfx.trailLife ?? 0.16);
	        }

        while (this.tickTimer >= this.tickInterval && this.life > 0) {
            this.tickTimer -= this.tickInterval;
            this.state.enemies.forEach(e => {
                if (e.dead) return;
                if (dist2(this.x, this.y, e.x, e.y) < (this.r + e.r) ** 2) {
                    DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, isDoT: true, dotTextMode: "aggregate" });
                }
            });
        }
        return this.life > 0;
    }

	    draw(ctx, s) {
	        const p = s(this.x, this.y);
	        ctx.save();
	        ctx.globalAlpha = Math.min(0.6, this.life / 1.2);
	        ctx.fillStyle = tc("fx.ember", 0.25) || c("ember", 0.25) || "ember";
	        ctx.beginPath();
	        ctx.arc(p.x, p.y, this.r, 0, Math.PI * 2);
	        ctx.fill();
	        ctx.restore();
	    }
}

export class Projectile {
    constructor(state, player, x, y, vx, vy, life, spec, snapshot, pierce = 0, bounce = 0, isSalvo = false, hitMeta = null) {
        this.state = state;
        this.player = player;
        this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life;
        this.spec = spec;
        this.snapshot = snapshot;
        this.pierce = pierce; this.bounce = bounce; this.hitList = [];
        this.isSalvo = isSalvo;
        this.hitMeta = hitMeta;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
        // Collision
        for (let e of this.state.enemies) {
            if (!e.dead && !this.hitList.includes(e) && dist2(this.x, this.y, e.x, e.y) < (15 + e.r) ** 2) {
                DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, ...(this.hitMeta || {}) });
                this.hitList.push(e);
                if (this.pierce > 0) this.pierce--;
                else if (this.bounce > 0) {
                    this.bounce--;
                    let t = this.state.findTarget(e, this.x, this.y);
                    if (t) {
                        let a = Math.atan2(t.y - this.y, t.x - this.x);
                        let spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                        this.vx = Math.cos(a) * spd; this.vy = Math.sin(a) * spd;
                        this.hitList = [];
                    } else return false;
                } else return false;
            }
        }
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        ctx.fillStyle = this.isSalvo ? (tc("player.core") || "p2") : (tc("fx.uiText") || "parchment");
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 6.28);
        ctx.fill();
        if (this.isSalvo) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = tc("player.core") || "p2";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, 6.28);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}

export class EnemyProjectile {
    constructor(x, y, angle, isBuffed, level, kind = "standard") {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * BALANCE.projectiles.enemy.speed;
        this.vy = Math.sin(angle) * BALANCE.projectiles.enemy.speed;
        this.life = BALANCE.projectiles.enemy.life;
        this.isBuffed = isBuffed;
        this.level = level;
        this.kind = kind || "standard";
        this.spec = DamageSpecs.enemyProjectile(isBuffed, level);
    }

    update(dt, state) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        const pl = state.game.p;
        if (dist2(this.x, this.y, pl.x, pl.y) < (pl.r + 5) ** 2) {
            state.combatSystem.onPlayerHit(this, state);
            DamageSystem.dealPlayerDamage(this, pl, this.spec, { state });
            return false;
        }
        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const size = 5;
        const rim = tc("fx.ink") || "ink";
        const fill = this.kind === "spitter"
            ? (tc("enemy.projectile.spitter") || tc("fx.toxic") || "toxic")
            : (tc("enemy.projectile.standard") || "e2");

        const tri = (r) => {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - r);
            ctx.lineTo(p.x - r * 0.9, p.y + r);
            ctx.lineTo(p.x + r * 0.9, p.y + r);
            ctx.closePath();
        };

        if (this.kind === "spitter") {
            ctx.fillStyle = rim;
            tri(size + 1);
            ctx.fill();
            ctx.fillStyle = fill;
            tri(size);
            ctx.fill();
        } else {
            ctx.fillStyle = fill;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, 6.28);
            ctx.fill();
        }
    }
}

export class Shockwave {
    constructor(state, player, x, y, spec, snapshot, meta = {}) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.r = 0; 
        this.spec = spec;
        this.snapshot = snapshot;
        this.meta = meta;
        this.hitList = [];
        this.life = BALANCE.projectiles.shockwave.life; 
    }
    update(dt) {
        this.r += dt * BALANCE.projectiles.shockwave.speed; this.life -= dt;
        this.state.enemies.forEach(e => {
	            if (!e.dead && !this.hitList.includes(e) && dist2(this.x, this.y, e.x, e.y) < (this.r + e.r) ** 2) {
	                DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
	                if ((this.meta?.perkTier || 0) >= 2) {
	                    const burnSpec = DamageSpecs.soulBlastBurnTick();
	                    const burnCfg = BALANCE.projectiles.soulBlastBurn || { duration: 2.0, tickInterval: 1.0 };
	                    const burnColor = (BALANCE.perks?.soulBlast?.vfx?.burnVfxColor) || { token: "ember", alpha: 0.85 };
	                    StatusSystem.applyStatus(e, "perk:soulBlastBurn", {
	                        source: this.player,
                        stacks: 1,
                        duration: burnCfg.duration,
                        tickInterval: burnCfg.tickInterval,
                        spec: burnSpec,
                        snapshotPolicy: "snapshot",
                        triggerOnHit: false,
                        dotTextMode: "perTick",
                        vfx: {
                            interval: 0.3,
                            color: burnColor,
                            count: 1,
                            size: 2.2,
                            life: 0.18,
                        },
                    });
                }
                e.kb = 30;
                this.hitList.push(e);
            }
        });
        return this.life > 0;
    }
	    draw(ctx, s) {
	        let p = s(this.x, this.y);
	        const vfx = BALANCE.perks?.soulBlast?.vfx || {};
	        const tier = this.meta?.perkTier || 1;
	        const fade = Math.max(0, Math.min(1, this.life * 2));
	        const base = tier >= 2 ? (vfx.ringColorTier2 || { token: "ember", alpha: 0.85 }) : (vfx.ringColor || { token: "p2", alpha: 0.8 });
	        ctx.save();
	        ctx.globalAlpha = fade;
	        ctx.strokeStyle = resolveColor(base) || tc("player.core") || "p2";
	        ctx.lineWidth = 4;
	        ctx.beginPath();
	        ctx.arc(p.x, p.y, this.r, 0, 6.28);
	        ctx.stroke();
	        ctx.restore();
	    }
	}

export class RootWave {
    constructor(state, x, y) { this.state = state; this.x = x; this.y = y; this.r = 0; this.life = BALANCE.projectiles.rootWave.life; }
    update(dt) {
        this.r += dt * BALANCE.projectiles.rootWave.speed; this.life -= dt;
        const p = this.state.game.p;
        if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2 && p.dashTimer <= 0) {
            this.state.combatSystem.rootPlayer(p, BALANCE.projectiles.rootWave.duration);
        }
        return this.life > 0;
    }
	    draw(ctx, s) {
	        let p = s(this.x, this.y);
	        ctx.save();
	        ctx.globalAlpha = Math.max(0, Math.min(1, this.life * 2));
	        ctx.strokeStyle = tc("fx.uiText") || "parchment";
	        ctx.lineWidth = 4;
	        ctx.beginPath();
	        ctx.arc(p.x, p.y, this.r, 0, 6.28);
	        ctx.stroke();
	        ctx.restore();
	    }
	}

export class StaticMine {
    constructor(state, player, x, y, spec) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.spec = spec;
        this.life = BALANCE.projectiles.staticMine.life; 
    }
    update(dt) {
        this.life -= dt;
        this.state.enemies.forEach(e => {
            if (dist2(this.x, this.y, e.x, e.y) < BALANCE.projectiles.staticMine.radius ** 2) {
                DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, isDoT: true, context: { dt }, particles: ParticleSystem, triggerOnHit: false });
            }
        });
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = tc("player.core") || "p2"; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
}

export class Wisp {
    constructor(state, player, x, y, spec, snapshot) { 
        this.state = state; 
        this.player = player;
        this.x = x; 
        this.y = y; 
        this.spec = spec;
        this.snapshot = snapshot;
        this.life = BALANCE.projectiles.wisp.life; 
        this.target = null; 
    }
    update(dt) {
        this.life -= dt;
        if (!this.target || this.target.dead) this.target = this.state.findTarget(null, this.x, this.y);
        if (this.target) {
            let angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * BALANCE.projectiles.wisp.speed * dt; this.y += Math.sin(angle) * BALANCE.projectiles.wisp.speed * dt;
            if (dist2(this.x, this.y, this.target.x, this.target.y) < 20 * 20) {
                DamageSystem.dealDamage(this.player, this.target, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
                return false;
            }
        } else {
            this.y -= 100 * dt;
        }
        return this.life > 0;
    }
    draw(ctx, s) { let p = s(this.x, this.y); ctx.fillStyle = tc("player.core") || "p2"; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 6.28); ctx.fill(); }
}

export class SoulTempest {
    constructor(state, player, x, y, spec, snapshot, meta = {}) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.spec = spec;
        this.snapshot = snapshot;
        this.meta = meta;
        this.life = (meta.isSplit ? BALANCE.projectiles.soulTempestSplit.life : BALANCE.projectiles.soulTempest.life);
        this.speed = (meta.isSplit ? BALANCE.projectiles.soulTempestSplit.speed : BALANCE.projectiles.soulTempest.speed);
        this.hitRadius = (meta.isSplit ? BALANCE.projectiles.soulTempestSplit.hitRadius : BALANCE.projectiles.soulTempest.hitRadius);
        this.target = null;
        this.vx = meta.vx || 0;
        this.vy = meta.vy || 0;
        this.hitSet = new Set();
        this.didSplit = false;
        this.vfxTimer = 0;
    }

    split() {
        if (this.didSplit) return;
        this.didSplit = true;
        if ((this.meta?.perkTier || 0) < 2) return;
        if (this.meta?.isSplit) return;

        const baseAngle = Math.atan2(this.vy || 0, this.vx || 1);
        const angles = [baseAngle - 0.7, baseAngle + 0.7];
        const spec = DamageSpecs.soulTempestSplitHit();
        const snapshot = DamageSystem.snapshotOutgoing(this.player, spec);
        for (const a of angles) {
            const vx = Math.cos(a) * BALANCE.projectiles.soulTempestSplit.speed;
            const vy = Math.sin(a) * BALANCE.projectiles.soulTempestSplit.speed;
            this.state.shots.push(new SoulTempest(this.state, this.player, this.x, this.y, spec, snapshot, { perkTier: this.meta.perkTier, isSplit: true, vx, vy }));
        }
        ParticleSystem.emit(this.x, this.y, { token: "p2", alpha: 0.85 }, 12, 160, 2.6, 0.25);
    }

    update(dt) {
        this.life -= dt;
        this.vfxTimer -= dt;

        if (!this.meta?.isSplit) {
            if (!this.target || this.target.dead) this.target = this.state.findTarget(null, this.x, this.y);
            if (this.target) {
                const ang = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.vx = Math.cos(ang) * this.speed;
                this.vy = Math.sin(ang) * this.speed;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        const vfx = BALANCE.perks?.tempest?.vfx || {};
        if (this.vfxTimer <= 0) {
            this.vfxTimer = vfx.trailInterval ?? 0.06;
            ParticleSystem.emit(this.x, this.y, vfx.trailColor || { token: "p2", alpha: 0.35 }, vfx.trailCount ?? 1, vfx.trailSpeed ?? 0, vfx.trailSize ?? 2.2, vfx.trailLife ?? 0.18);
        }

        if (this.meta?.isSplit) {
            this.state.enemies.forEach(e => {
                if (e.dead) return;
                if (this.hitSet.has(e)) return;
                if (dist2(this.x, this.y, e.x, e.y) < (this.hitRadius + e.r) ** 2) {
                    DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
                    this.hitSet.add(e);
                }
            });
        } else if (this.target && !this.target.dead) {
            if (dist2(this.x, this.y, this.target.x, this.target.y) < (this.hitRadius + this.target.r) ** 2) {
                DamageSystem.dealDamage(this.player, this.target, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
                this.split();
                return false;
            }
        }

        if (this.life <= 0) {
            this.split();
        }
        return this.life > 0;
    }

    draw(ctx, s) {
        const p = s(this.x, this.y);
        const alpha = Math.max(0, Math.min(1, this.life / 2));
        const vfx = BALANCE.perks?.tempest?.vfx || {};
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = resolveColor(this.meta?.isSplit ? (vfx.splitColor || { token: "p2", alpha: 0.8 }) : (vfx.bodyColor || { token: "p2", alpha: 0.95 })) || tc("player.core") || "p2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.meta?.isSplit ? 5 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class OrbitalWisp {
    constructor(state, player, spec, snapshot, meta = {}) {
        this.state = state;
        this.player = player;
        this.spec = spec;
        this.snapshot = snapshot;
        this.meta = meta;
        this.life = BALANCE.projectiles.orbitalWisp.life;
        this.radius = BALANCE.projectiles.orbitalWisp.orbitRadius;
        this.angularSpeed = BALANCE.projectiles.orbitalWisp.angularSpeed;
        this.hitRadius = BALANCE.projectiles.orbitalWisp.hitRadius;
        this.angle = Math.random() * Math.PI * 2;
        this.hitSet = new Set();
        this.x = player.x;
        this.y = player.y;
        this.vfxTimer = 0;
    }

    update(dt) {
        this.life -= dt;
        this.vfxTimer -= dt;
        if (this.life <= 0) {
            this.player.activeOrbitalWisps = Math.max(0, (this.player.activeOrbitalWisps || 0) - 1);
            return false;
        }

        this.angle += this.angularSpeed * dt;
        this.x = this.player.x + Math.cos(this.angle) * this.radius;
        this.y = this.player.y + Math.sin(this.angle) * this.radius;

        const vfx = BALANCE.perks?.orbitalWisp?.vfx || {};
        if (this.vfxTimer <= 0) {
            this.vfxTimer = vfx.trailInterval ?? 0.05;
            ParticleSystem.emit(this.x, this.y, vfx.trailColor || { token: "p2", alpha: 0.35 }, vfx.trailCount ?? 1, vfx.trailSpeed ?? 20, vfx.trailSize ?? 2.0, vfx.trailLife ?? 0.22);
        }

        this.state.enemies.forEach(e => {
            if (e.dead) return;
            if (this.hitSet.has(e)) return;
            if (dist2(this.x, this.y, e.x, e.y) < (this.hitRadius + e.r) ** 2) {
                DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem, triggerOnHit: false });
                this.hitSet.add(e);

                if ((this.meta?.perkTier || 0) >= 2) {
                    const range = BALANCE.projectiles.perkLightning.range;
                    const maxChains = BALANCE.projectiles.perkLightning.maxChains;
                    const lightningSpec = DamageSpecs.orbitalWispLightning();
                    const lightningSnapshot = DamageSystem.snapshotOutgoing(this.player, lightningSpec);

                    let from = e;
                    const visited = new Set([e]);
                    const pickNext = (src) => {
                        let best = null;
                        let bestD2 = range * range;
                        this.state.enemies.forEach(cand => {
                            if (!cand || cand.dead) return;
                            if (visited.has(cand)) return;
                            const d2 = dist2(src.x, src.y, cand.x, cand.y);
                            if (d2 < bestD2) { bestD2 = d2; best = cand; }
                        });
                        return best;
                    };
                    for (let i = 0; i < maxChains; i++) {
                        const next = pickNext(from);
                        if (!next) break;
                        visited.add(next);
                        DamageSystem.dealDamage(this.player, next, lightningSpec, { state: this.state, snapshot: lightningSnapshot, particles: ParticleSystem, triggerOnHit: false });
                        const chainColor = vfx.lightningColor || { token: "p1", alpha: 0.95 };
                        this.state.chains.push({ t: 0.15, pts: [{ x: from.x, y: from.y }, { x: next.x, y: next.y }], color: chainColor });
                        ParticleSystem.emit(from.x, from.y, chainColor, vfx.lightningBurstCount ?? 8, vfx.lightningBurstSpeed ?? 120, vfx.lightningBurstSize ?? 2.6, vfx.lightningBurstLife ?? 0.22);
                        ParticleSystem.emit(next.x, next.y, chainColor, vfx.lightningBurstCount ?? 8, vfx.lightningBurstSpeed ?? 120, vfx.lightningBurstSize ?? 2.6, vfx.lightningBurstLife ?? 0.22);
                        from = next;
                    }
                }
            }
        });

        return true;
    }

    draw(ctx, s) {
        const p = s(this.x, this.y);
        const alpha = Math.max(0.2, Math.min(1, this.life / BALANCE.projectiles.orbitalWisp.life));
        const vfx = BALANCE.perks?.orbitalWisp?.vfx || {};
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = resolveColor(vfx.bodyColor || { token: "p2", alpha: 0.9 }) || tc("player.core") || "p2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Hazard {
    constructor(state, x, y, life) {
        this.state = state;
        this.x = x; this.y = y; this.life = life;
        this.spec = DamageSpecs.hazardTick();
    }
    update(dt) {
        this.life -= dt;
        if (dist2(this.x, this.y, this.state.game.p.x, this.state.game.p.y) < (this.state.game.p.r + 5)**2) {
            this.state.combatSystem.onPlayerHit(this, this.state);
            DamageSystem.dealPlayerDamage(this, this.state.game.p, this.spec, { state: this.state, context: { dt } });
        }
        return this.life > 0;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        const a = Math.max(0, Math.min(1, this.life / 2));
        ctx.save();
        ctx.globalAlpha = a;
        // Hostile hazard: enemy-owned cue + mandatory ink rim for small moving elements.
        ctx.fillStyle = tc("fx.ink") || "ink";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, 6.28);
        ctx.fill();
        ctx.fillStyle = tc("enemy.body.standard") || "e2";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, 6.28);
        ctx.fill();
        ctx.restore();
    }
}

export class AegisPulse {
    constructor(state, player, x, y, radius, stacks, spec, snapshot) {
        this.state = state;
        this.player = player;
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.stacks = stacks;
        this.spec = spec;
        this.snapshot = snapshot;
        this.life = 0.5; // Duration of the pulse visual
        this.currentRadius = 0;
        this.hitList = [];
    }

    update(dt) {
        this.life -= dt;
        this.currentRadius += (this.maxRadius / 0.5) * dt;

        this.state.enemies.forEach(e => {
            if (!e.dead && !this.hitList.includes(e)) {
                if (dist2(this.x, this.y, e.x, e.y) < (this.currentRadius + e.r) ** 2) {
                    DamageSystem.dealDamage(this.player, e, this.spec, { state: this.state, snapshot: this.snapshot, particles: ParticleSystem });
                    this.hitList.push(e);
                }
            }
        });

        return this.life > 0;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        const alpha = this.life * 2; // Fade out
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        // Shield/guard: P4 with ink rim for readability.
        ctx.strokeStyle = tc("fx.ink") || "ink";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = tc("player.guard") || "p4";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring for higher stacks
        if (this.stacks > 1) {
            ctx.strokeStyle = tc("player.spec") || "p1";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.currentRadius * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Tiny shards
        const shardCount = 6 + this.stacks * 2;
        for (let i = 0; i < shardCount; i++) {
            const angle = (i / shardCount) * Math.PI * 2 + this.life * 5;
            const dist = this.currentRadius;
            const sx = p.x + Math.cos(angle) * dist;
            const sy = p.y + Math.sin(angle) * dist;
            
            ctx.fillStyle = tc("player.spec") || "p1";
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
