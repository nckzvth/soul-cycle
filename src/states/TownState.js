import State from '../core/State.js';
import FieldState from './FieldState.js';
import DungeonState from './DungeonState.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';
import UI from '../systems/UI.js';
import ParticleSystem from '../systems/Particles.js';

class TownState extends State {
    constructor(game) {
        super(game);
        this.uiFlags = { canOpenInv: false, canSwapGear: false, canOpenAppraise: false };
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

    update(dt) {
        const p = this.game.p;
        
        // Update Player (False = No Combat)
        p.update(dt, this, false);
        ParticleSystem.update(dt);

        const canUseOutfitter = this.outfitter.checkInteraction(p);
        this.uiFlags.canOpenInv = canUseOutfitter;
        this.uiFlags.canSwapGear = canUseOutfitter;
        const canUseAppraiser = this.appraiser.checkInteraction(p);
        this.uiFlags.canOpenAppraise = canUseAppraiser;

        // Interaction
        const fDown = !!keys['KeyF'];
        if (fDown && !this._fHeld) {
            if (this.gate.checkInteraction(p)) {
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
        const s = (x, y) => ({ x: x - p.x + w / 2, y: y - p.y + h / 2 });

        ctx.fillStyle = '#2c2f38'; 
        ctx.fillRect(0, 0, w, h);

        // Draw Gate
        let gatePos = s(this.gate.x, this.gate.y);
        ctx.fillStyle = '#8d8d8d';
        ctx.fillRect(gatePos.x, gatePos.y, this.gate.width, this.gate.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Gate', gatePos.x + 30, gatePos.y + 30);

        // TODO: Remove this temporary portal for testing
        let portalPos = s(this.dungeonPortal.x, this.dungeonPortal.y);
        ctx.fillStyle = 'purple';
        ctx.fillRect(portalPos.x, portalPos.y, this.dungeonPortal.width, this.dungeonPortal.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Dungeon', portalPos.x - 5, portalPos.y + 30);

        // Draw Outfitter
        const outfitterPos = s(this.outfitter.x, this.outfitter.y);
        ctx.fillStyle = '#245d45';
        ctx.fillRect(outfitterPos.x, outfitterPos.y, this.outfitter.width, this.outfitter.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Outfitter', outfitterPos.x + 8, outfitterPos.y + 32);

        // Draw Appraiser
        const appraiserPos = s(this.appraiser.x, this.appraiser.y);
        ctx.fillStyle = '#3a3f73';
        ctx.fillRect(appraiserPos.x, appraiserPos.y, this.appraiser.width, this.appraiser.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Appraiser', appraiserPos.x + 10, appraiserPos.y + 32);

        p.draw(ctx, s);
        ParticleSystem.render(ctx, s);

        // Overlay
        ctx.fillStyle = 'white';
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
