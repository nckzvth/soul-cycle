import { dist2 } from "../core/Utils.js";
import UI from "../systems/UI.js";
import { BALANCE } from "../data/Balance.js";

export class LootDrop {
    constructor(x, y, item) { this.x = x; this.y = y; this.item = item; this.life = 0; }
    update(dt, p) {
        this.life += dt;
        if (dist2(this.x, this.y, p.x, p.y) < BALANCE.pickups.loot.pickupRadius ** 2) {
            p.inv.push(this.item);
            UI.toast(`Got ${this.item.name}`);
            return false;
        }
        return true;
    }
    draw(ctx, s) {
        let p = s(this.x, this.y);
        let c = { common: "#888", uncommon: "#6aae9d", rare: "#6b8cc4", epic: "#c46b6b", legendary: "#d7c48a" }[this.item.rarity] || "#fff";
        let float = Math.sin(this.life * 3) * 5;
        ctx.save();
        ctx.translate(p.x, p.y + float);
        let g = ctx.createLinearGradient(0, -40, 0, 0);
        g.addColorStop(0, "transparent"); g.addColorStop(1, c);
        ctx.fillStyle = g; ctx.fillRect(-2, -40, 4, 40);
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -10, 4, 0, 6.28); ctx.fill();
        ctx.restore();
    }
}

export class SoulOrb {
    constructor(x, y) { this.x = x; this.y = y; }
    update(dt, p) {
        let r = BALANCE.pickups.soul.pickupRadius;
        if (p.perks.will || p.stats.area > 2) r = BALANCE.pickups.soul.extendedPickupRadius;
        let d2 = dist2(this.x, this.y, p.x, p.y);
        if (d2 < r * r) {
            if (r > BALANCE.pickups.soul.pickupRadius) { this.x += (p.x - this.x) * BALANCE.pickups.soul.attractionSpeed * dt; this.y += (p.y - this.y) * BALANCE.pickups.soul.attractionSpeed * dt; }
            if (d2 < BALANCE.pickups.soul.pickupRadius ** 2) {
                p.souls += Math.ceil(BALANCE.pickups.soul.baseSoulValue * p.stats.soulGain);
                UI.dirty = true;
                return false;
            }
        }
        return true;
    }
}