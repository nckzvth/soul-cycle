// src/systems/CombatSystem.js
import { dist2 } from "../core/Utils.js";
import { SoulOrb as Soul } from "../entities/Pickups.js";
import { LootDrop as Drop } from "../entities/Pickups.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp } from "../entities/Projectile.js";
import { mouse } from "../core/Input.js";
import DungeonState from "../states/DungeonState.js";
import { BALANCE } from "../data/Balance.js";

const CombatSystem = {
    // Event hooks
    onEnemySpawn: (enemy, state) => {},
    onPlayerHit: (source, state) => {
        // This function was empty, causing enemies to not deal damage initially.
        // The logic is now handled directly in each enemy's handlePlayerCollision method.
        // This hook can be used for global effects that trigger when the player is hit.
    },
    onRoomOrWaveClear: (state) => {},

    hit(target, dmg, player, state) {
        if (target.dead) return;
        
        let finalDmg = dmg * BALANCE.combat.playerDamageMult;
        if (target.isBuffed) {
            finalDmg *= BALANCE.combat.buffedEnemyDamageTakenMult;
        }

        target.takeDamage(finalDmg);

        if (player) {
            let a = Math.atan2(target.y - player.y, target.x - player.x);
            if(target.vx !== undefined) {
                target.vx += Math.cos(a) * (player.stats.kb + BALANCE.combat.knockbackBase);
                target.vy += Math.sin(a) * (player.stats.kb + BALANCE.combat.knockbackBase);
            }
        }

        if (target.hp <= 0) {
            target.dead = true;
        }
    },

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
        state.shots.push(new Proj(state,
            player.x, player.y, Math.cos(a) * BALANCE.player.pistolSpeed, Math.sin(a) * BALANCE.player.pistolSpeed, 1.5, player.stats.hexPierce || 0, player.stats.hexBounce || 0
        ));
    },

    fireZap(player, state) {
        const maxChains = 1 + (player.stats.chainCount || 0);
        const range = BALANCE.combat.zapChainRange * (1 + (player.stats.chainJump || 0));
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
        player.hammerAng += dt * 5;
        for (let i = 0; i < cnt; i++) {
            let a = player.hammerAng + (i * 6.28 / cnt);
            let ox = player.x + Math.cos(a) * player.hammerRad;
            let oy = player.y + Math.sin(a) * player.hammerRad;
            state.enemies.forEach(e => {
                if (!e.dead && dist2(ox, oy, e.x, e.y) < (15 + e.r) ** 2) {
                    this.hit(e, player.stats.dmg * BALANCE.combat.orbitDamageMult, player, state);
                }
            });
        }
    },

    fireShockwave(player, state) {
        state.shots.push(new Shockwave(
            state,
            player.x,
            player.y,
            player.stats.dmg * BALANCE.combat.shockwaveDamageMult
        ));
    },

    fireStaticMine(player, state, x, y) {
        state.shots.push(new StaticMine(
            state,
            x,
            y,
            player.stats.dmg * BALANCE.combat.staticMineDamageMult
        ));
    },

    fireWisp(player, state) {
        state.shots.push(new Wisp(
            state,
            player.x,
            player.y,
            player.stats.dmg * BALANCE.combat.wispDamageMult
        ));
    }
};

export default CombatSystem;