import State from '../core/State.js';
import FieldState from './FieldState.js';
import DungeonState from './DungeonState.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';
import UI from '../systems/UI.js';
import ParticleSystem from '../systems/Particles.js';
import { color as c } from "../data/ColorTuning.js";
import Assets from "../core/Assets.js";
import { SPRITESHEETS, ANIMATIONS } from "../data/Art.js";
import SpriteSheet from "../render/SpriteSheet.js";
import Animation from "../render/Animation.js";
import AnimatedProp from "../entities/AnimatedProp.js";
import InteractableSprite from "../entities/InteractableSprite.js";

const CAMPFIRE_POS = Object.freeze({ x: 400, y: 180 });
const WEAPON_ICON_ARC = Object.freeze({
    radius: 72,
    anglesDeg: Object.freeze([-150, -90, -30]), // left, top, right (above campfire)
});

class TownState extends State {
    constructor(game) {
        super(game);
        this.uiFlags = { canOpenInv: false, canSwapGear: false, canOpenAppraise: false };
        this.campfire = null;
        this.weaponIcons = null;
        this._campfireTune = false;
        this._campfireTuneHeld = false;
        this.gate = new Interactable(350, 500, 100, 50, () => {
            this.game.stateManager.switchState(new FieldState(this.game));
        });
        // TODO: Remove this temporary portal for testing
        this.dungeonPortal = new Interactable(600, 300, 50, 50, () => {
            this.game.stateManager.switchState(new DungeonState(this.game));
        });
        this.outfitter = new Interactable(200, 360, 80, 55, () => {
            UI.toggle('inv');
        });
        this.appraiser = new Interactable(520, 360, 95, 55, () => {
            UI.toggle('appraise');
        });
        // Empty array for safety if perks trigger
        this.shots = []; 
        this.showKillCounter = false;
        this._fHeld = false;
    }

    enter() {
        console.log("Entering Town State");
        const p = this.game.p;
        
        // Encapsulated Reset
        p.teleport(400, 300);
        p.resetKillSession();
        p.clearPhials(); // Clear phials on entering town
        p.clearSkills(); // Clear skills on entering town

        // Run progression resets on town return (roguelike run state).
        p.lvl = 1;
        p.xp = 0;
        p.attr = { might: 0, alacrity: 0, will: 0, pts: 0 };
        p.totalAttr = { might: 0, alacrity: 0, will: 0 };
        p.perks = { might: false, alacrity: false, will: false };
        p.timers = { might: 0, alacrity: 0, will: 0 };

        p.fullHeal();
        p.levelPicks = { attribute: 0, weapon: 0, phial: 0 }; // Clear level picks
        console.log(`Lifetime kills: ${p.killStats.lifetime}`);
        this.showKillCounter = false;
        UI.updateLevelUpPrompt();
    }

    ensureCampfire() {
        if (this.campfire) return;
        const def = SPRITESHEETS.campfire;
        const animDef = ANIMATIONS.campfireIdle;
        const img = Assets.getImage(def.imageKey);
        if (!img) return;

        const sheet = new SpriteSheet(img, {
            frameWidth: def.frameWidth,
            frameHeight: def.frameHeight,
            frameCount: def.frameCount,
        });
        const anim = new Animation({
            fps: animDef.fps,
            frames: animDef.frames,
            loop: animDef.loop,
        });

        this.campfire = new AnimatedProp({
            x: CAMPFIRE_POS.x,
            y: CAMPFIRE_POS.y,
            sheet,
            anim,
            scale: 1,
            anchor: "bottom-center",
            pixelArt: true,
        });
    }

