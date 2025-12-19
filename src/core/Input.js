// src/core/Input.js
import UI from "../systems/UI.js";
import Game from "./Game.js";

export const keys = {};
export const mouse = { x: 0, y: 0, down: false };

export function initInput() {
    window.onkeydown = e => {
        keys[e.code] = true;

        if (e.code === "Escape" && !e.repeat) {
            if (document.getElementById("screen_death")?.classList.contains("active")) return;
            const closed = UI.closeTop();
            if (!closed) UI.toggle("pause");
            e.preventDefault();
            return;
        }

        if (e.code === "KeyC" && !e.repeat) {
            if (UI.isOpen("levelup")) {
                UI.close("levelup");
                return;
            }
            if (Game.p && (Game.p.levelPicks.attribute > 0 || Game.p.levelPicks.weapon > 0 || Game.p.levelPicks.phial > 0)) {
                UI.open("levelup");
            }
        }
    };
    window.onkeyup = e => keys[e.code] = false;

    window.onmousedown = (e) => {
        // Only treat canvas clicks as "fire weapon" input; UI clicks shouldn't shoot or interfere.
        if (e.button !== 0) return;
        if (e.target && e.target.id === "game") mouse.down = true;
    };
    window.onmouseup = () => mouse.down = false;
    window.onmousemove = e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    };

    window.onresize = () => {
        const c = document.getElementById("game");
        if(c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    };
    window.onresize();
}
