export const BALANCE = {
    player: {
        // Core stats
        baseHp: 80,
        hpPerLevel: 5,
        baseDmg: 5,
        baseCrit: 0.05,
        baseRegen: 0.5,
        baseSoulGain: 1,
        baseMove: 0,
        baseSpd: 0,
        baseKb: 0,
        baseArea: 1,
        baseMagnetism: 15,

        // Attribute scaling
        dmgPerMight: 0.5,
        kbPerMight: 3,
        spdPerAlacrity: 0.03,
        movePerAlacrity: 0.02,
        areaPerWill: 0.05,
        soulGainPerWill: 0.1,

        // Perk thresholds
        perkThreshold: 20,

        // Dash
        baseDashCharges: 2,
        dashRechargeTime: 3.0, // Seconds per charge
        dashDuration: 0.2,
        dashSpeed: 800,
        walkBaseSpeed: 180,
        rootImmunityDuration: 1.0,

        // Weapon timings
        pistolBaseRate: 0.4,
        staffRateMult: 1.5,

        // Weapon configs
        hammer: {
            startRadius: 20,
            maxRadius: 350,
            radialSpeed: 180,
            angularSpeed: -7.0,
            hitRadius: 12,
            cooldown: 0.6,
            damageMult: 0.6
        },
        pistol: {
            damageMult: 3.2
        },
        staff: {
            damageMult: 3.2
        },

        // Projectile speeds
        pistolSpeed: 700,
    },

    combat: {
        // Global damage multipliers
        playerDamageMult: 1.0,
        buffedEnemyDamageTakenMult: 0.5,
        knockbackBase: 50,

        // Skill multipliers
        orbitDamageMult: 0.6,
        shockwaveDamageMult: 2.0,
        staticMineDamageMult: 1.0,
        wispDamageMult: 1.0,

        // Zap settings
        zapChainRange: 250,
    },

    waves: {
        // Soul gauge
        baseSoulGaugeThreshold: 20,
        soulGaugeThresholdPerWave: 5,

        // Spawn & caps
        waveDuration: 60,
        hardEnemyCap: 400,
        baseWaveEnemyCap: 80,
        enemyCapPerWave: 80,
        spawnRadius: 600,

        // Spawn pacing within a wave
        baseSpawnInterval: 1.2,
        minSpawnInterval: 0.25,
        baseBatchSize: 2,
        batchSizeRamp: 4
    },

    enemies: {
        walker: { baseHp: 200, hpPerLevel: 5, speed: 1500 },
        charger: { baseHp: 50, hpPerLevel: 5, speed: 2000, dashSpeed: 800 },
        spitter: { baseHp: 150, hpPerLevel: 5, speed: 500, retreatDistance: 300 },
        anchor:  { baseHp: 500, hpPerLevel: 10, speed: 40, auraRadius: 150 },
        baseHp: 10,
        baseSpeed: 100,
        baseRadius: 12,
        baseSoulValue: 1,
        eliteHpMult: 2.0,
        eliteRadiusMult: 1.5,
        eliteSoulMult: 3.0
    },

    boss: {
        hp: 2000,
        radius: 30,
        phase1: { attackInterval: 2, projectileCount: 8, projectileSpeed: 200, projectileDamage: 10 },
        phase2: { attackInterval: 1, projectileCount: 16, projectileSpeed: 200, projectileDamage: 10 }
    },

    projectiles: {
        enemy: { speed: 200, life: 3, damage: 8, buffedDamage: 12 },
        shockwave: { speed: 400, life: 0.5 },
        rootWave: { speed: 400, life: 0.5, duration: 2 },
        staticMine: { life: 3.0, radius: 25, damageMultiplier: 3 },
        wisp: { life: 4.0, speed: 350, damageMultiplier: 1.5 },
        hazard: { life: 2, damage: 10 }
    },

    pickups: {
        loot: { pickupRadius: 30 },
        soul: { pickupRadius: 30, extendedPickupRadius: 150, attractionSpeed: 5, baseSoulValue: 1, magnetism: 5 }
    }
};