export const IMAGE_ASSETS = Object.freeze({
    campfireSheet: "notes/references/campfire-sheet.png",
    hammerIcon: "notes/references/hammer_icon.png",
    pistolIcon: "notes/references/pistol_icon.png",
    staffIcon: "notes/references/staff_icon.png",
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
