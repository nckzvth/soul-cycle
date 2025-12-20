export const PALETTE = Object.freeze({
    ink: "#0c0d12",
    abyss: "#141623",
    slate: "#25283a",
    iron: "#3b3f52",
    dust: "#6e7386",
    bone: "#d2c8bc",
    parchment: "#efe6d8",

    rotwood: "#4a2f2a",
    rust: "#8a5a3c",
    blood: "#6a2430",
    moss: "#4a6a4e",

    teal: "#2f5d63",
    cyan: "#6cc7c2",
    violet: "#4b2b57",

    chartreuse: "#8bc45a",
    ember: "#c06a3a",
});

export const SEMANTIC_COLORS = Object.freeze({
    uiText: PALETTE.parchment,
    uiMuted: PALETTE.dust,
    uiPanel: PALETTE.abyss,
    uiBorder: PALETTE.slate,
    uiAccent: PALETTE.ember,

    playerCore: PALETTE.cyan,
    playerTrim: PALETTE.teal,

    enemyCore: PALETTE.blood,
    enemyAlt: PALETTE.moss,
    elite: PALETTE.chartreuse,

    rarity: Object.freeze({
        common: PALETTE.dust,
        uncommon: PALETTE.teal,
        rare: PALETTE.cyan,
        epic: PALETTE.violet,
        legendary: PALETTE.ember,
    }),
});

