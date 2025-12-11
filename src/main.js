// src/main.js
import Game from "./core/Game.js";
import { initInput } from "./core/Input.js";

initInput();
Game.init();

// Manual Wiring to break Circular Dependency
document.getElementById("btn-start-hammer").onclick = () => Game.startGame("hammer");
document.getElementById("btn-start-pistol").onclick = () => Game.startGame("pistol");
document.getElementById("btn-start-staff").onclick = () => Game.startGame("staff");
document.getElementById("btn-restart").onclick = () => Game.restart();

// Expose for Debug
window.Game = Game;
