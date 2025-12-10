import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";
import { clamp } from "../core/Utils.js";
import UI from "../systems/UI.js";
import CombatSystem from "../systems/CombatSystem.js";

export default class PlayerObj {
    constructor() {
        this.x = 0; this.y = 0; this.r = 12; this.hp = 100; this.hpMax = 100; this.sta = 100;
        this.lvl = 1; this.xp = 0; this.souls = 0;
        this.inv = []; this.gear = {}; SLOTS.forEach(s => this.gear[s] = null);
        this.attr = { might: 0, alacrity: 0, will: 0, pts: 0 };
        this.totalAttr = { might: 0, alacrity: 0, will: 0 };
        this.perks = { might: false, alacrity: false, will: false };
        this.timers = { might: 0, alacrity: 0, will: 0 };
        this.skills = new Set(); this.stats = {};
        this.dashTimer = 0; this.dashVec = { x: 0, y: 0 };
        this.rooted = 0; // Root timer
        this.recalc();
    }
    recalc() {
        let t = { might: this.attr.might, alacrity: this.attr.alacrity, will: this.attr.will };
        for (let k in this.gear) if (this.gear[k]) {
            if (this.gear[k].stats.might) t.might += this.gear[k].stats.might;
            if (this.gear[k].stats.alacrity) t.alacrity += this.gear[k].stats.alacrity;
            if (this.gear[k].stats.will) t.will += this.gear[k].stats.will;
        }
        this.totalAttr = t;

        let s = { hp: 80 + (this.lvl * 5), dmg: 5, crit: 0.05, spd: 0, move: 0, regen: 0.5, soulGain: 1, kb: 0, area: 1 };
        s.dmg += t.might * 0.5; s.kb += t.might * 3;
        s.spd += t.alacrity * 0.03; s.move += t.alacrity * 0.02;
        s.area += t.will * 0.05; s.soulGain += t.will * 0.1;

        this.perks.might = t.might >= 20;
        this.perks.alacrity = t.alacrity >= 20;
        this.perks.will = t.will >= 20;

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
        this.xp += n; let req = Math.floor(50 * Math.pow(1.2, this.lvl - 1));
        if (this.xp >= req) { this.xp -= req; this.lvl++; this.attr.pts += 3; this.hp = this.hpMax; UI.toast("LEVEL UP!"); this.recalc(); }
        UI.dirty = true;
    }
    updatePerks(dt, state) {
        if (this.perks.might) {
            this.timers.might -= dt;
            if (this.timers.might <= 0) { this.timers.might = 3.0; CombatSystem.fireShockwave(this, state); }
        }
        if (this.perks.alacrity) {
            this.timers.alacrity -= dt;
            if (this.timers.alacrity <= 0 && state.keysMoved) { this.timers.alacrity = 0.5; CombatSystem.fireStaticMine(this, state); }
        }
        if (this.perks.will) {
            this.timers.will -= dt;
            if (this.timers.will <= 0) { this.timers.will = 1.5; CombatSystem.fireWisp(this, state); }
        }
    }
}