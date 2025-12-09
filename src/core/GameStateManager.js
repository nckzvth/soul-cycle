// src/core/GameStateManager.js

class GameStateManager {
    constructor(game) {
        this.game = game;
        this.currentState = null;
    }

    switchState(newState) {
        if (this.currentState) {
            this.currentState.exit();
        }
        this.currentState = newState;
        this.currentState.enter();
    }

    update(dt) {
        if (this.currentState) {
            this.currentState.update(dt);
        }
    }

    render(ctx) {
        if (this.currentState) {
            this.currentState.render(ctx);
        }
    }
}

export default GameStateManager;
