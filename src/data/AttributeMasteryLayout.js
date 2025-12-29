import { ActivationMode, ATTRIBUTE_MASTERY_TREES } from "./AttributeMasteryTrees.js";
import { AttributeId } from "./Vocabulary.js";

const ATTRIBUTE_ORDER = Object.freeze([AttributeId.Might, AttributeId.Will, AttributeId.Alacrity, AttributeId.Constitution]);

const ATTRIBUTE_ANGLE = Object.freeze({
    [AttributeId.Might]: -90,
    [AttributeId.Will]: 0,
    [AttributeId.Alacrity]: 90,
    [AttributeId.Constitution]: 180,
});

const CLOCKWISE_NEIGHBOR = Object.freeze({
    [AttributeId.Might]: AttributeId.Will,
    [AttributeId.Will]: AttributeId.Alacrity,
    [AttributeId.Alacrity]: AttributeId.Constitution,
    [AttributeId.Constitution]: AttributeId.Might,
});

const COUNTERCLOCKWISE_NEIGHBOR = Object.freeze({
    [AttributeId.Might]: AttributeId.Constitution,
    [AttributeId.Will]: AttributeId.Might,
    [AttributeId.Alacrity]: AttributeId.Will,
    [AttributeId.Constitution]: AttributeId.Alacrity,
});

const ATTRIBUTE_COLORS = Object.freeze({
    [AttributeId.Might]: Object.freeze({ fill: "ember", stroke: "emberDeep" }),
    [AttributeId.Will]: Object.freeze({ fill: "arcaneDeep", stroke: "p4" }),
    [AttributeId.Alacrity]: Object.freeze({ fill: "p2", stroke: "p3" }),
    [AttributeId.Constitution]: Object.freeze({ fill: "midStone", stroke: "dust" }),
});

const TIER_RADII = Object.freeze({
    1: 140,
    2: 220,
    3: 300,
    4: 380,
    5: 460,
    6: 540,
    7: 620,
    8: 700,
    10: 860,
});

const NODE_RADIUS_BY_SIZE = Object.freeze({
    sm: 16,
    md: 18,
    lg: 22,
    xl: 26,
});

const BRANCH_LATERAL = 86;
const HYBRID_PORT_OFFSET = 42;

const NODE_OVERRIDES = Object.freeze({
    // --- Might ---
    might_05a_phoenix_covenant: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    might_05b_sanctified_hearth: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),
    might_10a_cinderstorm_moment: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    might_10b_phoenix_rebirth: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),

    // --- Will ---
    will_05a_whirlpool_curse: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    will_05b_abyssal_tentacle: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),
    will_10a_maelstrom: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    will_10b_call_of_the_deep: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),

    // --- Alacrity ---
    alac_05a_pinball_dash: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    alac_05b_gale_dancer: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),
    alac_10a_cyclone_break: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    alac_10b_perfect_cadence: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),

    // --- Constitution ---
    con_05a_wardweaver: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    con_05b_bone_mirror: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),
    con_10a_fortress_protocol: Object.freeze({ lateral: BRANCH_LATERAL, side: "counterclockwise" }),
    con_10b_break_upon_me: Object.freeze({ lateral: BRANCH_LATERAL, side: "clockwise" }),
});

const HYBRID_PAIRINGS = Object.freeze([]);

function radians(deg) {
    return (deg * Math.PI) / 180;
}

function getTierRadius(tier) {
    return TIER_RADII[tier] || TIER_RADII[1];
}

function polar(angleDeg, radius, lateral = 0, { clockwise = true } = {}) {
    const a = radians(angleDeg);
    const base = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
    if (!lateral) return base;

    const offsetAngle = radians(clockwise ? angleDeg + 90 : angleDeg - 90);
    return {
        x: base.x + Math.cos(offsetAngle) * lateral,
        y: base.y + Math.sin(offsetAngle) * lateral,
    };
}

function hybridPort() {
    return null;
}

function roleForNode(meta) {
    if (meta?.tier >= 10) return "capstone";
    if (meta?.exclusiveGroup) return "exclusive";
    if (meta?.tier === 1) return "root";
    return "node";
}

