// src/entities/Interactable.js
import { color as c } from "../data/ColorTuning.js";

class Interactable {
    constructor(x, y, width, height, onInteract) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.onInteract = onInteract;
    }

    checkInteraction(player) {
        return (
            player.x < this.x + this.width &&
            player.x > this.x &&
            player.y < this.y + this.height &&
            player.y > this.y
        );
    }

    draw(ctx) {
        // Placeholder draw function
        ctx.fillStyle = c("interactable.placeholderFill") || c("player.core", 0.25) || "p2";
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export default Interactable;
