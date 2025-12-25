import { BALANCE } from "../data/Balance.js";
import { AttributeId } from "../data/Vocabulary.js";
import { getWeaponConfigByCls } from "../data/Weapons.js";
import { Phials } from "../data/Phials.js";

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampInt(n, min, max) {
  const x = Math.floor(toNumber(n));
  return Math.max(min, Math.min(max, x));
}

function ensureAttributeTrack(profile, attrId) {
  profile.mastery = profile.mastery || {};
  profile.mastery.attributes = profile.mastery.attributes || {};
  if (!profile.mastery.attributes[attrId]) {
    profile.mastery.attributes[attrId] = { xp: 0, level: 0, unlocks: [] };
  }
  return profile.mastery.attributes[attrId];
}

function ensureWeaponTrack(profile, weaponId) {
  profile.mastery = profile.mastery || {};
  profile.mastery.weapons = profile.mastery.weapons || {};
  if (!profile.mastery.weapons[weaponId]) {
    profile.mastery.weapons[weaponId] = { xp: 0, level: 0, unlocks: [] };
  }
  return profile.mastery.weapons[weaponId];
}

function reqForLevel({ reqBase, reqGrowth }, level) {
  const base = Math.max(1, toNumber(reqBase) || 100);
  const growth = Math.max(1.01, toNumber(reqGrowth) || 1.2);
  const lvl = Math.max(0, clampInt(level, 0, 10_000));
  return Math.floor(base * Math.pow(growth, lvl));
}

function addXpToTrack(track, xp, curve) {
  const add = Math.max(0, clampInt(xp, 0, 1_000_000_000));
  if (add <= 0) return { gainedXp: 0, gainedLevels: 0 };
  track.xp = clampInt(track.xp + add, 0, 1_000_000_000);

  let gainedLevels = 0;
  while (track.xp >= reqForLevel(curve, track.level)) {
    track.xp -= reqForLevel(curve, track.level);
    track.level = clampInt(track.level + 1, 0, 10_000);
    gainedLevels++;
  }
  return { gainedXp: add, gainedLevels };
}

function distributeChoiceShare(choiceXp, weightsByAttr, fallbackAttr) {
  const choice = Math.max(0, clampInt(choiceXp, 0, 1_000_000_000));
  const out = new Map();
  if (choice <= 0) return out;

  let totalWeight = 0;
  for (const w of Object.values(weightsByAttr || {})) totalWeight += Math.max(0, toNumber(w));

  if (!(totalWeight > 0)) {
    out.set(fallbackAttr, (out.get(fallbackAttr) || 0) + choice);
    return out;
  }

  // Largest remainder method to ensure exact sum.
  const entries = Object.entries(weightsByAttr)
    .filter(([k, w]) => !!k && Math.max(0, toNumber(w)) > 0)
    .map(([k, w]) => ({ k, w: Math.max(0, toNumber(w)) }));

  let used = 0;
  const remainders = [];
  for (const e of entries) {
    const raw = (choice * e.w) / totalWeight;
    const base = Math.floor(raw);
    used += base;
    out.set(e.k, base);
    remainders.push({ k: e.k, r: raw - base });
  }

  let rem = choice - used;
  remainders.sort((a, b) => b.r - a.r);
  let i = 0;
  while (rem > 0 && remainders.length > 0) {
    const k = remainders[i % remainders.length].k;
    out.set(k, (out.get(k) || 0) + 1);
    rem--;
    i++;
  }
  return out;
}

export function appendRunHistory(profile, runResult, { masteryXp = null } = {}) {
  profile.history = profile.history || {};
  profile.history.recentRuns = Array.isArray(profile.history.recentRuns) ? profile.history.recentRuns : [];
  profile.history.recentRuns.unshift(masteryXp == null ? { ...runResult } : { ...runResult, masteryXp });
  const cfg = BALANCE?.progression?.mastery || {};
  const max = clampInt(cfg.recentRunsMax, 1, 100) || 20;
  profile.history.recentRuns = profile.history.recentRuns.slice(0, max);
}

