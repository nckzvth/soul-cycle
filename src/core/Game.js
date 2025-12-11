// src/core/Game.js
import PlayerObj from "../entities/Player.js";
import GameStateManager from "./GameStateManager.js";
import TownState from "../states/TownState.js";
import UI from "../systems/UI.js";
import { keys, mouse } from "./Input.js";
import { SLOTS } from "../data/Constants.js";
import { ITEMS } from "../data/Items.js";

const Game = {
    p: null,
    stateManager: null,
    time: 0,
    paused: false,
    lastTime: 0,
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById("game");
        this.ctx = this.canvas.getContext("2d");
        UI.init(this);
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
    },

    render() {
        if (!this.canvas) return;
        this.stateManager.render(this.ctx);
        UI.render(); // always update HUD
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
