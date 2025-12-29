import EffectSystem from "../src/systems/EffectSystem.js";
import { buildAttributeMasteryEffectSources } from "../src/systems/AttributeMasterySystem.js";
import { ATTRIBUTE_MASTERY_TREES } from "../src/data/AttributeMasteryTrees.js";
import { AttributeId, StatusId } from "../src/data/Vocabulary.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

function makeEnemy(overrides = {}) {
  return {
    x: 120,
    y: 0,
    r: 12,
    vx: 0,
    vy: 0,
    speed: 120,
    hp: 100,
    hpMax: 100,
    dead: false,
    isElite: false,
    isBoss: false,
    statuses: new Map(),
    stats: {},
    ...overrides,
  };
}

function makePlayer() {
  return {
    isPlayer: true,
    x: 0,
    y: 0,
    r: 12,
    hp: 100,
    hpMax: 100,
    souls: 0,
    dashCharges: 2,
    maxDashCharges: 2,
    dashTimer: 0,
    _sprite: { move: { x: 0, y: 0 } },
    combatBuffs: { powerMult: 1.0, moveSpeedMult: 1.0, attackSpeedMult: 1.0 },
    stats: {
      power: 10,
      powerMult: 1.0,
      dotMult: 1.0,
      aoeMult: 1.0,
      critChance: 0,
      critMult: 1.5,
      magnetism: 0,
      moveSpeedMult: 1.0,
      attackSpeed: 1.0,
      knockback: 0,
    },
  };
}

function makeProfile({ attunement } = {}) {
  const attributeTrees = {};
  for (const [attrId, tree] of Object.entries(ATTRIBUTE_MASTERY_TREES)) {
    attributeTrees[attrId] = { unlocked: (tree?.nodes || []).map((n) => n.id), selectedExclusive: {} };
  }
  return {
    armory: { attunement: attunement ?? null },
    mastery: { attributeTrees },
  };
}

function runOnce(attunement) {
  const player = makePlayer();
  const profile = makeProfile({ attunement });

  const enemy = makeEnemy({ isElite: true });
  enemy.statuses.set(StatusId.Ignited, { id: StatusId.Ignited });
  enemy.statuses.set(StatusId.Soaked, { id: StatusId.Soaked });
  enemy.statuses.set(StatusId.Conductive, { id: StatusId.Conductive });

  const state = {
    isRun: true,
    isTrainingArena: false,
    game: { time: 0 },
    enemies: [enemy],
    shots: [],
  };
  const game = { time: 0 };

  const sources = buildAttributeMasteryEffectSources(player, profile, state);
  invariant(Array.isArray(sources), "Expected mastery sources array");

  EffectSystem.reset();
  EffectSystem.setActiveSources(sources);

  EffectSystem.trigger(EffectSystem.TRIGGERS.runStart, { game, player, state }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.tick, { game, player, state, dt: 0.016 }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.hit, { game, player, state, target: enemy, hit: {} }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.dash, { game, player, state, dash: { phase: "end" } }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.kill, { game, player, state, enemy }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.damageTaken, { game, player, state, source: enemy }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.levelUp, { game, player, state, level: 2 }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.gaugeFill, { game, player, state }, { shadow: false });
  EffectSystem.trigger(EffectSystem.TRIGGERS.runEnd, { game, player, state, runResult: { ok: true } }, { shadow: false });
}

for (const att of [null, AttributeId.Might, AttributeId.Will, AttributeId.Alacrity, AttributeId.Constitution]) {
  runOnce(att);
}

console.log("smoke_attribute_mastery_effects: OK");

