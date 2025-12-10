// src/systems/CombatSystem.js
import { dist2 } from "../core/Utils.js";
import { SoulOrb as Soul } from "../entities/Pickups.js";
import { LootDrop as Drop } from "../entities/Pickups.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp } from "../entities/Projectile.js";
import { mouse } from "../core/Input.js";
import DungeonState from "../states/DungeonState.js";

const CombatSystem = {
    // Event hooks
    onEnemySpawn: (enemy, state) => {},
    onPlayerHit: (source, state) => {},
    onRoomOrWaveClear: (state) => {},

    hit(target, dmg, player, state) {
        if (target.dead) return;
        target.hp -= dmg;
        target.flash = 0.1;

        if (player) {
            let a = Math.atan2(target.y - player.y, target.x - player.x);
            if(target.vx !== undefined) {
                target.vx += Math.cos(a) * (player.stats.kb + 50);
                target.vy += Math.sin(a) * (player.stats.kb + 50);
            }
        }

        if (target.hp <= 0) {
            target.dead = true;
            if (state.onEnemyDeath) {
                state.onEnemyDeath(target);
            }
        }
    },

    firePistol(player, state) {
        let w;
        if (state instanceof DungeonState) {
            w = { x: mouse.x, y: mouse.y };
        } else {
            w = state.game.screenToWorld(mouse.x, mouse.y);
        }
        const a = Math.atan2(w.y - player.y, w.x - player.x);
        state.shots.push(new Proj(state,
            player.x, player.y, Math.cos(a) * 700, Math.sin(a) * 700, 1.5, player.stats.hexPierce || 0, player.stats.hexBounce || 0
        ));
    },

    fireZap(player, state) {
        const maxChains = 1 + (player.stats.chainCount || 0);
        const range = 250 * (1 + (player.stats.chainJump || 0));
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
                this.hit(best, player.stats.dmg, player, state);
                state.chains.push({ t: 0.15, pts: [{ x: curr.x, y: curr.y }, { x: best.x, y: best.y }] });
                curr = best;
            } else break;
        }
    },

    runOrbit(player, state, dt) {
        const cnt = 1 + (player.stats.orbitBase || 0);
        state.hammerAng += dt * 5;
        for (let i = 0; i < cnt; i++) {
            let a = state.hammerAng + (i * 6.28 / cnt);
            let ox = player.x + Math.cos(a) * state.hammerRad;
            let oy = player.y + Math.sin(a) * state.hammerRad;
            state.enemies.forEach(e => {
                if (!e.dead && dist2(ox, oy, e.x, e.y) < (15 + e.r) ** 2) {
                    this.hit(e, player.stats.dmg * 0.6, player, state);
                }
            });
        }
    },

    fireShockwave(player, state) {
        state.shots.push(new Shockwave(state, player.x, player.y, player.stats.dmg * 2));
    },

    fireStaticMine(player, state) {
        state.shots.push(new StaticMine(state, player.x, player.y, player.stats.dmg));
    },

    fireWisp(player, state) {
        state.shots.push(new Wisp(state, player.x, player.y, player.stats.dmg));
    }
};

export default CombatSystem;
