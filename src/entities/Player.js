import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";
import { clamp } from "../core/Utils.js";
import { keys, mouse } from "../core/Input.js";
import UI from "../systems/UI.js";
import CombatSystem from "../systems/CombatSystem.js";

export default class PlayerObj {
    constructor() {
        // Physics & Transform
        this.x = 0; 
        this.y = 0; 
        this.r = 12; 
        
        // Stats
        this.hp = 100; this.hpMax = 100; this.sta = 100;
        this.lvl = 1; this.xp = 0; this.souls = 0;
        
        // Inventory
        this.inv = []; 
        this.gear = {}; 
        SLOTS.forEach(s => this.gear[s] = null);
        
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
        this.rooted = 0;
        this.atkCd = 0;
        
        // Visuals
        this.hammerRad = 0;
        this.hammerAng = 0;

        this.recalc();
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
            return; // Hard stop on actions
        }

        // 2. Handle Passive Perks
        if (allowCombat) this.updatePerks(dt, scene);

        // 3. Cooldowns & Regen
        if (this.atkCd > 0) this.atkCd -= dt;
        this.sta = Math.min(100, this.sta + dt * 15);

        // 4. Movement
        if (this.dashTimer > 0) {
            this.processDash(dt);
        } else {
            this.processMovement(dt);
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
        this.sta = 100;
        this.rooted = 0;
        this.dashTimer = 0;
        this.atkCd = 0;
    }

    /** Move player without physics interpolation */
    teleport(x, y) {
        this.x = x;
        this.y = y;
        this.dashTimer = 0;
        this.hammerRad = 0;
    }

    // --- INTERNAL LOGIC ---

    processMovement(dt) {
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
        if (keys["Space"] && this.sta >= 20 && (mx || my)) {
            this.sta -= 20; 
            this.dashTimer = 0.2; 
            this.dashVec = { x: mx, y: my };
        } else {
            // Standard Walk
            let spd = 180 * (1 + this.stats.move);
            this.x += mx * spd * dt; 
            this.y += my * spd * dt;
        }
    }

    processDash(dt) {
        this.dashTimer -= dt;
        // Dash speed is fixed high velocity
        this.x += this.dashVec.x * 800 * dt; 
        this.y += this.dashVec.y * 800 * dt;
    }

    processCombat(dt, scene) {
        const w = this.gear.weapon;
        if (!w) return;

        // Hammer Orbit
        if (w.cls === "hammer") {
            if (mouse.down) {
                this.hammerRad = Math.min(100, this.hammerRad + dt * 300); // Expand
                CombatSystem.runOrbit(this, scene, dt); 
            } else {
                if (this.hammerRad > 0) {
                    this.hammerRad -= dt * 400; // Decay
                    CombatSystem.runOrbit(this, scene, dt); // Keep orbiting while decaying
                }
            }
        }

        // Shooting (Pistol/Staff) - Don't shoot while dashing
        if (mouse.down && this.atkCd <= 0 && this.dashTimer <= 0) {
            let rate = 0.4 / (1 + this.stats.spd);
            
            if (w.cls === "pistol") {
                CombatSystem.firePistol(this, scene);
                this.atkCd = rate;
            } else if (w.cls === "staff") {
                CombatSystem.fireZap(this, scene);
                this.atkCd = rate * 1.5;
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
    
    takeDamage(amount) {
        this.hp -= amount;
        UI.render(); // Directly call render to ensure UI updates immediately
        if (this.hp <= 0) {
            this.hp = 0;
            document.getElementById('screen_death').classList.add('active');
            document.getElementById('deathSouls').innerText = this.souls;
            document.getElementById('deathLvl').innerText = this.lvl;
        }
    }

    updatePerks(dt, state) {
        if (this.perks.might) {
            this.timers.might -= dt;
            if (this.timers.might <= 0) { this.timers.might = 3.0; CombatSystem.fireShockwave(this, state); }
        }
        if (this.perks.alacrity) {
            this.timers.alacrity -= dt;
            // Check keys here instead of local state for cleaner logic
            if (this.timers.alacrity <= 0 && (keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"])) { 
                this.timers.alacrity = 0.5; CombatSystem.fireStaticMine(this, state); 
            }
        }
        if (this.perks.will) {
            this.timers.will -= dt;
            if (this.timers.will <= 0) { this.timers.will = 1.5; CombatSystem.fireWisp(this, state); }
        }
    }

    draw(ctx, s) {
        let pc = s(this.x, this.y);
        ctx.fillStyle = "#6aae9d"; 
        ctx.beginPath(); 
        ctx.arc(pc.x, pc.y, 12, 0, 6.28); 
        ctx.fill();

        if (this.hammerRad > 0) {
            let cnt = 1 + (this.stats.orbitBase || 0);
            for (let i = 0; i < cnt; i++) {
                let a = this.hammerAng + (i * 6.28 / cnt);
                ctx.fillStyle = "#e87b7b"; 
                ctx.beginPath();
                ctx.arc(pc.x + Math.cos(a) * this.hammerRad, pc.y + Math.sin(a) * this.hammerRad, 8, 0, 6.28); 
                ctx.fill();
            }
        }
    }
}