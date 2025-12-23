export const IMAGE_ASSETS = Object.freeze({
    campfireSheet: "notes/references/campfire-sheet.png",
    hammerIcon: "notes/references/hammer_icon.png",
    pistolIcon: "notes/references/pistol_icon.png",
    staffIcon: "notes/references/staff_icon.png",
    fieldForestGroundDraft: "notes/references/field_forest-ground-draft.png",

    // Player (directional 8x15 @ 64x64)
    playerIdleSheet: "notes/references/Sprites/Player/PlayerIdle.png",
    playerRunSheet: "notes/references/Sprites/Player/PlayerRun.png",
    playerAttackSheet: "notes/references/Sprites/Player/PlayerAttack5.png",
    playerRunBackwardsSheet: "notes/references/Sprites/Player/PlayerRunBackwards.png",
    playerStrafeLeftSheet: "notes/references/Sprites/Player/PlayerStrafeLeft.png",
    playerStrafeRightSheet: "notes/references/Sprites/Player/PlayerStrafeRight.png",
    playerDieSheet: "notes/references/Sprites/Player/PlayerDie.png",

    // Enemy (directional 8x8 @ 64x64)
    enemyWalkerIdleSheet: "notes/references/Sprites/Enemy/WalkerIdle.png",
    enemyWalkerRunSheet: "notes/references/Sprites/Enemy/WalkerRun.png",
    enemyWalkerAttackSheet: "notes/references/Sprites/Enemy/WalkerAttack.png",
    enemyWalkerDieSheet: "notes/references/Sprites/Enemy/WalkerDie.png",

    enemyThrallIdleSheet: "notes/references/Sprites/Enemy/ThrallIdle.png",
    enemyThrallRunSheet: "notes/references/Sprites/Enemy/ThrallRun.png",
    enemyThrallAttackSheet: "notes/references/Sprites/Enemy/ThrallAttack.png",
    enemyThrallDieSheet: "notes/references/Sprites/Enemy/ThrallDie.png",

    enemyCursedIdleSheet: "notes/references/Sprites/Enemy/CursedIdle.png",
    enemyCursedRunSheet: "notes/references/Sprites/Enemy/CursedRun.png",
    enemyCursedAttackSheet: "notes/references/Sprites/Enemy/CursedAttack.png",
    enemyCursedDieSheet: "notes/references/Sprites/Enemy/CursedDie.png",

    enemyBruteIdleSheet: "notes/references/Sprites/Enemy/BruteIdle.png",
    enemyBruteRunSheet: "notes/references/Sprites/Enemy/BruteRun.png",
    enemyBruteAttackSheet: "notes/references/Sprites/Enemy/BruteAttack.png",
    enemyBruteSpecialAtkSheet: "notes/references/Sprites/Enemy/BruteSpecialAtk.png",
    enemyBruteDieSheet: "notes/references/Sprites/Enemy/BruteDie.png",

    enemyChargerIdleSheet: "notes/references/Sprites/Enemy/ChargerIdle.png",
    enemyChargerRunSheet: "notes/references/Sprites/Enemy/ChargerRun.png",
    enemyChargerAttackSheet: "notes/references/Sprites/Enemy/ChargerAttack.png",
    enemyChargerSpecialAtkSheet: "notes/references/Sprites/Enemy/ChargerSpecialAtk.png",
    enemyChargerDieSheet: "notes/references/Sprites/Enemy/ChargerDie.png",

    enemySpitterIdleSheet: "notes/references/Sprites/Enemy/SpitterIdle.png",
    enemySpitterRunSheet: "notes/references/Sprites/Enemy/SpitterRun.png",
    enemySpitterAttackSheet: "notes/references/Sprites/Enemy/SpitterAttack.png",
    enemySpitterSpecialAtkSheet: "notes/references/Sprites/Enemy/SpitterSpecialAtk.png",
    enemySpitterDieSheet: "notes/references/Sprites/Enemy/SpitterDie.png",

    enemyAnchorIdleSheet: "notes/references/Sprites/Enemy/AnchorIdle.png",
    enemyAnchorRunSheet: "notes/references/Sprites/Enemy/AnchorRun.png",
    enemyAnchorAttackSheet: "notes/references/Sprites/Enemy/AnchorAttack.png",
    enemyAnchorSpecialAtkSheet: "notes/references/Sprites/Enemy/AnchorSpecialAtk.png",
    enemyAnchorDieSheet: "notes/references/Sprites/Enemy/AnchorDie.png",

    // Projectiles
    hammerSpinSheet: "notes/references/Sprites/Projectiles/hammer_spin.png",
});

export const TILED_BACKGROUNDS = Object.freeze({
    fieldForest: Object.freeze({
        imageKey: "fieldForestGroundDraft",
        scale: 2.0,
        pixelArt: true,
        alpha: 1.0,
    }),
});

export const SPRITESHEETS = Object.freeze({
    campfire: Object.freeze({
        imageKey: "campfireSheet",
        frameWidth: 32,
        frameHeight: 64,
        frameCount: 8,
    }),
});

export const ANIMATIONS = Object.freeze({
    campfireIdle: Object.freeze({
        sheetKey: "campfire",
        fps: 10,
        frames: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]),
        loop: true,
    }),
});
