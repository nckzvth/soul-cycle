const STATES = Object.freeze({
    idle: "idle",
    run: "run",
    attack: "attack",
    special: "special",
    die: "die",
});

export const ENEMY_SPRITE_CONFIG = Object.freeze({
    frameWidth: 64,
    frameHeight: 64,
    dirCount: 8,
    framesPerDir: 8,

    // Default render scale (tune per type/variant as needed).
    defaultScale: 2.0,
    pixelArt: false,

    elite: Object.freeze({
        scaleMult: 1.5,
        glowAlpha: 0.5,
        glowRadiusMult: 1.85,
    }),

    // Sprite base keys (used to build image asset keys in `src/data/Art.js`)
    // Example: baseKey="enemyWalker" + "IdleSheet" => "enemyWalkerIdleSheet"
    enemies: Object.freeze({
        walker: Object.freeze({
            baseKey: "enemyWalker",
            scale: 2.0,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 14, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        thrall: Object.freeze({
            baseKey: "enemyThrall",
            scale: 1.75,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 14, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        cursed: Object.freeze({
            baseKey: "enemyCursed",
            scale: 1.75,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 14, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        brute: Object.freeze({
            baseKey: "enemyBrute",
            scale: 2.25,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 12, loop: true }),
                [STATES.special]: Object.freeze({ suffix: "SpecialAtkSheet", fps: 12, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        charger: Object.freeze({
            baseKey: "enemyCharger",
            scale: 1.80,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 12, loop: true }),
                [STATES.special]: Object.freeze({ suffix: "SpecialAtkSheet", fps: 12, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        spitter: Object.freeze({
            baseKey: "enemySpitter",
            scale: 1.75,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 12, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 12, loop: true }),
                [STATES.special]: Object.freeze({ suffix: "SpecialAtkSheet", fps: 12, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
        anchor: Object.freeze({
            baseKey: "enemyAnchor",
            scale: 2.5,
            states: Object.freeze({
                [STATES.idle]: Object.freeze({ suffix: "IdleSheet", fps: 8, loop: true }),
                [STATES.run]: Object.freeze({ suffix: "RunSheet", fps: 10, loop: true }),
                [STATES.attack]: Object.freeze({ suffix: "AttackSheet", fps: 12, loop: true }),
                [STATES.special]: Object.freeze({ suffix: "SpecialAtkSheet", fps: 10, loop: true }),
                [STATES.die]: Object.freeze({ suffix: "DieSheet", fps: 12, loop: false }),
            }),
        }),
    }),
});

export const ENEMY_SPRITE_STATES = STATES;

export function resolveEnemySpriteId(enemyType, variant) {
    const t = String(enemyType || "");
    if (t === "walker") {
        const v = String(variant || "walker");
        if (ENEMY_SPRITE_CONFIG.enemies[v]) return v;
        return "walker";
    }
    return t;
}

export function getEnemySpriteDef(enemyType, variant) {
    const id = resolveEnemySpriteId(enemyType, variant);
    return ENEMY_SPRITE_CONFIG.enemies[id] || null;
}

