// Controlled vocabulary for Soul-Cycle progression/tagging.
// Binding rules (high level):
// - Use Rites only (no "Force").
// - Rites are derived from Attributes (source of truth: ATTRIBUTE_TO_RITE).
// - Aspect validity is enforced via ASPECTS_BY_RITE.

export const AttributeId = Object.freeze({
  Might: "Might",
  Will: "Will",
  Alacrity: "Alacrity",
  Constitution: "Constitution",
});

export const RiteId = Object.freeze({
  Cinder: "Cinder",
  Tide: "Tide",
  Gale: "Gale",
  Ossuary: "Ossuary",
});

export const AspectId = Object.freeze({
  // Cinder
  Sanctified: "Sanctified",
  Ash: "Ash",
  Ember: "Ember",

  // Tide
  Soak: "Soak",
  Undertow: "Undertow",
  Tempest: "Tempest",

  // Gale
  Guided: "Guided",
  Ricochet: "Ricochet",
  Pierce: "Pierce",

  // Ossuary
  Stone: "Stone",
  Bone: "Bone",
  Golemcraft: "Golemcraft",
});

export const DeliveryTagId = Object.freeze({
  Core: "Core",
  Melee: "Melee",
  Projectile: "Projectile",
  Beam: "Beam",
  Orbit: "Orbit",
  Zone: "Zone",
  Summon: "Summon",

  // Optional (scaffold now)
  Nova: "Nova",
  Trap: "Trap",
  Aura: "Aura",
  Chain: "Chain",
});

export const MechanicTagId = Object.freeze({
  // Core loops
  Mark: "Mark",
  Execute: "Execute",
  Ward: "Ward",
  Tempo: "Tempo",
  Ritual: "Ritual",
  Reap: "Reap",

  // Movement/control
  DashTrigger: "DashTrigger",
  Pull: "Pull",
  Knockback: "Knockback",
  Stagger: "Stagger",
  Root: "Root",
  Slow: "Slow",

  // Projectile behaviors
  Ricochet: "Ricochet",
  Pierce: "Pierce",
  Homing: "Homing",

  // Status application hooks
  SoakApplied: "SoakApplied",
  ConductiveApplied: "ConductiveApplied",
  IgniteApplied: "IgniteApplied",

  // Summon hooks
  MinionCap: "MinionCap",
  MinionHeal: "MinionHeal",
  MinionOnKill: "MinionOnKill",

  // Economy/uptime (optional; scaffold now)
  Cooldown: "Cooldown",
  Recharge: "Recharge",
  Crit: "Crit",
  Overkill: "Overkill",
});

export const TargetTagId = Object.freeze({
  SingleTarget: "SingleTarget",
  AoE: "AoE",
  BossFocus: "BossFocus",
  MinionFocus: "MinionFocus",
  CrowdControl: "CrowdControl",
  StatusEffects: "StatusEffects",
});

export const StatusId = Object.freeze({
  Marked: "Marked",
  Reaped: "Reaped",
  Soaked: "Soaked",
  Conductive: "Conductive",
  Ignited: "Ignited",
  Warded: "Warded",
  Slowed: "Slowed",
  Staggered: "Staggered",
});

export const ATTRIBUTE_TO_RITE = Object.freeze({
  [AttributeId.Might]: RiteId.Cinder,
  [AttributeId.Will]: RiteId.Tide,
  [AttributeId.Alacrity]: RiteId.Gale,
  [AttributeId.Constitution]: RiteId.Ossuary,
});

export const ASPECTS_BY_RITE = Object.freeze({
  [RiteId.Cinder]: Object.freeze([AspectId.Sanctified, AspectId.Ash, AspectId.Ember]),
  [RiteId.Tide]: Object.freeze([AspectId.Soak, AspectId.Undertow, AspectId.Tempest]),
  [RiteId.Gale]: Object.freeze([AspectId.Guided, AspectId.Ricochet, AspectId.Pierce]),
  [RiteId.Ossuary]: Object.freeze([AspectId.Stone, AspectId.Bone, AspectId.Golemcraft]),
});

export const TagBuckets = Object.freeze({
  attributeTag: "attributeTag",
  riteTag: "riteTag",
  aspectTags: "aspectTags",
  deliveryTags: "deliveryTags",
  mechanicTags: "mechanicTags",
  targetTags: "targetTags",
});

export function derivedRiteFromAttribute(attributeId) {
  return ATTRIBUTE_TO_RITE[attributeId] || null;
}

