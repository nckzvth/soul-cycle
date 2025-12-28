import { validateTagSet } from "./TagValidation.js";
import { AttributeId } from "./Vocabulary.js";
import { ActivationMode, ATTRIBUTE_MASTERY_TREES } from "./AttributeMasteryTrees.js";

function invariant(condition, message, data) {
  if (condition) return;
  const err = new Error(message);
  if (data !== undefined) err.data = data;
  throw err;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toInt(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

const VALID_ATTR = new Set(Object.values(AttributeId));
const VALID_ACTIVATION = new Set(Object.values(ActivationMode));

function validateNodeShape(node, { treeAttrId } = {}) {
  invariant(isPlainObject(node), "Attribute mastery node must be an object", { node, treeAttrId });

  invariant(typeof node.id === "string" && node.id.trim(), "Node.id must be a non-empty string", { node });
  invariant(VALID_ATTR.has(node.attributeId), "Node.attributeId must be a valid AttributeId", { node });
  invariant(node.attributeId === treeAttrId, "Node.attributeId must match its tree attribute", { node, treeAttrId });

  const tier = toInt(node.tier);
  invariant(Number.isFinite(tier) && tier >= 1, "Node.tier must be an integer >= 1", { node });

  const prereqs = node.prereqs == null ? [] : node.prereqs;
  invariant(Array.isArray(prereqs), "Node.prereqs must be an array", { node });
  for (const p of prereqs) {
    invariant(typeof p === "string" && p.trim(), "Node.prereqs entries must be non-empty strings", { node, prereq: p });
  }

  invariant(
    node.exclusiveGroup == null || (typeof node.exclusiveGroup === "string" && node.exclusiveGroup.trim()),
    "Node.exclusiveGroup must be null or non-empty string",
    { node }
  );

  invariant(typeof node.activationMode === "string" && VALID_ACTIVATION.has(node.activationMode), "Invalid node.activationMode", {
    node,
    valid: [...VALID_ACTIVATION],
  });

  invariant(node.tags != null, "Node.tags is required", { node });
  const { normalized } = validateTagSet(node.tags, { context: { kind: "attributeMasteryNode", id: node.id } });
  invariant(!!normalized?.attributeTag, "Node.tags.attributeTag is required", { nodeId: node.id });
  invariant(normalized.attributeTag === treeAttrId, "Node.tags.attributeTag must match node.attributeId", {
    nodeId: node.id,
    attributeId: treeAttrId,
    attributeTag: normalized.attributeTag,
  });

  const effects = node.effects == null ? [] : node.effects;
  invariant(Array.isArray(effects), "Node.effects must be an array", { node });

  return {
    ok: true,
    normalized: {
      ...node,
      tier,
      prereqs,
      exclusiveGroup: node.exclusiveGroup || null,
      tags: normalized,
      effects,
    },
  };
}

function validateGraph(nodes) {
  const byId = new Map();
  for (const n of nodes) {
    invariant(!byId.has(n.id), "Duplicate node id", { id: n.id });
    byId.set(n.id, n);
  }

  // Prereq existence + tier monotonicity (prereq tier must be lower).
  for (const n of nodes) {
    for (const preId of n.prereqs) {
      const pre = byId.get(preId);
      invariant(!!pre, "Missing prereq node", { nodeId: n.id, prereqId: preId });
      invariant(pre.tier < n.tier, "Prereq must be in a lower tier", {
        nodeId: n.id,
        nodeTier: n.tier,
        prereqId: preId,
        prereqTier: pre?.tier,
      });
    }
  }

  // Cycle detection (DFS).
  const temp = new Set();
  const perm = new Set();
  const visit = (id, stack) => {
    if (perm.has(id)) return;
    invariant(!temp.has(id), "Cycle detected in prereqs", { cycleAt: id, stack });
    temp.add(id);
    const n = byId.get(id);
    const nextStack = [...stack, id];
    for (const preId of n?.prereqs || []) visit(preId, nextStack);
    temp.delete(id);
    perm.add(id);
  };
  for (const id of byId.keys()) visit(id, []);

  // Exclusive group sanity: members must share tier.
  const groups = new Map();
  for (const n of nodes) {
    if (!n.exclusiveGroup) continue;
    if (!groups.has(n.exclusiveGroup)) groups.set(n.exclusiveGroup, []);
    groups.get(n.exclusiveGroup).push(n);
  }
  for (const [groupId, members] of groups.entries()) {
    const tiers = new Set(members.map((m) => m.tier));
    invariant(tiers.size === 1, "Exclusive group members must share the same tier", {
      groupId,
      tiers: [...tiers],
      nodeIds: members.map((m) => m.id),
    });
  }

  return { ok: true, byId };
}

export function validateAttributeMasteryTrees(opts = {}) {
  const { trees = ATTRIBUTE_MASTERY_TREES } = opts;
  invariant(isPlainObject(trees), "ATTRIBUTE_MASTERY_TREES must be an object", { trees });

  const requiredAttrs = Object.values(AttributeId);
  for (const attrId of requiredAttrs) {
    invariant(!!trees[attrId], "Missing attribute mastery tree", { attrId });
  }

  const globalIds = new Set();
  const validated = {};

  for (const [attrId, tree] of Object.entries(trees)) {
    invariant(VALID_ATTR.has(attrId), "Unknown attribute tree key", { attrId });
    invariant(isPlainObject(tree), "Attribute tree must be an object", { attrId, tree });
    invariant(tree.attributeId === attrId, "Tree.attributeId must match key", { attrId, got: tree.attributeId });

    const nodes = tree.nodes == null ? [] : tree.nodes;
    invariant(Array.isArray(nodes), "Tree.nodes must be an array", { attrId });

    const normalizedNodes = [];
    for (const node of nodes) {
      const { normalized } = validateNodeShape(node, { treeAttrId: attrId });
      invariant(!globalIds.has(normalized.id), "Duplicate node id across trees", { id: normalized.id, attrId });
      globalIds.add(normalized.id);
      normalizedNodes.push(normalized);
    }

    validateGraph(normalizedNodes);
    validated[attrId] = { attributeId: attrId, nodes: normalizedNodes };
  }

  return { ok: true, normalized: validated };
}

