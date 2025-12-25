import {
  ASPECTS_BY_RITE,
  ATTRIBUTE_TO_RITE,
  AspectId,
  AttributeId,
  DeliveryTagId,
  MechanicTagId,
  RiteId,
  TagBuckets,
  TargetTagId,
} from "../src/data/Vocabulary.js";

function invariant(cond, msg) {
  if (!cond) throw new Error(msg);
}

function values(o) {
  return Object.values(o);
}

function hasDuplicates(arr) {
  return new Set(arr).size !== arr.length;
}

// Basic enum sanity
invariant(!hasDuplicates(values(AttributeId)), "AttributeId has duplicates");
invariant(!hasDuplicates(values(RiteId)), "RiteId has duplicates");
invariant(!hasDuplicates(values(AspectId)), "AspectId has duplicates");
invariant(!hasDuplicates(values(DeliveryTagId)), "DeliveryTagId has duplicates");
invariant(!hasDuplicates(values(MechanicTagId)), "MechanicTagId has duplicates");
invariant(!hasDuplicates(values(TargetTagId)), "TargetTagId has duplicates");
invariant(!hasDuplicates(values(TagBuckets)), "TagBuckets has duplicates");

// Mapping is total over attributes
for (const a of values(AttributeId)) {
  invariant(ATTRIBUTE_TO_RITE[a], `ATTRIBUTE_TO_RITE missing mapping for ${a}`);
}

// Aspects are defined per rite, and only include known aspects
const allAspects = new Set(values(AspectId));
for (const r of values(RiteId)) {
  const list = ASPECTS_BY_RITE[r];
  invariant(Array.isArray(list) && list.length > 0, `ASPECTS_BY_RITE missing/empty for ${r}`);
  for (const a of list) invariant(allAspects.has(a), `ASPECTS_BY_RITE[${r}] includes unknown aspect ${a}`);
}

// Hard rules: forbid legacy synonyms (informational; tags are enums so these should never appear)
const forbidden = ["Storm", "Earth", "Water", "Force"];
for (const word of forbidden) {
  const all = [
    ...values(AttributeId),
    ...values(RiteId),
    ...values(AspectId),
    ...values(DeliveryTagId),
    ...values(MechanicTagId),
    ...values(TargetTagId),
  ];
  invariant(!all.includes(word), `Forbidden term present in vocabulary: ${word}`);
}

console.log("validate_vocab: OK");

