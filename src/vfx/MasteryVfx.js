import ParticleSystem from "../systems/Particles.js";
import { color as c } from "../data/ColorTuning.js";
import { AttributeId, RiteId, ATTRIBUTE_TO_RITE } from "../data/Vocabulary.js";

export const MASTERY_RITE_VFX = Object.freeze({
  [RiteId.Cinder]: Object.freeze({ fill: "fx.ember", deep: "fx.emberDeep", text: "fx.ember", rim: "fx.ink" }),
  [RiteId.Tide]: Object.freeze({ fill: "fx.uiAccent", deep: "fx.uiText", text: "fx.uiText", rim: "fx.ink" }),
  [RiteId.Gale]: Object.freeze({ fill: "player.core", deep: "fx.uiText", text: "fx.uiText", rim: "fx.ink" }),
  [RiteId.Ossuary]: Object.freeze({ fill: "player.guard", deep: "fx.uiText", text: "player.guard", rim: "fx.ink" }),
});

export function getRiteForAttribute(attributeId) {
  return ATTRIBUTE_TO_RITE?.[attributeId] || null;
}

export function getMasteryPaletteByAttribute(attributeId) {
  const rite = getRiteForAttribute(attributeId);
  return MASTERY_RITE_VFX[rite] || MASTERY_RITE_VFX[RiteId.Gale];
}

function ensureCd(holder) {
  if (!holder) return null;
  if (!holder._masteryVfxCd) holder._masteryVfxCd = {};
  return holder._masteryVfxCd;
}

export function shouldProc(holder, key, cooldownSec, now) {
  const cd = ensureCd(holder);
  if (!cd || !key) return true;
  const t = typeof now === "number" && Number.isFinite(now) ? now : 0;
  const until = cd[key] || 0;
  if (t < until) return false;
  cd[key] = t + Math.max(0, Number(cooldownSec) || 0);
  return true;
}

export function emitMasteryProcText({ x, y, text, colorToken, size = 14, life = 0.7, layer = null } = {}) {
  if (x == null || y == null || !text) return;
  ParticleSystem.emitText(x, y, String(text), {
    color: colorToken || { token: "uiText", alpha: 0.95 },
    size,
    life,
    layer: layer ?? "default",
  });
}

export function emitMasteryBurst({ x, y, colorToken, count = 10, speed = 140, size = 2.8, life = 0.28, layer = null } = {}) {
  if (x == null || y == null) return;
  ParticleSystem.emit(
    x,
    y,
    colorToken || { token: "uiText", alpha: 0.9 },
    Math.max(0, Math.floor(count)),
    Math.max(0, Number(speed) || 0),
    Math.max(0.1, Number(size) || 0),
    Math.max(0.05, Number(life) || 0),
    null,
    { layer: layer ?? "default", rimColor: c("fx.ink", 0.55) || "ink" }
  );
}

export function emitMasteryRing({ x, y, radius, colorToken, alpha = 0.8, life = 0.24, count = 18, size = 2.2, layer = null } = {}) {
  if (x == null || y == null) return;
  const r = Math.max(0, Number(radius) || 0);
  if (r <= 0) return;
  const n = Math.max(6, Math.floor(count));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    ParticleSystem.emit(
      px,
      py,
      colorToken || { token: "uiText", alpha },
      1,
      0,
      Math.max(0.1, Number(size) || 0),
      Math.max(0.05, Number(life) || 0),
      null,
      { layer: layer ?? "default", rimColor: c("fx.ink", 0.6) || "ink" }
    );
  }
}

export function getAttunementLabel(attunement) {
  if (attunement === AttributeId.Might) return "Might";
  if (attunement === AttributeId.Will) return "Will";
  if (attunement === AttributeId.Alacrity) return "Alacrity";
  if (attunement === AttributeId.Constitution) return "Constitution";
  return String(attunement || "");
}

