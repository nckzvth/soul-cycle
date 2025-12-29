import { ATTRIBUTE_MASTERY_LAYOUT } from "./AttributeMasteryLayout.js";
import { ATTRIBUTE_MASTERY_TREES } from "./AttributeMasteryTrees.js";
import { AttributeId } from "./Vocabulary.js";

function invariant(condition, message, data) {
    if (condition) return;
    const err = new Error(message);
    if (data !== undefined) err.data = data;
    throw err;
}

function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

const VALID_ATTRS = new Set(Object.values(AttributeId));
const VALID_SIDES = new Set(["clockwise", "counterclockwise"]);

function buildTreeIndex(trees) {
    const byId = new Map();
    for (const [attrId, tree] of Object.entries(trees || {})) {
        invariant(VALID_ATTRS.has(attrId), "Unknown attribute tree key", { attrId });
        for (const node of tree?.nodes || []) {
            invariant(!byId.has(node.id), "Duplicate AttributeMastery node id", { id: node.id });
            byId.set(node.id, { ...node, attributeId: attrId });
        }
    }
    return byId;
}

export function validateAttributeMasteryLayout(opts = {}) {
    const { layout = ATTRIBUTE_MASTERY_LAYOUT, trees = ATTRIBUTE_MASTERY_TREES } = opts;
    invariant(isPlainObject(layout), "ATTRIBUTE_MASTERY_LAYOUT must be an object", { layout });

    const treeIndex = buildTreeIndex(trees);
    invariant(treeIndex.size > 0, "No AttributeMastery nodes found in trees", { trees });

    const nodes = Array.isArray(layout.nodes) ? layout.nodes : [];
    invariant(nodes.length > 0, "Layout.nodes must be a non-empty array", { nodesLen: nodes.length });

    const seenIds = new Set();
    const nodeIndex = new Map();

    for (const node of nodes) {
        invariant(isPlainObject(node), "Layout node must be an object", { node });
        const nodeId = node.id;
        invariant(typeof nodeId === "string" && nodeId.trim(), "Layout node id must be a non-empty string", { node });

        const meta = treeIndex.get(nodeId);
        invariant(!!meta, "Layout node must reference a known AttributeMastery node id", { nodeId });

        invariant(VALID_ATTRS.has(node.attributeId), "Layout node attributeId must be a valid AttributeId", { nodeId, attributeId: node.attributeId });
        invariant(node.attributeId === meta.attributeId, "Layout node attributeId must match tree definition", {
            nodeId,
            layoutAttrId: node.attributeId,
            treeAttrId: meta.attributeId,
        });

        invariant(isFiniteNumber(node.tier), "Layout node tier must be a finite number", { nodeId, tier: node.tier });
        invariant(node.tier === meta.tier, "Layout node tier must match tree definition", { nodeId, layoutTier: node.tier, treeTier: meta.tier });

        invariant(isPlainObject(node.point), "Layout node point must be an object", { nodeId, point: node.point });
        invariant(isFiniteNumber(node.point.x) && isFiniteNumber(node.point.y), "Layout node point.x/point.y must be finite numbers", {
            nodeId,
            point: node.point,
        });

        invariant(isFiniteNumber(node.radius) && node.radius > 0, "Layout node radius must be a positive number", { nodeId, radius: node.radius });

        invariant(isPlainObject(node.color), "Layout node color must be an object", { nodeId, color: node.color });
        invariant(typeof node.color.fill === "string" && node.color.fill.trim(), "Layout node color.fill must be a non-empty string", {
            nodeId,
            color: node.color,
        });
        invariant(typeof node.color.stroke === "string" && node.color.stroke.trim(), "Layout node color.stroke must be a non-empty string", {
            nodeId,
            color: node.color,
        });

        const prereqs = Array.isArray(node.prereqs) ? node.prereqs : [];
        invariant(prereqs.every((p) => typeof p === "string" && p.trim()), "Layout node prereqs must be non-empty strings", { nodeId, prereqs });

        const metaPrereqs = meta.prereqs || [];
        const prereqSet = new Set(prereqs);
        const metaSet = new Set(metaPrereqs);
        invariant(prereqSet.size === metaSet.size && [...prereqSet].every((p) => metaSet.has(p)), "Layout node prereqs must match tree definition", {
            nodeId,
            prereqs,
            treePrereqs: metaPrereqs,
        });

        const hybridPorts = Array.isArray(node.hybridPorts) ? node.hybridPorts : [];
        for (const port of hybridPorts) {
            invariant(isPlainObject(port), "Layout hybridPort must be an object", { nodeId, port });
            invariant(VALID_SIDES.has(port.side), "Layout hybridPort.side must be clockwise or counterclockwise", { nodeId, port });
            invariant(VALID_ATTRS.has(port.toAttributeId), "Layout hybridPort.toAttributeId must be a valid AttributeId", { nodeId, port });
            invariant(isPlainObject(port.anchor), "Layout hybridPort.anchor must be an object", { nodeId, port });
            invariant(isFiniteNumber(port.anchor.x) && isFiniteNumber(port.anchor.y), "Layout hybridPort.anchor must have finite x/y", { nodeId, port });
        }

        const presentation = node.presentation || {};
        invariant(isPlainObject(presentation), "Layout node presentation must be an object", { nodeId, presentation });
        if (presentation.size != null) invariant(typeof presentation.size === "string", "Layout node presentation.size must be a string when present", { nodeId });
        if (presentation.role != null) invariant(typeof presentation.role === "string", "Layout node presentation.role must be a string when present", { nodeId });
        if (presentation.badge != null) invariant(typeof presentation.badge === "string", "Layout node presentation.badge must be a string when present", { nodeId });
        if (presentation.tierRing != null) invariant(isFiniteNumber(presentation.tierRing), "Layout node presentation.tierRing must be numeric when present", {
            nodeId,
            tierRing: presentation.tierRing,
        });

        invariant(!seenIds.has(nodeId), "Duplicate layout node id", { nodeId });
        seenIds.add(nodeId);
        nodeIndex.set(nodeId, node);
    }

    const missing = [...treeIndex.keys()].filter((id) => !seenIds.has(id));
    invariant(missing.length === 0, "Layout is missing nodes present in AttributeMasteryTrees", { missing });

    const hybridSpokes = Array.isArray(layout.hybridSpokes) ? layout.hybridSpokes : [];
    for (const spoke of hybridSpokes) {
        invariant(isPlainObject(spoke), "Hybrid spoke must be an object", { spoke });
        invariant(typeof spoke.id === "string" && spoke.id.trim(), "Hybrid spoke id must be a non-empty string", { spoke });
        if (spoke.anchor != null) {
            invariant(isPlainObject(spoke.anchor), "Hybrid spoke anchor must be an object", { spoke });
            invariant(isFiniteNumber(spoke.anchor.x) && isFiniteNumber(spoke.anchor.y), "Hybrid spoke anchor must have finite x/y", { spoke });
        }

        const spokeNodes = Array.isArray(spoke.nodes) ? spoke.nodes : [];
        invariant(spokeNodes.length >= 2, "Hybrid spoke nodes must include at least two endpoints", { spokeId: spoke.id, spokeNodes });
        for (const n of spokeNodes) {
            invariant(isPlainObject(n), "Hybrid spoke entry must be an object", { spokeId: spoke.id, n });
            invariant(typeof n.nodeId === "string" && n.nodeId.trim(), "Hybrid spoke entry nodeId must be a non-empty string", { spokeId: spoke.id, n });
            const layoutNode = nodeIndex.get(n.nodeId);
            invariant(!!layoutNode, "Hybrid spoke entry must reference a known layout node", { spokeId: spoke.id, nodeId: n.nodeId });

            if (n.attributeId != null) {
                invariant(VALID_ATTRS.has(n.attributeId), "Hybrid spoke entry attributeId must be valid when present", { spokeId: spoke.id, n });
                invariant(n.attributeId === layoutNode.attributeId, "Hybrid spoke entry attributeId must match layout node attributeId", {
                    spokeId: spoke.id,
                    entryAttrId: n.attributeId,
                    nodeAttrId: layoutNode.attributeId,
                });
            }

            if (n.side != null) invariant(VALID_SIDES.has(n.side), "Hybrid spoke entry side must be clockwise/counterclockwise when present", { spokeId: spoke.id, n });
            if (n.toAttributeId != null) invariant(VALID_ATTRS.has(n.toAttributeId), "Hybrid spoke entry toAttributeId must be valid when present", {
                spokeId: spoke.id,
                n,
            });
        }
    }

    return {
        ok: true,
        normalized: {
            nodes,
            hybridSpokes,
        },
    };
}
