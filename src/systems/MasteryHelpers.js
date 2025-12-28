import { FeatureFlags } from "../core/FeatureFlags.js";
import { AttributeId } from "../data/Vocabulary.js";

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export const META_MASTERY_PASSIVES = Object.freeze({
  [AttributeId.Might]: Object.freeze({ powerMultPerTier: 0.01 }),
  [AttributeId.Will]: Object.freeze({ soulGainMultPerTier: 0.015 }),
  [AttributeId.Alacrity]: Object.freeze({ attackSpeedMultPerTier: 0.005, moveSpeedMultPerTier: 0.003 }),
  [AttributeId.Constitution]: Object.freeze({ hpPerTier: 3 }),
});

export function getAttributeTier(player, attributeId) {
  if (!FeatureFlags.isOn("progression.metaMasteryEnabled")) return 0;
  const lv = player?.metaMasteryLevels;
  if (!lv) return 0;
  const n = toNumber(lv[attributeId]);
  return n > 0 ? Math.floor(n) : 0;
}

export function getAttributePointsAvailable(profile, attributeId) {
  if (!FeatureFlags.isOn("progression.metaMasteryEnabled")) return 0;
  const tier = toNumber(profile?.mastery?.attributes?.[attributeId]?.level);
  const spent = getAttributePointsSpent(profile, attributeId);
  const available = Math.floor(tier) - spent;
  return available > 0 ? available : 0;
}

export function getAttributePointsSpent(profile, attributeId) {
  const unlocked = profile?.mastery?.attributeTrees?.[attributeId]?.unlocked;
  if (!Array.isArray(unlocked)) return 0;
  const seen = new Set();
  for (const id of unlocked) {
    if (typeof id !== "string") continue;
    const s = id.trim();
    if (!s) continue;
    seen.add(s);
  }
  return seen.size;
}

export function applyMetaMasteryPassiveBonuses(stats, metaMasteryLevels) {
  if (!stats || !metaMasteryLevels) return;

  const mightLv = toNumber(metaMasteryLevels[AttributeId.Might]);
  const willLv = toNumber(metaMasteryLevels[AttributeId.Will]);
  const alacLv = toNumber(metaMasteryLevels[AttributeId.Alacrity]);
  const conLv = toNumber(metaMasteryLevels[AttributeId.Constitution]);

  const m = META_MASTERY_PASSIVES[AttributeId.Might];
  const w = META_MASTERY_PASSIVES[AttributeId.Will];
  const a = META_MASTERY_PASSIVES[AttributeId.Alacrity];
  const c = META_MASTERY_PASSIVES[AttributeId.Constitution];

  // Keep these small; they are intended as gentle synergies, not primary scaling.
  stats.powerMult *= 1 + mightLv * (m?.powerMultPerTier || 0);
  stats.soulGain *= 1 + willLv * (w?.soulGainMultPerTier || 0);
  stats.attackSpeed *= 1 + alacLv * (a?.attackSpeedMultPerTier || 0);
  stats.moveSpeedMult *= 1 + alacLv * (a?.moveSpeedMultPerTier || 0);
  stats.hp += conLv * (c?.hpPerTier || 0);
}

export function formatMetaMasteryTierTooltip(attributeId, tier) {
  const t = Math.max(0, Math.floor(toNumber(tier)));
  if (t <= 0) return "Meta tier 0 (no passive bonus)";

  const p = META_MASTERY_PASSIVES[attributeId] || {};
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;

  if (attributeId === AttributeId.Might) {
    const per = toNumber(p.powerMultPerTier);
    return `Meta tier ${t}: Power Mult +${pct(per * t)} (${pct(per)} per tier)`;
  }
  if (attributeId === AttributeId.Will) {
    const per = toNumber(p.soulGainMultPerTier);
    return `Meta tier ${t}: Soul Gain +${pct(per * t)} (${pct(per)} per tier)`;
  }
  if (attributeId === AttributeId.Alacrity) {
    const atk = toNumber(p.attackSpeedMultPerTier);
    const mov = toNumber(p.moveSpeedMultPerTier);
    return `Meta tier ${t}: Attack Speed +${pct(atk * t)}, Move Speed +${pct(mov * t)}`;
  }
  if (attributeId === AttributeId.Constitution) {
    const per = Math.floor(toNumber(p.hpPerTier));
    return `Meta tier ${t}: Max HP +${per * t} (+${per} per tier)`;
  }
  return `Meta tier ${t}`;
}
