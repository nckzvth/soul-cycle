import { validateEffectDef } from "../systems/EffectSystem.js";
import { getAttributeMasteryEffectsByNodeId } from "./AttributeMasteryEffectDefs.js";
import { ATTRIBUTE_MASTERY_TREES } from "./AttributeMasteryTrees.js";
import { BALANCE } from "./Balance.js";

function invariant(condition, message, data) {
  if (condition) return;
  const err = new Error(message);
  if (data !== undefined) err.data = data;
  throw err;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toStringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function validateAttributeMasteryEffects(opts = {}) {
  const { trees = ATTRIBUTE_MASTERY_TREES } = opts;
  const tuning = BALANCE?.mastery?.attributes || {};

  for (const tree of Object.values(trees || {})) {
    for (const node of tree?.nodes || []) {
      const nodeId = toStringOrNull(node?.id);
      invariant(!!nodeId, "Attribute mastery node is missing id", { node });

      invariant(node.effects == null, "Attribute mastery node contains deprecated 'effects' field", { nodeId });

      const effectGroupId = toStringOrNull(node?.effectGroupId);
      invariant(!!effectGroupId, "Attribute mastery node is missing effectGroupId", { nodeId });
      invariant(effectGroupId === nodeId, "Attribute mastery node effectGroupId must equal node.id", { nodeId, effectGroupId });

      const defs = getAttributeMasteryEffectsByNodeId(effectGroupId);
      invariant(Array.isArray(defs), "Attribute mastery EffectDefs binding must be an array", { nodeId, effectGroupId });
      invariant(defs.length > 0, "Attribute mastery node must bind to at least one EffectDef", { nodeId, effectGroupId });

      for (const def of defs) validateEffectDef(def);

      const attrId = toStringOrNull(node?.attributeId);
      invariant(!!attrId, "Attribute mastery node missing attributeId", { nodeId });
      invariant(isPlainObject(tuning[attrId]), "Missing BALANCE.mastery.attributes[attributeId] tuning section", { nodeId, attrId });
      invariant(isPlainObject(tuning[attrId][nodeId]), "Missing BALANCE.mastery.attributes[attributeId][nodeId] tuning entry", { nodeId, attrId });
    }
  }

  return true;
}
