export const PLAYER_SPRITE_CONFIG = Object.freeze({
    frameWidth: 64,
    frameHeight: 64,
    dirCount: 8,
    framesPerDir: 15,

    // Visual tuning (gameplay collision remains `PlayerObj.r`)
    scale: 2.0,
    pixelArt: false,
    shadow: true,
    offset: Object.freeze({ x: 0, y: 0 }),

    // Collision tuning: derive a stable "footprint" box by scanning alpha in the lower portion
    // of frames (uses PNG transparency, but collision remains AABB for performance).
    collision: Object.freeze({
        mode: "alphaFootprint",
        footprintYStartRatio: 0.55,
        alphaThreshold: 10,
        paddingPx: 2,
        // Fallback local bounds within a 64x64 frame if alpha scan can't run yet.
        fallbackLocalBounds: Object.freeze({ minX: 20, minY: 40, maxX: 44, maxY: 62 }),
    }),

    states: Object.freeze({
        idle: Object.freeze({ imageKey: "playerIdleSheet", fps: 8, loop: true }),
        run: Object.freeze({ imageKey: "playerRunSheet", fps: 12, loop: true }),
        runBack: Object.freeze({ imageKey: "playerRunBackwardsSheet", fps: 12, loop: true }),
        strafeL: Object.freeze({ imageKey: "playerStrafeLeftSheet", fps: 12, loop: true }),
        strafeR: Object.freeze({ imageKey: "playerStrafeRightSheet", fps: 12, loop: true }),
        attack: Object.freeze({ imageKey: "playerAttackSheet", fps: 16, loop: true }),
        die: Object.freeze({ imageKey: "playerDieSheet", fps: 12, loop: false }),
    }),
});
