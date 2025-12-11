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

        // Attribute scaling
        dmgPerMight: 0.5,
        kbPerMight: 3,
        spdPerAlacrity: 0.03,
        movePerAlacrity: 0.02,
        areaPerWill: 0.05,
        soulGainPerWill: 0.1,

        // Perk thresholds
        perkThreshold: 20,

        // Stamina / movement
        stamRegenPerSec: 15,
        dashCost: 20,
        dashDuration: 0.2,
        dashSpeed: 800,
        walkBaseSpeed: 180,

        // Weapon timings
        pistolBaseRate: 0.4,   // lower = slower, you already use 0.4 / (1+spd)
        staffRateMult: 1.5,    // staff is 1.5x slower currently

        // Hammer behaviour
        hammerMaxRadius: 100,
        hammerExpandSpeed: 300,
        hammerDecaySpeed: 400,

        // Projectile speeds
        pistolSpeed: 700,
    },

    combat: {
        // Global damage multipliers (currently neutral)
        playerDamageMult: 1.0,

        // How much less damage buffed enemies take
        buffedEnemyDamageTakenMult: 0.5,

        // Knockback base
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
        maxEnemies: 30,
        baseSpawnRate: 1.0,
        spawnRatePerWave: 0.5,

        // Soul gauge
        baseSoulGaugeThreshold: 10,   // wave 1
        soulGaugeThresholdPerWave: 10 // waveIndex * this => current behaviour
    },

    enemies: {
        // These mirror what you already do in subclasses
        walker: { baseHp: 200, hpPerLevel: 5, speed: 1500 },
        charger: { baseHp: 50, hpPerLevel: 5, speed: 2000, dashSpeed: 800 },
        spitter: { baseHp: 150, hpPerLevel: 5, speed: 500, retreatDistance: 300 },
        anchor:  { baseHp: 500, hpPerLevel: 10, speed: 40, auraRadius: 150 },

        // Default/elite scaling from Enemy base class
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
        phase1: {
            attackInterval: 2,
            projectileCount: 8,
            projectileSpeed: 200,
            projectileDamage: 10,
        },
        phase2: {
            attackInterval: 1,
            projectileCount: 16,
            projectileSpeed: 200,
            projectileDamage: 10,
        }
    },

    projectiles: {
        enemy: {
            speed: 200,
            life: 3,
            damage: 8,
            buffedDamage: 12,
        },
        shockwave: {
            speed: 400,
            life: 0.5,
        },
        rootWave: {
            speed: 400,
            life: 0.5,
            duration: 2,
        },
        staticMine: {
            life: 3.0,
            radius: 25,
            damageMultiplier: 3,
        },
        wisp: {
            life: 4.0,
            speed: 350,
            damageMultiplier: 1.5,
        },
        hazard: {
            life: 2,
            damage: 10,
        }
    },

    pickups: {
        loot: {
            pickupRadius: 30,
        },
        soul: {
            pickupRadius: 30,
            extendedPickupRadius: 150,
            attractionSpeed: 5,
            baseSoulValue: 1,
        }
    }
};