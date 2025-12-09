import Game from "../core/Game.js";
import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";

const UI = {
    dirty: true,
    init() {
        // Build Attr UI
        const c = document.getElementById("attr-container");
        c.innerHTML = `
        <div class="stat-row" style="border-color:var(--red)"><div><b style="color:var(--red)">MIGHT</b><span id="perkMight" style="font-size:9px;margin-left:4px;opacity:0.5">(20: Battle Rhythm)</span><br><small>Dmg/Knockback</small></div><div style="display:flex;gap:4px"><b id="valMight">0</b><button class="stat-btn" id="btn-up-might">+</button></div></div>
        <div class="stat-row" style="border-color:var(--green)"><div><b style="color:var(--green)">ALACRITY</b><span id="perkAlac" style="font-size:9px;margin-left:4px;opacity:0.5">(20: Static Trail)</span><br><small>Spd/Dash</small></div><div style="display:flex;gap:4px"><b id="valAlac">0</b><button class="stat-btn" id="btn-up-alac">+</button></div></div>
        <div class="stat-row" style="border-color:var(--blue)"><div><b style="color:var(--blue)">WILL</b><span id="perkWill" style="font-size:9px;margin-left:4px;opacity:0.5">(20: Soul Wisps)</span><br><small>Area/Soul</small></div><div style="display:flex;gap:4px"><b id="valWill">0</b><button class="stat-btn" id="btn-up-will">+</button></div></div>
        `;
        document.getElementById("btn-up-might").onclick = () => Game.p.upAttr('might');
        document.getElementById("btn-up-alac").onclick = () => Game.p.upAttr('alacrity');
        document.getElementById("btn-up-will").onclick = () => Game.p.upAttr('will');

        document.getElementById("btn-inv").onclick = () => this.toggle('inv');
        document.getElementById("btn-skill").onclick = () => this.toggle('skill');
        document.getElementById("btn-close-inv").onclick = () => this.toggle('inv');
        document.getElementById("btn-close-skill").onclick = () => this.toggle('skill');
        document.getElementById("btn-save").onclick = () => Game.save();
    },
    render() {
        let p = Game.p;
        document.getElementById("uiLvl").innerText = p.lvl;
        document.getElementById("uiSouls").innerText = p.souls;
        document.getElementById("uiXp").innerText = Math.floor(p.xp);
        document.getElementById("uiMaxXp").innerText = Math.floor(50 * Math.pow(1.2, p.lvl - 1));
        document.getElementById("txtHp").innerText = `${Math.ceil(p.hp)}/${p.hpMax}`;
        document.getElementById("hpBar").style.width = (p.hp / p.hpMax * 100) + "%";
        document.getElementById("txtSta").innerText = `${Math.ceil(p.sta)}/100`;
        document.getElementById("staBar").style.width = p.sta + "%";
    },
    toggle(id) {
        let el = document.getElementById("modal_" + id);
        let on = el.classList.toggle("show");
        Game.paused = on;
        if (on) { if (id === "inv") this.renderInv(); if (id === "skill") this.renderSkill(); }
    },
    renderInv() {
        let p = Game.p;
        document.getElementById("uiPts").innerText = p.attr.pts;
        document.getElementById("valMight").innerText = p.totalAttr.might;
        document.getElementById("valAlac").innerText = p.totalAttr.alacrity;
        document.getElementById("valWill").innerText = p.totalAttr.will;

        document.getElementById("perkMight").className = p.perks.might ? "perk-active" : "";
        document.getElementById("perkAlac").className = p.perks.alacrity ? "perk-active" : "";
        document.getElementById("perkWill").className = p.perks.will ? "perk-active" : "";

        let txt = ""; for (let k in p.stats) if (p.stats[k]) txt += `${k}: ${Math.round(p.stats[k] * 100) / 100}, `;
        document.getElementById("statText").innerText = txt;

        let elEq = document.getElementById("equipList"); elEq.innerHTML = "";
        SLOTS.forEach(s => {
            let it = p.gear[s];
            let d = document.createElement("div"); d.className = "equip-slot";
            d.innerHTML = `<span style="color:#888;font-size:10px">${s.toUpperCase()}</span><span class="${it ? 'r-' + it.rarity : 'slot-empty'}">${it ? it.name : 'Empty'}</span>`;
            if (it) d.onclick = () => { p.inv.push(it); p.gear[s] = null; p.recalc(); this.renderInv(); };
            elEq.appendChild(d);
        });

        let elInv = document.getElementById("invList"); elInv.innerHTML = "";
        p.inv.sort((a, b) => (SLOTS.indexOf(a.type) - SLOTS.indexOf(b.type)));
        if (p.inv.length === 0) elInv.innerHTML = "<div style='color:#555;padding:10px;text-align:center'>Inventory Empty</div>";

        p.inv.forEach((it, i) => {
            let d = document.createElement("div"); d.className = `item-card r-${it.rarity}`;
            let stStr = ""; for (let k in it.stats) stStr += `${k}:${it.stats[k]} `;
            d.innerHTML = `<div class="item-info"><span class="item-name">${it.name}</span><span class="item-meta">${stStr}</span></div>`;
            d.onclick = () => {
                if (p.gear[it.type]) p.inv.push(p.gear[it.type]);
                p.gear[it.type] = it; p.inv.splice(i, 1); p.recalc(); this.renderInv();
            };
            elInv.appendChild(d);
        });
    },
    renderSkill() {
        let p = Game.p, w = p.gear.weapon, el = document.getElementById("skillList");
        el.innerHTML = "";
        if (!w) { el.innerText = "Equip weapon."; return; }
        SKILLS.filter(s => s.cls === w.cls).forEach(s => {
            let has = p.skills.has(s.id);
            let d = document.createElement("div"); d.className = `node ${has ? 'unlocked' : ''}`;
            d.innerHTML = `<div class="node-top"><span>${s.name}</span><span>${has ? 'YES' : s.cost}</span></div><small style="color:#888">${s.desc}</small>`;
            if (!has) d.onclick = () => { if (p.souls >= s.cost) { p.souls -= s.cost; p.skills.add(s.id); p.recalc(); this.renderSkill(); } else this.toast("No Souls"); };
            el.appendChild(d);
        });
    },
    toast(m) { let t = document.getElementById("toast"); t.innerText = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); }
};
export default UI;