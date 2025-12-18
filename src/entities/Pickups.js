import { dist2 } from "../core/Utils.js";
import UI from "../systems/UI.js";
import { BALANCE } from "../data/Balance.js";
import ProgressionSystem from "../systems/ProgressionSystem.js";

export class LootDrop {
    constructor(x, y, item) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.item = item;
        this.life = 0;
    }
    update(dt, p) {
        this.life += dt;
        let r = BALANCE.pickups.loot.pickupRadius + p.stats.magnetism;
        let d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            if (r > BALANCE.pickups.loot.pickupRadius) { this.x += (p.x - this.x) * BALANCE.pickups.soul.attractionSpeed * dt; this.y += (p.y - this.y) * BALANCE.pickups.soul.attractionSpeed * dt; }
            if (d2 < BALANCE.pickups.loot.pickupRadius ** 2) {
                p.inv.push(this.item);
                UI.toast(`Got ${this.item.name}`);
                return false;
            }
        }
        return true;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        let c = { common: "#888", uncommon: "#6aae9d", rare: "#6b8cc4", epic: "#c46b6b", legendary: "#d7c48a" }[this.item.rarity] || "#fff";
        ctx.save();
        ctx.translate(p.x, p.y);
        let g = ctx.createLinearGradient(0, -40, 0, 0);
        g.addColorStop(0, "transparent"); g.addColorStop(1, c);
        ctx.fillStyle = g; ctx.fillRect(-2, -40, 4, 40);
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.28); ctx.fill();
        ctx.restore();
    }
}

export class SoulOrb {
    constructor(state, x, y, opts = {}) {
        this.state = state;
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.life = 0;

        const baseSoul = BALANCE.pickups.soul.baseSoulValue;
        const unitsFromValue = typeof opts.soulsValue === "number" ? Math.max(1, Math.round(opts.soulsValue / baseSoul)) : null;
        this.unitCount = typeof opts.unitCount === "number" ? Math.max(1, Math.round(opts.unitCount)) : (unitsFromValue || 1);
        this.soulsValue = this.unitCount * baseSoul;
        this.xpValue = typeof opts.xpValue === "number" ? opts.xpValue : ProgressionSystem.getXpForKill(this.state);

        const tierCfg = BALANCE?.pickups?.soul?.tiers || {};
        const req = tierCfg.requiredCount ?? 20;
        const maxTier = tierCfg.maxTier ?? 5;
        const computeTier = (units) => {
            let t = 1;
            let next = req;
            while (t < maxTier && units >= next) {
                t++;
                next *= req;
            }
            return t;
        };
        this.tier = typeof opts.tier === "number" ? opts.tier : computeTier(this.unitCount);

        this.merge = null;
        this._mergeDead = false;
        this._mergeNextTier = null;
        this._mergeRemaining = 0;
        this._mergePendingXp = null;
        this._mergePendingUnits = null;
    }
    update(dt, p) {
        this.life += dt;

        // Tier merge animation: suck into the merge target, temporarily ignoring player pickup.
        if (this.merge && this.merge.target) {
            const tgt = this.merge.target;
            // If the target vanished (picked up/culled), cancel merge and behave normally.
            if (!tgt || tgt === this || tgt._mergeDead) {
                this.merge = null;
            } else {
                const tLeft = (this.merge.tLeft ?? 0) - dt;
                this.merge.tLeft = tLeft;
                const duration = Math.max(0.05, this.merge.duration ?? 0.25);
                const k = Math.min(1, dt / duration);
                this.x += (tgt.x - this.x) * k;
                this.y += (tgt.y - this.y) * k;

                const dx = tgt.x - this.x;
                const dy = tgt.y - this.y;
                if (tLeft <= 0 || (dx * dx + dy * dy) <= 9) {
                    // Transfer into sink, then remove.
                    if (typeof tgt._mergePendingXp !== "number") tgt._mergePendingXp = tgt.xpValue || 0;
                    if (typeof tgt._mergePendingUnits !== "number") tgt._mergePendingUnits = tgt.unitCount || 1;
                    tgt._mergePendingXp += this.xpValue || 0;
                    tgt._mergePendingUnits += this.unitCount || 1;
                    tgt._mergeRemaining = Math.max(0, (tgt._mergeRemaining || 0) - 1);
                    if ((tgt._mergeRemaining || 0) <= 0) {
                        tgt.xpValue = tgt._mergePendingXp || 0;
                        tgt.unitCount = Math.max(1, Math.round(tgt._mergePendingUnits || 1));
                        tgt.soulsValue = tgt.unitCount * BALANCE.pickups.soul.baseSoulValue;

                        const tierCfg = BALANCE?.pickups?.soul?.tiers || {};
                        const req = tierCfg.requiredCount ?? 20;
                        const maxTier = tierCfg.maxTier ?? 5;
                        let t = 1;
                        let next = req;
                        while (t < maxTier && tgt.unitCount >= next) {
                            t++;
                            next *= req;
                        }
                        tgt.tier = t;
                        tgt._mergePendingXp = null;
                        tgt._mergePendingUnits = null;
                        tgt._mergeNextTier = null;
                        tgt.life = 0;
                    }
                    this._mergeDead = true;
                    return false;
                }
                return true;
            }
        }

        // Merge sink: don't allow pickup while absorbing (prevents losing merge targets).
        if ((this._mergeRemaining || 0) > 0) {
            return true;
        }

        let r = BALANCE.pickups.soul.pickupRadius + p.stats.magnetism;
        const magnet = BALANCE?.progression?.soulMagnet;
        if (p.soulMagnetTimer > 0 && magnet?.attractRadius) {
            r = Math.max(r, magnet.attractRadius);
        }
        let d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            let speed = BALANCE.pickups.soul.attractionSpeed;
            if (p.soulMagnetTimer > 0 && magnet?.attractSpeedMult) speed *= magnet.attractSpeedMult;
            if (r > BALANCE.pickups.soul.pickupRadius) { this.x += (p.x - this.x) * speed * dt; this.y += (p.y - this.y) * speed * dt; }
            if (d2 < BALANCE.pickups.soul.pickupRadius ** 2) {
                p.souls += this.soulsValue || 0; // Currency
                p.giveXp(this.xpValue || 0);  // XP
                UI.dirty = true;
                return false;
            }
        }
        return true;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        let float = Math.sin(this.life * 3) * 5;
        const colors = BALANCE?.pickups?.soul?.tierColors || {};
        const color = colors?.[this.tier] || "#d7c48a";
        ctx.save();
        ctx.translate(p.x, p.y + float);
        ctx.globalAlpha = (this.merge || (this._mergeRemaining || 0) > 0) ? 0.9 : 1.0;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, 6.28);
        ctx.fill();
        ctx.restore();
    }
}

