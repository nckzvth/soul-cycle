// Color System Spec: Identity Palette + Production Rules (v5)
// Canonical reference: `notes/references/color-system-spec.md`
export const TOKENS_V5 = Object.freeze({
    player: Object.freeze({
        p1GlowSpec: "#6ceded",
        p2Primary: "#6cb9c9",
        p3Secondary: "#6d85a5",
        p4Guard: "#6e5181",
    }),
    enemy: Object.freeze({
        e1Elite: "#6f1d5c",
        e2Standard: "#4f1446",
        e3Swarm: "#2e0a30",
        e4Abyss: "#0d001a",
    }),
    neutrals: Object.freeze({
        ink: "#0c0d12",
        nearBlack: "#141623",
        slate: "#25283a",
        iron: "#3b3f52",
        dust: "#6e7386",
        bone: "#d2c8bc",
        parchment: "#efe6d8",
    }),
    world: Object.freeze({
        rotwood: "#4a2f2a",
        rust: "#8a5a3c",
        graveMoss: "#4a6a4e",
        deepStone: "#1f2230",
        midStone: "#34384b",
    }),
    fx: Object.freeze({
        bloodDeep: "#3d0b18",
        bloodMid: "#7a1b2e",
        bloodBright: "#b3424a",

        ember: "#c06a3a",
        emberDeep: "#7e3b22",

        toxic: "#8bc45a",
        toxicDeep: "#3d5a2d",

        arcaneDeep: "#2a6674",
    }),
});

// Back-compat + convenience aliases.
// Prefer consuming specific v5 tokens (player/enemy/ui/fx) by semantic intent.
export const PALETTE = Object.freeze({
    // Neutrals / UI foundation
    ink: TOKENS_V5.neutrals.ink,
    abyss: TOKENS_V5.neutrals.nearBlack,
    slate: TOKENS_V5.neutrals.slate,
    iron: TOKENS_V5.neutrals.iron,
    dust: TOKENS_V5.neutrals.dust,
    bone: TOKENS_V5.neutrals.bone,
    parchment: TOKENS_V5.neutrals.parchment,

    // World materials
    rotwood: TOKENS_V5.world.rotwood,
    rust: TOKENS_V5.world.rust,
    moss: TOKENS_V5.world.graveMoss,
    deepStone: TOKENS_V5.world.deepStone,
    midStone: TOKENS_V5.world.midStone,

    // Ownership identity
    p1: TOKENS_V5.player.p1GlowSpec,
    p2: TOKENS_V5.player.p2Primary,
    p3: TOKENS_V5.player.p3Secondary,
    p4: TOKENS_V5.player.p4Guard,
    e1: TOKENS_V5.enemy.e1Elite,
    e2: TOKENS_V5.enemy.e2Standard,
    e3: TOKENS_V5.enemy.e3Swarm,
    e4: TOKENS_V5.enemy.e4Abyss,

    // FX palette
    bloodDeep: TOKENS_V5.fx.bloodDeep,
    bloodMid: TOKENS_V5.fx.bloodMid,
    bloodBright: TOKENS_V5.fx.bloodBright,
    ember: TOKENS_V5.fx.ember,
    emberDeep: TOKENS_V5.fx.emberDeep,
    toxic: TOKENS_V5.fx.toxic,
    toxicDeep: TOKENS_V5.fx.toxicDeep,
    arcaneDeep: TOKENS_V5.fx.arcaneDeep,

    // Legacy names (minimize churn while refactoring call sites)
    blood: TOKENS_V5.fx.bloodMid,
    cyan: TOKENS_V5.player.p2Primary,
    teal: TOKENS_V5.player.p3Secondary,
    violet: TOKENS_V5.player.p4Guard,
    chartreuse: TOKENS_V5.fx.toxic,
});

export const SEMANTIC_COLORS = Object.freeze({
    uiText: PALETTE.parchment,
    uiMuted: PALETTE.dust,
    uiPanel: PALETTE.abyss,
    uiBorder: PALETTE.iron,
    uiAccent: PALETTE.ember,

    uiDisabled: PALETTE.dust,
    xp: PALETTE.p3,

    playerCore: PALETTE.p2,
    playerSpec: PALETTE.p1,
    playerSupport: PALETTE.p3,
    playerGuard: PALETTE.p4,

    enemyCore: PALETTE.e2,
    enemyDeep: PALETTE.e3,
    enemyElite: PALETTE.e1,

    rarity: Object.freeze({
        common: PALETTE.dust,
        uncommon: PALETTE.p3,
        rare: PALETTE.p2,
        epic: PALETTE.p4,
        legendary: PALETTE.ember,
    }),
});