export function computeRunResult(game, { endReason, state } = {}) {
  const p = game?.p;
  const st = state || game?.stateManager?.currentState;
  const isDungeon = !!st?.isRun && typeof st?.timer === "number" && typeof st?.riftScore === "number" && !("waveIndex" in st);
  const isField = !!st?.isRun && typeof st?.waveIndex === "number";

  const mode = isDungeon ? "dungeon" : (isField ? "field" : "unknown");
  const weaponCls = p?.gear?.weapon?.cls || null;
  const wcfg = getWeaponConfigByCls(weaponCls);

  const start = p?.runStart || {};
  const soulsStart = toNumber(start.souls);
  const soulsEnd = toNumber(p?.souls);

  const pickedPhials = [];
  for (const [id, stacks] of (p?.phials || new Map()).entries()) {
    if (!stacks) continue;
    // Attribute tags are optional until content tagging is complete.
    // The 70/30 distribution will treat missing attributeTag as "no weight".
    const phialDef = Object.values(Phials).find(ph => ph?.id === id) || null;
    const attributeTag = phialDef?.tags?.attributeTag || null;
    pickedPhials.push({ id, stacks: clampInt(stacks, 0, 999), attributeTag });
  }

  return {
    schemaVersion: 1,
    runId: toNumber(p?.runId) || 0,
    mode,
    endReason: String(endReason || "unknown"),

    durationSec: toNumber(isField ? st?.fieldElapsed : (isDungeon ? st?.elapsed : null)) || 0,
    reachedLevel: clampInt(p?.lvl, 1, 999),
    kills: clampInt(p?.killStats?.currentSession, 0, 1_000_000),

    weaponCls,
    weaponId: wcfg?.weaponId || null,
    weaponPrimaryAttribute: wcfg?.primaryAttribute || null,

    soulsStart,
    soulsEnd,
    soulsDelta: soulsEnd - soulsStart,

    pickedPhials,
  };
}

export function applyMetaProgression(profile, runResult) {
  const cfg = BALANCE?.progression?.mastery || {};

  const endReason = String(runResult?.endReason || "unknown");
  const grantOnForfeit = cfg.grantOnForfeit !== false;
  const isForfeit = endReason === "forfeit" || endReason === "restart";
  if (isForfeit && !grantOnForfeit) {
    return { gained: false, masteryXp: 0 };
  }

  // Performance XP: minimal, tunable, stable.
  const perKill = toNumber(cfg.xpPerKill) || 1;
  const perLevel = toNumber(cfg.xpPerReachedLevel) || 6;
  const perSoul = toNumber(cfg.xpPerSoulDelta) || 0;
  const base = toNumber(cfg.xpBase) || 0;
  const soulDelta = Math.max(0, toNumber(runResult.soulsDelta));
  let masteryXp = Math.floor(base + runResult.kills * perKill + runResult.reachedLevel * perLevel + soulDelta * perSoul);

  if (runResult.endReason === "fieldComplete") masteryXp += toNumber(cfg.fieldCompleteBonus) || 0;
  if (runResult.endReason === "dungeonComplete") masteryXp += toNumber(cfg.dungeonCompleteBonus) || 0;
  if (runResult.endReason === "dungeonFailed") masteryXp += toNumber(cfg.dungeonFailedBonus) || 0;

  masteryXp = Math.max(0, clampInt(masteryXp, 0, 1_000_000_000));
  if (masteryXp <= 0) return { gained: false, masteryXp: 0 };

  const weaponAttr = runResult.weaponPrimaryAttribute || AttributeId.Might;
  const weaponShare = Math.floor(masteryXp * 0.7);
  const choiceShare = masteryXp - weaponShare;

  // Build weights from phials (attributeTag is optional until content is tagged).
  const weights = {};
  for (const ph of runResult.pickedPhials || []) {
    const attr = ph?.attributeTag;
    const stacks = Math.max(0, toNumber(ph?.stacks));
    if (!attr || stacks <= 0) continue;
    weights[attr] = (weights[attr] || 0) + stacks;
  }

  const choiceDist = distributeChoiceShare(choiceShare, weights, weaponAttr);

  // Apply attribute XP.
  const attrCurve = cfg.attributeCurve || { reqBase: 120, reqGrowth: 1.25 };
  const weaponAttrTrack = ensureAttributeTrack(profile, weaponAttr);
  addXpToTrack(weaponAttrTrack, weaponShare, attrCurve);
  for (const [attr, xp] of choiceDist.entries()) {
    const track = ensureAttributeTrack(profile, attr);
    addXpToTrack(track, xp, attrCurve);
  }

  // Apply weapon XP (full mastery XP to weapon track).
  const weaponId = runResult.weaponId;
  if (weaponId) {
    const weaponCurve = cfg.weaponCurve || { reqBase: 160, reqGrowth: 1.28 };
    const wTrack = ensureWeaponTrack(profile, weaponId);
    addXpToTrack(wTrack, masteryXp, weaponCurve);
  }

  appendRunHistory(profile, runResult, { masteryXp });

  return { gained: true, masteryXp };
}

export function getWeaponMasteryLevel(profile, weaponId) {
  const lvl = profile?.mastery?.weapons?.[weaponId]?.level;
  return clampInt(lvl, 0, 10_000);
}
