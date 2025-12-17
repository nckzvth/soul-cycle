import { BALANCE } from "../data/Balance.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getCfg() {
  return BALANCE?.progression || {};
}

function getXpCfg() {
  return getCfg().xp || {};
}

function xpDiminishMultiplierFromKillRate(killRate) {
  const xpCfg = getXpCfg();
  const threshold = xpCfg.killRateThreshold ?? 2.5;
  const minMult = xpCfg.minMult ?? 0.2;
  const k = xpCfg.diminishK ?? 0.18;
  const p = xpCfg.diminishP ?? 1.3;

  const kr = typeof killRate === "number" && Number.isFinite(killRate) ? killRate : 0;
  if (kr <= threshold) return 1.0;

  const extra = Math.max(0, kr - threshold);
  const mult = 1 / (1 + k * Math.pow(extra, p));
  return clamp(mult, minMult, 1.0);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function earlyFieldXpMultiplier(state) {
  const xpCfg = getXpCfg();
  const start = xpCfg.earlyFieldMultStart ?? 1.0;
  const end = xpCfg.earlyFieldMultEnd ?? 1.0;
  const dur = xpCfg.earlyFieldMultDurationSec ?? 0;

  const elapsed = Math.max(0, Number(state?.fieldElapsed || 0));
  if (!(dur > 0)) return 1.0;
  const t = clamp(elapsed / dur, 0, 1);
  return lerp(start, end, t);
}

const ProgressionSystem = {
  getXpRequired(level) {
    const xpCfg = getXpCfg();
    const base = xpCfg.reqBase ?? 16;
    const growth = xpCfg.reqGrowth ?? 1.28;
    const lvl = Math.max(1, Math.floor(level || 1));
    return Math.max(1, Math.floor(base * Math.pow(growth, lvl - 1)));
  },

  getBaseXpPerKill() {
    const xpCfg = getXpCfg();
    return xpCfg.basePerKill ?? 0.25;
  },

  getXpForKill(state) {
    const base = this.getBaseXpPerKill();
    const killRate = state?.killRateEMA ?? 0;
    const mult = xpDiminishMultiplierFromKillRate(killRate);
    const early = earlyFieldXpMultiplier(state);
    return base * mult * early;
  },

  getEnemyLevelForField(state) {
    const cfg = getCfg();
    const tierCfg = cfg.enemyTier || {};
    const base = tierCfg.base ?? 1;
    const perWave = tierCfg.perWave ?? 1.0;
    const perMinute = tierCfg.perMinute ?? 0.75;

    const waveIndex = Math.max(1, Math.floor(state?.waveIndex || 1));
    const elapsed = Math.max(0, Number(state?.fieldElapsed || 0));
    const minutes = elapsed / 60;

    const raw = base + (waveIndex - 1) * perWave + minutes * perMinute;
    return Math.max(1, Math.floor(raw));
  },

  getEnemyLevelForDungeon(state) {
    const cfg = getCfg();
    const tierCfg = cfg.enemyTier || {};
    const base = (tierCfg.dungeonBase ?? 10);
    const perMinute = (tierCfg.dungeonPerMinute ?? 1.5);
    const elapsed = Math.max(0, Number(state?.elapsed || 0));
    const minutes = elapsed / 60;
    return Math.max(1, Math.floor(base + minutes * perMinute));
  },

  getFieldDurationSec() {
    return getCfg()?.field?.durationSec ?? 900;
  },

  getFieldDungeonDecisionSec() {
    return getCfg()?.field?.dungeonDecisionSec ?? 30;
  },

  getDungeonDurationSec() {
    return getCfg()?.dungeon?.durationSec ?? 300;
  },
};

export default ProgressionSystem;
