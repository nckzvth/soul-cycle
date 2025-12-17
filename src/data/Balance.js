export const BALANCE = {
    progression: {
        field: {
            durationSec: 900,
            dungeonDecisionSec: 30,
        },
        dungeon: {
            durationSec: 300,
            scoreThresholds: [120, 260, 420],
        },
        xp: {
            // Goal: ~level 10 around 15 minutes with normal play.
            reqBase: 15,
            reqGrowth: 1.27,
            basePerKill: 0.28,
            // Early field pacing: start faster then taper into the main curve.
            earlyFieldMultStart: 1.45,
            earlyFieldMultEnd: 1.0,
            earlyFieldMultDurationSec: 240,
            // Diminish XP when kill rate is very high to break the spawn→XP feedback loop.
            killRateThreshold: 2.5, // kills/sec before diminishing
            diminishK: 0.18,
            diminishP: 1.3,
            minMult: 0.2,
        },
        enemyTier: {
            base: 1,
            perWave: 1.0,
            perMinute: 0.75,
            dungeonBase: 10,
            dungeonPerMinute: 1.5,
        },
        director: {
            // Limit how far kill-rate can push desired alive enemies over baseline.
            desiredBonusCap: 40,
            killRateExponent: 0.6,
        },
        healOrbs: {
            eliteDropChance: 0.20,
            nonEliteDropChance: 0.01,
            healPctMaxHp: 0.20,
            highHpThreshold: 0.99,
            highHpChanceMult: 0.15,
        },
        soulMagnet: {
            durationSec: 6.0,
            attractRadius: 5000,
            attractSpeedMult: 3.0,
            eliteDropChance: 0.0075,
        },
        indicators: {
            // World-space ring around the player.
            objectiveRingRadius: 120,
            bountyRingRadius: 150,
            // Hide/fade when close enough.
            objectiveShowDistance: 250,
            bountyShowDistance: 300,
            // Smoothing (seconds to converge).
            positionSmoothTime: 0.12,
            rotationSmoothTime: 0.10,
            fadeSmoothTime: 0.18,
            // Animation (keep at 0 for clear compass-style indicators).
            bobAmplitude: 0,
            bobSpeed: 0,
            pulseAmount: 0,
            pulseSpeed: 0,
            // If target is on-screen, reduce alpha to declutter.
            onScreenFadeMult: 0.25,
        },
        fieldObjectives: {
            // Spawn events during Field waves (not during the Field Boss gate).
            shrine: {
                cooldownSec: 75,
                spawnMinSec: 35,
                spawnChancePerRoll: 0.85,
                // Distance ring around player.
                minSpawnRadius: 420,
                maxSpawnRadius: 680,
                // Effect
                hpSacrificePctMax: 0.10,
                powerMult: 1.30,
                durationSec: 20,
            },
            chest: {
                cooldownSec: 120,
                spawnMinSec: 50,
                spawnChancePerRoll: 0.20,
                minSpawnRadius: 450,
                maxSpawnRadius: 750,
                // Reward
                bonusSouls: 25,
                bonusPhialShards: 2,
            },
        },
        fieldEvents: {
            bounty: {
                cooldownSec: 70,
                spawnMinSec: 40,
                spawnChancePerRoll: 0.55,
                minSpawnRadius: 420,
                maxSpawnRadius: 780,
                durationSec: 20,
                // Encounter
                pattern: "orbitingSpitters",
                orbitingSpitters: {
                    ringCount: 8,
                    ringRadius: 220,
                    angularSpeed: 1.35, // radians/sec
                    shootIntervalSec: 2.4,
                },
                // Rewards (spawned at bounty center on success)
                rewardHealthOrbs: 1,
                rewardPhialShards: 1,
                rewardSoulOrbs: 18,
            },
            chargerPack: {
                // If a charger would spawn, chance to spawn a formation pack instead.
                chanceOnChargerSpawn: 1.0,
                cooldownSec: 60,
                maxActivePacks: 1,
                size: 6,
                // Formation behavior
                formSpeed: 520,
                stiffness: 7.0,
                // Charge cadence
                chargeIntervalSec: 3.2,
                windupDurationSec: 0.65,
                chargeDurationSec: 0.65,
                chargeSpeed: 820,
                // Readability gates
                maxChargeStartDistance: 650,
                maxChargeRange: 520,
            },
        },
        softCaps: {
            attackSpeed: 3.0,
            powerMult: 3.0,
            area: 2.5,
            chainRangeMult: 2.0,
            pierce: 6,
            bounce: 4,
        },
        phials: {
            maxStacks: 6,
        },
    },

    perks: {
        soulBlast: {
            vfx: {
                procColor: "rgba(215, 196, 138, 0.9)",
                textColor: "rgba(215, 196, 138, 0.95)",
                ringColor: "rgba(215, 196, 138, 0.8)",
                ringColorTier2: "rgba(255, 140, 60, 0.85)",
                procBurstCount: 12,
                procBurstSpeed: 140,
                procBurstSize: 3.0,
                procBurstLife: 0.35,
                burnVfxColor: "rgba(255, 120, 0, 0.85)",
            },
        },
        tempest: {
            vfx: {
                procColor: "rgba(120, 255, 220, 0.85)",
                textColor: "rgba(120, 255, 220, 0.95)",
                bodyColor: "rgba(120, 255, 220, 0.95)",
                splitColor: "rgba(120, 255, 220, 0.8)",
                trailColor: "rgba(120, 255, 220, 0.35)",
                trailInterval: 0.06,
                trailCount: 1,
                trailSpeed: 0,
                trailSize: 2.2,
                trailLife: 0.18,
                splitBurstCount: 12,
                splitBurstSpeed: 160,
                splitBurstSize: 2.6,
                splitBurstLife: 0.25,
            },
        },
        orbitalWisp: {
            vfx: {
                procColor: "rgba(160, 235, 255, 0.85)",
                textColor: "rgba(160, 235, 255, 0.95)",
                bodyColor: "rgba(160, 235, 255, 0.9)",
                trailColor: "rgba(160, 235, 255, 0.35)",
                trailInterval: 0.05,
                trailCount: 1,
                trailSpeed: 20,
                trailSize: 2.0,
                trailLife: 0.22,
                lightningColor: "rgba(160, 235, 255, 0.95)",
                lightningBurstCount: 8,
                lightningBurstSpeed: 120,
                lightningBurstSize: 2.6,
                lightningBurstLife: 0.22,
            },
        },
    },

    player: {
        // Core stats
        baseHp: 80,
        hpPerLevel: 5,
        baseDmg: 5,
        baseCrit: 0.05,
        baseCritMult: 1.5,
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
        perkThreshold: 25,
        perkThreshold2: 50,

        // Perk proc chance (on-attack)
        perkProcBaseChance: 0.05,
        perkProcPerPickChance: 0.01, // +1% per +5 beyond threshold
        perkProcSoftCap: 0.35,
        perkProcSoftCapGain: 0.20, // asymptote adds up to +20% beyond soft cap
        perkProcSoftCapK: 0.35,
        perkWillMaxWisps: 3,

        // Dash
        baseDashCharges: 2,
        dashRechargeTime: 3.0, // Seconds per charge
        dashDuration: 0.2,
        dashSpeed: 800,
        walkBaseSpeed: 180,
        rootImmunityDuration: 1.0,

        // Reroll
        baseRerollCost: 50,
        rerollCostMultiplier: 1.25,

        // Weapon timings
        pistolBaseRate: 0.4,
        staffRateMult: 1.5,

        // Weapon configs
        hammer: {
            startRadius: 20,
            maxRadius: 120,
            radialSpeed: 180,
            angularSpeed: -7.0,
            hitRadius: 12,
            cooldown: 0.6,
            damageMult: 3,
            spinTime: 3.0,
            maxHammers: 3
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
        soulBlastBurnDamageMult: 0.25,
        staticMineDamageMult: 1.0,
        wispDamageMult: 1.0,
        soulTempestDamageMult: 1.2,
        soulTempestSplitDamageMult: 0.55,
        orbitalWispDamageMult: 0.7,
        orbitalWispLightningDamageMult: 0.55,

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
                duration: 180,
                baseAlive: 3, // Reduced from 10
                bufferSeconds: 3,
                maxAlive: 50,
                weights: [{ type: 'walker', weight: 100, soulValue: 1 }],
                events: [
                     { type: 'walker', count: 10, rate: 1, delay: 10 }
                ]
            },
            { // Wave 2
                duration: 180,
                baseAlive: 8, // Reduced from 15
                bufferSeconds: 4,
                maxAlive: 80,
                weights: [{ type: 'walker', weight: 60, soulValue: 1 }, { type: 'charger', weight: 40, soulValue: 2 }],
                events: [
                    { type: 'charger', count: 15, rate: 1, delay: 20 }
                ]
            },
            { // Wave 3
                duration: 180,
                baseAlive: 12, // Reduced from 20
                bufferSeconds: 5,
                maxAlive: 100,
                weights: [{ type: 'walker', weight: 50, soulValue: 1 }, { type: 'charger', weight: 30, soulValue: 2 }, { type: 'spitter', weight: 20, soulValue: 2 }],
                events: [
                    { type: 'spitter', count: 10, rate: 0.5, delay: 15 }
                ]
            },
            { // Wave 4
                duration: 180,
                baseAlive: 16, // Reduced from 25
                bufferSeconds: 5,
                maxAlive: 120,
                weights: [{ type: 'walker', weight: 40, soulValue: 1 }, { type: 'charger', weight: 30, soulValue: 2 }, { type: 'spitter', weight: 20, soulValue: 2 }, { type: 'anchor', weight: 10, soulValue: 5 }],
                events: [
                    { type: 'anchor', count: 5, rate: 0.2, delay: 10 }
                ]
            },
            { // Wave 5
                duration: 180,
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

    fieldBoss: {
        hp: 3500,
        radius: 34,
        phase1: { attackInterval: 2.0, projectileCount: 10, projectileSpeed: 220, projectileDamage: 12 },
        phase2: { attackInterval: 1.2, projectileCount: 18, projectileSpeed: 240, projectileDamage: 14 }
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
        soulTempest: { life: 3.0, speed: 300, hitRadius: 16 },
        soulTempestSplit: { life: 2.0, speed: 360, hitRadius: 14 },
        orbitalWisp: { life: 3.0, orbitRadius: 52, angularSpeed: 7.5, hitRadius: 16 },
        perkLightning: { range: 250, maxChains: 2 },
        soulBlastBurn: { duration: 2.0, tickInterval: 1.0 },
        hazard: { life: 2, damage: 10 }
    },

    pickups: {
        loot: { pickupRadius: 30 },
        soul: { pickupRadius: 30, extendedPickupRadius: 150, attractionSpeed: 5, baseSoulValue: 1, magnetism: 5 }
    },

    skills: {
        rarityWeights: { common: 70, uncommon: 23, rare: 6, epic: 1 },

        pistol: {
            windupGainPerSecond: 0.8,
            windupDecayPerSecond: 1.2,
            windupAttackSpeedBonus: 1.2,
            // Cyclone is a proc: chance on pistol bullet hit to burst a 360° spray.
            cycloneProcChanceBase: 0.01,
            cycloneProcWindupBonus: 1.5,
            cycloneProcIcd: 0.2,
            cycloneProcWindow: 0.5,
            // Cyclone burst firing pattern: 360° spray.
            cycloneShotCount: 8,

            // Gust Spray: triggered on cyclone proc.
            gustRadius: 70,

            hexDuration: 3.0,
            hexMaxStacks: 5,
            soulPressureWindupOnHit: 0.08,
            soulPressureCycloneExtend: 0.08,
            debtPopRadius: 90,
            vortexChainRadius: 220,
            vortexChainBudget: 2,
            vortexBudgetRegenPerSecond: 1.0,

            vfx: {
                cycloneBurstColor: "rgba(190, 240, 255, 0.9)",
                cycloneBurstCount: 18,
                cycloneTextColor: "rgba(190, 240, 255, 0.95)",
                cooldownTextColor: "rgba(200, 200, 200, 0.95)",

                hexColor: "rgba(190, 120, 255, 0.85)",
                hexInterval: 0.4,
                hexCount: 1,
                hexCountPerStack: 0.35,
                hexSize: 2.3,
                hexLife: 0.2,
                hexApplyBurstCount: 3,
                hexApplyBurstSpeed: 110,
            },
        }
        ,
        hammer: {
            burnDuration: 2.0,
            burnTickInterval: 1.0,
            burnCoeff: 0.4,

            trailDuration: 1.2,
            trailTickInterval: 0.25,
            trailRadius: 55,
            trailCoeff: 0.25,

            igniteStacks: 4,
            igniteInternalCooldown: 1.0,
            igniteCoeff: 0.8,

            pyreBurstRadius: 100,
            pyreBurstCoeff: 1.0,

            soulBrandDuration: 2.0,
            soulBrandRadius: 90,
            soulBrandCoeff: 1.0,

            forgeHeatGainPerSecond: 0.6,
            forgeHeatDecayPerSecond: 0.9,
            forgeHeatMax: 6,
            forgeHeatCoeffPerStack: 0.06,

            vfx: {
                burnColor: "rgba(255, 120, 0, 0.85)",
                burnInterval: 0.28,
                burnCount: 1,
                burnCountPerStack: 0.45,
                burnSize: 2.4,
                burnLife: 0.22,
                burnApplyBurstCount: 4,
                burnApplyBurstSpeed: 120,

                trailColor: "rgba(255, 120, 0, 0.6)",
                trailInterval: 0.12,
                trailCount: 2,
                trailSize: 2.0,
                trailLife: 0.16,

                igniteColor: "rgba(255, 190, 80, 0.9)",
                igniteBurstCount: 16,
                igniteBurstSpeed: 170,

                pyreColor: "rgba(255, 80, 0, 0.9)",
                pyreBurstCount: 22,
                pyreBurstSpeed: 220,

                soulBrandColor: "rgba(190, 120, 255, 0.85)",
                soulBrandInterval: 0.28,
                soulBrandCount: 1,
                soulBrandSize: 2.4,
                soulBrandLife: 0.22,
                soulBrandApplyBurstCount: 4,
                soulBrandApplyBurstSpeed: 120,
                soulBrandPopBurstCount: 18,
                soulBrandPopBurstSpeed: 190,

                heatColor: "rgba(255, 120, 0, 0.65)",
                heatInterval: 0.14,
                heatBaseCount: 1,
                heatCountPerHeat: 0.5,
                heatSize: 2.0,
                heatLife: 0.16,
                heatRadius: 20,
            },
        }
        ,
        staff: {
            markDuration: 2.0,
            markMaxStacks: 3,

            hexDuration: 3.0,
            hexMaxStacks: 4,
            // Bonus damage scaling when hitting hexed targets.
            hexZapCoeffBonusPerStack: 0.08,

            // Voltage Build: gain on successful zaps; decays over time; boosts zap damage.
            voltageGainPerHit: 0.35,
            voltageMax: 6,
            voltageDecayPerSecond: 0.9,
            voltageCoeffPerStack: 0.03,

            // Soul Circuit: temporary "Current" buff duration and effects.
            currentDuration: 2.5,
            currentRangeMult: 0.25,
            currentOverchargeCoeffMult: 0.25,

            // Contract Conduit: links created on overload, consumed by next cast.
            linkDuration: 2.0,
            linkRadius: 240,

            vfx: {
                markColor: "rgba(160, 235, 255, 0.95)",
                markInterval: 0.3,
                markCount: 1,
                markCountPerStack: 1,
                markSize: 2.5,
                markLife: 0.22,
                markApplyBurstCount: 4,
                markApplyBurstSpeed: 130,

                hexColor: "rgba(190, 120, 255, 0.9)",
                hexInterval: 0.35,
                hexCount: 1,
                hexCountPerStack: 0.5,
                hexSize: 2.5,
                hexLife: 0.22,
                hexApplyBurstCount: 4,
                hexApplyBurstSpeed: 110,

                linkColor: "rgba(120, 255, 220, 0.9)",
                linkInterval: 0.25,
                linkCount: 1,
                linkSize: 2.4,
                linkLife: 0.2,
                linkApplyBurstCount: 3,
                linkApplyBurstSpeed: 100,

                overloadColor: "rgba(160, 235, 255, 0.9)",
                overloadBurstCount: 14,

                relayColor: "rgba(160, 235, 255, 0.9)",
                relayBurstCount: 10,
                overchargeColor: "rgba(240, 240, 140, 0.9)",
                overchargeBurstCount: 10,

                currentColor: "rgba(160, 235, 255, 0.8)",
                currentInterval: 0.12,
                currentCount: 1,
                currentSize: 2.2,
                currentLife: 0.18,
                currentRadius: 22,
                currentBurstColor: "rgba(160, 235, 255, 0.95)",
                currentBurstCount: 16,
                currentTextColor: "rgba(160, 235, 255, 0.95)",

                voltageColor: "rgba(240, 240, 140, 0.85)",
                voltageInterval: 0.16,
                voltageCount: 1,
                voltageCountPerStack: 0.35,
                voltageSize: 2.0,
                voltageLife: 0.16,
                voltageRadius: 18,
            },
        }
    }
};
