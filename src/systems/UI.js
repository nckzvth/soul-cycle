import Game from "../core/Game.js";
import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";
import { Phials } from "../data/Phials.js";
import { BALANCE } from "../data/Balance.js";
import SkillOfferSystem from "./SkillOfferSystem.js";
import PhialOfferSystem from "./PhialOfferSystem.js";
import ProgressionSystem from "./ProgressionSystem.js";

const UI = {
    dirty: true,
    playChoiceConfirm(btn, color) {
        if (!btn) return;
        const parseRgba = (s) => {
            const m = /^rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/.exec(s);
            if (!m) return null;
            return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Number(m[4]) };
        };
        const rgba = parseRgba(color);
        if (rgba) {
            btn.style.setProperty('--confirm-color', `rgba(${rgba.r},${rgba.g},${rgba.b},1)`);
            btn.style.setProperty('--confirm-glow', `rgba(${rgba.r},${rgba.g},${rgba.b},0.65)`);
            btn.style.setProperty('--confirm-fill', `rgba(${rgba.r},${rgba.g},${rgba.b},0.35)`);
        } else {
            btn.style.setProperty('--confirm-color', color);
            btn.style.setProperty('--confirm-glow', 'rgba(215,196,138,0.65)');
            btn.style.setProperty('--confirm-fill', 'rgba(215,196,138,0.35)');
        }
        btn.classList.remove('btn-choice-confirm');
        void btn.offsetWidth;
        btn.classList.add('btn-choice-confirm');
        window.setTimeout(() => btn.classList.remove('btn-choice-confirm'), 320);
    },
    init() {
        // Build Attr UI
        const c = document.getElementById("attr-container");
        c.innerHTML = `
        <div class="stat-row" style="border-color:var(--red)"><div><b style="color:var(--red)">MIGHT</b><span id="perkMight" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Soul Blast • 50: Burn)</span><br><small>Dmg/Knockback</small></div><div style="display:flex;gap:4px"><b id="valMight">0</b></div></div>
        <div class="stat-row" style="border-color:var(--green)"><div><b style="color:var(--green)">ALACRITY</b><span id="perkAlac" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Tempest • 50: Split)</span><br><small>Spd/Dash</small></div><div style="display:flex;gap:4px"><b id="valAlac">0</b></div></div>
        <div class="stat-row" style="border-color:var(--blue)"><div><b style="color:var(--blue)">WILL</b><span id="perkWill" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Wisps • 50: Rod)</span><br><small>Area/Soul</small></div><div style="display:flex;gap:4px"><b id="valWill">0</b></div></div>
        `;

        document.getElementById("btn-inv").onclick = () => this.toggle('inv');
        document.getElementById("btn-close-inv").onclick = () => this.toggle('inv');
        document.getElementById("btn-save").onclick = () => Game.save();
        
        document.getElementById('levelup-prompt').onmousedown = (e) => {
            e.preventDefault();
            this.toggle('levelup');
        };
        document.getElementById('btn-close-levelup').onclick = () => this.toggle('levelup');
    },
    render() {
        let p = Game.p;
        if (!p) return; // in case called before startGame()

        document.getElementById("uiLvl").innerText = p.lvl;
        document.getElementById("uiSouls").innerText = p.souls;
        const xpRequired = ProgressionSystem.getXpRequired(p.lvl);
        const xpProgress = (p.xp / xpRequired) * 100;
        document.getElementById("xp-bar-fill").style.width = `${xpProgress}%`;
        document.getElementById("txtHp").innerText = `${Math.ceil(p.hp)}/${p.hpMax}`;
        document.getElementById("hpBar").style.width = (p.hp / p.hpMax * 100) + "%";
        
        const dashContainer = document.getElementById("dash-charges");
        if (dashContainer) {
            dashContainer.innerHTML = "";
            for (let i = 0; i < BALANCE.player.baseDashCharges; i++) {
                const chargeEl = document.createElement("div");
                chargeEl.className = "dash-charge-pip";
                const fillEl = document.createElement("div");
                fillEl.className = "fill";
                
                if (i < p.dashCharges) {
                    chargeEl.classList.add("full");
                    fillEl.style.width = "100%";
                    if (p.dashRechargeFlash > 0 && i === p.dashCharges - 1) {
                        chargeEl.classList.add("recharged");
                    }
                } else if (i === p.dashCharges) {
                    const progress = p.dashRechargeTimer / BALANCE.player.dashRechargeTime;
                    fillEl.style.width = `${progress * 100}%`;
                }

                chargeEl.appendChild(fillEl);
                dashContainer.appendChild(chargeEl);
            }
        }

        // Kill counter: always visible, always driven by player
        const killCounter = document.getElementById("uiKills");
        if (killCounter) {
            const kc = p.killStats?.currentSession ?? 0;
            killCounter.innerText = kc;
        }
        this.updateLevelUpPrompt();
    },
    toggle(id) {
        let el = document.getElementById("modal_" + id);
        let on = el.classList.toggle("show");
        Game.paused = on;
        if (on) { 
            if (id === "inv") this.renderInv(); 
            if (id === 'levelup') this.renderLevelUp();
        }
        this.updateLevelUpPrompt();
    },
    renderInv() {
        let p = Game.p;
        document.getElementById("valMight").innerText = p.totalAttr.might;
        document.getElementById("valAlac").innerText = p.totalAttr.alacrity;
        document.getElementById("valWill").innerText = p.totalAttr.will;

        const m = p.perkLevel?.might || 0;
        const a = p.perkLevel?.alacrity || 0;
        const w = p.perkLevel?.will || 0;
        document.getElementById("perkMight").className = m > 0 ? "perk-active" : "";
        document.getElementById("perkAlac").className = a > 0 ? "perk-active" : "";
        document.getElementById("perkWill").className = w > 0 ? "perk-active" : "";

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
        
        const debugPhials = document.getElementById('debug-phials');
        if (Game.debug) {
            debugPhials.innerHTML = '<span class="sec-title">Debug: Add Phials</span>';
            for (const phialId in Phials) {
                const phial = Phials[phialId];
                const btn = document.createElement('button');
                btn.className = 'btn';
                btn.innerText = `+ ${phial.name}`;
                btn.onclick = () => {
                    p.addPhial(phial.id);
                };
                debugPhials.appendChild(btn);
            }
        }
    },
    renderLevelUp() {
        const p = Game.p;
        const body = document.querySelector('#modal_levelup .modal-body');
        
        const weaponOptions = this.ensureWeaponOffers();
        const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
        const phialOptions = this.ensurePhialOffers();
        const phialRerollCost = this.getPhialRerollCost();

        body.innerHTML = `
            <div class="levelup-row" id="levelup-attributes">
                <div class="sec-title">Attributes (x${p.levelPicks.attribute})</div>
                <div class="levelup-options">
                    <button class="btn-attr" id="btn-might">Might</button>
                    <button class="btn-attr" id="btn-alacrity">Alacrity</button>
                    <button class="btn-attr" id="btn-will">Will</button>
                </div>
            </div>
            <div class="levelup-row" id="levelup-weapon">
                <div class="sec-title-container">
                    <div class="sec-title">Weapon Upgrade (x${p.levelPicks.weapon})</div>
                    <button class="btn-reroll" id="btn-reroll-weapon">Reroll (${rerollCost} Souls)</button>
                </div>
                <div class="levelup-options" id="weapon-upgrade-options">
                    ${weaponOptions.map(skill => `<button class="btn-upgrade" data-skill-id="${skill.id}">${skill.name}<small>${skill.desc}</small></button>`).join('')}
                </div>
            </div>
            <div class="levelup-row" id="levelup-phial">
                <div class="sec-title-container">
                    <div class="sec-title">Phial (x${p.levelPicks.phial})</div>
                    <button class="btn-reroll" id="btn-reroll-phial">Reroll (${phialRerollCost} Shards)</button>
                </div>
                <div class="levelup-options" id="phial-options">
                    ${phialOptions.map(id => {
                        const stacks = p.getPhialStacks(id);
                        const phial = Object.values(Phials).find(ph => ph.id === id);
                        const title = phial?.name || id;
                        const desc = phial?.description || "";
                        const tag = stacks > 0 ? `Upgrade (x${stacks + 1})` : "New";
                        return `<button class="btn-upgrade" data-phial-id="${id}">${title}<small>${tag} — ${desc}</small></button>`;
                    }).join('')}
                </div>
            </div>
        `;

        this.updateRowCompletion();

        document.getElementById('btn-might').onclick = (e) => this.selectAttribute('might', e.currentTarget);
        document.getElementById('btn-alacrity').onclick = (e) => this.selectAttribute('alacrity', e.currentTarget);
        document.getElementById('btn-will').onclick = (e) => this.selectAttribute('will', e.currentTarget);

        document.querySelectorAll('.btn-upgrade').forEach(btn => {
            if (btn.dataset.skillId) btn.onclick = (e) => this.selectWeaponUpgrade(btn.dataset.skillId, e.currentTarget);
            if (btn.dataset.phialId) btn.onclick = (e) => this.selectPhial(btn.dataset.phialId, e.currentTarget);
        });
        
        document.getElementById('btn-reroll-weapon').onclick = () => this.rerollWeaponOptions();
        document.getElementById('btn-reroll-phial').onclick = () => this.rerollPhialOptions();
    },
    selectAttribute(attr, sourceBtn) {
        const p = Game.p;
        if (p.levelPicks.attribute > 0) {
            p.attr[attr] += 5;
            p.levelPicks.attribute--;
            p.recalc();
            const color = attr === 'might' ? 'rgba(196,107,107,0.75)' : (attr === 'alacrity' ? 'rgba(107,196,140,0.75)' : 'rgba(107,140,196,0.75)');
            this.playChoiceConfirm(sourceBtn, color);
            this.rerenderAttributeRow();
        }
    },
    rerenderAttributeRow() {
        const p = Game.p;
        const attrRow = document.getElementById('levelup-attributes');
        attrRow.querySelector('.sec-title').innerText = `Attributes (x${p.levelPicks.attribute})`;
        this.updateRowCompletion();
    },
    getWeaponUpgradeOptions() {
        const p = Game.p;
        const weapon = p.gear.weapon;
        if (!weapon) return [];
        return SkillOfferSystem.getWeaponOffers(p, weapon.cls, 3);
    },
    ensureWeaponOffers() {
        const p = Game.p;
        if (!p.levelUpOffers) {
            p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
        }
        const weaponCls = p.gear.weapon?.cls || null;
        if (!weaponCls) {
            p.levelUpOffers.weapon = [];
            p.levelUpOffers.weaponMeta.weaponCls = null;
            return [];
        }
        const invalid = p.levelUpOffers.weaponMeta?.weaponCls !== weaponCls;
        if (!Array.isArray(p.levelUpOffers.weapon) || p.levelUpOffers.weapon.length === 0 || invalid) {
            p.levelUpOffers.weapon = this.getWeaponUpgradeOptions();
            p.levelUpOffers.weaponMeta.weaponCls = weaponCls;
        }
        return p.levelUpOffers.weapon;
    },
    getPhialOptions() {
        const p = Game.p;
        return PhialOfferSystem.getPhialOffers(p, 3);
    },
    ensurePhialOffers() {
        const p = Game.p;
        if (!p.levelUpOffers) {
            p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
        }
        if (!Array.isArray(p.levelUpOffers.phial) || p.levelUpOffers.phial.length === 0) {
            p.levelUpOffers.phial = this.getPhialOptions();
        }
        return p.levelUpOffers.phial;
    },
    selectWeaponUpgrade(skillId, sourceBtn) {
        const p = Game.p;
        if (p.levelPicks.weapon > 0) {
            const currentStacks = p.skills.get(skillId) || 0;
            p.skills.set(skillId, currentStacks + 1);
            const picked = SKILLS.find(s => s.id === skillId);
            if (picked) {
                p.skillMeta = p.skillMeta || { exclusive: new Map(), flags: new Set() };
                if (picked.exclusiveGroup && picked.exclusiveKey) {
                    p.skillMeta.exclusive.set(picked.exclusiveGroup, picked.exclusiveKey);
                    p.skillMeta.flags.add(`${picked.exclusiveGroup}:${picked.exclusiveKey}`);
                }
                if (Array.isArray(picked.flagAdds)) {
                    picked.flagAdds.forEach(f => p.skillMeta.flags.add(f));
                }
            }
            p.levelPicks.weapon--;
            p.recalc();
            this.playChoiceConfirm(sourceBtn, 'rgba(215,196,138,0.75)');
            window.setTimeout(() => this.rerenderWeaponRow(), 180);
        }
    },
    rerenderWeaponRow() {
        const p = Game.p;
        const weaponRow = document.getElementById('levelup-weapon');
        weaponRow.querySelector('.sec-title').innerText = `Weapon Upgrade (x${p.levelPicks.weapon})`;
        
        const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
        const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
        rerollBtn.innerText = `Reroll (${rerollCost} Souls)`;
        
        if (p.souls < rerollCost) {
            rerollBtn.classList.add('disabled');
        } else {
            rerollBtn.classList.remove('disabled');
        }

        if (!p.levelUpOffers) {
            p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
        }
        p.levelUpOffers.weapon = this.getWeaponUpgradeOptions();
        p.levelUpOffers.weaponMeta.weaponCls = p.gear.weapon?.cls || null;
        const weaponOptions = p.levelUpOffers.weapon;
        const optionsContainer = weaponRow.querySelector('#weapon-upgrade-options');
        optionsContainer.innerHTML = weaponOptions.map(skill => `<button class="btn-upgrade" data-skill-id="${skill.id}">${skill.name}<small>${skill.desc}</small></button>`).join('');
        
        optionsContainer.querySelectorAll('.btn-upgrade').forEach(btn => {
            btn.onclick = () => this.selectWeaponUpgrade(btn.dataset.skillId);
        });
        this.updateRowCompletion();
    },
    rerollWeaponOptions() {
        const p = Game.p;
        const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
        if (p.souls >= rerollCost) {
            p.souls -= rerollCost;
            p.weaponRerollsUsed++;
            this.dirty = true;
            this.rerenderWeaponRow();
        }
    },
    getPhialRerollCost() {
        const p = Game.p;
        return 1 + (p.phialRerollsUsed || 0);
    },
    selectPhial(phialId, sourceBtn) {
        const p = Game.p;
        if (p.levelPicks.phial > 0) {
            p.addPhial(phialId);
            p.levelPicks.phial--;
            if (!p.levelUpOffers) p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
            p.levelUpOffers.phial = null;
            this.playChoiceConfirm(sourceBtn, 'rgba(215,196,138,0.75)');
            window.setTimeout(() => this.rerenderPhialRow(), 180);
            this.dirty = true;
        }
    },
    rerenderPhialRow() {
        const p = Game.p;
        const phialRow = document.getElementById('levelup-phial');
        if (!phialRow) return;
        phialRow.querySelector('.sec-title').innerText = `Phial (x${p.levelPicks.phial})`;

        const rerollBtn = phialRow.querySelector('#btn-reroll-phial');
        const rerollCost = this.getPhialRerollCost();
        if (rerollBtn) {
            rerollBtn.innerText = `Reroll (${rerollCost} Shards)`;
            if ((p.phialShards || 0) < rerollCost) rerollBtn.classList.add('disabled');
            else rerollBtn.classList.remove('disabled');
        }

        const phialOptions = this.ensurePhialOffers();
        const optionsContainer = phialRow.querySelector('#phial-options');
        if (optionsContainer) {
            optionsContainer.innerHTML = phialOptions.map(id => {
                const stacks = p.getPhialStacks(id);
                const phial = Object.values(Phials).find(ph => ph.id === id);
                const title = phial?.name || id;
                const desc = phial?.description || "";
                const tag = stacks > 0 ? `Upgrade (x${stacks + 1})` : "New";
                return `<button class="btn-upgrade" data-phial-id="${id}">${title}<small>${tag} — ${desc}</small></button>`;
            }).join('');
            optionsContainer.querySelectorAll('.btn-upgrade').forEach(btn => {
                if (btn.dataset.phialId) btn.onclick = (e) => this.selectPhial(btn.dataset.phialId, e.currentTarget);
            });
        }

        if (rerollBtn) rerollBtn.onclick = () => this.rerollPhialOptions();
        this.updateRowCompletion();
    },
    rerollPhialOptions() {
        const p = Game.p;
        const rerollCost = this.getPhialRerollCost();
        if ((p.phialShards || 0) >= rerollCost) {
            p.phialShards -= rerollCost;
            p.phialRerollsUsed = (p.phialRerollsUsed || 0) + 1;
            if (!p.levelUpOffers) p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
            p.levelUpOffers.phial = null;
            this.rerenderPhialRow();
            this.dirty = true;
        }
    },
    updateRowCompletion() {
        const p = Game.p;
        const attrRow = document.getElementById('levelup-attributes');
        const weaponRow = document.getElementById('levelup-weapon');
        const phialRow = document.getElementById('levelup-phial');

        const addOverlay = (row, text) => {
            if (!row.querySelector('.row-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'row-overlay';
                overlay.innerText = text;
                row.appendChild(overlay);
            }
        };
        const clearComplete = (row) => {
            if (!row) return;
            row.classList.remove('complete');
            const overlay = row.querySelector('.row-overlay');
            if (overlay) overlay.remove();
        };

        if (p.levelPicks.attribute > 0) clearComplete(attrRow);
        if (p.levelPicks.weapon > 0) clearComplete(weaponRow);
        if (p.levelPicks.phial > 0) clearComplete(phialRow);

        if (p.levelPicks.attribute === 0) {
            attrRow.classList.add('complete');
            addOverlay(attrRow, 'NO PENDING ATTRIBUTES');
        }
        if (p.levelPicks.weapon === 0) {
            weaponRow.classList.add('complete');
            const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
            if(rerollBtn) rerollBtn.style.display = 'none';
            addOverlay(weaponRow, 'NO PENDING SKILLS');
        } else {
            const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
            if (rerollBtn) rerollBtn.style.display = '';
        }
        if (p.levelPicks.phial === 0) {
            phialRow.classList.add('complete');
            const rerollBtn = phialRow.querySelector('#btn-reroll-phial');
            if (rerollBtn) rerollBtn.style.display = 'none';
            addOverlay(phialRow, 'NO PENDING PHIALS');
        } else {
            const rerollBtn = phialRow.querySelector('#btn-reroll-phial');
            if (rerollBtn) rerollBtn.style.display = '';
        }
        
        const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
        if (rerollBtn) {
            const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
            if (p.souls < rerollCost) {
                rerollBtn.classList.add('disabled');
            } else {
                rerollBtn.classList.remove('disabled');
            }
        }

        const phialRerollBtn = phialRow.querySelector('#btn-reroll-phial');
        if (phialRerollBtn) {
            const cost = this.getPhialRerollCost();
            if ((p.phialShards || 0) < cost) phialRerollBtn.classList.add('disabled');
            else phialRerollBtn.classList.remove('disabled');
        }
    },
    toast(m) { let t = document.getElementById("toast"); t.innerText = m; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 2000); },
    updateLevelUpPrompt() {
        const prompt = document.getElementById('levelup-prompt');
        const p = Game.p;
        const levelupModal = document.getElementById('modal_levelup');
        const levelupOpen = !!levelupModal && levelupModal.classList.contains('show');
        if (levelupOpen) {
            prompt.style.display = 'none';
            prompt.classList.remove('glow');
            return;
        }
        if (p && (p.levelPicks.attribute > 0 || p.levelPicks.weapon > 0 || p.levelPicks.phial > 0)) {
            const totalPicks = p.levelPicks.attribute + p.levelPicks.weapon + p.levelPicks.phial;
            prompt.innerHTML = `Level Up!<small>${totalPicks} available</small>`;
            prompt.style.display = 'block';
            prompt.classList.add('glow');
        } else {
            prompt.style.display = 'none';
            prompt.classList.remove('glow');
        }
    }
};
export default UI;
