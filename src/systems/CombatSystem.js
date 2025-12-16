// src/systems/CombatSystem.js
import { dist2 } from "../core/Utils.js";
import { SoulOrb as Soul, PhialShard } from "../entities/Pickups.js";
import { LootDrop as Drop } from "../entities/Pickups.js";
import { Projectile as Proj, Shockwave, StaticMine, Wisp, HammerProjectile } from "../entities/Projectile.js";
import { mouse } from "../core/Input.js";
import DungeonState from "../states/DungeonState.js";
import { BALANCE } from "../data/Balance.js";
import ParticleSystem from "./Particles.js";

const CombatSystem = {
    // Event hooks
    onEnemySpawn: (enemy, state) => {},
    onPlayerHit: (source, state) => {},
    onRoomOrWaveClear: (state) => {},

    hit(target, dmg, player, state, isDoT = false) {
        if (target.dead) return;
        
        this.applyDamage(target, dmg, player, state, isDoT);
        player.onHit(target, state);
    },

    applyDamage(target, dmg, player, state, isDoT = false) {
        let finalDmg = dmg * BALANCE.combat.playerDamageMult;
        if (target.isBuffed) {
            finalDmg *= BALANCE.combat.buffedEnemyDamageTakenMult;
        }

        const roundedDmg = Math.round(finalDmg);
        if (roundedDmg <= 0) return;

        target.takeDamage(roundedDmg, state);
        
        if (isDoT) {
            target.damageAccumulator += roundedDmg;
            if (target.damageAccumulator > 5) {
                ParticleSystem.emitText(target.x, target.y - target.r, target.damageAccumulator, {
                    color: 'orange',
                    size: 16,
                    life: 0.6
                });
                target.damageAccumulator = 0;
            }
        } else {
            ParticleSystem.emitText(target.x, target.y - target.r, roundedDmg, {
                color: 'white',
                size: 20,
                life: 0.8
            });
        }

        if (player) {
            let a = Math.atan2(target.y - player.y, target.x - player.x);
            if(target.vx !== undefined) {
                target.vx += Math.cos(a) * (player.stats.kb + BALANCE.combat.knockbackBase);
                target.vy += Math.sin(a) * (player.stats.kb + BALANCE.combat.knockbackBase);
            }
        }

        if (target.hp <= 0) {
            target.dead = true;
            if (target.isElite) {
                state.pickups.push(new PhialShard(target.x, target.y));
            }
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
        const damage = player.stats.dmg * BALANCE.player.pistol.damageMult;
        state.shots.push(new Proj(state, player,
            player.x, player.y, Math.cos(a) * BALANCE.player.pistolSpeed, Math.sin(a) * BALANCE.player.pistolSpeed, 1.5, damage, player.stats.hexPierce || 0, player.stats.hexBounce || 0
        ));

        if (player.salvoCharges > 0) {
            player.salvoCharges--;
            setTimeout(() => {
                state.shots.push(new Proj(state, player,
                    player.x, player.y, Math.cos(a) * BALANCE.player.pistolSpeed, Math.sin(a) * BALANCE.player.pistolSpeed, 1.5, damage, player.stats.hexPierce || 0, player.stats.hexBounce || 0, true
                ));
            }, 100);
        }
    },

    fireZap(player, state) {
        const maxChains = 1 + (player.stats.chainCount || 0);
        const range = BALANCE.combat.zapChainRange * (1 + (player.stats.chainJump || 0));
        const damage = player.stats.dmg * BALANCE.player.staff.damageMult;
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
                this.hit(best, damage, player, state);
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
                    this.hit(best, damage, player, state);
                    state.chains.push({ t: 0.15, pts: [{ x: curr2.x, y: curr2.y }, { x: best.x, y: best.y }], isSalvo: true });
                    curr2 = best;
                } else break;
            }
        }
    },

    fireShockwave(player, state) {
        state.shots.push(new Shockwave(
            state,
            player,
            player.x,
            player.y,
            player.stats.dmg * BALANCE.combat.shockwaveDamageMult
        ));
    },

    fireStaticMine(player, state, x, y) {
        state.shots.push(new StaticMine(
            state,
            player,
            x,
            y,
            player.stats.dmg * BALANCE.combat.staticMineDamageMult
        ));
    },

    fireWisp(player, state) {
        state.shots.push(new Wisp(
            state,
            player,
            player.x,
            player.y,
            player.stats.dmg * BALANCE.combat.wispDamageMult
        ));
    }
};

export default CombatSystem;