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
        // Global settings
        hardEnemyCap: 400,
        minSpawnRadius: 500, // Minimum distance from player
        maxSpawnRadius: 700, // Maximum distance from player
        viewportMargin: 50,  // Extra margin outside camera view to ensure off-screen
        baseSoulGaugeThreshold: 20,
        soulGaugeThresholdPerWave: 5,
        
        // Director settings (Ambient Spawning)
        director: {
            emaAlpha: 0.5, // Smoothing factor for kill rate (higher = more responsive)
            fillRate: 2,   // Max enemies/sec the director can spawn to reach target (Reduced from 10)
        },

        // Per-wave configuration
        sequence: [
            { // Wave 1
                duration: 60,
                baseAlive: 3, // Reduced from 10
                bufferSeconds: 3,
                maxAlive: 50,
                weights: [{ type: 'walker', weight: 100, soulValue: 1 }],
                events: [
                     { type: 'walker', count: 10, rate: 1, delay: 10 }
                ]
            },
            { // Wave 2
                duration: 60,
                baseAlive: 8, // Reduced from 15
                bufferSeconds: 4,
                maxAlive: 80,
                weights: [{ type: 'walker', weight: 60, soulValue: 1 }, { type: 'charger', weight: 40, soulValue: 2 }],
                events: [
                    { type: 'charger', count: 15, rate: 1, delay: 20 }
                ]
            },
            { // Wave 3
                duration: 60,
                baseAlive: 12, // Reduced from 20
                bufferSeconds: 5,
                maxAlive: 100,
                weights: [{ type: 'walker', weight: 50, soulValue: 1 }, { type: 'charger', weight: 30, soulValue: 2 }, { type: 'spitter', weight: 20, soulValue: 2 }],
                events: [
                    { type: 'spitter', count: 10, rate: 0.5, delay: 15 }
                ]
            },
            { // Wave 4
                duration: 60,
                baseAlive: 16, // Reduced from 25
                bufferSeconds: 5,
                maxAlive: 120,
                weights: [{ type: 'walker', weight: 40, soulValue: 1 }, { type: 'charger', weight: 30, soulValue: 2 }, { type: 'spitter', weight: 20, soulValue: 2 }, { type: 'anchor', weight: 10, soulValue: 5 }],
                events: [
                    { type: 'anchor', count: 5, rate: 0.2, delay: 10 }
                ]
            },
            { // Wave 5
                duration: 60,
                baseAlive: 20, // Reduced from 30
                bufferSeconds: 6,
                maxAlive: 150,
                weights: [{ type: 'walker', weight: 30, soulValue: 1 }, { type: 'charger', weight: 30, soulValue: 2 }, { type: 'spitter', weight: 20, soulValue: 2 }, { type: 'anchor', weight: 20, soulValue: 5 }],
                events: [
                    { type: 'charger', count: 50, rate: 2, delay: 5 } // Swarm
                ]
            }
        ]
    },

    enemies: {
        walker: { baseHp: 200, hpPerLevel: 5, speed: 750 },
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