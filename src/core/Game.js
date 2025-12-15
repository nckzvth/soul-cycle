// src/core/Game.js
import PlayerObj from "../entities/Player.js";
import GameStateManager from "./GameStateManager.js";
import TownState from "../states/TownState.js";
import UI from "../systems/UI.js";
import { keys, mouse } from "./Input.js";
import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";
import ParticleSystem from "../systems/Particles.js";

const Game = {
    p: null,
    stateManager: null,
    time: 0,
    paused: false,
    lastTime: 0,
    canvas: null,
    ctx: null,
    debug: false,

    init() {
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        UI.init(this);

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP') {
                this.debug = !this.debug;
                const debugEl = document.getElementById('debug-phials');
                if (debugEl) {
                    debugEl.style.display = this.debug ? 'block' : 'none';
                }
            }
        });
    },

    startGame(wepType) {
        document.getElementById('screen_select').classList.remove('active');
        
        this.p = new PlayerObj();
        const w = this.loot("weapon");
        const bases = { hammer: "Rusty Hammer", pistol: "Old Flintlock", staff: "Worn Staff" };
        w.name = bases[wepType];
        w.cls = wepType;
        w.stats = { dmg: 6 };
        this.p.gear.weapon = w;
        this.p.recalc();

        this.stateManager = new GameStateManager(this);
        this.stateManager.switchState(new TownState(this));
        
        this.paused = false;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    },

    restart() {
        document.getElementById('screen_death').classList.remove('active');
        this.stateManager.switchState(new TownState(this));
        this.paused = false;
    },

    loop(now) {
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dt > 0.1) dt = 0.1;
        if (!this.paused) this.update(dt);
        this.render();
        requestAnimationFrame(this.loop.bind(this));
    },

    update(dt) {
        this.time += dt;
        this.stateManager.update(dt);
        ParticleSystem.update(dt, this.p);
    },

    render() {
        if (!this.canvas) return;
        this.stateManager.render(this.ctx);
        UI.render(); // always update HUD

        if (this.p && this.p.salvoCharges > 0) {
            this.ctx.fillStyle = `rgba(160, 235, 255, ${this.p.salvoGlow * 0.2})`;
            this.ctx.beginPath();
            this.ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
            this.ctx.fill();
        }
    },

    screenToWorld(sx, sy) {
        return { x: sx - this.canvas.width / 2 + this.p.x, y: sy - this.canvas.height / 2 + this.p.y };
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
            return { id: Math.random().toString(36), type, name: tpl.base, rarity, stats, cls: tpl.cls };
        } catch (e) { return { id: "err", type: "trinket", name: "Scrap", rarity: "common", stats: {} }; }
    }
};

export default Game;