    ensureWeaponIcons() {
        if (this.weaponIcons) return;
        const imgHammer = Assets.getImage("hammerIcon");
        const imgPistol = Assets.getImage("pistolIcon");
        const imgStaff = Assets.getImage("staffIcon");
        if (!imgHammer || !imgPistol || !imgStaff) return;

        const mkIcon = (img, label, auraColor, auraStroke) => {
            const sheet = new SpriteSheet(img, {
                frameWidth: img.width || 1,
                frameHeight: img.height || 1,
                frameCount: 1,
            });
            const anim = new Animation({ frameCount: 1, fps: 1, loop: true });
            return new InteractableSprite({
                x: 0,
                y: 0,
                sheet,
                anim,
                label,
                prompt: "",
                anchor: "bottom-center",
                pixelArt: false,
                interactRadius: 58,
                bobAmplitude: 4.5,
                bobSpeed: 2.4,
                liftOnHover: 10,
                auraColor,
                auraStroke,
                auraRadius: 18,
            });
        };

        // Order matches arc angles: Hammer (left), Staff (top), Pistol (right).
        this.weaponIcons = [
            mkIcon(imgHammer, "hammer", c("town.weaponIconAura.hammer") || c("fx.uiAccent", 0.18) || "ember", c("town.weaponIconAura.hammerStroke") || c("fx.uiAccent", 0.30) || "ember"),
            mkIcon(imgStaff, "staff", c("town.weaponIconAura.staff") || c("player.support", 0.16) || "p3", c("town.weaponIconAura.staffStroke") || c("player.support", 0.28) || "p3"),
            mkIcon(imgPistol, "pistol", c("town.weaponIconAura.pistol") || c("player.core", 0.16) || "p2", c("town.weaponIconAura.pistolStroke") || c("player.core", 0.28) || "p2"),
        ];

        const cx = CAMPFIRE_POS.x;
        const cy = CAMPFIRE_POS.y;
        const r = WEAPON_ICON_ARC.radius;
        const angles = WEAPON_ICON_ARC.anglesDeg;
        for (let i = 0; i < this.weaponIcons.length; i++) {
            const a = (angles[i] * Math.PI) / 180;
            this.weaponIcons[i].x = cx + Math.cos(a) * r;
            this.weaponIcons[i].y = cy + Math.sin(a) * r;
        }
    }

    update(dt) {
        const p = this.game.p;
        
        // Update Player (False = No Combat)
        p.update(dt, this, false);
        this.ensureCampfire();
        this.ensureWeaponIcons();
        this.campfire?.update(dt);
        this.weaponIcons?.forEach((w) => w.update(dt, p));
        ParticleSystem.update(dt);

        // Debug: toggle and tune campfire placement (scales to other future props).
        const toggleDown = !!keys["KeyO"];
        if (toggleDown && !this._campfireTuneHeld && this.game?.debug) {
            this._campfireTune = !this._campfireTune;
        }
        this._campfireTuneHeld = toggleDown;
        if (this._campfireTune && this.campfire) {
            const fast = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
            const speed = fast ? 220 : 110; // world px/sec
            if (keys["ArrowLeft"]) this.campfire.x -= speed * dt;
            if (keys["ArrowRight"]) this.campfire.x += speed * dt;
            if (keys["ArrowUp"]) this.campfire.y -= speed * dt;
            if (keys["ArrowDown"]) this.campfire.y += speed * dt;
        }

        const canUseOutfitter = this.outfitter.checkInteraction(p);
        this.uiFlags.canOpenInv = canUseOutfitter;
        this.uiFlags.canSwapGear = canUseOutfitter;
        const canUseAppraiser = this.appraiser.checkInteraction(p);
        this.uiFlags.canOpenAppraise = canUseAppraiser;

        // Interaction
        const fDown = !!keys['KeyF'];
        if (fDown && !this._fHeld) {
            // Weapon selection near the campfire.
            const icons = this.weaponIcons || [];
            for (const w of icons) {
                if (w.tryInteract(p, true)) {
                    if (p.gear?.weapon?.cls !== w.label) {
                        this.game?.equipStartingWeapon?.(w.label);
                        UI.toast(`Equipped ${String(w.label).toUpperCase()}`);
                    }
                    this._fHeld = true;
                    return;
                }
            }

            if (this.gate.checkInteraction(p)) {
                if ((p.gear?.weapon?.cls || "none") === "none") {
                    UI.toast("Equip a weapon at the campfire.");
                    this._fHeld = true;
                    return;
                }
                this.gate.onInteract();
            }
            // TODO: Remove this temporary portal for testing
            if (this.dungeonPortal.checkInteraction(p)) {
                this.dungeonPortal.onInteract();
            }
            if (this.outfitter.checkInteraction(p)) {
                this.outfitter.onInteract();
            }
            if (this.appraiser.checkInteraction(p)) {
                this.appraiser.onInteract();
            }
        }
        this._fHeld = fDown;
        
        // Cleanup visuals
        this.shots = this.shots.filter(s => s.update(dt, this));
    }

