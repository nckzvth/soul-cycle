// src/main.js
import Game from "./core/Game.js";
import { initInput } from "./core/Input.js";

initInput();
Game.init();

// Manual Wiring to break Circular Dependency
document.getElementById("btn-start").onclick = () => Game.startGame().catch(console.error);
document.getElementById("btn-restart").onclick = () => Game.restart();

// Expose for Debug
window.Game = Game;