export class PhialShard {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.life = 0;
    }

    update(dt, p) {
        this.life += dt;
        let r = BALANCE.pickups.loot.pickupRadius + p.stats.magnetism;
        let d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            if (r > BALANCE.pickups.loot.pickupRadius) { this.x += (p.x - this.x) * BALANCE.pickups.soul.attractionSpeed * dt; this.y += (p.y - this.y) * BALANCE.pickups.soul.attractionSpeed * dt; }
            if (d2 < BALANCE.pickups.loot.pickupRadius ** 2) {
                p.phialShards++;
                UI.dirty = true;
                return false;
            }
        }
        return true;
    }

    draw(ctx, s) {
        let p = s(this.x, this.y);
        let float = Math.sin(this.life * 3) * 5;
        ctx.save();
        ctx.translate(p.x, p.y + float);
        let g = ctx.createLinearGradient(0, -60, 0, 0);
        g.addColorStop(0, "transparent"); g.addColorStop(1, "#a865e8");
        ctx.fillStyle = g; ctx.fillRect(-3, -60, 6, 60);
        ctx.fillStyle = "#8a2be2"; // A darker purplish color for the shard
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

export class HealthOrb {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.life = 0;
    }

    update(dt, p) {
        this.life += dt;
        const baseRadius = BALANCE.pickups.loot.pickupRadius;
        const r = baseRadius + p.stats.magnetism;
        const d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            if (r > baseRadius) {
                this.x += (p.x - this.x) * BALANCE.pickups.soul.attractionSpeed * dt;
                this.y += (p.y - this.y) * BALANCE.pickups.soul.attractionSpeed * dt;
            }
            if (d2 < baseRadius ** 2) {
                const cfg = BALANCE?.progression?.healOrbs || {};
                const pct = cfg.healPctMaxHp ?? 0.20;
                const heal = Math.max(0, p.hpMax * pct);
                p.hp = Math.min(p.hpMax, p.hp + heal);
                UI.dirty = true;
                return false;
            }
        }
        return true;
    }

    draw(ctx, s) {
        const p = s(this.x, this.y);
        const t = this.life;
        const pulse = Math.sin(t * 6) * 0.2 + 0.8;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = `rgba(107, 196, 140, ${0.6 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(230, 255, 240, 0.95)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class SoulMagnet {
    constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.life = 0;
    }

    update(dt, p) {
        this.life += dt;
        const baseRadius = BALANCE.pickups.loot.pickupRadius;
        const r = baseRadius + p.stats.magnetism;
        const d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            if (r > baseRadius) {
                this.x += (p.x - this.x) * BALANCE.pickups.soul.attractionSpeed * dt;
                this.y += (p.y - this.y) * BALANCE.pickups.soul.attractionSpeed * dt;
            }
            if (d2 < baseRadius ** 2) {
                const cfg = BALANCE?.progression?.soulMagnet || {};
                p.soulMagnetTimer = Math.max(p.soulMagnetTimer || 0, cfg.durationSec ?? 6.0);
                UI.toast("SOUL MAGNET");
                UI.dirty = true;
                return false;
            }
        }
        return true;
    }

    draw(ctx, s) {
        const p = s(this.x, this.y);
        const t = this.life;
        const pulse = Math.sin(t * 5) * 0.25 + 0.75;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = `rgba(215, 196, 138, ${0.8 * pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(160, 235, 255, ${0.6 * pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
