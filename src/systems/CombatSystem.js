// src/systems/CombatSystem.js
import { dist2 } from "../core/Utils.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp } from "../entities/Projectile.js";
import { mouse } from "../core/Input.js";
import DungeonState from "../states/DungeonState.js";
import { BALANCE } from "../data/Balance.js";
import DamageSystem from "./DamageSystem.js";
import DamageSpecs from "../data/DamageSpecs.js";
import ParticleSystem from "./Particles.js";

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
        const a = Math.atan2(w.y - player.y, w.x - player.x);
        const spec = DamageSpecs.pistolShot();
        const snapshot = DamageSystem.snapshotOutgoing(player, spec);
        state.shots.push(new Proj(state, player,
            player.x,
            player.y,
            Math.cos(a) * BALANCE.player.pistolSpeed,
            Math.sin(a) * BALANCE.player.pistolSpeed,
            1.5,
            spec,
            snapshot,
            player.stats.pierce ?? player.stats.hexPierce ?? 0,
            player.stats.bounce ?? player.stats.hexBounce ?? 0
        ));

        if (player.salvoCharges > 0) {
            player.salvoCharges--;
            setTimeout(() => {
                state.shots.push(new Proj(state, player,
                    player.x,
                    player.y,
                    Math.cos(a) * BALANCE.player.pistolSpeed,
                    Math.sin(a) * BALANCE.player.pistolSpeed,
                    1.5,
                    spec,
                    snapshot,
                    player.stats.pierce ?? player.stats.hexPierce ?? 0,
                    player.stats.bounce ?? player.stats.hexBounce ?? 0,
                    true
                ));
            }, 100);
        }
    },

    fireZap(player, state) {
        const maxChains = 1 + (player.stats.chainCount || 0);
        const range = BALANCE.combat.zapChainRange * (player.stats.chainRangeMult || (1 + (player.stats.chainJump || 0)));
        const spec = DamageSpecs.staffZap();
        const snapshot = DamageSystem.snapshotOutgoing(player, spec);
        let curr = { x: player.x, y: player.y };
        let visited = new Set();

        for (let i = 0; i < maxChains; i++) {
            let best = null, bestDist = range * range;
            state.enemies.forEach(e => {
                if (e.dead || visited.has(e)) return;
                let d = dist2(curr.x, curr.y, e.x, e.y);
                if (d < bestDist) { bestDist = d; best = e; }
            });

            if (best) {
                visited.add(best);
                DamageSystem.dealDamage(player, best, spec, { state, snapshot, particles: ParticleSystem });
                state.chains.push({ t: 0.15, pts: [{ x: curr.x, y: curr.y }, { x: best.x, y: best.y }] });
                curr = best;
            } else break;
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
                    DamageSystem.dealDamage(player, best, spec, { state, snapshot, particles: ParticleSystem });
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