    render(ctx) {
        const p = this.game.p;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const s = (x, y) => ({ x, y });

        // Screen-space base pass
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = c("town.background") || c("fx.slate") || "slate";
        ctx.fillRect(0, 0, w, h);

        // World-space pass (camera centered on player with zoom)
        ctx.save();
        this.game.applyWorldTransform(ctx);

        // Campfire (top-center of town; scale relative to player size).
        this.ensureCampfire();
        this.ensureWeaponIcons();
        if (this.campfire) {
            const targetScale = (p.r * 2 / 32) * 2.0; // player diameter as reference
            this.campfire.scale = Math.max(1, targetScale);
            this.campfire.draw(ctx, s);
            if (this._campfireTune && this.game?.debug) {
                const fw = this.campfire.sheet.frameWidth * this.campfire.scale;
                const fh = this.campfire.sheet.frameHeight * this.campfire.scale;
                const sp = s(this.campfire.x, this.campfire.y);
                const x = sp.x - fw / 2;
                const y = sp.y - fh;
                ctx.save();
                ctx.strokeStyle = c("player.core", 0.85) || "p2";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, fw, fh);
                ctx.strokeStyle = c("fx.uiText", 0.85) || "parchment";
                ctx.beginPath();
                ctx.moveTo(sp.x - 6, sp.y); ctx.lineTo(sp.x + 6, sp.y);
                ctx.moveTo(sp.x, sp.y - 6); ctx.lineTo(sp.x, sp.y + 6);
                ctx.stroke();
                ctx.fillStyle = c("fx.uiText", 0.85) || "parchment";
                ctx.font = "12px sans-serif";
                ctx.fillText(`Campfire: (${Math.round(this.campfire.x)}, ${Math.round(this.campfire.y)})  [O] tune`, sp.x - 90, sp.y + 18);
                ctx.restore();
            }
        }

        // Weapon icons (starting weapon selection).
        const icons = this.weaponIcons || [];
        for (const wpn of icons) {
            const targetHeight = (p.r * 2) * 1.9;
            const fh = wpn.sheet?.frameHeight || 1;
            wpn.scale = Math.max(0.65, targetHeight / fh);
            const equipped = p.gear?.weapon?.cls === wpn.label;
            wpn.prompt = equipped ? "Equipped" : `Equip ${String(wpn.label).charAt(0).toUpperCase() + String(wpn.label).slice(1)} [F]`;
            wpn.draw(ctx, s, { showPrompt: false, drawSprite: true });
        }
        // Prompts render in a separate pass so they always appear above the icons.
        for (const wpn of icons) {
            wpn.draw(ctx, s, { showPrompt: true, drawSprite: false });
        }

        // Draw Gate
        let gatePos = s(this.gate.x, this.gate.y);
        ctx.fillStyle = c("town.gate.body") || c("fx.uiMuted") || "dust";
        ctx.fillRect(gatePos.x, gatePos.y, this.gate.width, this.gate.height);
        ctx.fillStyle = c("town.gate.label") || c("fx.uiText") || "parchment";
        ctx.font = '16px sans-serif';
        ctx.fillText('Gate', gatePos.x + 30, gatePos.y + 30);

        // TODO: Remove this temporary portal for testing
        let portalPos = s(this.dungeonPortal.x, this.dungeonPortal.y);
        ctx.fillStyle = c("town.dungeonPortal.body") || "arcaneDeep";
        ctx.fillRect(portalPos.x, portalPos.y, this.dungeonPortal.width, this.dungeonPortal.height);
        ctx.fillStyle = c("town.dungeonPortal.label") || c("fx.uiText") || "parchment";
        ctx.font = '16px sans-serif';
        ctx.fillText('Dungeon', portalPos.x - 5, portalPos.y + 30);

        // Draw Outfitter
        const outfitterPos = s(this.outfitter.x, this.outfitter.y);
        ctx.fillStyle = c("town.outfitter.body") || "p3";
        ctx.fillRect(outfitterPos.x, outfitterPos.y, this.outfitter.width, this.outfitter.height);
        ctx.fillStyle = c("town.outfitter.label") || c("fx.uiText") || "parchment";
        ctx.font = '16px sans-serif';
        ctx.fillText('Outfitter', outfitterPos.x + 8, outfitterPos.y + 32);

        // Draw Appraiser
        const appraiserPos = s(this.appraiser.x, this.appraiser.y);
        ctx.fillStyle = c("town.appraiser.body") || "p4";
        ctx.fillRect(appraiserPos.x, appraiserPos.y, this.appraiser.width, this.appraiser.height);
        ctx.fillStyle = c("town.appraiser.label") || c("fx.uiText") || "parchment";
        ctx.font = '16px sans-serif';
        ctx.fillText('Appraiser', appraiserPos.x + 10, appraiserPos.y + 32);

        p.draw(ctx, s);
        ParticleSystem.render(ctx, s);

        ctx.restore();

        // Screen-space overlays
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Overlay
        ctx.fillStyle = c("fx.uiText") || "parchment";
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Town', w / 2, 50);

        if (this.gate.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] to Enter Field", w / 2, h - 50);
        }
        if (this.outfitter.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] Outfitter", w / 2, h - 80);
        }
        if (this.appraiser.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] Appraiser", w / 2, h - 110);
        }
        // TODO: Remove this temporary portal for testing
        if (this.dungeonPortal.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] to Enter Dungeon", w / 2, h - 20);
        }
        ctx.textAlign = 'start';
    }
}

export default TownState;
