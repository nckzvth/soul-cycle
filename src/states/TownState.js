// src/states/TownState.js
import State from '../core/State.js';
import FieldState from './FieldState.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';

class TownState extends State {
    constructor(game) {
        super(game);
        this.gate = new Interactable(350, 500, 100, 50, () => {
            this.game.stateManager.switchState(new FieldState(this.game));
        });
    }

    enter() {
        console.log("Entering Town State");
        this.game.p.x = 400;
        this.game.p.y = 300;
        // Restore player health/stamina
        this.game.p.hp = this.game.p.stats.hpMax;
        this.game.p.sta = 100;
    }

    update(dt) {
        const p = this.game.p;
        // Player movement (no dash or attack)
        let mx = 0, my = 0;
        if (keys["KeyW"]) my--; if (keys["KeyS"]) my++;
        if (keys["KeyA"]) mx--; if (keys["KeyD"]) mx++;

        if (mx || my) {
            let l = Math.sqrt(mx * mx + my * my);
            mx /= l; my /= l;
            let spd = 180 * (1 + p.stats.move);
            p.x += mx * spd * dt;
            p.y += my * spd * dt;
        }

        if (keys['KeyF'] && this.gate.checkInteraction(p)) {
            this.gate.onInteract();
        }
    }

    render(ctx) {
        const p = this.game.p;
        const canvas = this.game.canvas;
        const w = canvas.width;
        const h = canvas.height;

        // Center camera on player
        const s = (x, y) => ({ x: x - p.x + w / 2, y: y - p.y + h / 2 });

        ctx.fillStyle = '#2c2f38'; // Dark gray-blue
        ctx.fillRect(0, 0, w, h);

        // Draw town elements
        ctx.fillStyle = '#8d8d8d';
        let gatePos = s(this.gate.x, this.gate.y);
        ctx.fillRect(gatePos.x, gatePos.y, this.gate.width, this.gate.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px sans-serif';
        ctx.fillText('Gate', gatePos.x + 30, gatePos.y + 30);


        // Draw Player
        let pc = s(p.x, p.y);
        ctx.fillStyle = "#6aae9d";
        ctx.beginPath();
        ctx.arc(pc.x, pc.y, 12, 0, 6.28);
        ctx.fill();


        // Town Label
        ctx.fillStyle = 'white';
        ctx.font = '48px serif';
        ctx.textAlign = 'center';
        ctx.fillText('Town', w / 2, 50);

        // Interaction prompt
        if (this.gate.checkInteraction(p)) {
            ctx.font = '24px sans-serif';
            ctx.fillText("[F] to Enter Field", w / 2, h - 50);
        }
        ctx.textAlign = 'start'; // Reset alignment
    }
}

export default TownState;
