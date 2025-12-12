export const Phials = {
    ashenHalo: {
        id: "ashenHalo",
        name: "Ashen Halo",
        category: "aura",
        description: "Radiate an occult fire field that lightly scorches nearby enemies.",
        baseDamagePerSecond: 4,
        damagePerStack: 2,
        baseRadius: 60,
        radiusPerStack: 8,
    },
    soulSalvo: {
        id: "soulSalvo",
        name: "Soul Salvo",
        category: "gauge",
        description: "On Soul Gauge fill, gain charges that add extra spectral projectiles to your next attacks.",
        baseChargesPerFill: 5,
        chargesPerStack: 2
    },
    witchglassAegis: {
        id: "witchglassAegis",
        name: "Witchglass Aegis",
        category: "defensive",
        description: "Taking damage triggers a brief ward and a short-range soul pulse.",
        baseDamageReduction: 0.25,
        damageReductionPerStack: 0.05,
        baseDuration: 1.0,
        durationPerStack: 0.2,
        pulseBaseDamage: 10,
        pulseDamagePerStack: 4,
        pulseBaseRadius: 70,
        pulseRadiusPerStack: 10,
        internalCooldown: 2.0
    },
    blindingStep: {
        id: "blindingStep",
        name: "Blinding Step",
        category: "movement",
        description: "Dashing through enemies blinds them and eventually burns them over time.",
        baseBlindDuration: 1.0,
        blindDurationPerTwoStacks: 0.2,
        baseBurnDuration: 2.0,
        baseBurnDamagePerSecond: 3,
        burnDamagePerStack: 2,
        dashAffectRadius: 40,
        baseKnockback: 150,
        knockbackPerStack: 20,
        maxKnockback: 400
    },
    titheEngine: {
        id: "titheEngine",
        name: "Tithe Engine",
        category: "killRhythm",
        description: "Every few kills grants a charge. The next hit creates a soul explosion.",
        baseKillsRequired: 6,
        killsReductionPerStack: 1,
        minKillsRequired: 3,
        baseExplosionDamage: 20,
        explosionDamagePerStack: 6,
        baseExplosionRadius: 80,
        radiusPerStack: 10
    }
};