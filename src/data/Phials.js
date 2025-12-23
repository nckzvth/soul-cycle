export const Phials = {
    ashenHalo: {
        id: "ashenHalo",
        icon: "🔆",
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
        icon: "➕",
        name: "Soul Salvo",
        category: "gauge",
        description: "On Soul Gauge fill, gain a short-lived burst of charges that add extra spectral attacks.",
        baseChargesPerFill: 5,
        chargesPerStack: 2,
        // Tuning knobs (best-practice anti-infinite controls):
        // - Charges only granted when none are active
        // - Hard cap to prevent runaway stacking
        // - Duration so it feels like a moment, not a permanent state
        // - ICD so it can't immediately re-trigger
        grantOnlyWhenEmpty: true,
        maxChargesBase: 5,
        maxChargesPerStack: 1,
        durationSec: 5.0,
        procIcdSec: 8.0
    },
    witchglassAegis: {
        id: "witchglassAegis",
        icon: "🛡️",
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
        icon: "✨",
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
        icon: "🩸",
        name: "Tithe Engine",
        category: "killRhythm",
        description: "Every few kills grants a charge. The next hit creates a soul explosion; enemies struck return a brief tithe (heal-over-time + short power).",
        baseKillsRequired: 6,
        killsReductionPerStack: 1,
        minKillsRequired: 3,
        baseExplosionDamage: 5,
        baseExplosionRadius: 80,
        radiusPerStack: 10,

        // Tithe Harvest (Option A):
        // - Explosion damage stays flat (uncapped AoE)
        // - Successful explosions grant a small, capped HoT and a very short power buff
        // - Neither effect refreshes while active (prevents chain overlaps/perma-uptime)
        harvest: {
            hotDurationSec: 3.0,
            hotTickSec: 0.5,
            hotHealPctMaxHpPerTickBase: 0.0075,      // 0.75% max HP per tick
            hotHealPctMaxHpPerTickPerStack: 0.0015,  // +0.15% per extra stack

            // Cap total healing per proc (prevents immortality)
            hotMaxTotalHealPctBase: 0.06,            // 6% max HP per proc
            hotMaxTotalHealPctPerStack: 0.01,        // +1% per extra stack
            hotMaxTotalHealPctCap: 0.10,             // hard cap at 10%

            buffDurationSec: 1.25,
            buffPowerMultAddBase: 0.08,              // +8% power
            buffPowerMultAddPerStack: 0.02,          // +2% per extra stack

            noRefreshWhileActive: true,
        }
    }
};
