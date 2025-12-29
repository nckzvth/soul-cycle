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

    // Exclusives: unlock = select, so in a valid profile there will be at most one unlocked member per group.
    // For legacy/buggy profiles, deterministically pick a single member per group to activate.
    const pickedByGroup = {};
    for (const [groupId, nodeId] of Object.entries(selectedExclusive)) {
      const g = toStringOrNull(groupId);
      const n = toStringOrNull(nodeId);
      if (!g || !n) continue;
      if (!unlocked.has(n)) continue;
      pickedByGroup[g] = n;
    }
    for (const node of nodes) {
      const groupId = toStringOrNull(node?.exclusiveGroup);
      if (!groupId) continue;
      if (pickedByGroup[groupId]) continue;
      if (node?.id && unlocked.has(node.id)) pickedByGroup[groupId] = node.id;
    }

    for (const node of nodes) {
      if (!node?.id) continue;
      if (!unlocked.has(node.id)) continue;

      const groupId = toStringOrNull(node.exclusiveGroup);
      if (groupId) {
        const picked = toStringOrNull(pickedByGroup[groupId]);
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

export function isMasteryGameplayActive(state) {
  // Mastery effects should run in real combat contexts (runs), and optionally in town
  // when a training arena is active.
  return !!(state?.isRun || state?.isTrainingArena);
}

export function buildAttributeMasteryEffectSources(player, profile, state = null) {
  if (state && !isMasteryGameplayActive(state)) return [];
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

    const effectGroupId = toStringOrNull(node?.effectGroupId) || node.id;
    sources.push({
      sourceId: `mastery:${node.id}`,
      kind: "mastery",
      stacks: 1,
      effects: getAttributeMasteryEffectsByNodeId(effectGroupId),
    });
  }

  return sources;
}
