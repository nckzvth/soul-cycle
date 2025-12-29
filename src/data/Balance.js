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
        // Percent of max HP restored on level-up (0 disables healing).
        levelUpHealPctMaxHp: 0,
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

        // Phase 6: meta progression (masteries). Intentionally simple + tunable.
        // XP is earned on run end and distributed 70/30 (weapon primary attribute / phial attributeTags).
        mastery: {
            // Award control
            grantOnForfeit: false,
            recentRunsMax: 20,

            // Performance->XP
            xpBase: 0,
            xpPerKill: 1,
            xpPerReachedLevel: 6,
            xpPerSoulDelta: 0.5,
            fieldCompleteBonus: 40,
            dungeonCompleteBonus: 70,
            dungeonFailedBonus: 10,

            // Level curves (xp required increases per level)
            attributeCurve: { reqBase: 120, reqGrowth: 1.25 },
            weaponCurve: { reqBase: 160, reqGrowth: 1.28 },
        },

        // Tier scaling: data-driven modifiers you can attach to any spawn spec.
        // Current usage: thrall tiers (fodder pressure) via `BALANCE.spawns.*.tier`.
        enemyTiers: {
            t1: { hpBonusPerPlayerLevel: 0, maxBonusHp: 0, eliteHpBonusMult: 1.0 },
            t2: { hpBonusPerPlayerLevel: 6, maxBonusHp: 120, eliteHpBonusMult: 1.0 },
            t3: { hpBonusPerPlayerLevel: 10, maxBonusHp: 220, eliteHpBonusMult: 1.0 },
            t4: { hpBonusPerPlayerLevel: 14, maxBonusHp: 360, eliteHpBonusMult: 1.0 },
        },
    },

    // Phase 6: attribute mastery tuning (node gameplay values).
    // Keep all AttributeMasteryEffectDefs numbers here so logic stays behavior-only.
    mastery: {
        shared: {
            soaked: {
                minDurationSec: 0.05,
                durationDefault: 2.4,
                slowMultDefault: 0.85,
                slowMultClampMin: 0.1,
                slowMultClampMax: 1.0,
                vfx: { interval: 0.35, alpha: 0.32, count: 1, size: 2.2, life: 0.22, radiusAdd: 10 },
            },
            ignite: {
                minDurationSec: 0.1,
                durationDefault: 3.0,
                stacksDefault: 1,
                coeffDefault: 0.05,
                tickInterval: 1.0,
                maxStacks: 20,
                vfx: { interval: 0.45, alpha: 0.35, count: 1, size: 2.2, life: 0.22, radiusAdd: 12 },
            },
        },
        entities: {
            masteryWhirlpool: {
                soakedResistMult: 0.85,
                eliteResistMult: 1.35,
            },
            masteryTentacleSlam: {
                // Impact timing relative to life timer.
                impactAtLifeSec: 0.45,
                // Root-lite durations.
                rootDurationSec: 0.65,
                rootDurationEliteSec: 0.35,
                // Upgraded rider.
                soakedDurationUpgradedSec: 2.2,
            },
            masteryConsecrateZone: {
                // Gameplay
                tickIntervalSec: 0.35,
                igniteDurationSec: 1.8,
                igniteTickIntervalSec: 1.0,
                igniteMaxStacks: 12,
                // Visuals
                alphaDurationDivisorSec: 1.8,
                fillAlpha: 0.16,
                rimAlpha: 0.22,
            },
        },
        attributes: {
            Might: {
                might_01_kindling: { igniteTextChance: 0.7, igniteTextIcd: 0.7 },
                might_02_deepen_ignite: { igniteCoeffMult: 1.35 },
                might_03_hearth_regen: {
                    heatRadius: 210,
                    hearthCapBase: 10,
                    hearthCapAttunedBonus: 4,
                    decayHoldSeconds: 1.2,
                    decayPerSec: 0.9,
                    decayPerSecAttuned: 0.65,
                    healPerSecPerStack: 0.18,
                },
                might_04_press_the_burn: { perTargetIcdSec: 0.6, durationSec: 2.2 },
                might_05a_phoenix_covenant: {
                    cdSec: 4.0,
                    healNonElite: 8,
                    healEliteBonus: 6,
                    healBossBonus: 10,
                    buffDurationSec: 2.5,
                    regenPerSec: 1.4,
                    moveSpeedMult: 1.12,
                },
                might_05b_sanctified_hearth: { cdSec: 3.0, zoneRadius: 70, zoneLifeSec: 1.8, zoneIgniteCoeff: 0.035 },
                might_06_ember_spread: { cdSec: 1.2, radius: 95, radiusAttuned: 120, durationSec: 2.0, coeffMult: 0.75 },
                might_07_flames_of_hearth: { hearthDecayMult: 0.6 },
                might_08_ignite_mastery: { igniteStacksAdd: 1 },
                might_10a_cinderstorm_moment: { cdSec: 10.0, radius: 160, coeffMult: 1.15, durationSec: 3.5, stacks: 3 },
                might_10b_phoenix_rebirth: {
                    cdSec: 30.0,
                    hpPctThreshold: 0.3,
                    healBase: 8,
                    healPerHearth: 2,
                    drDurationSec: 2.0,
                    drMult: 0.75,
                },
            },
            Will: {
                will_01_soak: { soakTextChance: 0.7, soakTextIcd: 0.7, slowMultDefault: 0.86, durationDefault: 2.4 },
                will_02_undertow_drag: { pullMultOnSoaked: 1.35 },
                will_03_lunar_tide: { magnetismBonus: 55, magnetismBonusAttuned: 80 },
                will_04_conductive_water: { hitsRequired: 3, durationSec: 4.0, conductiveTextChance: 0.9, conductiveTextIcd: 0.9 },
                will_05a_whirlpool_curse: {
                    cdSec: 2.0,
                    max: 2,
                    maxMajor: 1,
                    radius: 95,
                    radiusMajor: 135,
                    pullStrength: 42,
                    pullStrengthMajor: 70,
                    lifeSec: 2.6,
                    lifeSecMajor: 3.5,
                },
                will_05b_abyssal_tentacle: { cdSec: 6.0, clusterRadius: 220, radius: 95, radiusUpgraded: 115, lifeSec: 0.65 },
                will_06_high_tide_window: { soakDuration: 3.0, soakSlowMult: 0.82 },
                will_07_tempest_conductor: { cdSec: 1.0, microPullStrength: 26, soakedDuration: 1.4, soakedSlowMult: 0.9 },
                will_08_moonbound_current: { buffDurationSec: 2.5, soakDuration: 3.4, soakSlowMult: 0.78 },
                will_10a_maelstrom: {},
                will_10b_call_of_the_deep: {},
            },
            Alacrity: {
                alac_01_windstep: { moveSpeedMult: 1.03 },
                alac_02_quickhands: { attackSpeedMult: 1.04 },
                alac_03_gust_spacing: { strength: 70, strengthAttuned: 90, radius: 110 },
                alac_04_guided_projectiles: { guidanceLevel: 1 },
                alac_05a_pinball_dash: { chainCount: 3, targetRadius: 220, dashTimerSec: 0.12, endWaveStrength: 120, endWaveRadius: 130 },
                alac_05b_gale_dancer: { maxStacks: 6, durationSec: 2.0, decayPerSec: 3, moveSpeedPerStack: 0.02, attackSpeedPerStack: 0.02 },
                alac_06_extra_charge: { extraCharges: 1, rechargeMultAttuned: 1.12 },
                alac_07_slipstream: { maxStacks: 10, buildPerSec: 4, decayPerSec: 6, movingThreshold: 0.01, moveSpeedPerStack: 0.008 },
                alac_08_windguard: { durationSec: 0.9, damageTakenMult: 0.85 },
                alac_10a_cyclone_break: { requiredMomentumStacks: 5, radius: 150, pushStrength: 140, soakedDuration: 1.6, soakedSlowMult: 0.9 },
                alac_10b_perfect_cadence: { windowSec: 2.0, damageBase: 2, damageCoeff: 0.25 },
            },
            Constitution: {
                con_01_ward_seed: { wardMaxAdd: 18, wardOnlineIcd: 4.0 },
                con_02_stonehide: { damageTakenMult: 0.92 },
                con_03_thorn_marrow: { cdSec: 0.6, multAttuned: 1.25, damageBase: 1, damageCoeff: 0.12, targetRadius: 140 },
                con_04_bone_plating: { hpPctThreshold: 0.75, durationSec: 2.2, damageTakenMult: 0.88 },
                con_05a_wardweaver: { wardPerSec: 4.0, outOfDangerDelaySec: 1.6 },
                con_05b_bone_mirror: { cdSec: 0.9, damageBase: 1, damageCoeff: 0.10, radius: 95 },
                con_06_more_ward: { wardMaxAdd: 12 },
                con_07_splinterburst: { cdSec: 1.0, damageBase: 1, damageCoeff: 0.08, radius: 110, soakedDurationAttuned: 1.2, soakedSlowMultAttuned: 0.92 },
                con_08_granite_oath: { wardPctThreshold: 0.6, damageTakenMult: 0.9 },
                con_10a_fortress_protocol: { cdSec: 18.0, wardRefillPct: 0.75, rootImmunitySec: 1.2 },
                con_10b_break_upon_me: { cdSec: 1.0, damageBase: 1, damageCoeff: 0.18, radius: 160 },
            },
        },
    },

    // Spawn specs: stable IDs for wave composition. Specs can include `{ tier: "tN" }`
    // to apply `BALANCE.progression.enemyTiers` scaling at spawn time.
    spawns: {
        walker: { enemyType: "walker", variant: "walker" },
        thrall: { enemyType: "walker", variant: "thrall" },
        brute: { enemyType: "walker", variant: "brute" },
        cursed: { enemyType: "walker", variant: "cursed" },

        thrall_t1: { enemyType: "walker", variant: "thrall", tier: "t1" },
        thrall_t2: { enemyType: "walker", variant: "thrall", tier: "t2" },
        thrall_t3: { enemyType: "walker", variant: "thrall", tier: "t3" },
        thrall_t4: { enemyType: "walker", variant: "thrall", tier: "t4" },

        charger: { enemyType: "charger" },
        spitter: { enemyType: "spitter" },
        anchor: { enemyType: "anchor" },
    },

    loot: {
        // Drop frequency (Field): prefer reward moments over kill spam.
        dropChances: {
            field: {
                elite: 0.12,      // chance per elite kill
                bounty: 0.50,     // chance per bounty completion
                chest: 1.0,       // chance per chest interaction
                fieldBoss: 1.0,   // guaranteed reward
            },
        },

        // Rarity tables are per-drop (not cumulative). Each table should sum <= 1.
        // Targets (approx): Field legendary is very rare; dungeon boss slightly higher but still rare.
        rarityBySource: {
            field:       { legendary: 0.005, epic: 0.015, rare: 0.10, uncommon: 0.35 },
            fieldElite:  { legendary: 0.006, epic: 0.018, rare: 0.12, uncommon: 0.38 },
            fieldChest:  { legendary: 0.007, epic: 0.020, rare: 0.14, uncommon: 0.45 },
            fieldBounty: { legendary: 0.007, epic: 0.020, rare: 0.14, uncommon: 0.45 },
            fieldBoss:   { legendary: 0.010, epic: 0.030, rare: 0.18, uncommon: 0.50 },
            dungeonBoss: { legendary: 0.012, epic: 0.040, rare: 0.22, uncommon: 0.55 },
        },
    },

	    perks: {
	        soulBlast: {
	            vfx: {
	                // Player-owned hit feedback: impact=P2, confirm/crit=P1, heat=Ember.
	                procColor: { token: "p2", alpha: 0.9 },
	                textColor: { token: "p2", alpha: 0.95 },
	                ringColor: { token: "p2", alpha: 0.8 },
	                ringColorTier2: { token: "ember", alpha: 0.85 },
	                procBurstCount: 12,
	                procBurstSpeed: 140,
	                procBurstSize: 3.0,
	                procBurstLife: 0.35,
	                burnVfxColor: { token: "ember", alpha: 0.85 },
	            },
	        },
	        tempest: {
	            vfx: {
	                procColor: { token: "p2", alpha: 0.85 },
	                textColor: { token: "p2", alpha: 0.95 },
	                bodyColor: { token: "p2", alpha: 0.95 },
	                splitColor: { token: "p2", alpha: 0.8 },
	                trailColor: { token: "p2", alpha: 0.35 },
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
	                procColor: { token: "p2", alpha: 0.85 },
	                textColor: { token: "p2", alpha: 0.95 },
	                bodyColor: { token: "p2", alpha: 0.9 },
	                trailColor: { token: "p2", alpha: 0.35 },
	                trailInterval: 0.05,
	                trailCount: 1,
	                trailSpeed: 20,
	                trailSize: 2.0,
	                trailLife: 0.22,
	                lightningColor: { token: "p1", alpha: 0.95 },
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
        // Constitution scaling (Phase 1): modest max-HP gain per point.
        // Attribute picks grant +5 points, so this is tuned as "per point" (not per pick).
        hpPerConstitution: 0.8,
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
	        repeaterBaseRate: 0.4,
	        staffRateMult: 1.5,

        // Weapon configs
        hammer: {
            startRadius: 20,
            maxRadius: 100,
            radialSpeed: 180,
            angularSpeed: -7.0,
            hitRadius: 12,
            cooldown: 0.6,
            damageMult: 1.5,
            spinTime: 3.0,
            maxHammers: 3
        },
	        repeater: {
	            damageMult: 1.6
	        },
	        staff: {
	            damageMult: 1.6
	        },

        scythe: {
            cooldown: 0.34,
            damageMult: 1.25,
            range: 75,
            comboResetSec: 1.0,
            harvestCooldownExtraSec: 0.12,
        },

	        // Projectile speeds
	        repeaterSpeed: 700,
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
        staffBaseChains: 1,
    },

    waves: {
        // Global settings
        hardEnemyCap: 450,
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
            { // Wave 1 (0:00 - 1:30)
                duration: 90,
                baseAlive: 25,
                baseAliveStart: 0,
                baseAliveRampSec: 80,
                bufferSeconds: 1.5,
                maxAlive: 60,
                fillRate: { start: 0.7, peak: 2.0, end: 1.2, rampUpSec: 70, rampDownSec: 10 },
                weights: [
                    { type: 'thrall_t1', weight: 85, soulValue: 1 },
                    { type: 'walker', weight: 15, soulValue: 1 },
                ],
                events: [
                    { type: 'thrall_t1', count: 12, rate: 1.2, delay: 35 }
                ]
            },
            { // Wave 2 (1:30 - 3:00)
                duration: 90,
                baseAlive: 75,
                baseAliveRampSec: 14,
                bufferSeconds: 4,
                maxAlive: 120,
                fillRate: { start: 5, peak: 12, end: 7, rampUpSec: 18, rampDownSec: 14 },
                weights: [
                    { type: 'thrall_t1', weight: 55, soulValue: 1 },
                    { type: 'thrall_t2', weight: 20, soulValue: 1 },
                    { type: 'walker', weight: 20, soulValue: 1 },
                    { type: 'charger', weight: 5, soulValue: 2 },
                ],
                events: [
                    { type: 'charger', count: 10, rate: 1.5, delay: 25 }
                ]
            },
            { // Wave 3 (3:00 - 4:30) lull
                duration: 90,
                baseAlive: 30,
                baseAliveRampSec: 10,
                bufferSeconds: 4,
                maxAlive: 80,
                fillRate: { start: 3, peak: 6, end: 3, rampUpSec: 12, rampDownSec: 12 },
                weights: [
                    { type: 'walker', weight: 70, soulValue: 1 },
                    { type: 'thrall_t1', weight: 20, soulValue: 1 },
                    { type: 'thrall_t2', weight: 5, soulValue: 1 },
                    { type: 'spitter', weight: 5, soulValue: 2 },
                ],
                events: [
                    { type: 'spitter', count: 6, rate: 0.8, delay: 18 }
                ]
            },
            { // Wave 4 (4:30 - 6:00) density spike
                duration: 90,
                baseAlive: 300,
                baseAliveRampSec: 28,
                bufferSeconds: 6,
                maxAlive: 340,
                fillRate: { start: 6, peak: 22, end: 8, rampUpSec: 25, rampDownSec: 15 },
                weights: [
                    { type: 'thrall_t1', weight: 70, soulValue: 1 },
                    { type: 'thrall_t2', weight: 20, soulValue: 1 },
                    { type: 'thrall_t3', weight: 6, soulValue: 1 },
                    { type: 'walker', weight: 2, soulValue: 1 },
                    { type: 'spitter', weight: 1, soulValue: 2 },
                    { type: 'charger', weight: 1, soulValue: 2 },
                ],
                events: [
                    { type: 'thrall_t1', count: 110, rate: 30, delay: 14 },
                    { type: 'thrall_t2', count: 30, rate: 8, delay: 22 },
                    { type: 'charger', count: 12, rate: 2.0, delay: 35 },
                    { type: 'spitter', count: 10, rate: 1.5, delay: 55 },
                ]
            },
            { // Wave 5 (6:00 - 7:30) lull
                duration: 90,
                baseAlive: 25,
                baseAliveRampSec: 10,
                bufferSeconds: 4,
                maxAlive: 90,
                fillRate: { start: 3, peak: 7, end: 4, rampUpSec: 14, rampDownSec: 12 },
                weights: [
                    { type: 'walker', weight: 75, soulValue: 1 },
                    { type: 'thrall_t1', weight: 10, soulValue: 1 },
                    { type: 'thrall_t2', weight: 5, soulValue: 1 },
                    { type: 'spitter', weight: 8, soulValue: 2 },
                    { type: 'charger', weight: 2, soulValue: 2 },
                ],
                events: [
                    { type: 'walker', count: 24, rate: 4, delay: 10 }
                ]
            },
            { // Wave 6 (7:30 - 9:00)
                duration: 90,
                baseAlive: 50,
                baseAliveRampSec: 12,
                bufferSeconds: 5,
                maxAlive: 120,
                fillRate: { start: 4, peak: 10, end: 6, rampUpSec: 16, rampDownSec: 14 },
                weights: [
                    { type: 'thrall_t1', weight: 30, soulValue: 1 },
                    { type: 'thrall_t2', weight: 25, soulValue: 1 },
                    { type: 'walker', weight: 30, soulValue: 1 },
                    { type: 'brute', weight: 10, soulValue: 2 },
                    { type: 'spitter', weight: 3, soulValue: 2 },
                    { type: 'charger', weight: 2, soulValue: 2 },
                ],
                events: [
                    { type: 'brute', count: 8, rate: 0.8, delay: 40 }
                ]
            },
            { // Wave 7 (9:00 - 10:30)
                duration: 90,
                baseAlive: 75,
                baseAliveRampSec: 12,
                bufferSeconds: 6,
                maxAlive: 150,
                fillRate: { start: 5, peak: 13, end: 8, rampUpSec: 18, rampDownSec: 15 },
                weights: [
                    { type: 'thrall_t1', weight: 22, soulValue: 1 },
                    { type: 'thrall_t2', weight: 24, soulValue: 1 },
                    { type: 'thrall_t3', weight: 6, soulValue: 1 },
                    { type: 'walker', weight: 28, soulValue: 1 },
                    { type: 'brute', weight: 12, soulValue: 2 },
                    { type: 'spitter', weight: 6, soulValue: 2 },
                    { type: 'charger', weight: 2, soulValue: 2 },
                ],
                events: [
                    { type: 'spitter', count: 10, rate: 1.0, delay: 30 }
                ]
            },
            { // Wave 8 (10:30 - 12:00)
                duration: 90,
                baseAlive: 100,
                baseAliveRampSec: 14,
                bufferSeconds: 6,
                maxAlive: 180,
                fillRate: { start: 6, peak: 15, end: 9, rampUpSec: 18, rampDownSec: 15 },
                weights: [
                    { type: 'thrall_t1', weight: 12, soulValue: 1 },
                    { type: 'thrall_t2', weight: 20, soulValue: 1 },
                    { type: 'thrall_t3', weight: 10, soulValue: 1 },
                    { type: 'thrall_t4', weight: 3, soulValue: 1 },
                    { type: 'walker', weight: 22, soulValue: 1 },
                    { type: 'brute', weight: 18, soulValue: 2 },
                    { type: 'cursed', weight: 8, soulValue: 2 },
                    { type: 'spitter', weight: 5, soulValue: 2 },
                    { type: 'charger', weight: 2, soulValue: 2 },
                ],
                events: [
                    { type: 'cursed', count: 14, rate: 1.2, delay: 20 }
                ]
            },
            { // Wave 9 (12:00 - 13:30) lull
                duration: 90,
                baseAlive: 25,
                baseAliveRampSec: 10,
                bufferSeconds: 5,
                maxAlive: 120,
                fillRate: { start: 3, peak: 8, end: 5, rampUpSec: 14, rampDownSec: 12 },
                weights: [
                    { type: 'walker', weight: 55, soulValue: 1 },
                    { type: 'brute', weight: 25, soulValue: 2 },
                    { type: 'spitter', weight: 12, soulValue: 2 },
                    { type: 'anchor', weight: 8, soulValue: 5 },
                ],
                events: [
                    { type: 'anchor', count: 3, rate: 0.4, delay: 28 }
                ]
            },
            { // Wave 10 (13:30 - 15:00) density spike
                duration: 90,
                baseAlive: 300,
                baseAliveRampSec: 28,
                bufferSeconds: 7,
                maxAlive: 360,
                fillRate: { start: 8, peak: 24, end: 10, rampUpSec: 25, rampDownSec: 15 },
                weights: [
                    { type: 'thrall_t1', weight: 35, soulValue: 1 },
                    { type: 'thrall_t2', weight: 30, soulValue: 1 },
                    { type: 'thrall_t3', weight: 20, soulValue: 1 },
                    { type: 'thrall_t4', weight: 8, soulValue: 1 },
                    { type: 'brute', weight: 3, soulValue: 2 },
                    { type: 'cursed', weight: 2, soulValue: 2 },
                    { type: 'spitter', weight: 1, soulValue: 2 },
                    { type: 'charger', weight: 1, soulValue: 2 },
                ],
                events: [
                    { type: 'thrall_t1', count: 80, rate: 30, delay: 12 },
                    { type: 'thrall_t3', count: 28, rate: 8, delay: 25 },
                    { type: 'thrall_t4', count: 12, rate: 2.0, delay: 40 },
                    { type: 'cursed', count: 18, rate: 1.2, delay: 35 },
                    { type: 'charger', count: 14, rate: 2.2, delay: 60 },
                ]
            },
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
        walkerVariants: {
            // Walkers use damped acceleration; `speed` is accel and `friction` controls turn tightness + terminal velocity.
            // Goal: player can barely outrun in a straight line, but circle-strafing is less safe.
            // NOTE: Keep baseline speeds conservative; enemy stacking/collision and fairness depend on this.
            thrall: { baseHp: 60, hpPerLevel: 3, speed: 900, friction: 0.92, radius: 10, knockbackTakenMult: 1.0 },
            walker: { baseHp: 200, hpPerLevel: 5, speed: 800, friction: 0.92, radius: 12, knockbackTakenMult: 1.0 },
            brute: { baseHp: 420, hpPerLevel: 10, speed: 720, friction: 0.92, radius: 14, knockbackTakenMult: 0.35 },
            cursed: { baseHp: 260, hpPerLevel: 8, speed: 780, friction: 0.92, radius: 12, knockbackTakenMult: 0.75 },
        },
        charger: { baseHp: 50, hpPerLevel: 5, speed: 900, dashSpeed: 800 },
        spitter: { baseHp: 150, hpPerLevel: 5, speed: 500, retreatDistance: 300 },
        anchor:  { baseHp: 500, hpPerLevel: 10, speed: 40, auraRadius: 150 },
        friction: 0.92,
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
        soul: {
            pickupRadius: 30,
            extendedPickupRadius: 150,
            attractionSpeed: 5,
            baseSoulValue: 1,
            magnetism: 5,

            tiers: {
                requiredCount: 20,
                maxTier: 5,
                // Merge control (performance + feel).
                enabled: true,
                radius: 120,
                intervalSec: 0.35,
                maxMergesPerTick: 4,
                onlyWhenOrbsAtLeast: 20,
                mergeAnimSec: 0.25,
                // Value-threshold merge (Option C): any nearby orbs can consolidate.
                minOrbsToMerge: 6,
                maxAbsorbPerMerge: 28,
            },

        }
    },

    skills: {
        rarityWeights: { common: 70, uncommon: 23, rare: 6, epic: 1 },

	        repeater: {
            windupGainPerSecond: 0.8,
            windupDecayPerSecond: 1.2,
            windupAttackSpeedBonus: 1.2,
            // Cyclone is a proc: chance on repeater bullet hit to burst a 360° spray.
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
	                cycloneBurstColor: { token: "p2", alpha: 0.9 },
	                cycloneBurstCount: 18,
	                cycloneTextColor: { token: "p1", alpha: 0.95 },
	                cooldownTextColor: { token: "bone", alpha: 0.95 },

	                hexColor: { token: "arcaneDeep", alpha: 0.85 },
	                hexInterval: 0.4,
	                hexCount: 1,
	                hexCountPerStack: 0.35,
	                hexSize: 2.3,
                hexLife: 0.2,
                hexApplyBurstCount: 3,
                hexApplyBurstSpeed: 110,
            },
	        },
	        
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
	                burnColor: { token: "ember", alpha: 0.85 },
	                burnInterval: 0.28,
	                burnCount: 1,
	                burnCountPerStack: 0.45,
	                burnSize: 2.4,
	                burnLife: 0.22,
	                burnApplyBurstCount: 4,
	                burnApplyBurstSpeed: 120,

	                trailColor: { token: "ember", alpha: 0.6 },
	                trailInterval: 0.12,
	                trailCount: 2,
	                trailSize: 2.0,
	                trailLife: 0.16,

	                igniteColor: { token: "ember", alpha: 0.9 },
	                igniteBurstCount: 16,
	                igniteBurstSpeed: 170,

	                pyreColor: { token: "emberDeep", alpha: 0.9 },
	                pyreBurstCount: 22,
	                pyreBurstSpeed: 220,

	                soulBrandColor: { token: "arcaneDeep", alpha: 0.85 },
	                soulBrandInterval: 0.28,
	                soulBrandCount: 1,
	                soulBrandSize: 2.4,
	                soulBrandLife: 0.22,
	                soulBrandApplyBurstCount: 4,
	                soulBrandApplyBurstSpeed: 120,
	                soulBrandPopBurstCount: 18,
	                soulBrandPopBurstSpeed: 190,

	                heatColor: { token: "ember", alpha: 0.65 },
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
	                markColor: { token: "p2", alpha: 0.95 },
	                markInterval: 0.3,
	                markCount: 1,
	                markCountPerStack: 1,
	                markSize: 2.5,
	                markLife: 0.22,
	                markApplyBurstCount: 4,
	                markApplyBurstSpeed: 130,

	                hexColor: { token: "arcaneDeep", alpha: 0.9 },
	                hexInterval: 0.35,
	                hexCount: 1,
	                hexCountPerStack: 0.5,
	                hexSize: 2.5,
	                hexLife: 0.22,
	                hexApplyBurstCount: 4,
	                hexApplyBurstSpeed: 110,

	                linkColor: { token: "p2", alpha: 0.9 },
	                linkInterval: 0.25,
	                linkCount: 1,
	                linkSize: 2.4,
	                linkLife: 0.2,
	                linkApplyBurstCount: 3,
	                linkApplyBurstSpeed: 100,

	                overloadColor: { token: "p2", alpha: 0.9 },
	                overloadBurstCount: 14,

	                relayColor: { token: "p2", alpha: 0.9 },
	                relayBurstCount: 10,
	                overchargeColor: { token: "p1", alpha: 0.9 },
	                overchargeBurstCount: 10,

	                currentColor: { token: "p2", alpha: 0.8 },
	                currentInterval: 0.12,
	                currentCount: 1,
	                currentSize: 2.2,
	                currentLife: 0.18,
	                currentRadius: 22,
	                currentBurstColor: { token: "p2", alpha: 0.95 },
	                currentBurstCount: 16,
	                currentTextColor: { token: "p2", alpha: 0.95 },

	                voltageColor: { token: "p1", alpha: 0.85 },
	                voltageInterval: 0.16,
	                voltageCount: 1,
	                voltageCountPerStack: 0.35,
	                voltageSize: 2.0,
                voltageLife: 0.16,
                voltageRadius: 18,
            },
        }
        ,
        scythe: {
            markDurationSec: 6.0,
            golemCapBase: 3,
            golemHealPctOverflow: 0.18,
            golemSlamCoeff: 0.65,
            // Incoming damage scaling (1.0 = same as player takes for identical specs).
            golemDamageTakenMult: 0.5,
            // Defensive utility: shared taunt across all golems (not always up).
            golemTauntRadius: 75,
            golemTauntDurationSec: 5.0,
            golemTauntPeriodSec: 10.0,
            golemTauntBossesEnabled: false,
            // Minion AI tuning: keep golems near the player (defensive screen) and avoid chasing across the map.
            golemAcquireRange: 360,
            golemLeashRange: 440,
            golemOrbitRadius: 78,
            golemOrbitWobble: 16,
            golemOrbitAngularSpeed: 1.3,
            golemMoveSpeed: 180,
            golemReturnSpeedMult: 1.35,
            vfx: {
                markColor: { token: "p4", alpha: 0.9 },
            },
        }
    }
};
