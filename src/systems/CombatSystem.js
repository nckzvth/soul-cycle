// src/systems/CombatSystem.js
import { dist2 } from "../core/Utils.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp } from "../entities/Projectile.js";
import { mouse } from "../core/Input.js";
import DungeonState from "../states/DungeonState.js";
import { BALANCE } from "../data/Balance.js";
import DamageSystem from "./DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import ParticleSystem from "./Particles.js";
import StatusSystem from "./StatusSystem.js";

const CombatSystem = {
    // Event hooks
    onEnemySpawn: (enemy, state) => {},
    onPlayerHit: (source, state) => {},
    onRoomOrWaveClear: (state) => {},

    rootPlayer(player, duration) {
        player.rooted = Math.max(player.rooted, duration);
    },

    firePistol(player, state) {
        let w;
        if (state instanceof DungeonState) {
            w = { x: mouse.x, y: mouse.y };
        } else {
            w = state.game.screenToWorld(mouse.x, mouse.y);
        }
        const aimAngle = Math.atan2(w.y - player.y, w.x - player.x);
        const spec = DamageSpecs.pistolShot();

        const pistolState = player.weaponState?.pistol;
        const cycloning = !!pistolState && pistolState.cycloneTime > 0;
        const airLance = cycloning && (player.stats.pistolAirLanceEnable || 0) > 0;
        const pinball = cycloning && (player.stats.pistolPinballEnable || 0) > 0;
        const extraPierce = airLance ? 2 : 0;
        const extraBounce = pinball ? 1 : 0;

        const pierce = (player.stats.pierce ?? player.stats.hexPierce ?? 0) + extraPierce;
        const bounce = (player.stats.bounce ?? player.stats.hexBounce ?? 0) + extraBounce;

        const snapshot = DamageSystem.snapshotOutgoing(player, spec);

        // Cyclone: fire in all directions (Reaper-style).
        if (cycloning && pistolState) {
            const cfg = BALANCE.skills?.pistol || {};
            const count = Math.max(3, cfg.cycloneShotCount ?? 8);
            const spin = cfg.cycloneSpinPerShot ?? 0.35;
            const base = pistolState.cycloneAngle || 0;
            for (let i = 0; i < count; i++) {
                const shotAngle = base + (i / count) * Math.PI * 2;
                state.shots.push(new Proj(state, player,
                    player.x,
                    player.y,
                    Math.cos(shotAngle) * BALANCE.player.pistolSpeed,
                    Math.sin(shotAngle) * BALANCE.player.pistolSpeed,
                    1.5,
                    spec,
                    snapshot,
                    pierce,
                    bounce
                ));
            }
            pistolState.cycloneAngle = base + spin;
        } else {
            state.shots.push(new Proj(state, player,
                player.x,
                player.y,
                Math.cos(aimAngle) * BALANCE.player.pistolSpeed,
                Math.sin(aimAngle) * BALANCE.player.pistolSpeed,
                1.5,
                spec,
                snapshot,
                pierce,
                bounce
            ));
        }

        // Gust Spray: during Cyclone, every N shots emits a small gust hit near the muzzle.
        if (cycloning && (player.stats.pistolGustEnable || 0) > 0 && pistolState) {
            pistolState.gustCounter++;
            const cfg = BALANCE.skills?.pistol || {};
            const baseShots = cfg.gustShotsBase ?? 10;
            const rateMult = 1 + (player.stats.pistolGustRateMult || 0);
            const shotsPerGust = Math.max(3, Math.round(baseShots / rateMult));
            if (pistolState.gustCounter >= shotsPerGust) {
                pistolState.gustCounter = 0;
                const gustSpec = DamageSpecs.pistolGust();
                const gustSnapshot = DamageSystem.snapshotOutgoing(player, gustSpec);
                const radius = cfg.gustRadius ?? 70;
                const gx = player.x + Math.cos(aimAngle) * 60;
                const gy = player.y + Math.sin(aimAngle) * 60;
                state.enemies.forEach(e => {
                    if (e.dead) return;
                    if (dist2(gx, gy, e.x, e.y) < radius * radius) {
                        DamageSystem.dealDamage(player, e, gustSpec, { state, snapshot: gustSnapshot, particles: ParticleSystem });
                    }
                });
            }
        }

        if (player.salvoCharges > 0) {
            player.salvoCharges--;
            setTimeout(() => {
                if (cycloning && pistolState) {
                    const cfg = BALANCE.skills?.pistol || {};
                    const count = Math.max(3, cfg.cycloneShotCount ?? 8);
                    const spin = cfg.cycloneSpinPerShot ?? 0.35;
                    const base = pistolState.cycloneAngle || 0;
                    for (let i = 0; i < count; i++) {
                        const a2 = base + (i / count) * Math.PI * 2;
                        state.shots.push(new Proj(state, player,
                            player.x,
                            player.y,
                            Math.cos(a2) * BALANCE.player.pistolSpeed,
                            Math.sin(a2) * BALANCE.player.pistolSpeed,
                            1.5,
                            spec,
                            snapshot,
                            pierce,
                            bounce,
                            true
                        ));
                    }
                    pistolState.cycloneAngle = base + spin;
                } else {
                    const a2 = Math.atan2(w.y - player.y, w.x - player.x);
                    state.shots.push(new Proj(state, player,
                        player.x,
                        player.y,
                        Math.cos(a2) * BALANCE.player.pistolSpeed,
                        Math.sin(a2) * BALANCE.player.pistolSpeed,
                        1.5,
                        spec,
                        snapshot,
                        pierce,
                        bounce,
                        true
                    ));
                }
            }, 100);
        }
    },

    fireZap(player, state) {
        const baseMaxChains = 1 + (player.stats.chainCount || 0);
        let maxChains = baseMaxChains;
        let range = BALANCE.combat.zapChainRange * (player.stats.chainRangeMult || (1 + (player.stats.chainJump || 0)));

        const zapSpec = DamageSpecs.staffZap();

        // Baseline staff kit:
        // - Zap always applies Conduction Mark.
        // - If you hit an already-marked enemy, you get one payoff for that cast:
        //   Relay (+1 chain) OR Overcharge (bonus strike).
        // Upgrades enhance these behaviors; they should not be required for the baseline to function.
        const overchargeSpec = DamageSpecs.staffOvercharge();
        const overchargeCoeffMult = 1 + (player.stats.staffOverchargeCoeffMult || 0);
        const overchargeAlwaysOnMarked = (player.stats.staffOverchargeEnable || 0) > 0;

        const markEnabled = true;
        const staffCfg = BALANCE.skills?.staff || {};
        const staffVfx = staffCfg.vfx || {};
        const markDuration = (staffCfg.markDuration ?? 2.0) * (1 + (player.stats.staffMarkDurationMult || 0));
        const markMaxStacks = (staffCfg.markMaxStacks ?? 1) + (player.stats.staffMarkMaxStacksAdd || 0);

        const hexEnabled = (player.stats.staffHexEnable || 0) > 0;
        const hexDuration = (staffCfg.hexDuration ?? 3.0) * (1 + (player.stats.staffHexDurationMult || 0));
        const hexMaxStacks = staffCfg.hexMaxStacks ?? 4;
        const hexBonusPerStack = staffCfg.hexZapCoeffBonusPerStack ?? 0.08;

        const voltageEnabled = (player.stats.staffVoltageEnable || 0) > 0;
        const voltageGainPerHit = staffCfg.voltageGainPerHit ?? 0.35;
        const voltageMax = staffCfg.voltageMax ?? 6;
        const voltageCoeffPerStack = staffCfg.voltageCoeffPerStack ?? 0.03;

        const relayEnabled = (player.stats.staffRelayEnable || 0) > 0;
        const relayBonus = (player.stats.staffRelayBonusMult || 0);

        const forkEnabled = (player.stats.staffForkEnable || 0) > 0;
        const forkChance = (player.stats.staffForkChance || 0);

        const overloadEnabled = (player.stats.staffOverloadEnable || 0) > 0;
        const overloadSpec = overloadEnabled ? DamageSpecs.staffOverloadDetonation() : null;
        const overloadSnapshot = overloadSpec ? DamageSystem.snapshotOutgoing(player, overloadSpec) : null;

        const currentActive = (player.weaponState?.staff?.currentTime || 0) > 0;
        if (currentActive) {
            range *= (1 + (staffCfg.currentRangeMult ?? 0.25));
        }

        const contractEnabled = (player.stats.staffContractConduitEnable || 0) > 0;
        const linkDuration = staffCfg.linkDuration ?? 2.0;
        const linkRadius = staffCfg.linkRadius ?? 240;

        let curr = { x: player.x, y: player.y };
        let visited = new Set();
        const staffState = player.weaponState?.staff;

        // Upgrade: if relay is enabled and a marked first target exists, boost range for this cast.
        if (relayEnabled) {
            let bestFirst = null, bestDist = range * range;
            state.enemies.forEach(e => {
                if (e.dead) return;
                let d = dist2(curr.x, curr.y, e.x, e.y);
                if (d < bestDist) { bestDist = d; bestFirst = e; }
            });
            if (bestFirst) {
                const stacks = StatusSystem.getStacks(bestFirst, "staff:mark");
                if (stacks > 0) {
                    range *= (1 + relayBonus * stacks);
                }
            }
        }

        const pickNextTarget = (from, range2, preferLinked) => {
            let best = null, bestDist = range2 * range2;
            if (preferLinked) {
                state.enemies.forEach(e => {
                    if (e.dead || visited.has(e)) return;
                    if (!e.statuses?.has("staff:link")) return;
                    const d = dist2(from.x, from.y, e.x, e.y);
                    if (d < bestDist) { bestDist = d; best = e; }
                });
            }
            if (!best) {
                state.enemies.forEach(e => {
                    if (e.dead || visited.has(e)) return;
                    const d = dist2(from.x, from.y, e.x, e.y);
                    if (d < bestDist) { bestDist = d; best = e; }
                });
            }
            return best;
        };

        const hasAnyLinks = contractEnabled && state.enemies.some(e => !e.dead && e.statuses?.has("staff:link"));
        const linkedAtCastStart = hasAnyLinks
            ? state.enemies.filter(e => !e.dead && e.statuses?.has("staff:link"))
            : [];

        let circuitProcUsed = false;

        const zapHit = (target) => {
            const hadMarksBefore = StatusSystem.getStacks(target, "staff:mark") > 0;

            // If hex/voltage are enabled, scale zap coeff for this hit.
            const hexStacks = hexEnabled ? StatusSystem.getStacks(target, "staff:hex") : 0;
            const voltageStacks = voltageEnabled ? (staffState?.voltage || 0) : 0;
            const coeffMult =
                (1 + hexStacks * hexBonusPerStack) *
                (1 + voltageStacks * voltageCoeffPerStack);
            const zSpec = coeffMult !== 1 ? { ...zapSpec, coeff: zapSpec.coeff * coeffMult } : zapSpec;
            const zSnap = DamageSystem.snapshotOutgoing(player, zSpec);
            DamageSystem.dealDamage(player, target, zSpec, { state, snapshot: zSnap, particles: ParticleSystem });

            // Baseline payoff: first time this cast hits an already-marked target, trigger Relay or Overcharge.
            if (!circuitProcUsed && hadMarksBefore) {
                circuitProcUsed = true;
                const next = staffState?.circuitNext || "relay";
                if (next === "relay") {
                    maxChains += 1;
                    ParticleSystem.emit(target.x, target.y, staffVfx.relayColor ?? "rgba(160, 235, 255, 0.9)", staffVfx.relayBurstCount ?? 10, 130, 2.8, 0.3);
                    if (staffState) staffState.circuitNext = "overcharge";
                } else {
                    DamageSystem.dealDamage(player, target, { ...overchargeSpec, coeff: overchargeSpec.coeff * 0.6 * overchargeCoeffMult }, {
                        state,
                        particles: ParticleSystem,
                    });
                    ParticleSystem.emit(target.x, target.y, staffVfx.overchargeColor ?? "rgba(240, 240, 140, 0.9)", staffVfx.overchargeBurstCount ?? 10, 130, 2.8, 0.3);
                    if (staffState) staffState.circuitNext = "relay";
                }
            }

            // Voltage: build on successful zaps.
            if (voltageEnabled && staffState) {
                const gainMult = 1 + (player.stats.staffVoltageGain || 0);
                staffState.voltage = Math.min(voltageMax, (staffState.voltage || 0) + voltageGainPerHit * gainMult);
            }

            // Apply/stack Binding Hex on hit (independent of Mark).
            if (hexEnabled) {
                StatusSystem.applyStatus(target, "staff:hex", {
                    source: player,
                    stacks: 1,
                    duration: hexDuration,
                    tickInterval: 9999,
                    spec: null,
                    snapshotPolicy: "snapshot",
                    stackMode: "add",
                    maxStacks: hexMaxStacks,
                    vfx: {
                        interval: staffVfx.hexInterval ?? 0.35,
                        color: staffVfx.hexColor ?? "rgba(190, 120, 255, 0.9)",
                        count: staffVfx.hexCount ?? 1,
                        countPerStack: staffVfx.hexCountPerStack ?? 0.5,
                        size: staffVfx.hexSize ?? 2.5,
                        life: staffVfx.hexLife ?? 0.22,
                        applyBurstCount: staffVfx.hexApplyBurstCount ?? 4,
                        applyBurstSpeed: staffVfx.hexApplyBurstSpeed ?? 110,
                    },
                });
            }

            // Apply/stack Conduction Mark on hit.
            if (markEnabled) {
                StatusSystem.applyStatus(target, "staff:mark", {
                    source: player,
                    stacks: 1,
                    duration: markDuration,
                    tickInterval: 9999,
                    spec: null,
                    snapshotPolicy: "snapshot",
                    stackMode: "add",
                    maxStacks: markMaxStacks,
                    vfx: {
                        interval: staffVfx.markInterval ?? 0.3,
                        color: staffVfx.markColor ?? "rgba(160, 235, 255, 0.95)",
                        count: staffVfx.markCount ?? 1,
                        countPerStack: staffVfx.markCountPerStack ?? 1,
                        size: staffVfx.markSize ?? 2.5,
                        life: staffVfx.markLife ?? 0.22,
                        applyBurstCount: staffVfx.markApplyBurstCount ?? 4,
                        applyBurstSpeed: staffVfx.markApplyBurstSpeed ?? 130,
                    },
                });

                const stacksAfter = StatusSystem.getStacks(target, "staff:mark");

                // Upgrade: always Overcharge on marked hits (in addition to baseline payoff).
                if (overchargeAlwaysOnMarked && stacksAfter > 0) {
                    const currentCoeffMult = currentActive ? (1 + (staffCfg.currentOverchargeCoeffMult ?? 0.25)) : 1;
                    DamageSystem.dealDamage(player, target, { ...overchargeSpec, coeff: overchargeSpec.coeff * overchargeCoeffMult * currentCoeffMult }, {
                        state,
                        particles: ParticleSystem,
                    });
                }

                // Overload: detonate when marks max out.
                if (overloadSpec && stacksAfter >= markMaxStacks) {
                    // Consume marks.
                    if (target.statuses) target.statuses.delete("staff:mark");
                    const radius = 70;
                    ParticleSystem.emit(target.x, target.y, staffVfx.overloadColor ?? "rgba(160, 235, 255, 0.9)", staffVfx.overloadBurstCount ?? 14, 140, 3.0, 0.35);
                    state.enemies.forEach(e2 => {
                        if (e2.dead) return;
                        if (dist2(target.x, target.y, e2.x, e2.y) < radius * radius) {
                            DamageSystem.dealDamage(player, e2, overloadSpec, { state, snapshot: overloadSnapshot, particles: ParticleSystem });
                        }
                    });

                    // Contract Conduit: apply temporary links consumed by next cast.
                    if (contractEnabled) {
                        state.enemies.forEach(e2 => {
                            if (e2.dead) return;
                            if (dist2(target.x, target.y, e2.x, e2.y) < linkRadius * linkRadius) {
                                StatusSystem.applyStatus(e2, "staff:link", {
                                    source: player,
                                    stacks: 1,
                                    duration: linkDuration,
                                    tickInterval: 9999,
                                    spec: null,
                                    snapshotPolicy: "snapshot",
                                    stackMode: "max",
                                    maxStacks: 1,
                                    vfx: {
                                        interval: staffVfx.linkInterval ?? 0.25,
                                        color: staffVfx.linkColor ?? "rgba(120, 255, 220, 0.9)",
                                        count: staffVfx.linkCount ?? 1,
                                        size: staffVfx.linkSize ?? 2.4,
                                        life: staffVfx.linkLife ?? 0.2,
                                        applyBurstCount: staffVfx.linkApplyBurstCount ?? 3,
                                        applyBurstSpeed: staffVfx.linkApplyBurstSpeed ?? 100,
                                    },
                                });
                            }
                        });
                    }
                }
            }
        };

        for (let i = 0; i < maxChains; i++) {
            const best = pickNextTarget(curr, range, hasAnyLinks);

            if (best) {
                visited.add(best);
                zapHit(best);

                // Fork Node: chance to strike an extra nearby target.
                if (forkEnabled && Math.random() < forkChance) {
                    let forkTarget = null;
                    let forkBest = range * range;
                    state.enemies.forEach(e2 => {
                        if (e2.dead || visited.has(e2)) return;
                        const d2 = dist2(best.x, best.y, e2.x, e2.y);
                        if (d2 < forkBest) { forkBest = d2; forkTarget = e2; }
                    });
                    if (forkTarget) {
                        visited.add(forkTarget);
                        zapHit(forkTarget);
                    }
                }
                state.chains.push({ t: 0.15, pts: [{ x: curr.x, y: curr.y }, { x: best.x, y: best.y }] });
                curr = best;
            } else break;
        }

        // Consume only the links that existed at cast start; newly-created links should persist for the next cast.
        if (hasAnyLinks) {
            linkedAtCastStart.forEach(e => {
                if (e.statuses) e.statuses.delete("staff:link");
            });
        }

        if (player.salvoCharges > 0) {
            player.salvoCharges--;
            let curr2 = { x: player.x, y: player.y };
            for (let i = 0; i < maxChains; i++) {
                let best = null, bestDist = range * range;
                // First pass: try to find an unvisited target
                state.enemies.forEach(e => {
                    if (e.dead || visited.has(e)) return;
                    let d = dist2(curr2.x, curr2.y, e.x, e.y);
                    if (d < bestDist) { bestDist = d; best = e; }
                });
                
                // Second pass: if no unvisited target, fall back to any target
                if (!best) {
                    state.enemies.forEach(e => {
                        if (e.dead) return;
                        let d = dist2(curr2.x, curr2.y, e.x, e.y);
                        if (d < bestDist) { bestDist = d; best = e; }
                    });
                }
    
                if (best) {
                    visited.add(best);
                    zapHit(best);
                    state.chains.push({ t: 0.15, pts: [{ x: curr2.x, y: curr2.y }, { x: best.x, y: best.y }], isSalvo: true });
                    curr2 = best;
                } else break;
            }
        }
    },

    fireShockwave(player, state) {
        const spec = DamageSpecs.shockwave();
        const snapshot = DamageSystem.snapshotOutgoing(player, spec);
        state.shots.push(new Shockwave(
            state,
            player,
            player.x,
            player.y,
            spec,
            snapshot
        ));
    },

    fireStaticMine(player, state, x, y) {
        const spec = DamageSpecs.staticMineTick();
        state.shots.push(new StaticMine(
            state,
            player,
            x,
            y,
            spec
        ));
    },

    fireWisp(player, state) {
        const spec = DamageSpecs.wispHit();
        const snapshot = DamageSystem.snapshotOutgoing(player, spec);
        state.shots.push(new Wisp(
            state,
            player,
            player.x,
            player.y,
            spec,
            snapshot
        ));
    }
};

export default CombatSystem;
