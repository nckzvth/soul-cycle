import {
  AspectId,
  ASPECTS_BY_RITE,
  AttributeId,
  ATTRIBUTE_TO_RITE,
  DeliveryTagId,
  MechanicTagId,
  RiteId,
  TagBuckets,
  TargetTagId,
} from "./Vocabulary.js";

function invariant(condition, message, data) {
  if (condition) return;
  const err = new Error(message);
  if (data !== undefined) err.data = data;
  throw err;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function setFromEnum(enumObj) {
  return new Set(Object.values(enumObj));
}

const VALID_ATTRIBUTE = setFromEnum(AttributeId);
const VALID_RITE = setFromEnum(RiteId);
const VALID_ASPECT = setFromEnum(AspectId);
const VALID_DELIVERY = setFromEnum(DeliveryTagId);
const VALID_MECHANIC = setFromEnum(MechanicTagId);
const VALID_TARGET = setFromEnum(TargetTagId);

const VALID_BUCKET_KEYS = new Set(Object.values(TagBuckets));

function validateEnumValue(kind, value, validSet) {
  if (value == null) return null;
  invariant(typeof value === "string", `${kind} must be a string`, { kind, value });
  invariant(validSet.has(value), `Unknown ${kind}: ${value}`, { kind, value });
  return value;
}

function validateEnumArray(kind, value, validSet, { max = null } = {}) {
  if (value == null) return [];
  invariant(Array.isArray(value), `${kind} must be an array`, { kind, value });
  const out = [];
  const seen = new Set();
  for (const v of value) {
    invariant(typeof v === "string", `${kind} entries must be strings`, { kind, value: v });
    invariant(validSet.has(v), `Unknown ${kind} value: ${v}`, { kind, value: v });
    if (!seen.has(v)) out.push(v);
    seen.add(v);
  }
  if (typeof max === "number" && Number.isFinite(max)) {
    invariant(out.length <= max, `${kind} exceeds max (${max})`, { kind, max, got: out.length });
  }
  return out;
}

export const DEFAULT_CARDINALITY_LIMITS = Object.freeze({
  aspectTags: 3,
  deliveryTags: 2,
  mechanicTags: 4,
  targetTags: 2,
});

/**
 * Validates a TagSet against the binding controlled vocabulary rules.
 *
 * TagSet shape (all optional):
 * {
 *   attributeTag?: AttributeId,
 *   riteTag?: RiteId,
 *   aspectTags?: AspectId[],
 *   deliveryTags?: DeliveryTagId[],
 *   mechanicTags?: MechanicTagId[],
 *   targetTags?: TargetTagId[],
 * }
 */
export function validateTagSet(tagSet, opts = {}) {
  if (tagSet == null) return { ok: true, normalized: null };
  invariant(isPlainObject(tagSet), "TagSet must be an object", { tagSet });

  const {
    strictBuckets = true,
    cardinality = DEFAULT_CARDINALITY_LIMITS,
    context = null,
  } = opts;

  if (strictBuckets) {
    for (const k of Object.keys(tagSet)) {
      invariant(VALID_BUCKET_KEYS.has(k), `Unknown tag bucket: ${k}`, { bucket: k, context });
    }
  }

  const attributeTag = validateEnumValue(TagBuckets.attributeTag, tagSet.attributeTag, VALID_ATTRIBUTE);
  const riteTag = validateEnumValue(TagBuckets.riteTag, tagSet.riteTag, VALID_RITE);

  const aspectTags = validateEnumArray(TagBuckets.aspectTags, tagSet.aspectTags, VALID_ASPECT, {
    max: cardinality?.aspectTags,
  });
  const deliveryTags = validateEnumArray(TagBuckets.deliveryTags, tagSet.deliveryTags, VALID_DELIVERY, {
    max: cardinality?.deliveryTags,
  });
  const mechanicTags = validateEnumArray(TagBuckets.mechanicTags, tagSet.mechanicTags, VALID_MECHANIC, {
    max: cardinality?.mechanicTags,
  });
  const targetTags = validateEnumArray(TagBuckets.targetTags, tagSet.targetTags, VALID_TARGET, {
    max: cardinality?.targetTags,
  });

  const derivedRite = attributeTag ? ATTRIBUTE_TO_RITE[attributeTag] : null;

  if (attributeTag && riteTag) {
    invariant(
      derivedRite === riteTag,
      `riteTag (${riteTag}) must match derived rite from attributeTag (${attributeTag} → ${derivedRite})`,
      { attributeTag, riteTag, derivedRite, context }
    );
  }

  const effectiveRite = riteTag || derivedRite;
  if (effectiveRite && aspectTags.length > 0) {
    const allowed = new Set(ASPECTS_BY_RITE[effectiveRite] || []);
    invariant(
      allowed.size > 0,
      `No aspect matrix defined for riteTag ${effectiveRite}`,
      { effectiveRite, context }
    );
    for (const a of aspectTags) {
      invariant(
        allowed.has(a),
        `Invalid aspect ${a} for rite ${effectiveRite}`,
        { aspect: a, rite: effectiveRite, context }
      );
    }
  }

  return {
    ok: true,
    normalized: {
      attributeTag: attributeTag || null,
      riteTag: riteTag || null,
      aspectTags,
      deliveryTags,
      mechanicTags,
      targetTags,
    },
  };
}

/**
 * WeaponConfig rules:
 * - Must define exactly one primaryAttribute: AttributeId
 * - Must not author riteTag (rite is derived from primaryAttribute)
 */
export function validateWeaponConfig(weaponConfig, opts = {}) {
  invariant(isPlainObject(weaponConfig), "WeaponConfig must be an object", { weaponConfig });
  const { context = null } = opts;

  const primaryAttribute = validateEnumValue("primaryAttribute", weaponConfig.primaryAttribute, VALID_ATTRIBUTE);
  invariant(!!primaryAttribute, "WeaponConfig.primaryAttribute is required", { weaponConfig, context });

  invariant(
    weaponConfig.riteTag == null,
    "WeaponConfig must not author riteTag (rite is derived from primaryAttribute)",
    { weaponConfig, context }
  );

  return {
    ok: true,
    normalized: {
      ...weaponConfig,
      primaryAttribute,
      derivedRite: ATTRIBUTE_TO_RITE[primaryAttribute] || null,
    },
  };
}

