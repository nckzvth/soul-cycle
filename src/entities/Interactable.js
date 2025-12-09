// src/entities/Interactable.js

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
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

export default Interactable;
