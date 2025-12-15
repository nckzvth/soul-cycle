import State from '../core/State.js';
import TownState from './TownState.js';
import Boss from '../entities/Boss.js';
import Interactable from '../entities/Interactable.js';
import { keys } from '../core/Input.js';
import CombatSystem from '../systems/CombatSystem.js';
import LootSystem from '../systems/LootSystem.js';
import { LootDrop as Drop } from '../entities/Pickups.js';
import UI from '../systems/UI.js';

class DungeonState extends State {
    constructor(game) {
        super(game);
        this.boss = null;
        this.enemies = [];
        this.shots = []; 
        this.drops = [];
        this.townPortal = null;
        this.chains = [];
        // Room bounds
        this.bounds = { x: 0, y: 0, w: 800, h: 600 };
        this.showKillCounter = true;
        
        this.combatSystem = CombatSystem; // Expose CombatSystem to entities
    }

    enter() {
        console.log("Entering Dungeon State");
        const p = this.game.p;
        // Encapsulated Teleport
        p.teleport(400, 500);
        p.recalc();

        this.boss = new Boss(400, 200);
        this.enemies = [this.boss];
        this.shots = [];
        this.drops = [];
        this.townPortal = null;
        this.showKillCounter = true;
        UI.updateLevelUpPrompt();
    }

    exit() {
        this.showKillCounter = false;
    }

    update(dt) {
        const p = this.game.p;

        // 1. UPDATE PLAYER (Combat Enabled)
        p.update(dt, this, true);

        // 2. WALLS (Clamp Position)
        p.x = Math.max(this.bounds.x + 12, Math.min(this.bounds.w - 12, p.x));
        p.y = Math.max(this.bounds.y + 12, Math.min(this.bounds.h - 12, p.y));

        // 3. BOSS/ENEMIES
        if (this.boss.dead && !this.townPortal) {
            this.onEnemyDeath(this.boss);
        } else if (!this.boss.dead) {
            this.boss.update(dt, p, this);
        }
        
        // 4. PROJECTILES
        // Use a standard for loop to handle projectiles spawning other projectiles (like TitheExplosion)
        for (let i = 0; i < this.shots.length; i++) {
            const b = this.shots[i];
            if (!b.update(dt, this)) {
                this.shots.splice(i, 1);
                i--;
            }
        }
        this.chains = this.chains.filter(c => { c.t -= dt; return c.t > 0; });
        this.drops = this.drops.filter(d => d.update(dt, p));

        // 5. INTERACTION
        if (this.townPortal && keys['KeyF'] && this.townPortal.checkInteraction(p)) {
            this.townPortal.onInteract();
        }
    }

    onEnemyDeath(enemy) {
        const p = this.game.p;

        // Always record the kill
        p.registerKill(enemy);

        if (enemy === this.boss) {
            console.log("Boss defeated!");
            this.drops.push(new Drop(this.boss.x, this.boss.y, LootSystem.loot("weapon")));
            this.townPortal = new Interactable(this.boss.x, this.boss.y, 50, 50, () => {
                this.game.stateManager.switchState(new TownState(this.game));
            });
            CombatSystem.onRoomOrWaveClear(this);
        }
    }

    findTarget(exclude, x, y) {
        if (!this.boss.dead && this.boss !== exclude) {
            return this.boss;
        }
        return null;
    }

    render(ctx) {
        const p = this.game.p;
        const w = ctx.canvas.width, h = ctx.canvas.height;
        // Static Camera
        const s = (x, y) => ({ x, y });

        ctx.fillStyle = '#4a2a5a'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'white'; ctx.strokeRect(0, 0, w, h);

        if (!this.boss.dead) this.boss.draw(ctx, s);
        this.shots.forEach(shot => shot.draw(ctx, s));
        this.drops.forEach(d => d.draw(ctx, s));
        
        // Chains
        ctx.lineWidth = 2; ctx.strokeStyle = "#a0ebff";
        this.chains.forEach(c => {
            let p1 = s(c.pts[0].x, c.pts[0].y);
            let p2 = s(c.pts[1].x, c.pts[1].y);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
            ctx.globalAlpha = c.t * 5; ctx.stroke(); ctx.globalAlpha = 1;
        });

        p.draw(ctx, s);

        // Portal
        if (this.townPortal) {
            let portalPos = s(this.townPortal.x, this.townPortal.y);
            ctx.fillStyle = 'lightblue';
            ctx.fillRect(portalPos.x, portalPos.y, this.townPortal.width, this.townPortal.height);
            if (this.townPortal.checkInteraction(p)) {
                ctx.fillStyle = 'white'; ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText("[F] to return to Town", w / 2, h - 50);
                ctx.textAlign = 'start';
            }
        }

        // Boss UI
        if (!this.boss.dead) {
            ctx.fillStyle = 'red'; ctx.fillRect(w / 2 - 250, 20, 500 * (this.boss.hp / this.boss.hpMax), 20);
            ctx.strokeStyle = 'white'; ctx.strokeRect(w / 2 - 250, 20, 500, 20);
        }
    }
}

export default DungeonState;