function sizeForNode(meta) {
    if (meta?.tier >= 10) return "xl";
    if (meta?.tier >= 5) return "lg";
    if (meta?.tier <= 1) return "md";
    return "sm";
}

function badgeForNode(meta) {
    const tierLabel = `T${meta?.tier ?? "?"}`;
    const activation =
        meta?.activationMode === ActivationMode.Attuned
            ? "Attuned"
            : meta?.activationMode === ActivationMode.Hybrid
              ? "Hybrid"
              : "Passive";
    const exclusivity = meta?.exclusiveGroup ? "Exclusive" : "Node";
    return `${tierLabel} • ${exclusivity} • ${activation}`;
}

function buildLayoutNodes() {
    const nodes = [];

    for (const attributeId of ATTRIBUTE_ORDER) {
        const angle = ATTRIBUTE_ANGLE[attributeId] || 0;
        const tree = ATTRIBUTE_MASTERY_TREES[attributeId];
        const sorted = (tree?.nodes || []).slice().sort((a, b) => a.tier - b.tier || String(a.id).localeCompare(String(b.id)));
        for (const meta of sorted) {
            const override = NODE_OVERRIDES[meta.id] || {};
            const lateral = override?.lateral || 0;
            const side = override?.side || null;
            const point = polar(angle, getTierRadius(meta.tier), lateral, { clockwise: side !== "counterclockwise" });
            const role = override?.presentation?.role || roleForNode(meta);
            const size = override?.presentation?.size || sizeForNode(meta);
            const badge = override?.presentation?.badge || badgeForNode(meta);
            const tierRing = override?.presentation?.tierRing ?? meta.tier;

            const hybridPorts = [];

            const radius = override?.radius || NODE_RADIUS_BY_SIZE[size] || NODE_RADIUS_BY_SIZE.md;
            nodes.push(
                Object.freeze({
                    id: meta.id,
                    attributeId,
                    tier: meta.tier,
                    point: Object.freeze({ x: Math.round(point.x * 100) / 100, y: Math.round(point.y * 100) / 100 }),
                    radius,
                    color: ATTRIBUTE_COLORS[attributeId],
                    prereqs: Object.freeze(meta.prereqs || []),
                    hybridPorts: Object.freeze(hybridPorts),
                    presentation: Object.freeze({
                        size,
                        role,
                        badge,
                        tierRing,
                    }),
                })
            );
        }
    }

    return nodes;
}

function midpoint(p1, p2) {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

function buildHybridSpokes(nodes) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const spokes = [];
    for (const pair of HYBRID_PAIRINGS) {
        const a = byId.get(pair.a);
        const b = byId.get(pair.b);
        if (!a || !b) continue;
        const anchor = midpoint(a.point, b.point);
        spokes.push(
            Object.freeze({
                id: pair.id,
                anchor: Object.freeze({ x: Math.round(anchor.x * 100) / 100, y: Math.round(anchor.y * 100) / 100 }),
                nodes: Object.freeze([
                    Object.freeze({
                        attributeId: a.attributeId,
                        nodeId: a.id,
                        side: NODE_OVERRIDES[a.id]?.side || null,
                        toAttributeId: NODE_OVERRIDES[a.id]?.side === "counterclockwise" ? COUNTERCLOCKWISE_NEIGHBOR[a.attributeId] : CLOCKWISE_NEIGHBOR[a.attributeId],
                    }),
                    Object.freeze({
                        attributeId: b.attributeId,
                        nodeId: b.id,
                        side: NODE_OVERRIDES[b.id]?.side || null,
                        toAttributeId: NODE_OVERRIDES[b.id]?.side === "counterclockwise" ? COUNTERCLOCKWISE_NEIGHBOR[b.attributeId] : CLOCKWISE_NEIGHBOR[b.attributeId],
                    }),
                ]),
            })
        );
    }
    return spokes;
}

const LAYOUT_NODES = Object.freeze(buildLayoutNodes());
const HYBRID_SPOKES = Object.freeze([]);

export const ATTRIBUTE_MASTERY_LAYOUT = Object.freeze({
    origin: Object.freeze({ x: 0, y: 0 }),
    tierRadius: TIER_RADII,
    nodes: LAYOUT_NODES,
    hybridSpokes: HYBRID_SPOKES,
});
