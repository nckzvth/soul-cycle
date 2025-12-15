import State from '../core/State.js';
import FieldState from './FieldState.js';
import DungeonState from './DungeonState.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';
import UI from '../systems/UI.js';

class TownState extends State {
    constructor(game) {
        super(game);
        this.gate = new Interactable(350, 500, 100, 50, () => {
            this.game.stateManager.switchState(new FieldState(this.game));
        });
        // TODO: Remove this temporary portal for testing
        this.dungeonPortal = new Interactable(600, 300, 50, 50, () => {
            this.game.stateManager.switchState(new DungeonState(this.game));
        });
        // Empty array for safety if perks trigger
        this.shots = []; 
        this.showKillCounter = false;
    }

    enter() {
        console.log("Entering Town State");
        const p = this.game.p;
        
        // Encapsulated Reset
        p.teleport(400, 300);
        p.fullHeal();
        p.resetKillSession();
        p.clearPhials(); // Clear phials on entering town
        p.clearSkills(); // Clear skills on entering town
        p.levelPicks = { attribute: 0, weapon: 0, phial: 0 }; // Clear level picks
        console.log(`Lifetime kills: ${p.killStats.lifetime}`);
        this.showKillCounter = false;
        UI.updateLevelUpPrompt();
    }

    update(dt) {
        const p = this.game.p;
        
        // Update Player (False = No Combat)
        p.update(dt, this, false);

        // Interaction
        if (keys['KeyF']) {
            if (this.gate.checkInteraction(p)) {
                this.gate.onInteract();
            }
            // TODO: Remove this temporary portal for testing
            if (this.dungeonPortal.checkInteraction(p)) {
                this.dungeonPortal.onInteract();
            }
        }
        
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

        p.draw(ctx, s);

        // Overlay
        ctx.fillStyle = 'white';
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Town', w / 2, 50);

        if (this.gate.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] to Enter Field", w / 2, h - 50);
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