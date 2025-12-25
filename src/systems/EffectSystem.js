// Shared effect engine for phials and weapon perks.
// Phase 3: shadow mode supported (collect stats, no gameplay mutation).

const TRIGGERS = Object.freeze({
  runStart: "runStart",
  levelUp: "levelUp",
  tick: "tick",
  hit: "hit",
  kill: "kill",
  damageTaken: "damageTaken",
  dash: "dash",
  gaugeFill: "gaugeFill",
  runEnd: "runEnd",
});

function invariant(condition, message, data) {
  if (condition) return;
  const err = new Error(message);
  if (data !== undefined) err.data = data;
  throw err;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeTrigger(t) {
  return typeof t === "string" ? t : null;
}

/**
 * EffectDef shape (JS-friendly, not yet data-only):
 * {
 *   id: string,
 *   trigger: keyof TRIGGERS,
 *   when?: (ctx) => boolean,
 *   act: (ctx) => void,
 * }
 */
export function validateEffectDef(def) {
  invariant(isPlainObject(def), "EffectDef must be an object", { def });
  invariant(typeof def.id === "string" && def.id.length > 0, "EffectDef.id must be a string", { def });
  const trigger = normalizeTrigger(def.trigger);
  invariant(trigger && Object.values(TRIGGERS).includes(trigger), `Unknown trigger: ${String(def.trigger)}`, { def });
  if (def.when != null) invariant(typeof def.when === "function", "EffectDef.when must be a function", { def });
  invariant(typeof def.act === "function", "EffectDef.act must be a function", { def });
  return true;
}

function createIndex() {
  const map = new Map();
  for (const t of Object.values(TRIGGERS)) map.set(t, []);
  return map;
}

const EffectSystem = {
  TRIGGERS,

  _index: createIndex(),
  _sources: [],
  _debug: { wouldRunByTrigger: {}, wouldRunBySource: {} },

  reset() {
    this._index = createIndex();
    this._sources = [];
    this._debug = { wouldRunByTrigger: {}, wouldRunBySource: {} };
  },

  /**
   * Registers currently-active sources and builds an index by trigger.
   *
   * Source shape:
   * { sourceId: string, kind: "phial"|"perk"|"mastery"|"other", stacks: number, effects: EffectDef[] }
   */
  setActiveSources(sources) {
    invariant(Array.isArray(sources), "sources must be an array", { sources });
    const nextIndex = createIndex();
    const nextSources = [];

    for (const src of sources) {
      if (!isPlainObject(src)) continue;
      const sourceId = String(src.sourceId || "");
      if (!sourceId) continue;
      const stacks = Math.max(0, Number(src.stacks || 0));
      const effects = Array.isArray(src.effects) ? src.effects : [];

      for (const def of effects) {
        validateEffectDef(def);
        nextIndex.get(def.trigger).push({ sourceId, kind: src.kind || "other", stacks, def });
      }

      nextSources.push({ sourceId, kind: src.kind || "other", stacks, effects });
    }

    this._index = nextIndex;
    this._sources = nextSources;
  },

  getDebugStats() {
    return this._debug;
  },

  /**
   * Applies all effects for a trigger. If `shadow` is true, does not call `act`,
   * but records what would have run (for safe validation during migration).
   */
  trigger(trigger, ctx, { shadow = false } = {}) {
    const t = normalizeTrigger(trigger);
    invariant(t && this._index.has(t), `Unknown trigger: ${String(trigger)}`, { trigger });
    const list = this._index.get(t) || [];
    if (list.length === 0) return;

    for (const entry of list) {
      const { sourceId, def, stacks } = entry;
      const when = def.when;
      let ok = true;
      if (typeof when === "function") {
        try {
          ok = !!when({ ...ctx, stacks, sourceId });
        } catch {
          ok = false;
        }
      }
      if (!ok) continue;

      if (shadow) {
        this._debug.wouldRunByTrigger[t] = (this._debug.wouldRunByTrigger[t] || 0) + 1;
        this._debug.wouldRunBySource[sourceId] = (this._debug.wouldRunBySource[sourceId] || 0) + 1;
        continue;
      }

      def.act({ ...ctx, stacks, sourceId });
    }
  },
};

export default EffectSystem;

