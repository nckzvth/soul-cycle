import { resolveColor } from "../render/Color.js";

function deepGet(obj, path) {
    if (!path) return obj;
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== "object") return null;
        cur = cur[p];
    }
    return cur ?? null;
}

/**
 * Centralized role → token wiring for any system that uses color.
 *
 * Edit this file to re-wire meanings (e.g. enemy thrall from `e3` → `e2`)
 * without hunting call sites. To tweak actual hex values, edit `src/data/Palette.js`.
 *
 * Entries can be:
 * - a palette key string, e.g. "e2"
 * - { token: "e2", alpha: 0.8 }
 */
export const COLOR_TUNING = Object.freeze({
    fx: Object.freeze({
        flash: "parchment",
        ink: "ink",
        uiText: "parchment",
        uiMuted: "dust",
        uiAccent: "ember",
        ember: "ember",
        emberDeep: "emberDeep",
        arcaneDeep: "arcaneDeep",
        toxic: "toxic",
        toxicDeep: "toxicDeep",
        bone: "bone",
        slate: "slate",
        abyss: "abyss",
        bloodDeep: "bloodDeep",
        bloodMid: "bloodMid",
        bloodBright: "bloodBright",
    }),

    player: Object.freeze({
        core: "p2",
        spec: "p1",
        support: "p3",
        guard: "p4",
        bloodHit: Object.freeze({ token: "bloodBright", alpha: 1 }),
    }),

    enemy: Object.freeze({
        body: Object.freeze({
            standard: "e2",
            elite: "e1",
            deep: "e3",
        }),
        walker: Object.freeze({
            variant: Object.freeze({
                walker: "e2",
                thrall: "e3",
                brute: "e2",
                cursed: "e1",
            }),
            rootOverlay: Object.freeze({ token: "parchment", alpha: 1 }),
        }),
        charger: Object.freeze({ body: "e2" }),
        spitter: Object.freeze({ body: "e2" }),
        anchor: Object.freeze({
            body: "e3",
            aura: Object.freeze({ token: "e3", alpha: 0.5 }),
        }),
        telegraph: Object.freeze({
            fill: Object.freeze({ token: "e2", alpha: 0.5 }),
            stroke: Object.freeze({ token: "parchment", alpha: 0.7 }),
        }),
        projectile: Object.freeze({
            standard: "e2",
            spitter: "toxic",
        }),
    }),

    pickups: Object.freeze({
        soul: Object.freeze({
            tier: Object.freeze({
                1: "p3",
                2: "p2",
                3: "bone",
                4: "ember",
                5: "p4",
            }),
        }),
        phialShard: Object.freeze({
            glow: "p4",
        }),
    }),

    town: Object.freeze({
        background: "slate",
        gate: Object.freeze({
            body: "dust",
            label: "parchment",
        }),
        outfitter: Object.freeze({
            body: "p3",
            label: "parchment",
        }),
        appraiser: Object.freeze({
            body: "p4",
            label: "parchment",
        }),
        dungeonPortal: Object.freeze({
            body: "arcaneDeep",
            label: "parchment",
        }),
        weaponIconAura: Object.freeze({
            hammer: Object.freeze({ token: "ember", alpha: 0.18 }),
            hammerStroke: Object.freeze({ token: "ember", alpha: 0.30 }),
            staff: Object.freeze({ token: "arcaneDeep", alpha: 0.16 }),
            staffStroke: Object.freeze({ token: "arcaneDeep", alpha: 0.28 }),
            pistol: Object.freeze({ token: "p2", alpha: 0.16 }),
            pistolStroke: Object.freeze({ token: "p2", alpha: 0.28 }),
        }),
    }),

    ui: Object.freeze({
        xp: "p3",
        rarity: Object.freeze({
            common: "dust",
            uncommon: "p3",
            rare: "p2",
            epic: "p4",
            legendary: "ember",
        }),
        attributeConfirm: Object.freeze({
            might: Object.freeze({ token: "ember", alpha: 0.75 }),
            alacrity: Object.freeze({ token: "p2", alpha: 0.75 }),
            will: Object.freeze({ token: "arcaneDeep", alpha: 0.75 }),
        }),
    }),

    interactable: Object.freeze({
        placeholderFill: Object.freeze({ token: "p2", alpha: 0.25 }),
        auraFill: Object.freeze({ token: "p2", alpha: 0.22 }),
        auraStroke: Object.freeze({ token: "p2", alpha: 0.35 }),
        promptPanel: Object.freeze({ token: "ink", alpha: 0.72 }),
        promptBorder: Object.freeze({ token: "parchment", alpha: 0.12 }),
        promptText: "parchment",
        promptShadow: Object.freeze({ token: "ink", alpha: 0.65 }),
    }),

    states: Object.freeze({
        field: Object.freeze({
            vignette: "ink",
            bossHpFill: "e1",
            bossHpStroke: "parchment",
            indicator: Object.freeze({
                objective: Object.freeze({ token: "ember", alpha: 0.95 }),
                bounty: Object.freeze({ token: "rust", alpha: 0.95 }),
            }),
        }),
        dungeon: Object.freeze({
            backgroundBoss: "abyss",
            backgroundNormal: "slate",
            frame: "parchment",
            bossHpFill: "e1",
            bossHpStroke: "parchment",
        }),
    }),
});

export function getColorRole(path) {
    return deepGet(COLOR_TUNING, path);
}

export function color(path, alphaOverride = null) {
    const entry = getColorRole(path);
    if (entry == null) return null;

    if (typeof entry === "string") {
        if (typeof alphaOverride === "number") return resolveColor({ token: entry, alpha: alphaOverride });
        return resolveColor(entry);
    }

    if (typeof entry === "object") {
        const token = entry.token ?? entry.color ?? null;
        const alpha = typeof alphaOverride === "number" ? alphaOverride : (entry.alpha ?? null);
        if (typeof alpha === "number") return resolveColor({ token, alpha });
        return resolveColor(token);
    }

    return null;
}

export function token(path) {
    const entry = getColorRole(path);
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") return entry.token ?? entry.color ?? null;
    return null;
}
