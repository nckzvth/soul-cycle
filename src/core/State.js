// src/core/State.js

class State {
    constructor(game) {
        this.game = game;
        this.uiFlags = { canOpenInv: false, canSwapGear: false, canOpenAppraise: false };
        this.isRun = false;
        this.isTrainingArena = false;
    }

    enter() {
        // Optional: Called when entering the state
    }

    exit() {
        // Optional: Called when exiting the state
    }

    update(dt) {
        // Required: Called every frame
    }

    render(ctx) {
        // Required: Called every frame
    }
}

export default State;
