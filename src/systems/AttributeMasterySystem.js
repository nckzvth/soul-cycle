import { ATTRIBUTE_MASTERY_TREES } from "../data/AttributeMasteryTrees.js";
import { AttributeId } from "../data/Vocabulary.js";
import { ATTRIBUTE_MASTERY_CORE_EFFECTS, getAttributeMasteryEffectsByNodeId } from "../data/AttributeMasteryEffectDefs.js";

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toStringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getUnlockedSet(profile, attributeId) {
  const raw = profile?.mastery?.attributeTrees?.[attributeId]?.unlocked;
  if (!Array.isArray(raw)) return new Set();
  const s = new Set();
  for (const id of raw) {
    if (typeof id !== "string") continue;
    const t = id.trim();
    if (t) s.add(t);
  }
  return s;
}

function getSelectedExclusive(profile, attributeId) {
  const sel = profile?.mastery?.attributeTrees?.[attributeId]?.selectedExclusive;
  return isPlainObject(sel) ? sel : {};
}

export function getUnlockedAttributeNodes(profile) {
  const out = [];
  for (const attrId of Object.values(AttributeId)) {
    const tree = ATTRIBUTE_MASTERY_TREES?.[attrId];
    const nodes = Array.isArray(tree?.nodes) ? tree.nodes : [];
    const unlocked = getUnlockedSet(profile, attrId);
    const selectedExclusive = getSelectedExclusive(profile, attrId);

    for (const node of nodes) {
      if (!node?.id) continue;
      if (!unlocked.has(node.id)) continue;

      // Enforce exclusives by selectedExclusive when present.
      const groupId = toStringOrNull(node.exclusiveGroup);
      if (groupId) {
        const picked = toStringOrNull(selectedExclusive[groupId]);
        if (picked && picked !== node.id) continue;
      }

      out.push(node);
    }
  }
  return out;
}

function isNodeActiveForAttunement(node, attunement) {
  const mode = toStringOrNull(node?.activationMode) || "Always";
  if (mode === "Always") return true;
  if (mode === "Attuned") return !!attunement && attunement === node.attributeId;
  if (mode === "Hybrid") return true;
  return false;
}

export function buildAttributeMasteryEffectSources(player, profile) {
  const attunement = toStringOrNull(player?.metaAttunement) || toStringOrNull(profile?.armory?.attunement);
  const unlockedNodes = getUnlockedAttributeNodes(profile);
  const sources = [];

  if (unlockedNodes.length > 0) {
    sources.push({
      sourceId: "mastery:core",
      kind: "mastery",
      stacks: 1,
      effects: ATTRIBUTE_MASTERY_CORE_EFFECTS,
    });
  }

  for (const node of unlockedNodes) {
    if (!isNodeActiveForAttunement(node, attunement)) continue;

    // Phase 5: we only emit sources; node->real EffectDef bindings come later.
    sources.push({
      sourceId: `mastery:${node.id}`,
      kind: "mastery",
      stacks: 1,
      effects: getAttributeMasteryEffectsByNodeId(node.id),
    });
  }

  return sources;
}
