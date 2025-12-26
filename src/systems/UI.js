import Game from "../core/Game.js";
import { SLOTS } from "../data/Constants.js";
import { SKILLS } from "../data/Skills.js";
import { Phials } from "../data/Phials.js";
import { BALANCE } from "../data/Balance.js";
import SkillOfferSystem from "./SkillOfferSystem.js";
import PhialOfferSystem from "./PhialOfferSystem.js";
import ProgressionSystem from "./ProgressionSystem.js";
import { color as c } from "../data/ColorTuning.js";
import { FeatureFlags } from "../core/FeatureFlags.js";
import { ProfileStore } from "../core/ProfileStore.js";
import { getWeaponConfigByCls, WeaponId, normalizeWeaponCls } from "../data/Weapons.js";
import { PerkSocketLevel, getSkillDef, getSocketOptions, getUnlockedSkillIdsForSocket } from "../data/PerkSockets.js";
import { getWeaponMasteryLevel } from "./MasterySystem.js";
import { AttributeId } from "../data/Vocabulary.js";

const UI = {
    dirty: true,
    _openStack: [],
    _appraiseSession: null,
    _pauseView: "build",
    _armoryTab: "loadout",
    _armoryWeaponId: null,
    _minionHudKey: null,
    buildAttrUI(containerId, suffix) {
        const c = document.getElementById(containerId);
        if (!c) return;
        const showCon = FeatureFlags.isOn("progression.constitutionEnabled");
        c.innerHTML = `
        <div class="stat-row" style="border-color:var(--red)"><div><b style="color:var(--red)">MIGHT</b><span id="perkMight-${suffix}" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Soul Blast • 50: Burn)</span><br><small>Dmg/Knockback</small></div><div style="display:flex;gap:4px"><b id="valMight-${suffix}">0</b></div></div>
        <div class="stat-row" style="border-color:var(--green)"><div><b style="color:var(--green)">ALACRITY</b><span id="perkAlac-${suffix}" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Tempest • 50: Split)</span><br><small>Spd/Dash</small></div><div style="display:flex;gap:4px"><b id="valAlac-${suffix}">0</b></div></div>
        <div class="stat-row" style="border-color:var(--blue)"><div><b style="color:var(--blue)">WILL</b><span id="perkWill-${suffix}" style="font-size:9px;margin-left:4px;opacity:0.5">(25: Wisps • 50: Rod)</span><br><small>Area/Soul</small></div><div style="display:flex;gap:4px"><b id="valWill-${suffix}">0</b></div></div>
        ${showCon ? `<div class="stat-row" style="border-color:var(--violet)"><div><b style="color:var(--violet)">CONSTITUTION</b><span id="perkCon-${suffix}" style="font-size:9px;margin-left:4px;opacity:0.5">(Rite: Ossuary)</span><br><small>HP/Guard</small></div><div style="display:flex;gap:4px"><b id="valCon-${suffix}">0</b></div></div>` : ""}
        `;
    },
    renderAttrAndStats(suffix) {
        const p = Game.p;
        document.getElementById(`valMight-${suffix}`).innerText = p.totalAttr.might;
        document.getElementById(`valAlac-${suffix}`).innerText = p.totalAttr.alacrity;
        document.getElementById(`valWill-${suffix}`).innerText = p.totalAttr.will;
        const conEl = document.getElementById(`valCon-${suffix}`);
        if (conEl) conEl.innerText = p.totalAttr.constitution || 0;

        const m = p.perkLevel?.might || 0;
        const a = p.perkLevel?.alacrity || 0;
        const w = p.perkLevel?.will || 0;
        const con = p.perkLevel?.constitution || 0;
        document.getElementById(`perkMight-${suffix}`).className = m > 0 ? "perk-active" : "";
        document.getElementById(`perkAlac-${suffix}`).className = a > 0 ? "perk-active" : "";
        document.getElementById(`perkWill-${suffix}`).className = w > 0 ? "perk-active" : "";
        const perkCon = document.getElementById(`perkCon-${suffix}`);
        if (perkCon) perkCon.className = con > 0 ? "perk-active" : "";

        let txt = ""; for (let k in p.stats) if (p.stats[k]) txt += `${k}: ${Math.round(p.stats[k] * 100) / 100}, `;
        document.getElementById(`statText-${suffix}`).innerText = txt;
    },
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
            btn.style.setProperty('--confirm-glow', c("player.core", 0.65) || "p2");
            btn.style.setProperty('--confirm-fill', c("player.core", 0.35) || "p2");
        }
        btn.classList.remove('btn-choice-confirm');
        void btn.offsetWidth;
        btn.classList.add('btn-choice-confirm');
        window.setTimeout(() => btn.classList.remove('btn-choice-confirm'), 320);
    },
    init() {
        this.buildAttrUI("attr-container-inv", "inv");
        const menuBtn = document.getElementById("btn-inv");
        if (menuBtn) menuBtn.onclick = () => this.toggle('pause');
        document.getElementById("btn-close-inv").onclick = () => this.toggle('inv');
        document.getElementById("btn-close-appraise").onclick = () => this.toggle('appraise');
        document.getElementById("btn-identify-all").onclick = () => this.identifyAll();
        document.getElementById("btn-close-pause").onclick = () => this.toggle('pause');
        const saveBtn = document.getElementById("btn-save");
        if (saveBtn) saveBtn.onclick = () => Game.save();

        // Small-window HUD: allow collapsing the run panel so it doesn't obscure gameplay.
        const runPanel = document.getElementById("hud-run");
        const runTitle = document.getElementById("hud-run-title");
        const runToggle = document.getElementById("btn-hud-run-toggle");
        if (runPanel && runToggle) {
            const key = "hudRunCollapsed";
            const saved = window.localStorage?.getItem?.(key);
            const shouldDefaultCollapse = (saved == null) && window.innerWidth <= 900;
            const isCollapsed = (saved === "1") || shouldDefaultCollapse;
            runPanel.classList.toggle("collapsed", isCollapsed);
            runToggle.innerText = isCollapsed ? "Details" : "Hide";

            const setCollapsed = (next) => {
                runPanel.classList.toggle("collapsed", !!next);
                runToggle.innerText = next ? "Details" : "Hide";
                window.localStorage?.setItem?.(key, next ? "1" : "0");
            };
            const toggle = () => setCollapsed(!runPanel.classList.contains("collapsed"));
            runToggle.onclick = (e) => { e.preventDefault(); toggle(); };
            if (runTitle) runTitle.onclick = (e) => { e.preventDefault(); toggle(); };
        }

        const pauseModal = document.getElementById("modal_pause");
        if (pauseModal) {
            // No-op: pause actions are wired on render to avoid delegation edge cases.
        }
        
        document.getElementById('levelup-prompt').onmousedown = (e) => {
            e.preventDefault();
            this.toggle('levelup');
        };
        document.getElementById('btn-close-levelup').onclick = () => this.toggle('levelup');
    },
    getStateFlags() {
        return Game?.stateManager?.currentState?.uiFlags || { canOpenInv: false, canSwapGear: false };
    },
    isOpen(id) {
        const el = document.getElementById("modal_" + id);
        return !!el && el.classList.contains("show");
    },
    syncPauseState() {
        const anyModalOpen = !!document.querySelector(".modal.show");
        const death = document.getElementById("screen_death")?.classList.contains("active");
        Game.paused = anyModalOpen || !!death;
    },
    open(id) {
        const el = document.getElementById("modal_" + id);
        if (!el) return;

        // Don't allow the pause menu before a run/session exists.
        if (id === "pause" && !Game.p) return;

        if (id === "inv") {
            const flags = this.getStateFlags();
            if (!flags.canOpenInv) {
                this.toast("Visit the Outfitter to change your loadout");
                return;
            }
        }

        if (id === "appraise") {
            const flags = this.getStateFlags();
            if (!flags.canOpenAppraise) {
                this.toast("Visit the Appraiser to identify items");
                return;
            }
            const p = Game.p;
            this._appraiseSession = { items: p?.inv?.filter(it => it && it.identified === false) || [] };
        }

        if (id === "levelup") {
            const p = Game.p;
            const hasPicks = !!p && (p.levelPicks.attribute > 0 || p.levelPicks.weapon > 0 || p.levelPicks.phial > 0);
            if (!hasPicks) return;
        }

        el.classList.add("show");
        this._openStack = this._openStack.filter(openId => openId !== id);
        this._openStack.push(id);

        if (id === "inv") this.renderInv();
        if (id === "appraise") this.renderAppraise();
        if (id === "pause") {
            this._pauseView = "build";
            this.renderPause();
        }
        if (id === "levelup") this.renderLevelUp();

        this.syncPauseState();
        this.updateLevelUpPrompt();
    },
    close(id) {
        const el = document.getElementById("modal_" + id);
        if (!el) return;
        el.classList.remove("show");
        this._openStack = this._openStack.filter(openId => openId !== id);
        if (id === "appraise") this._appraiseSession = null;
        this.syncPauseState();
        this.updateLevelUpPrompt();
    },
    closeAll() {
        document.querySelectorAll(".modal.show").forEach(el => el.classList.remove("show"));
        this._openStack = [];
        this._appraiseSession = null;
        this.syncPauseState();
        this.updateLevelUpPrompt();
    },
    closeTop() {
        const top = this._openStack[this._openStack.length - 1];
        if (top) {
            this.close(top);
            return true;
        }

        const open = Array.from(document.querySelectorAll(".modal.show")).at(-1);
        if (!open) return false;
        const id = open.id?.startsWith("modal_") ? open.id.slice("modal_".length) : null;
        if (id) this.close(id);
        else {
            open.classList.remove("show");
            this.syncPauseState();
        }
        return true;
    },
    _objectiveUI: { displayKey: null, transitioning: false, nextKey: null, transitionUntil: 0 },
    _setObjectiveLine(el, { show = true, checked = false, completed = false, html = "—" } = {}) {
        if (!el) return;
        el.style.display = show ? "" : "none";
        el.classList.toggle("checked", !!checked);
        el.classList.toggle("completed", !!completed);
        const textEl = el.querySelector(".text");
        if (textEl) textEl.innerHTML = html;
        else el.innerHTML = html;
    },
    renderObjectives() {
        const st = Game?.stateManager?.currentState;
        const obj1 = document.getElementById("hud-obj-1");
        const obj2 = document.getElementById("hud-obj-2");
        const obj3 = document.getElementById("hud-obj-3");
        if (!obj1 || !obj2 || !obj3) return;

        // Determine current objective key + copy.
        let key = "none";
        let line1 = "—";
        let line2 = null;
        let line3 = null;

        const isField = !!st?.isRun && typeof st?.waveIndex === "number";
        const isDungeon = !!st?.isRun && typeof st?.timer === "number" && typeof st?.riftScore === "number" && !("waveIndex" in st);

        if (isField) {
            const waveTotal = BALANCE?.waves?.sequence?.length || 0;
            const waveLabel = waveTotal ? `${st.waveIndex} / ${waveTotal}` : `${st.waveIndex}`;
            const seq = (BALANCE && BALANCE.waves && BALANCE.waves.sequence) ? BALANCE.waves.sequence : null;
            const idx = Math.max(0, (st.waveIndex || 1) - 1);
            const waveCfg = (seq && seq[idx]) ? seq[idx] : null;
            if (st.fieldBoss && !st.fieldBoss.dead) {
                key = "field:boss";
                line1 = `Defeat the <b>Field Boss</b>.`;
            } else if (st.fieldCleared && st.dungeonDecisionTimer > 0) {
                key = "field:dungeonPrompt";
                line1 = `Enter the <b>Dungeon</b> before time expires.`;
                line3 = `<small>${Math.ceil(st.dungeonDecisionTimer)}s remaining</small>`;
            } else if (waveCfg) {
                key = `field:wave:${st.waveIndex}`;
                line1 = `Survive <b>Wave ${waveLabel}</b>.`;
            } else {
                key = "field:cleared";
                line1 = `Field cleared.`;
            }

            if (st.bounty && !st.fieldBoss) {
                line2 = `<small>Bounty: <b>${st.bounty.remaining}</b> left • ${Math.ceil(st.bounty.t || 0)}s</small>`;
            }

            const fieldTotal = ProgressionSystem.getFieldDurationSec();
            const fieldLeft = typeof st.fieldElapsed === "number" ? Math.max(0, fieldTotal - st.fieldElapsed) : null;
            if (typeof fieldLeft === "number" && !line3) line3 = `<small>Field: ${Math.ceil(fieldLeft)}s left</small>`;
        } else if (isDungeon) {
            key = `dungeon:${st.room || "entry"}`;
            const thresholds = st.progressThresholds || (BALANCE.progression?.dungeon?.scoreThresholds || [120, 260, 420]);
            const boss = thresholds[thresholds.length - 1] || 420;
            line1 = `Reach the <b>Boss Door</b>, then defeat the boss.`;
            line3 = `<small>Progress: <b>${Math.floor(st.riftScore || 0)}</b> / ${boss}</small>`;
        }

        // Transition: when key changes, show a checked+fade state briefly, then swap to the new objective.
        const now = performance.now();
        if (this._objectiveUI.displayKey == null) this._objectiveUI.displayKey = key;

        if (key !== this._objectiveUI.displayKey && !this._objectiveUI.transitioning) {
            this._objectiveUI.transitioning = true;
            this._objectiveUI.nextKey = key;
            this._objectiveUI.transitionUntil = now + 700;
        }

        if (this._objectiveUI.transitioning && now >= this._objectiveUI.transitionUntil) {
            this._objectiveUI.transitioning = false;
            this._objectiveUI.displayKey = this._objectiveUI.nextKey;
            this._objectiveUI.nextKey = null;
        }

        const isCompleting = this._objectiveUI.transitioning;
        // If we're completing, show the old objective checked + faded.
        if (isCompleting) {
            this._setObjectiveLine(obj1, { show: true, checked: true, completed: true, html: (obj1.querySelector(".text")?.innerHTML || line1) });
            // Hide bonus clutter unless it has real content.
            this._setObjectiveLine(obj2, { show: false });
            this._setObjectiveLine(obj3, { show: false });
            return;
        }

        // Normal render
        this._setObjectiveLine(obj1, { show: true, checked: false, completed: false, html: line1 });
        this._setObjectiveLine(obj2, { show: !!line2, checked: false, completed: false, html: line2 || "" });
        this._setObjectiveLine(obj3, { show: !!line3, checked: false, completed: false, html: line3 || "" });
    },
    render() {
        let p = Game.p;
        if (!p) return; // in case called before startGame()
        // Keep pause state consistent even if a modal is closed externally.
        this.syncPauseState();
        const st = Game?.stateManager?.currentState;

        document.getElementById("uiLvl").innerText = p.lvl;
        document.getElementById("uiSouls").innerText = p.souls;
        const shardEl = document.getElementById("uiShards");
        if (shardEl) shardEl.innerText = p.phialShards ?? 0;
        const xpRequired = ProgressionSystem.getXpRequired(p.lvl);
        const xpProgress = (p.xp / xpRequired) * 100;
        document.getElementById("xp-bar-fill").style.width = `${xpProgress}%`;

        const hpText = document.getElementById("txtHp");
        if (hpText) hpText.innerText = `${Math.ceil(p.hp)}/${p.hpMax}`;
        const hpFill = document.getElementById("hud-hp-orb-fill");
        if (hpFill) {
            const hpPct = p.hpMax > 0 ? Math.max(0, Math.min(1, p.hp / p.hpMax)) : 0;
            hpFill.style.setProperty("--fill", `${Math.round(hpPct * 100)}%`);
        }
        
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

        // Phials bar (PoE flask-ish)
        const phialsEl = document.getElementById("hud-phials");
        if (phialsEl) {
            phialsEl.innerHTML = "";
            const entries = Array.from((p.phials || new Map()).entries());
            if (entries.length === 0) {
                phialsEl.innerHTML = `<span style="color:var(--muted);font-size:11px;opacity:0.9">None</span>`;
            } else {
                for (const [id, stacks] of entries) {
                    const popTime = p.recentPhialGains?.get?.(id) || 0;
                    const pop = Math.max(0, Math.min(1, popTime));
                    const scale = 1 + pop * 0.35;
                    const ph = Object.values(Phials).find(x => x.id === id) || (Phials && Phials[id]);
                    const icon = ph?.icon || "🧪";
                    const chip = document.createElement("div");
                    chip.className = "phial-chip";
                    chip.title = ph?.name || id;
                    if (pop > 0.02) {
                        chip.style.transform = `scale(${scale})`;
                        chip.style.filter = `brightness(${1 + pop * 0.25})`;
                        const rim = c("fx.ink", 0.4) || "ink";
                        const glow = c("player.core", 0.22 + pop * 0.28) || "p2";
                        chip.style.boxShadow = `inset 0 0 0 1px ${rim}, 0 0 ${10 + pop * 14}px ${glow}`;
                    }
                    chip.innerHTML = `<span class="icon">${icon}</span>${stacks > 1 ? `<span class="stack">${stacks}</span>` : ""}`;
                    phialsEl.appendChild(chip);
                }
            }
        }

        this.renderObjectives();

        // Unified tracker bar (gold timer + purple dungeon progress)
        const trackerWrap = document.getElementById("hud-tracker");
        const trackerTitle = document.getElementById("hud-tracker-title");
        const trackerText = document.getElementById("hud-tracker-text");
        const trackerTimer = document.getElementById("hud-tracker-fill-timer");
        const trackerProgress = document.getElementById("hud-tracker-fill-progress");
        const trackerT1 = document.getElementById("hud-tracker-t1");
        const trackerT2 = document.getElementById("hud-tracker-t2");
        const trackerBoss = document.getElementById("hud-tracker-boss");
        const trackerCenter = document.getElementById("hud-tracker-center");

        const inField = !!st && st.isRun && typeof st.waveIndex === "number";
        const inDungeon = !!st && st.isRun && typeof st.timer === "number" && typeof st.riftScore === "number" && !("waveIndex" in st);
        const showTracker = inField || inDungeon;

        if (trackerWrap && trackerTitle && trackerText && trackerTimer && trackerProgress && trackerT1 && trackerT2 && trackerBoss && trackerCenter) {
            if (!showTracker) {
                trackerWrap.style.display = "none";
            } else {
                trackerWrap.style.display = "block";

                // Gold timer: always represents remaining time.
                let timeLeft = null;
                let timeMax = null;
                if (inDungeon) {
                    timeLeft = Math.max(0, Number(st.timer || 0));
                    timeMax = Math.max(1, Number(st.timerMax || 1));
                } else if (inField) {
                    const seq = (BALANCE && BALANCE.waves && BALANCE.waves.sequence) ? BALANCE.waves.sequence : null;
                    const idx = Math.max(0, (st.waveIndex || 1) - 1);
                    const waveCfg = (seq && seq[idx]) ? seq[idx] : null;
                    const dur = waveCfg && typeof waveCfg.duration === "number" ? waveCfg.duration : Number(waveCfg?.duration || 0);
                    timeLeft = Math.max(0, Number(st.waveTimer || 0));
                    timeMax = dur > 0 ? dur : Math.max(1, timeLeft || 1);
                }
                // Gold fill should grow as time passes (elapsed), not shrink (remaining).
                const timerPct = timeMax > 0 ? Math.max(0, Math.min(1, (timeMax - timeLeft) / timeMax)) : 0;
                trackerTimer.style.width = `${Math.round(timerPct * 100)}%`;

                if (inDungeon) {
                    const thresholds = st.progressThresholds || (BALANCE.progression?.dungeon?.scoreThresholds || [120, 260, 420]);
                    const t1 = thresholds[0] ?? 0;
                    const t2 = thresholds[1] ?? 0;
                    const boss = thresholds[thresholds.length - 1] ?? 420;
                    const score = Math.max(0, Math.floor(st.riftScore || 0));
                    const denom = Math.max(1, Math.floor(boss));
                    const progressPct = Math.max(0, Math.min(1, score / denom));
                    trackerProgress.style.width = `${Math.round(progressPct * 100)}%`;

                    trackerT1.style.display = "";
                    trackerT2.style.display = "";
                    trackerBoss.style.display = "";
                    trackerT1.style.left = `${Math.max(0, Math.min(100, (t1 / denom) * 100))}%`;
                    trackerT2.style.left = `${Math.max(0, Math.min(100, (t2 / denom) * 100))}%`;
                    trackerBoss.style.left = `100%`;

                    trackerTitle.innerText = "Dungeon";
                    trackerText.innerText = `${score}/${denom} • ${Math.ceil(timeLeft)}s`;
                    trackerCenter.innerText = "Progress vs Time";
                } else {
                    // Field: only timer (gold). No purple fill, no dungeon ticks.
                    trackerProgress.style.width = "0%";
                    trackerT1.style.display = "none";
                    trackerT2.style.display = "none";
                    trackerBoss.style.display = "none";

                    const waveTotal = BALANCE?.waves?.sequence?.length || 0;
                    const waveLabel = waveTotal ? `${st.waveIndex} / ${waveTotal}` : `${st.waveIndex}`;
                    trackerTitle.innerText = "Field";
                    trackerText.innerText = `${Math.ceil(timeLeft)}s`;
                    // Optional: show wave number inside the bar.
                    trackerCenter.innerText = `Wave ${waveLabel}`;
                }
            }
        }

        // Soul Gauge orb: consistent across Field/Dungeon (drives phials like Soul Salvo)
        const soulFill = document.getElementById("hud-soul-orb-fill");
        const soulText = document.getElementById("hud-soul-orb-text");
        const soulOrb = document.getElementById("hud-soul-orb");
        const soulLabel = document.getElementById("hud-soul-orb-label");
        if (soulFill || soulText) {
            const hasGauge = !!st && typeof st.soulGauge === "number" && typeof st.soulGaugeThreshold === "number" && st.soulGaugeThreshold > 0;
            if (hasGauge) {
                const pct = Math.max(0, Math.min(1, st.soulGauge / st.soulGaugeThreshold));
                if (soulFill) soulFill.style.setProperty("--fill", `${Math.round(pct * 100)}%`);
                if (soulLabel) soulLabel.innerText = "Soul Gauge";
                if (soulText) soulText.innerText = `${Math.round(pct * 100)}%`;

                if (soulOrb) {
                    const flash = typeof st?.gaugeFlash === "number" ? st.gaugeFlash : 0;
                    soulOrb.classList.toggle("flash", flash > 0);
                }
            } else {
                if (soulFill) soulFill.style.setProperty("--fill", "0%");
                if (soulText) soulText.innerText = "—";
                if (soulLabel) soulLabel.innerText = "Soul Gauge";
                if (soulOrb) soulOrb.classList.remove("flash");
            }
        }

        this.renderMinions();
        this.updateLevelUpPrompt();
    },
    renderMinions() {
        const panel = document.getElementById("hud-minions");
        const list = document.getElementById("hud-minion-list");
        if (!panel || !list) return;

        const st = Game?.stateManager?.currentState;
        const minions = Array.isArray(st?.minions) ? st.minions : [];
        const alive = minions.filter((m) => m && m.isMinion && !m.dead);
        if (alive.length === 0) {
            panel.style.display = "none";
            this._minionHudKey = null;
            return;
        }

        panel.style.display = "flex";
        const key = alive.map((m) => `${m.kind || "minion"}:${m.aspect || ""}:${Math.round((Number(m.hp) || 0) * 10)}:${Math.round((Number(m.hpMax) || 0) * 10)}`).join("|");
        if (key === this._minionHudKey) return;
        this._minionHudKey = key;

        list.innerHTML = alive.map((m, idx) => {
            const hp = Math.max(0, Number(m.hp) || 0);
            const hpMax = Math.max(1e-6, Number(m.hpMax) || 1);
            const pct = Math.max(0, Math.min(1, hp / hpMax));
            const low = pct <= 0.30;
            const isBone = String(m.aspect || "").toLowerCase() === "bone";
            const label = (m.kind === "golem") ? "G" : "M";
            const title = `${m.kind || "Minion"} ${idx + 1} • ${Math.ceil(hp)}/${Math.ceil(hpMax)}`;
            return `
                <div class="minion-card ${low ? "low" : ""}" title="${title}">
                    <div class="minion-portrait ${isBone ? "bone" : ""}">${label}</div>
                    <div class="minion-hp"><div class="fill" style="width:${Math.round(pct * 100)}%"></div></div>
                </div>
            `;
        }).join("");
    },
    toggle(id) {
        if (this.isOpen(id)) this.close(id);
        else this.open(id);
    },
    renderInv() {
        let p = Game.p;
        const canSwapGear = () => !!this.getStateFlags().canSwapGear;

        this.renderAttrAndStats("inv");

        // Armory tabs (Phase 5): simple panel switcher. "Weapon Perks" requires flag.
        const perksEnabled = FeatureFlags.isOn("progression.preRunWeaponPerks");
        const tabs = {
            loadout: document.getElementById("btn-armory-tab-loadout"),
            perks: document.getElementById("btn-armory-tab-perks"),
            weaponMastery: document.getElementById("btn-armory-tab-weapon-mastery"),
            attributeMastery: document.getElementById("btn-armory-tab-attribute-mastery"),
        };

        const setTab = (tabId) => {
            if (tabId === "perks" && !perksEnabled) {
                this.toast("Enable pre-run weapon perks to access sockets");
                tabId = "loadout";
            }
            this._armoryTab = tabId;
            this.renderInv();
        };

        if (tabs.loadout) tabs.loadout.onclick = () => setTab("loadout");
        if (tabs.perks) {
            tabs.perks.disabled = !perksEnabled;
            tabs.perks.onclick = () => setTab("perks");
        }
        if (tabs.weaponMastery) tabs.weaponMastery.onclick = () => setTab("weaponMastery");
        if (tabs.attributeMastery) tabs.attributeMastery.onclick = () => setTab("attributeMastery");

        for (const [id, btn] of Object.entries(tabs)) {
            if (!btn) continue;
            const active = (this._armoryTab === id);
            btn.className = active ? "btn primary" : "btn";
        }

        const viewLoadout = document.getElementById("armory-view-loadout");
        const viewPerks = document.getElementById("armory-view-perks");
        const viewWeaponMastery = document.getElementById("armory-view-weapon-mastery");
        const viewAttributeMastery = document.getElementById("armory-view-attribute-mastery");

        if (viewLoadout) viewLoadout.style.display = this._armoryTab === "loadout" ? "contents" : "none";
        if (viewPerks) viewPerks.style.display = this._armoryTab === "perks" ? "block" : "none";
        if (viewWeaponMastery) viewWeaponMastery.style.display = this._armoryTab === "weaponMastery" ? "block" : "none";
        if (viewAttributeMastery) viewAttributeMastery.style.display = this._armoryTab === "attributeMastery" ? "block" : "none";

        if (this._armoryTab === "perks") {
            this.renderArmoryPerks();
            return;
        }
        if (this._armoryTab === "weaponMastery") {
            this.renderArmoryWeaponMastery();
            return;
        }
        if (this._armoryTab === "attributeMastery") {
            this.renderArmoryAttributeMastery();
            return;
        }

        let elEq = document.getElementById("equipList"); elEq.innerHTML = "";
        SLOTS.forEach(s => {
            let it = p.gear[s];
            let d = document.createElement("div"); d.className = "equip-slot";
            d.innerHTML = `<span style="color:var(--muted);font-size:10px">${s.toUpperCase()}</span><span class="${it ? 'r-' + it.rarity : 'slot-empty'}">${it ? it.name : 'Empty'}</span>`;
            if (it) d.onclick = () => {
                if (!canSwapGear()) return;
                p.inv.push(it); p.gear[s] = null; p.recalc(); this.renderInv();
            };
            elEq.appendChild(d);
        });

        let elInv = document.getElementById("invList"); elInv.innerHTML = "";
        p.inv.sort((a, b) => (SLOTS.indexOf(a.type) - SLOTS.indexOf(b.type)));
        if (p.inv.length === 0) elInv.innerHTML = "<div style='color:var(--muted);padding:10px;text-align:center'>Stash Empty</div>";

        p.inv.forEach((it, i) => {
            let d = document.createElement("div"); d.className = `item-card r-${it.rarity}`;
            let stStr = "";
            if (it.identified === false) stStr = "Unidentified";
            else for (let k in it.stats) stStr += `${k}:${it.stats[k]} `;
            d.innerHTML = `<div class="item-info"><span class="item-name">${it.name}</span><span class="item-meta">${stStr}</span></div>`;
            d.onclick = () => {
                if (!canSwapGear()) return;
                if (p.gear[it.type]) p.inv.push(p.gear[it.type]);
                p.gear[it.type] = it; p.inv.splice(i, 1); p.recalc(); this.renderInv();
            };
            elInv.appendChild(d);
        });
        
        const debugPhials = document.getElementById('debug-phials-inv');
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
    renderArmoryPerks() {
        const container = document.getElementById("armory-perks");
        if (!container) return;
        const perksEnabled = FeatureFlags.isOn("progression.preRunWeaponPerks");
        if (!perksEnabled) {
            container.innerHTML = `<div style="color:var(--muted);font-size:12px">Enable <code>progression.preRunWeaponPerks</code> to configure perk sockets.</div>`;
            return;
        }

        // Ensure profile exists.
        if (!Game.profile) {
            try { Game.profile = ProfileStore.load(); } catch { /* ignore */ }
        }
        const profile = Game.profile || {};
        profile.armory = profile.armory || {};
        profile.armory.perkSocketsByWeapon = profile.armory.perkSocketsByWeapon || {};
        profile.mastery = profile.mastery || { attributes: {}, weapons: {} };

        const currentCls = Game.p?.gear?.weapon?.cls || null;
        const currentCfg = getWeaponConfigByCls(currentCls);
        const defaultWeaponId = currentCfg?.weaponId || WeaponId.Hammer;
        if (!this._armoryWeaponId) this._armoryWeaponId = defaultWeaponId;

        const selectWeaponBtn = (weaponId, label) => {
            const active = weaponId === this._armoryWeaponId;
            const cls = active ? "btn primary" : "btn";
            return `<button class="${cls}" data-weapon-id="${weaponId}">${label}</button>`;
        };

        const socketLabels = {
            [PerkSocketLevel.level2]: "Level 2 (Opener)",
            [PerkSocketLevel.level5]: "Level 5 (Engine)",
            [PerkSocketLevel.level10]: "Level 10 (Capstone)",
            [PerkSocketLevel.level15]: "Level 15 (Relic, later)",
        };

        const weaponId = this._armoryWeaponId;
        const metaEnabled = FeatureFlags.isOn("progression.metaMasteryEnabled");
        const weaponMasteryLevel = metaEnabled ? getWeaponMasteryLevel(profile, weaponId) : 0;
        const byWeapon = profile.armory.perkSocketsByWeapon;
        if (!byWeapon[weaponId]) {
            // First-time scaffold: seed meaningful defaults so milestone sockets aren't "empty by default".
            // Users can explicitly choose "None" afterward, which we respect.
            byWeapon[weaponId] = {
                level2: getUnlockedSkillIdsForSocket(weaponId, PerkSocketLevel.level2, { weaponMasteryLevel, metaEnabled })[0] || null,
                level5: getUnlockedSkillIdsForSocket(weaponId, PerkSocketLevel.level5, { weaponMasteryLevel, metaEnabled })[0] || null,
                level10: getUnlockedSkillIdsForSocket(weaponId, PerkSocketLevel.level10, { weaponMasteryLevel, metaEnabled })[0] || null,
                level15: null,
            };
            try { ProfileStore.save(profile, { backupPrevious: true }); } catch { /* ignore */ }
        }
        const sockets = byWeapon[weaponId] || { level2: null, level5: null, level10: null, level15: null };

        const renderSocket = (socketLevel) => {
            const opts = getSocketOptions(weaponId, socketLevel);
            const unlocked = new Set(getUnlockedSkillIdsForSocket(weaponId, socketLevel, { weaponMasteryLevel, metaEnabled }));
            // If meta progression is enabled and the selected perk is now locked, auto-fallback to a valid pick.
            let current = sockets[socketLevel] || null;
            if (metaEnabled && current && !unlocked.has(current)) {
                const fallback = Array.from(unlocked)[0] || null;
                sockets[socketLevel] = fallback;
                current = fallback;
                try { ProfileStore.save(profile, { backupPrevious: true }); } catch { /* ignore */ }
            }
            const rows = opts.map(({ id, unlockAtWeaponMasteryLevel }) => {
                const sk = getSkillDef(id);
                const title = sk?.name || id;
                const desc = sk?.desc || "";
                const active = id === current;
                const isUnlocked = unlocked.has(id);
                const cls = active ? "btn-upgrade selected" : "btn-upgrade";
                const lockedNote = metaEnabled && !isUnlocked ? ` <span style="opacity:0.75">[Unlock WM${unlockAtWeaponMasteryLevel}]</span>` : "";
                const disabledAttr = metaEnabled && !isUnlocked ? "disabled" : "";
                const aria = active ? `aria-pressed="true"` : `aria-pressed="false"`;
                return `<button class="${cls}" data-socket="${socketLevel}" data-skill-id="${id}" ${aria} ${disabledAttr}>${title}${lockedNote}<small>${desc}</small></button>`;
            }).join("");

            const noneActive = current == null;
            const noneCls = noneActive ? "btn-upgrade selected" : "btn-upgrade";
            const noneBtn = `<button class="${noneCls}" data-socket="${socketLevel}" data-skill-id="" aria-pressed="${noneActive ? "true" : "false"}">None<small>Leave this milestone empty</small></button>`;

            return `
                <div class="levelup-row" style="margin-top:10px">
                    <div class="sec-title">${socketLabels[socketLevel] || socketLevel}</div>
                    <div class="levelup-options">${noneBtn}${rows}</div>
                </div>
            `;
        };

        container.innerHTML = `
            <span class="sec-title">Weapon Perk Sockets</span>
            <div style="color:var(--muted);font-size:12px;line-height:1.5;margin-top:6px">
                Select perks in town; they activate automatically at run levels 2/5/10. (Level 15 relic slot is reserved.)
            </div>
            <div style="margin-top:8px;color:var(--muted);font-size:12px">
                Weapon Mastery: <b>${weaponMasteryLevel}</b>${metaEnabled ? "" : " (meta progression disabled)"}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                ${selectWeaponBtn(WeaponId.Hammer, "Hammer")}
                ${selectWeaponBtn(WeaponId.Staff, "Staff")}
                ${selectWeaponBtn(WeaponId.Repeater, "Repeater")}
                ${selectWeaponBtn(WeaponId.Scythe, "Scythe")}
            </div>
            ${renderSocket(PerkSocketLevel.level2)}
            ${renderSocket(PerkSocketLevel.level5)}
            ${renderSocket(PerkSocketLevel.level10)}
            ${renderSocket(PerkSocketLevel.level15)}
            <div style="margin-top:10px;color:var(--muted);font-size:11px">
                Note: Level 15 relic behavior is deferred, but the slot schema/UI is shipped now.
            </div>
        `;

        container.querySelectorAll("[data-weapon-id]").forEach((btn) => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute("data-weapon-id");
                if (!id) return;
                this._armoryWeaponId = id;
                this.renderArmoryPerks();
            };
        });

        const saveProfile = () => {
            try {
                Game.profile = profile;
                ProfileStore.save(profile, { backupPrevious: true });
            } catch {
                // ignore save errors
            }
        };

        container.querySelectorAll("[data-socket][data-skill-id]").forEach((btn) => {
            btn.onclick = (e) => {
                const socket = e.currentTarget.getAttribute("data-socket");
                const skillIdRaw = e.currentTarget.getAttribute("data-skill-id");
                if (!socket) return;
                const skillId = skillIdRaw && skillIdRaw.length ? skillIdRaw : null;

                const w = this._armoryWeaponId;
                profile.armory.perkSocketsByWeapon[w] = profile.armory.perkSocketsByWeapon[w] || { level2: null, level5: null, level10: null, level15: null };
                profile.armory.perkSocketsByWeapon[w][socket] = skillId;
                saveProfile();
                this.playChoiceConfirm(e.currentTarget, c("player.core", 0.75) || "p2");
                this.renderArmoryPerks();
            };
        });
    },

    renderArmoryWeaponMastery() {
        let profile = Game.profile;
        if (!profile) {
            try { profile = ProfileStore.load(); Game.profile = profile; } catch { /* ignore */ }
        }
        if (!profile) return;

        const container = document.getElementById("armory-view-weapon-mastery");
        if (!container) return;

        const metaEnabled = FeatureFlags.isOn("progression.metaMasteryEnabled");

        const ensureWeaponId = () => {
            if (this._armoryWeaponId) return this._armoryWeaponId;
            const weaponCls = Game?.p?.gear?.weapon?.cls || null;
            const cfg = getWeaponConfigByCls(weaponCls);
            this._armoryWeaponId = cfg?.weaponId || WeaponId.Hammer;
            return this._armoryWeaponId;
        };
        const weaponId = ensureWeaponId();

        const track = profile?.mastery?.weapons?.[weaponId] || { level: 0, xp: 0 };
        const level = Math.max(0, Math.floor(Number(track.level || 0)));
        const xp = Math.max(0, Math.floor(Number(track.xp || 0)));
        const curve = BALANCE?.progression?.mastery?.weaponCurve || { reqBase: 160, reqGrowth: 1.28 };
        const reqForLevel = (lvl) => Math.floor(Math.max(1, Number(curve.reqBase || 160)) * Math.pow(Math.max(1.01, Number(curve.reqGrowth || 1.28)), Math.max(0, lvl)));
        const req = reqForLevel(level);
        const pct = req > 0 ? Math.max(0, Math.min(1, xp / req)) : 0;

        const socketSummaries = [PerkSocketLevel.level2, PerkSocketLevel.level5, PerkSocketLevel.level10].map((socketLevel) => {
            const opts = getSocketOptions(weaponId, socketLevel);
            const unlocked = metaEnabled ? opts.filter(o => (o.unlockAtWeaponMasteryLevel || 0) <= level) : opts;
            const next = metaEnabled ? opts
                .filter(o => (o.unlockAtWeaponMasteryLevel || 0) > level)
                .sort((a, b) => (a.unlockAtWeaponMasteryLevel || 0) - (b.unlockAtWeaponMasteryLevel || 0))
                .slice(0, 3) : [];

            const nextHtml = next.length
                ? `<div style="color:var(--muted);font-size:12px;margin-top:4px">Next unlocks: ${next.map(n => `${getSkillDef(n.id)?.name || n.id} (lvl ${n.unlockAtWeaponMasteryLevel || 0})`).join(", ")}</div>`
                : `<div style="color:var(--muted);font-size:12px;margin-top:4px">Next unlocks: —</div>`;

            return `
                <div class="stat-row" style="border-color:rgba(var(--parchment-rgb),0.14)">
                    <div style="display:flex;flex-direction:column;gap:2px">
                        <b style="font-size:12px">${socketLevel.toUpperCase()}</b>
                        <div style="color:var(--muted);font-size:12px">${unlocked.length}/${opts.length} available${metaEnabled ? "" : " (meta disabled)"}</div>
                        ${nextHtml}
                    </div>
                </div>
            `;
        }).join("");

        const weaponBtn = (id, label) => {
            const active = id === weaponId;
            const cls = active ? "btn primary" : "btn";
            return `<button class="${cls}" data-weapon-id="${id}">${label}</button>`;
        };

        container.innerHTML = `
            <span class="sec-title">Weapon Mastery</span>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
                ${weaponBtn(WeaponId.Hammer, "Hammer")}
                ${weaponBtn(WeaponId.Staff, "Staff")}
                ${weaponBtn(WeaponId.Repeater, "Repeater")}
                ${weaponBtn(WeaponId.Scythe, "Scythe")}
            </div>
            <div style="margin-top:10px;color:var(--muted);font-size:12px;line-height:1.5">
                Weapon mastery gates perk socket options. XP is granted at run end when meta progression is enabled.
            </div>
            <div style="margin-top:10px">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
                    <div>Level: <b>${level}</b>${metaEnabled ? "" : " (meta disabled)"}</div>
                    <div style="color:var(--muted);font-size:12px">XP: ${xp} / ${req}</div>
                </div>
                <div class="hud-progress-bar" style="margin-top:8px">
                    <div class="fill-progress" style="width:${Math.round(pct * 100)}%"></div>
                </div>
            </div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
                ${socketSummaries}
            </div>
        `;

        container.querySelectorAll("[data-weapon-id]").forEach((btn) => {
            btn.onclick = (e) => {
                const id = e.currentTarget.getAttribute("data-weapon-id");
                if (!id) return;
                this._armoryWeaponId = id;
                this.renderArmoryWeaponMastery();
            };
        });
    },

    renderArmoryAttributeMastery() {
        let profile = Game.profile;
        if (!profile) {
            try { profile = ProfileStore.load(); Game.profile = profile; } catch { /* ignore */ }
        }
        if (!profile) return;

        const container = document.getElementById("armory-view-attribute-mastery");
        if (!container) return;

        const metaEnabled = FeatureFlags.isOn("progression.metaMasteryEnabled");
        const curve = BALANCE?.progression?.mastery?.attributeCurve || { reqBase: 120, reqGrowth: 1.25 };
        const reqForLevel = (lvl) => Math.floor(Math.max(1, Number(curve.reqBase || 120)) * Math.pow(Math.max(1.01, Number(curve.reqGrowth || 1.25)), Math.max(0, lvl)));

        const attrs = Object.values(AttributeId);
        const rows = attrs.map((attrId) => {
            const track = profile?.mastery?.attributes?.[attrId] || { level: 0, xp: 0 };
            const level = Math.max(0, Math.floor(Number(track.level || 0)));
            const xp = Math.max(0, Math.floor(Number(track.xp || 0)));
            const req = reqForLevel(level);
            const pct = req > 0 ? Math.max(0, Math.min(1, xp / req)) : 0;
            return `
                <div class="stat-row" style="border-color:rgba(var(--parchment-rgb),0.14);flex-direction:column;align-items:stretch;gap:8px">
                    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline">
                        <div style="font-weight:900">${attrId}</div>
                        <div style="color:var(--muted);font-size:12px">Level <b>${level}</b> • XP ${xp} / ${req}</div>
                    </div>
                    <div class="hud-progress-bar">
                        <div class="fill-progress" style="width:${Math.round(pct * 100)}%"></div>
                    </div>
                </div>
            `;
        }).join("");

        container.innerHTML = `
            <span class="sec-title">Attribute Mastery</span>
            <div style="margin-top:8px;color:var(--muted);font-size:12px;line-height:1.5">
                Attribute mastery advances at run end when meta progression is enabled. XP is distributed 70% to your weapon’s primary attribute and 30% across picked phials (weighted by stacks).
                ${metaEnabled ? "" : "<br><b>Meta progression is currently disabled.</b>"}
            </div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:10px">
                ${rows}
            </div>
        `;
    },
    identifyItem(item) {
        if (!item || item.identified !== false) return;
        item.identified = true;
        if (item.realName) item.name = item.realName;
        if (item.realStats) item.stats = item.realStats;
        delete item.realName;
        delete item.realStats;
    },
    identifyAll() {
        const list = this._appraiseSession?.items?.filter(it => it && it.identified === false) || [];
        if (list.length === 0) return;
        list.forEach(it => this.identifyItem(it));
        this.toast("Items identified");
        this.renderAppraise();
        if (this.isOpen("inv")) this.renderInv();
    },
    renderAppraise() {
        const p = Game.p;
        const el = document.getElementById("appraiseList");
        if (!el) return;
        el.innerHTML = "";

        const sessionItems = this._appraiseSession?.items || [];
        if (sessionItems.length === 0) {
            el.innerHTML = "<div style='color:var(--muted);padding:10px;text-align:center'>No items to appraise</div>";
            return;
        }

        sessionItems.forEach((it) => {
            const row = document.createElement("div");
            row.className = `item-card r-${it.rarity}`;
            row.style.cursor = "default";
            const isUnidentified = it.identified === false;
            let meta = "Unidentified";
            if (!isUnidentified) {
                let stStr = "";
                for (let k in (it.stats || {})) stStr += `${k}:${it.stats[k]} `;
                meta = stStr || "Identified";
            }
            row.innerHTML = `
                <div class="item-info">
                    <span class="item-name">${it.name}</span>
                    <span class="item-meta">${meta}</span>
                </div>
            `;
            const btn = document.createElement("button");
            btn.className = "btn";
            btn.innerText = isUnidentified ? "Identify" : "Identified";
            btn.disabled = !isUnidentified;
            btn.onclick = () => {
                if (!isUnidentified) return;
                this.identifyItem(it);
                this.toast("Identified");
                this.renderAppraise();
                if (this.isOpen("inv")) this.renderInv();
            };
            row.appendChild(btn);
            el.appendChild(row);
        });
    },
    renderPause() {
        const p = Game.p;
        if (!p) return;
        const state = Game?.stateManager?.currentState;
        const inRun = !!state?.isRun;

        const elOptions = document.getElementById("pauseOptions");
        const elBuild = document.getElementById("pauseBuild");
        if (!elOptions || !elBuild) return;

        const perkLine = (attrKey, colorVar, label, tier, tier1, tier2) => {
            const base = `<span style="color:var(${colorVar});font-weight:800">${label}</span>: ${p.totalAttr[attrKey] || 0}`;
            const perks = [];
            if ((tier || 0) >= 1) perks.push(tier1);
            if ((tier || 0) >= 2) perks.push(tier2);
            if (perks.length === 0) return base;
            return `${base} <span style="color:var(${colorVar});opacity:0.9">(${perks.join(", ")} unlocked)</span>`;
        };

        const weaponCls = p?.gear?.weapon?.cls || null;
        const upgrades = [];
        for (const [id, stacks] of (p.skills || new Map()).entries()) {
            if (!stacks) continue;
            const skill = SKILLS.find(s => s.id === id);
            if (!skill) continue;
            if (weaponCls && normalizeWeaponCls(skill.cls) !== normalizeWeaponCls(weaponCls)) continue;
            upgrades.push(stacks > 1 ? `${skill.name} x${stacks}` : skill.name);
        }

        const phialNames = [];
        for (const [id, stacks] of (p.phials || new Map()).entries()) {
            const phial = Object.values(Phials).find(ph => ph.id === id);
            const name = phial?.name || id;
            phialNames.push(`${name} (${stacks})`);
        }

        const runLoot = Array.isArray(p.runLoot) ? p.runLoot : [];
        const statsPairs = Object.entries(p.stats || {}).filter(([, v]) => !!v);
        const statsText = statsPairs.length
            ? statsPairs.map(([k, v]) => `${k}: ${Math.round(v * 100) / 100}`).join(", ")
            : "None";

        const equipped = p?.gear || {};
        const loadoutHtml = SLOTS.map((slot) => {
            const it = equipped[slot];
            if (slot === "weapon") {
                const up = upgrades.length ? `Upgrades: ${upgrades.join(", ")}` : "Upgrades: None";
                return `
                    <div class="equip-slot" style="cursor:default;flex-direction:column;align-items:stretch;gap:6px">
                        <div style="display:flex;justify-content:space-between;gap:10px">
                            <span style="color:var(--muted);font-size:10px">${slot.toUpperCase()}</span>
                            <span class="${it ? "r-" + it.rarity : "slot-empty"}" style="text-align:right">${it ? it.name : "Empty"}</span>
                        </div>
                        <div style="color:var(--muted);font-size:11px">${up}</div>
                    </div>
                `;
            }
            return `
                <div class="equip-slot" style="cursor:default">
                    <span style="color:var(--muted);font-size:10px">${slot.toUpperCase()}</span>
                    <span class="${it ? "r-" + it.rarity : "slot-empty"}">${it ? it.name : "Empty"}</span>
                </div>
            `;
        }).join("");

        elOptions.innerHTML = `
            <span class="sec-title">Options</span>
            <div style="display:flex;flex-direction:column;gap:8px">
                <button class="btn primary" id="btn-pause-resume">Resume</button>
                ${inRun ? `<button class="btn danger" id="btn-pause-restart">Restart Run</button>` : ""}
                ${inRun ? `<button class="btn danger" id="btn-pause-town">Return to Town</button>` : ""}
                <button class="btn" id="btn-pause-settings">${this._pauseView === "settings" ? "Back" : "Settings"}</button>
                <button class="btn" id="btn-pause-save">Save</button>
                <button class="btn danger" id="btn-pause-abandon">Abandon</button>
            </div>
            <div style="margin-top:14px;color:var(--muted);font-size:11px">Press Esc to close this menu.</div>
        `;

        const attrTier = p.perkLevel || {};
        const showCon = FeatureFlags.isOn("progression.constitutionEnabled");
        if (this._pauseView === "settings") {
            const presets = [0.9, 1.0, 1.15, 1.25, 1.35];
            const current = Number(Game.cameraZoom) || 1;
            const mkBtn = (z) => {
                const active = Math.abs(current - z) < 1e-6;
                const cls = active ? "btn primary" : "btn";
                return `<button class="${cls}" data-zoom="${z}">${z.toFixed(2)}x</button>`;
            };
            elBuild.innerHTML = `
                <span class="sec-title">Settings</span>
                <div style="color:var(--muted);font-size:12px;margin-top:6px">Zoom (default is slightly closer)</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                    ${presets.map(mkBtn).join("")}
                </div>
                <div style="color:var(--muted);font-size:11px;margin-top:10px">
                    Zoom affects world rendering only; HUD stays unchanged.
                </div>
            `;
        } else {
            elBuild.innerHTML = `
                <span class="sec-title">Build</span>
                <div style="display:flex;flex-direction:column;gap:8px">
                    <div>${perkLine("might", "--red", "Might", attrTier.might, "Soul Blast", "Burn")}</div>
                    <div>${perkLine("alacrity", "--green", "Alacrity", attrTier.alacrity, "Tempest", "Split")}</div>
                    <div>${perkLine("will", "--blue", "Will", attrTier.will, "Wisps", "Rod")}</div>
                    ${showCon ? `<div>${perkLine("constitution", "--violet", "Constitution", attrTier.constitution, "Tier I", "Tier II")}</div>` : ""}
                </div>
                <div style="margin-top:12px">
                    <span class="sec-title">Loadout</span>
                    <div style="display:flex;flex-direction:column;gap:6px">${loadoutHtml}</div>
                </div>
                <div style="margin-top:12px">
                    <span class="sec-title">Stats</span>
                    <div style="color:var(--muted);font-size:12px">${statsText}</div>
                </div>
                <div style="margin-top:12px">
                    <span class="sec-title">Phials</span>
                    <div style="color:var(--muted);font-size:12px">${phialNames.length ? phialNames.join(", ") : "None"}</div>
                </div>
                <div style="margin-top:12px">
                    <span class="sec-title">Loot Collected</span>
                    <div class="inv-list" id="pauseLootList" style="gap:6px"></div>
                </div>
            `;
        }

        // Wire pause actions directly to the freshly rendered buttons.
        const G = window.Game || Game;
        const resumeBtn = document.getElementById("btn-pause-resume");
        if (resumeBtn) resumeBtn.onclick = () => this.close("pause");
        const townBtn = document.getElementById("btn-pause-town");
        if (townBtn) townBtn.onclick = () => {
            if (!window.confirm("Return to Town and forfeit run progress?")) return;
            G.abortRunToTown();
        };
        const restartBtn = document.getElementById("btn-pause-restart");
        if (restartBtn) restartBtn.onclick = () => {
            if (!window.confirm("Restart the run and forfeit current run progress?")) return;
            G.restartRunInPlace();
        };
        const quitBtn = document.getElementById("btn-pause-quit");
        if (quitBtn) quitBtn.onclick = null;

        const saveBtn = document.getElementById("btn-pause-save");
        if (saveBtn) saveBtn.onclick = () => {
            try { G.save?.(); } catch { /* ignore */ }
            this.toast("Saved");
            this.renderPause();
        };

        const abandonBtn = document.getElementById("btn-pause-abandon");
        if (abandonBtn) abandonBtn.onclick = () => {
            if (!window.confirm("Abandon and reload the game?")) return;
            G.quitToTitle();
        };

        const settingsBtn = document.getElementById("btn-pause-settings");
        if (settingsBtn) settingsBtn.onclick = () => {
            this._pauseView = this._pauseView === "settings" ? "build" : "settings";
            this.renderPause();
        };

        if (this._pauseView === "settings") {
            elBuild.querySelectorAll("[data-zoom]").forEach((btn) => {
                btn.onclick = () => {
                    const z = Number(btn.getAttribute("data-zoom"));
                    if (Number.isFinite(z)) G.setCameraZoom(z);
                    this.renderPause();
                };
            });
        }

        const lootEl = document.getElementById("pauseLootList");
        if (lootEl) {
            if (runLoot.length === 0) {
                lootEl.innerHTML = "<div style='color:var(--muted);padding:10px;text-align:center'>None this run</div>";
            } else {
                lootEl.innerHTML = "";
                runLoot.forEach(it => {
                    const card = document.createElement("div");
                    card.className = `item-card r-${it.rarity}`;
                    card.style.cursor = "default";
                    const meta = it.identified === false ? "Unidentified" : Object.entries(it.stats || {}).map(([k, v]) => `${k}:${v}`).join(" ");
                    card.innerHTML = `<div class="item-info"><span class="item-name">${it.name}</span><span class="item-meta">${meta || ""}</span></div>`;
                    lootEl.appendChild(card);
                });
            }
        }
    },
    renderLevelUp() {
        const p = Game.p;
        const body = document.querySelector('#modal_levelup .modal-body');
        const showCon = FeatureFlags.isOn("progression.constitutionEnabled");
        const phialsOnly = FeatureFlags.isOn("progression.phialsOnlyLevelUps");
        const preRunPerks = FeatureFlags.isOn("progression.preRunWeaponPerks");
        const hideWeaponRow = phialsOnly || preRunPerks;

        // Safety: if the flag is toggled mid-run, convert legacy picks into phial picks
        // so the player can't get stuck with hidden rows.
        if (p?.levelPicks) {
            // If phials-only, collapse both attribute+weapon into phials.
            if (phialsOnly) {
                const carry = (p.levelPicks.attribute || 0) + (p.levelPicks.weapon || 0);
                if (carry > 0) {
                    p.levelPicks.phial = (p.levelPicks.phial || 0) + carry;
                    p.levelPicks.attribute = 0;
                    p.levelPicks.weapon = 0;
                    p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
                }
            } else if (hideWeaponRow) {
                // If only the weapon row is hidden (pre-run perks), collapse weapon picks into phials.
                const carry = (p.levelPicks.weapon || 0);
                if (carry > 0) {
                    p.levelPicks.phial = (p.levelPicks.phial || 0) + carry;
                    p.levelPicks.weapon = 0;
                    p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
                }
            }
        }
        
        const weaponOptions = hideWeaponRow ? [] : this.ensureWeaponOffers();
        const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
        const phialOptions = this.ensurePhialOffers();
        const phialRerollCost = this.getPhialRerollCost();

        const attrRowHtml = phialsOnly ? "" : `
            <div class="levelup-row" id="levelup-attributes">
                <div class="sec-title">Attributes (x${p.levelPicks.attribute})</div>
                <div class="levelup-options">
                    <button class="btn-attr" id="btn-might">Might</button>
                    <button class="btn-attr" id="btn-alacrity">Alacrity</button>
                    <button class="btn-attr" id="btn-will">Will</button>
                    ${showCon ? `<button class="btn-attr" id="btn-constitution">Constitution</button>` : ""}
                </div>
            </div>
        `;

        const weaponRowHtml = hideWeaponRow ? "" : `
            <div class="levelup-row" id="levelup-weapon">
                <div class="sec-title-container">
                    <div class="sec-title">Weapon Upgrade (x${p.levelPicks.weapon})</div>
                    <button class="btn-reroll" id="btn-reroll-weapon">Reroll (${rerollCost} Souls)</button>
                </div>
                <div class="levelup-options" id="weapon-upgrade-options">
                    ${weaponOptions.map(skill => `<button class="btn-upgrade" data-skill-id="${skill.id}">${skill.name}<small>${skill.desc}</small></button>`).join('')}
                </div>
            </div>
        `;

        const phialRowHtml = `
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

        body.innerHTML = `${attrRowHtml}${weaponRowHtml}${phialRowHtml}`;

        this.updateRowCompletion();

        if (!phialsOnly) {
            document.getElementById('btn-might').onclick = (e) => this.selectAttribute('might', e.currentTarget);
            document.getElementById('btn-alacrity').onclick = (e) => this.selectAttribute('alacrity', e.currentTarget);
            document.getElementById('btn-will').onclick = (e) => this.selectAttribute('will', e.currentTarget);
            const conBtn = document.getElementById('btn-constitution');
            if (conBtn) conBtn.onclick = (e) => this.selectAttribute('constitution', e.currentTarget);
        }

        document.querySelectorAll('.btn-upgrade').forEach(btn => {
            if (btn.dataset.skillId) btn.onclick = (e) => this.selectWeaponUpgrade(btn.dataset.skillId, e.currentTarget);
            if (btn.dataset.phialId) btn.onclick = (e) => this.selectPhial(btn.dataset.phialId, e.currentTarget);
        });
        
        const rerollWeaponBtn = document.getElementById('btn-reroll-weapon');
        if (rerollWeaponBtn) rerollWeaponBtn.onclick = () => this.rerollWeaponOptions();
        document.getElementById('btn-reroll-phial').onclick = () => this.rerollPhialOptions();
    },
    selectAttribute(attr, sourceBtn) {
        const p = Game.p;
        if (p.levelPicks.attribute > 0) {
            p.attr[attr] += 5;
            p.levelPicks.attribute--;
            p.recalc();
            this.playChoiceConfirm(sourceBtn, c(`ui.attributeConfirm.${attr}`) || c("player.core", 0.75) || "p2");
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
            this.playChoiceConfirm(sourceBtn, c("player.core", 0.75) || "p2");
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
            this.playChoiceConfirm(sourceBtn, c("player.core", 0.75) || "p2");
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
        const phialsOnly = FeatureFlags.isOn("progression.phialsOnlyLevelUps");
        const preRunPerks = FeatureFlags.isOn("progression.preRunWeaponPerks");
        const hideWeaponRow = phialsOnly || preRunPerks;
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

        if (!phialsOnly && p.levelPicks.attribute > 0) clearComplete(attrRow);
        if (!hideWeaponRow && p.levelPicks.weapon > 0) clearComplete(weaponRow);
        if (p.levelPicks.phial > 0) clearComplete(phialRow);

        if (!phialsOnly && attrRow && p.levelPicks.attribute === 0) {
            attrRow.classList.add('complete');
            addOverlay(attrRow, 'NO PENDING ATTRIBUTES');
        }
        if (!hideWeaponRow && weaponRow) {
            if (p.levelPicks.weapon === 0) {
                weaponRow.classList.add('complete');
                const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
                if (rerollBtn) rerollBtn.style.display = 'none';
                addOverlay(weaponRow, 'NO PENDING SKILLS');
            } else {
                const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
                if (rerollBtn) rerollBtn.style.display = '';
            }
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
        
        if (!hideWeaponRow && weaponRow) {
            const rerollBtn = weaponRow.querySelector('#btn-reroll-weapon');
            if (rerollBtn) {
                const rerollCost = Math.floor(BALANCE.player.baseRerollCost * Math.pow(BALANCE.player.rerollCostMultiplier, p.weaponRerollsUsed));
                if (p.souls < rerollCost) {
                    rerollBtn.classList.add('disabled');
                } else {
                    rerollBtn.classList.remove('disabled');
                }
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
