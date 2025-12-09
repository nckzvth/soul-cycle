// src/core/Input.js
import UI from "../systems/UI.js";

export const keys = {};
export const mouse = { x: 0, y: 0, down: false };

export function initInput() {
    window.onkeydown = e => {
        keys[e.code] = true;
        if (e.code === "KeyI") UI.toggle("inv");
        if (e.code === "KeyK") UI.toggle("skill");
    };
    window.onkeyup = e => keys[e.code] = false;

    window.onmousedown = () => mouse.down = true;
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