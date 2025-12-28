// src/core/Game.js
import PlayerObj from "../entities/Player.js";
import GameStateManager from "./GameStateManager.js";
import TownState from "../states/TownState.js";
import UI from "../systems/UI.js";
import { keys, mouse } from "./Input.js";
import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";
import ParticleSystem from "../systems/Particles.js";
import DecalSystem from "../systems/DecalSystem.js";
import Assets from "./Assets.js";
import { IMAGE_ASSETS } from "../data/Art.js";
import { color as c } from "../data/ColorTuning.js";
import { ProfileStore } from "./ProfileStore.js";
import { FeatureFlags } from "./FeatureFlags.js";
import EffectSystem from "../systems/EffectSystem.js";
import { computeRunResult, applyMetaProgression, appendRunHistory } from "../systems/MasterySystem.js";
import { validateAllContent } from "../data/ValidateAllContent.js";
import { normalizeWeaponCls } from "../data/Weapons.js";
import { buildAttributeMasteryEffectSources } from "../systems/AttributeMasterySystem.js";

const Game = {
    p: null,
    stateManager: null,
    time: 0,
    paused: false,
    cameraZoom: 1.35,
    lastTime: 0,
    canvas: null,
    ctx: null,
    debug: false,
    decals: null,
    profile: null,

    init() {
        // Stage 2: strict vocabulary validation fails fast at boot when enabled (and is intended
        // to be default-on once all content is fully tagged).
        if (FeatureFlags.isOn("content.useVocabularyValidationStrict")) {
            try {
                validateAllContent({ strict: true });
            } catch (e) {
                const msg = String(e?.message || e);
                console.error("Boot content validation failed:", e);
                try {
                    const escapeHtml = (s) =>
                        String(s)
                            .replaceAll("&", "&amp;")
                            .replaceAll("<", "&lt;")
                            .replaceAll(">", "&gt;")
                            .replaceAll('"', "&quot;")
                            .replaceAll("'", "&#039;");
                    document.body.innerHTML = `
                        <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; padding: 16px; color: #fff; background: #120a16;">
                            <div style="font-weight: 800; margin-bottom: 10px;">Content validation failed at boot</div>
                            <pre style="white-space: pre-wrap; line-height: 1.35; margin: 0; color: #ffd7f3;">${escapeHtml(msg)}</pre>
                        </div>
                    `;
                } catch {
                    // ignore
                }
                throw e;
            }
        }

        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        UI.init(this);
        Assets.registerAll(IMAGE_ASSETS);

        // Profile: load once at boot. Phase 2 does not auto-apply gameplay-affecting data.
        try {
            this.profile = ProfileStore.load();
        } catch {
            this.profile = null;
        }

        // Settings
        try {
            const saved = window.localStorage?.getItem?.("cameraZoom");
            const z = saved != null ? Number(saved) : NaN;
            if (Number.isFinite(z)) this.cameraZoom = Math.max(0.75, Math.min(2.5, z));
        } catch {
            // Ignore storage errors
        }

        // Prefer profile-stored zoom if present (non-gameplay setting).
        try {
            const pz = this.profile?.settings?.cameraZoom;
            if (typeof pz === "number" && Number.isFinite(pz)) {
                this.cameraZoom = Math.max(0.75, Math.min(2.5, pz));
            }
        } catch {
            // Ignore profile errors
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP') {
                this.debug = !this.debug;
                const debugEl = document.getElementById('debug-phials-inv');
                if (debugEl) {
                    debugEl.style.display = this.debug ? 'block' : 'none';
                }
            }
        });
    },

    syncMetaToPlayer() {
        const p = this.p;
        const prof = this.profile;
        if (!p || !prof?.mastery?.attributes) return;
        const attrs = prof.mastery.attributes;
        p.metaMasteryLevels = {
            Might: Number(attrs.Might?.level || 0),
            Will: Number(attrs.Will?.level || 0),
            Alacrity: Number(attrs.Alacrity?.level || 0),
            Constitution: Number(attrs.Constitution?.level || 0),
        };
        p.metaAttunement = prof?.armory?.attunement || null;
    },

    setCameraZoom(z) {
        const next = Math.max(0.75, Math.min(2.5, Number(z) || 1));
        this.cameraZoom = next;
        try {
            window.localStorage?.setItem?.("cameraZoom", String(next));
        } catch {
            // Ignore storage errors
        }
        // Mirror into profile for future unified saves.
        try {
            if (!this.profile) this.profile = ProfileStore.load();
            if (this.profile?.settings) this.profile.settings.cameraZoom = next;
        } catch {
            // Ignore profile errors
        }
    },

    applyWorldTransform(ctx) {
        const p = this.p;
        const canvas = this.canvas;
        if (!ctx || !p || !canvas) return;
        const z = Math.max(0.01, Number(this.cameraZoom) || 1);
        const w = canvas.width || 0;
        const h = canvas.height || 0;
        // World->screen: center camera on player
        ctx.setTransform(z, 0, 0, z, w / 2 - p.x * z, h / 2 - p.y * z);
    },
    beginRunTracking() {
        const p = this.p;
        if (!p) return;
        // Treat Field->Dungeon as the same run; only increment when starting a fresh run.
        const fresh = !p.runActive;
        if (fresh) {
            p.runId = (p.runId || 0) + 1;
            p.runLoot = [];
            p.runStart = { souls: p.souls, xp: p.xp };
            p.runEnded = false;
        }
        p.runActive = true;

        // Rebuild meta mirrors and mastery sources once per run start.
        try {
            this.syncMetaToPlayer();
            p._attributeMasteryEffectSources = buildAttributeMasteryEffectSources(p, this.profile);
        } catch {
            p._attributeMasteryEffectSources = [];
        }

        // Phase 6: apply run-start mastery effects via EffectSystem (no per-frame scanning).
        try {
            const enabled = FeatureFlags.isOn("progression.effectSystemEnabled");
            const shadow = FeatureFlags.isOn("progression.effectSystemShadow") && !enabled;
            if (enabled || shadow) {
                EffectSystem.setActiveSources(p._attributeMasteryEffectSources || []);
                EffectSystem.trigger(EffectSystem.TRIGGERS.runStart, { game: this, player: p, state: this.stateManager?.currentState }, { shadow: !!shadow });
            }
        } catch {
            // ignore
        }
    },
    endRun(endReason, state) {
        const p = this.p;
        if (!p) return null;
        if (!p.runActive || p.runEnded) return null;
        p.runEnded = true;
        p.runActive = false;

        const st = state || this.stateManager?.currentState;
        const runResult = computeRunResult(this, { endReason, state: st });

        // Emit runEnd to EffectSystem for future mastery hooks (no-op unless enabled elsewhere).
        try {
            EffectSystem.trigger(EffectSystem.TRIGGERS.runEnd, { game: this, player: p, state: st, runResult }, { shadow: false });
        } catch {
            // ignore
        }

        // Always record minimal run history (tuning/telemetry). Mastery XP only applies when enabled.
        try {
            const profile = this.profile || ProfileStore.load();
            if (FeatureFlags.isOn("progression.metaMasteryEnabled")) {
                applyMetaProgression(profile, runResult);
            } else {
                appendRunHistory(profile, runResult, { masteryXp: null });
            }
            ProfileStore.save(profile, { backupPrevious: true });
            this.profile = profile;
            this.syncMetaToPlayer();
        } catch (e) {
            console.warn("Run end persistence failed:", e);
        }

        return runResult;
    },
    forfeitRunRewards() {
        const p = this.p;
        if (!p?.runStart) return;
        p.souls = p.runStart.souls;
        p.xp = p.runStart.xp;
        p.recalc();
        UI.dirty = true;
    },
    resetRunProgression() {
        const p = this.p;
        if (!p) return;

        p.clearPhials();
        p.clearSkills();

        p.lvl = 1;
        p.xp = 0;
        p.attr = { might: 0, alacrity: 0, will: 0, constitution: 0, pts: 0 };
        p.totalAttr = { might: 0, alacrity: 0, will: 0, constitution: 0 };
        p.perks = { might: false, alacrity: false, will: false };
        p.timers = { might: 0, alacrity: 0, will: 0 };
        p.levelPicks = { attribute: 0, weapon: 0, phial: 0 };
        p.weaponRerollsUsed = 0;
        p.phialRerollsUsed = 0;
        p.levelUpOffers = { weapon: null, weaponMeta: { weaponCls: null }, phial: null };
        p.activeOrbitalWisps = 0;
        p.hp = p.hpMax;
        p.recalc();
        UI.dirty = true;
        UI.updateLevelUpPrompt();
    },
    abortRunToTown() {
        this.endRun("forfeit", this.stateManager?.currentState);
        this.forfeitRunRewards();
        UI.closeAll();
        this.stateManager.switchState(new TownState(this));
        this.paused = false;
    },
    restartRunInPlace() {
        const st = this.stateManager?.currentState;
        if (!st?.isRun) return;
        this.endRun("restart", st);
        this.forfeitRunRewards();
        this.resetRunProgression();
        UI.closeAll();
        const next = st.getRestartState?.(this);
        if (next) this.stateManager.switchState(next);
        this.paused = false;
    },
    quitToTitle() {
        location.reload();
    },

    async startGame(wepType) {
        document.getElementById('screen_select').classList.remove('active');

        // Preload core art used immediately in Town (non-fatal if it fails).
        try {
            await Assets.preload([
                "campfireSheet",
                "hammerIcon",
                "pistolIcon",
                "staffIcon",
                "scytheIcon",
                "fieldForestGroundDraft",

                // Player spritesheets (directional 8x15 @ 64x64)
                "playerIdleSheet",
                "playerRunSheet",
                "playerAttackSheet",
                "playerRunBackwardsSheet",
                "playerStrafeLeftSheet",
                "playerStrafeRightSheet",
                "playerDieSheet",

                // Enemy spritesheets (directional 8x8 @ 64x64)
                "enemyWalkerIdleSheet",
                "enemyWalkerRunSheet",
                "enemyWalkerAttackSheet",
                "enemyWalkerDieSheet",
                "enemyThrallIdleSheet",
                "enemyThrallRunSheet",
                "enemyThrallAttackSheet",
                "enemyThrallDieSheet",
                "enemyCursedIdleSheet",
                "enemyCursedRunSheet",
                "enemyCursedAttackSheet",
                "enemyCursedDieSheet",
                "enemyBruteIdleSheet",
                "enemyBruteRunSheet",
                "enemyBruteAttackSheet",
                "enemyBruteSpecialAtkSheet",
                "enemyBruteDieSheet",
                "enemyChargerIdleSheet",
                "enemyChargerRunSheet",
                "enemyChargerAttackSheet",
                "enemyChargerSpecialAtkSheet",
                "enemyChargerDieSheet",
                "enemySpitterIdleSheet",
                "enemySpitterRunSheet",
                "enemySpitterAttackSheet",
                "enemySpitterSpecialAtkSheet",
                "enemySpitterDieSheet",
                "enemyAnchorIdleSheet",
                "enemyAnchorRunSheet",
                "enemyAnchorAttackSheet",
                "enemyAnchorSpecialAtkSheet",
                "enemyAnchorDieSheet",

                // Projectiles
                "hammerSpinSheet",
            ]);
        } catch (e) {
            console.warn("Asset preload failed:", e);
        }
        
        this.p = new PlayerObj();
        // Default: no starting weapon selected yet (Town is non-combat).
        this.p.gear.weapon = { id: "starter:none", type: "weapon", name: "Bare Hands", rarity: "common", stats: { dmg: 0 }, cls: "none", identified: true };
        this.p.recalc();
        this.syncMetaToPlayer();

        this.decals = new DecalSystem(this);
        this.stateManager = new GameStateManager(this);
        this.stateManager.switchState(new TownState(this));
        
        this.paused = false;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    },

    restart() {
        document.getElementById('screen_death').classList.remove('active');
        UI.closeAll();
        this.stateManager.switchState(new TownState(this));
        this.paused = false;
    },

    equipStartingWeapon(wepType) {
        if (!this.p) return;
        const t = normalizeWeaponCls(wepType);
        const bases = { hammer: "Rusty Hammer", pistol: "Old Flintlock", repeater: "Old Repeater", staff: "Worn Staff", scythe: "Rusty Scythe" };
        if (!bases[t]) return;

        const w = this.loot("weapon");
        w.name = bases[t];
        // Stage 5: canonical runtime cls is now "repeater" (legacy saves/items may still say "pistol").
        const repeaterEnabled = FeatureFlags.isOn("content.weaponIdRepeaterEnabled");
        w.cls = (t === "repeater" && !repeaterEnabled) ? "pistol" : t;
        w.stats = { dmg: 6 };
        this.p.gear.weapon = w;
        this.p.recalc();
        UI.dirty = true;
    },

    loop(now) {
        try {
            let dt = (now - this.lastTime) / 1000;
            this.lastTime = now;
            if (dt > 0.1) dt = 0.1;
            if (!this.paused) this.update(dt);
            this.render();
        } catch (e) {
            console.error("Game loop error:", e);
        } finally {
            requestAnimationFrame(this.loop.bind(this));
        }
    },

    update(dt) {
        this.time += dt;
        this.stateManager.update(dt);
        ParticleSystem.update(dt, this.p);
    },

    render() {
        if (!this.canvas) return;
        this.stateManager.render(this.ctx);
        // Ensure UI/cursor overlays are in screen-space regardless of state render transforms.
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // HUD should never be able to crash the game loop.
        try {
            UI.render(); // always update HUD
        } catch (e) {
            console.error("UI.render failed:", e);
        }

        if (this.p && this.p.salvoCharges > 0) {
            const a = Math.max(0, Math.min(1, (this.p.salvoGlow || 0) * 0.2));
            // Small moving gameplay element: ink rim rule for readability.
            this.ctx.save();
            this.ctx.globalAlpha = a;
            this.ctx.fillStyle = c("fx.ink") || "ink";
            this.ctx.beginPath();
            this.ctx.arc(mouse.x, mouse.y, 22, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = c("player.core") || "p2";
            this.ctx.beginPath();
            this.ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    },

    screenToWorld(sx, sy) {
        const p = this.p;
        const canvas = this.canvas;
        if (!p || !canvas) return { x: sx, y: sy };
        const z = Math.max(0.01, Number(this.cameraZoom) || 1);
        return {
            x: (sx - canvas.width / 2) / z + p.x,
            y: (sy - canvas.height / 2) / z + p.y
        };
    },

    loot(forceType) {
        try {
            const type = forceType || SLOTS[Math.floor(Math.random() * SLOTS.length)];
            const pool = ITEMS[type];
            if (!pool) throw "No pool";
            const tpl = pool[Math.floor(Math.random() * pool.length)];
            const rVal = Math.random();
            let rarity = "common", m = 1;
            if (rVal < 0.05) { rarity = "legendary"; m = 2.5; }
            else if (rVal < 0.15) { rarity = "epic"; m = 1.8; }
            else if (rVal < 0.30) { rarity = "rare"; m = 1.4; }
            else if (rVal < 0.60) { rarity = "uncommon"; m = 1.2; }
            let stats = {};
            for (let k in tpl.stats) stats[k] = Math.ceil(tpl.stats[k] * m);
            return { id: Math.random().toString(36), type, name: tpl.base, rarity, stats, cls: tpl.cls, identified: true };
        } catch (e) { return { id: "err", type: "trinket", name: "Scrap", rarity: "common", stats: {} }; }
    },

    /**
     * Phase 2: explicit save button support. Stores non-run, non-combat-affecting state:
     * - settings (camera zoom)
     * - armory loadout snapshot (gear names/stats) for future Armory UI
     */
    save() {
        try {
            const profile = this.profile || ProfileStore.load();
            profile.settings = profile.settings || {};
            profile.settings.cameraZoom = this.cameraZoom;

            // Snapshot loadout for Armory (Phase 5 will formalize this schema).
            const p = this.p;
            const gear = p?.gear || {};
            const gearBySlot = {};
            for (const slot in gear) {
                const it = gear[slot];
                if (!it) continue;
                // Keep it minimal and JSON-safe. Items are currently randomly generated; we store a snapshot.
                gearBySlot[slot] = {
                    type: it.type || slot,
                    name: it.name || null,
                    rarity: it.rarity || null,
                    cls: it.cls || null,
                    stats: it.stats || {},
                    identified: it.identified !== false,
                };
            }
            profile.armory = profile.armory || {};
            profile.armory.loadout = {
                weaponCls: p?.gear?.weapon?.cls || null,
                gearBySlot,
            };

            ProfileStore.save(profile, { backupPrevious: true });
            this.profile = profile;
            UI?.toast?.("Saved");
        } catch (e) {
            console.warn("Save failed:", e);
            UI?.toast?.("Save failed");
        }
    },
};

export default Game;
