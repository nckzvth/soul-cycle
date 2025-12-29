import { dist2 } from "../core/Utils.js";
import DamageSystem from "../systems/DamageSystem.js";
import StatusSystem from "../systems/StatusSystem.js";
import { MasteryConsecrateZone, MasteryTentacleSlam, MasteryWhirlpool } from "../entities/Projectile.js";
import { AttributeId, StatusId } from "./Vocabulary.js";
import { BALANCE } from "./Balance.js";
import { emitMasteryBurst, emitMasteryProcText, shouldProc } from "../vfx/MasteryVfx.js";

const MASTERY_TUNING = BALANCE?.mastery || {};
const MASTERY_SHARED = MASTERY_TUNING.shared || {};
const MASTERY_ATTR = MASTERY_TUNING.attributes || {};

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clamp(n, lo, hi) {
  const x = toNumber(n);
  return Math.max(lo, Math.min(hi, x));
}

function getAttunement(ctx) {
  return ctx?.player?.metaAttunement || null;
}

function isAttuned(ctx, attrId) {
  return getAttunement(ctx) === attrId;
}

function ensure(obj, key, fallback) {
  if (!obj) return fallback;
  if (obj[key] == null) obj[key] = fallback;
  return obj[key];
}

function ensureMastery(player) {
  return ensure(player, "_mastery", {});
}

function ensureCooldown(player, key) {
  const m = ensureMastery(player);
  m.cd = m.cd || {};
  if (typeof m.cd[key] !== "number") m.cd[key] = 0;
  return m.cd;
}

function tickCooldown(player, dt) {
  const m = ensureMastery(player);
  if (!m.cd) return;
  for (const k of Object.keys(m.cd)) {
    m.cd[k] = Math.max(0, (m.cd[k] || 0) - dt);
  }
}

function applySoaked(enemy, source, { duration = null, slowMult = null } = {}) {
  const t = MASTERY_SHARED.soaked || {};
  if (!enemy || enemy.dead) return;
  const baseSpeed = typeof enemy._masteryBaseSpeed === "number" ? enemy._masteryBaseSpeed : enemy.speed;
  if (typeof enemy._masteryBaseSpeed !== "number") enemy._masteryBaseSpeed = baseSpeed;

  const dur = duration ?? t.durationDefault;
  const slow = slowMult ?? t.slowMultDefault;
  enemy.speed = Math.max(0, baseSpeed * clamp(slow, toNumber(t.slowMultClampMin), toNumber(t.slowMultClampMax)));

  StatusSystem.applyStatus(enemy, StatusId.Soaked, {
    source,
    stacks: 1,
    duration: Math.max(toNumber(t.minDurationSec), toNumber(dur)),
    tickInterval: 9999,
    spec: null,
    snapshotPolicy: "snapshot",
    stackMode: "max",
    maxStacks: 1,
    vfx: {
      interval: toNumber(t?.vfx?.interval),
      color: { token: "fx.uiAccent", alpha: toNumber(t?.vfx?.alpha) },
      count: toNumber(t?.vfx?.count),
      size: toNumber(t?.vfx?.size),
      life: toNumber(t?.vfx?.life),
      radiusAdd: toNumber(t?.vfx?.radiusAdd),
    },
    onExpire: (tgt) => {
      if (!tgt) return;
      const b = typeof tgt._masteryBaseSpeed === "number" ? tgt._masteryBaseSpeed : null;
      if (b != null) tgt.speed = b;
    },
    onExpireData: { baseSpeed },
  });
}

function applyIgnite(enemy, source, { duration = null, stacks = null, coeff = null } = {}) {
  const t = MASTERY_SHARED.ignite || {};
  if (!enemy || enemy.dead) return;
  const c = toNumber(coeff ?? t.coeffDefault);
  const spec = { id: "mastery:ignite", base: 0, coeff: Math.max(0, c), flat: 0, canCrit: false, tags: ["dot"], snapshot: true };
  StatusSystem.applyStatus(enemy, StatusId.Ignited, {
    source,
    stacks: Math.max(1, Math.floor(toNumber(stacks ?? t.stacksDefault))),
    duration: Math.max(toNumber(t.minDurationSec), toNumber(duration ?? t.durationDefault)),
    tickInterval: toNumber(t.tickInterval),
    spec,
    snapshotPolicy: "snapshot",
    stackMode: "add",
    maxStacks: toNumber(t.maxStacks),
    triggerOnHit: false,
    dotTextMode: "aggregate",
    vfx: {
      interval: toNumber(t?.vfx?.interval),
      color: { token: "fx.ember", alpha: toNumber(t?.vfx?.alpha) },
      count: toNumber(t?.vfx?.count),
      size: toNumber(t?.vfx?.size),
      life: toNumber(t?.vfx?.life),
      radiusAdd: toNumber(t?.vfx?.radiusAdd),
    },
  });
}

function pushAway(player, enemy, strength) {
  if (!player || !enemy || enemy.dead) return;
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const s = Math.max(0, strength);
  enemy.vx += (dx / d) * s;
  enemy.vy += (dy / d) * s;
}

function pullToward(point, enemy, strength, player = null) {
  if (!enemy || enemy.dead) return;
  const dx = point.x - enemy.x;
  const dy = point.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  let s = Math.max(0, strength);
  if (player && StatusSystem.hasStatus(enemy, StatusId.Soaked)) {
    const mult = toNumber(player?._mastery?.pullMultOnSoaked);
    if (mult > 0) s *= mult;
  }
  enemy.vx += (dx / d) * s;
  enemy.vy += (dy / d) * s;
}

export function getAttributeMasteryEffectsByNodeId(nodeId) {
  return MASTERY_EFFECTS_BY_NODE_ID[nodeId] || [];
}

export const ATTRIBUTE_MASTERY_CORE_EFFECTS = Object.freeze([
  {
    id: "mastery:core:tick",
    trigger: "tick",
    when: (ctx) => !!ctx?.player,
    act: (ctx) => {
      const p = ctx.player;
      const dt = Math.max(0, toNumber(ctx.dt) || 0);
      if (dt > 0) tickCooldown(p, dt);

      // Reset per-frame multipliers before other mastery effects run.
      p.combatBuffs = p.combatBuffs || {};
      p.combatBuffs.moveSpeedMult = 1.0;
      p.combatBuffs.attackSpeedMult = 1.0;
      p._masteryDashRechargeMult = 1.0;
      p._masteryDamageTakenMultFactor = toNumber(p._masteryDamageTakenMultPersistent) || 1.0;

      // Ensure dash cap is initialized for this run.
      if (typeof p.maxDashCharges !== "number" || !Number.isFinite(p.maxDashCharges)) {
        p.maxDashCharges = BALANCE?.player?.baseDashCharges ?? 2;
      }
    },
  },
]);

// EffectDefs are JS-friendly (like PhialEffectDefs) for Phase 6.
const MASTERY_EFFECTS_BY_NODE_ID = {
  // --- MIGHT (Cinder) ---
  might_01_kindling: [
    {
      id: "mastery:might_01_kindling:hit",
      trigger: "hit",
      when: (ctx) => !!ctx?.player && !!ctx?.target && !ctx.target.dead,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_01_kindling || {};
        const m = ensureMastery(ctx.player);
        const coeff = toNumber(m.igniteCoeff) || toNumber(MASTERY_SHARED?.ignite?.coeffDefault);
        const stacks = Math.max(1, Math.floor(toNumber(m.igniteStacks) || toNumber(MASTERY_SHARED?.ignite?.stacksDefault)));
        const dur = Math.max(0.5, toNumber(m.igniteDuration) || toNumber(MASTERY_SHARED?.ignite?.durationDefault));
        const wasIgnited = StatusSystem.hasStatus(ctx.target, StatusId.Ignited);
        applyIgnite(ctx.target, ctx.player, { duration: dur, stacks, coeff });
        const now = ctx?.game?.time || 0;
        if (!wasIgnited && Math.random() < toNumber(t.igniteTextChance) && shouldProc(ctx.target, "mastery:igniteText", toNumber(t.igniteTextIcd), now)) {
          emitMasteryBurst({ x: ctx.target.x, y: ctx.target.y, colorToken: { token: "fx.ember", alpha: 0.9 }, count: 7, speed: 140, size: 2.6, life: 0.28 });
          emitMasteryProcText({ x: ctx.target.x, y: ctx.target.y - (ctx.target.r || 12) - 12, text: "IGNITE", colorToken: { token: "fx.ember", alpha: 0.95 }, size: 13, life: 0.55 });
        }
      },
    },
  ],
  might_02_deepen_ignite: [
    {
      id: "mastery:might_02_deepen_ignite:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_02_deepen_ignite || {};
        const m = ensureMastery(ctx.player);
        const base = toNumber(m.igniteCoeff) || toNumber(MASTERY_SHARED?.ignite?.coeffDefault);
        m.igniteCoeff = Math.max(0, base * toNumber(t.igniteCoeffMult));
      },
    },
  ],
  might_03_hearth_regen: [
    {
      id: "mastery:might_03_hearth_regen:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_03_hearth_regen || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        if (dt <= 0) return;

        const m = ensureMastery(p);
        m.hearth = m.hearth || { stacks: 0, decayTimer: 0 };

        // Count ignited enemies nearby as "heat".
        const range = toNumber(t.heatRadius);
        let count = 0;
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (!StatusSystem.hasStatus(e, StatusId.Ignited)) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= range * range) count++;
        }

        const capBase = toNumber(t.hearthCapBase);
        const cap = isAttuned(ctx, AttributeId.Might) ? capBase + toNumber(t.hearthCapAttunedBonus) : capBase;

        // Add a bit of inertia so stacks don't jitter as enemies cross the radius.
        if (count > 0) {
          m.hearth.stacks = Math.min(cap, Math.max(m.hearth.stacks || 0, count));
          m.hearth.decayTimer = toNumber(t.decayHoldSeconds);
        } else {
          m.hearth.decayTimer = Math.max(0, (m.hearth.decayTimer || 0) - dt);
          if (m.hearth.decayTimer <= 0) {
            const decay = isAttuned(ctx, AttributeId.Might) ? toNumber(t.decayPerSecAttuned) : toNumber(t.decayPerSec);
            const decayMult = Math.max(0, toNumber(m.hearthDecayMult) || 1.0);
            m.hearth.stacks = Math.max(0, (m.hearth.stacks || 0) - dt * decay * decayMult);
          }
        }

        // Regen: small and capped.
        const stacks = Math.max(0, Math.floor(m.hearth.stacks || 0));
        if (stacks <= 0) return;
        const healPerSec = toNumber(t.healPerSecPerStack) * stacks;
        p.hp = Math.min(p.hpMax, p.hp + healPerSec * dt);
      },
    },
  ],
  might_04_press_the_burn: [
    {
      id: "mastery:might_04_press_the_burn:hit",
      trigger: "hit",
      when: (ctx) => !!ctx?.player && !!ctx?.target && StatusSystem.hasStatus(ctx.target, StatusId.Ignited),
      act: (ctx) => {
        const tn = MASTERY_ATTR?.Might?.might_04_press_the_burn || {};
        // On-hit accelerant: add an extra ignite stack (ICD per target).
        const p = ctx.player;
        const t = ctx.target;
        const now = toNumber(ctx?.state?.game?.time) || 0;
        t._masteryIgniteHitCdUntil = t._masteryIgniteHitCdUntil || 0;
        if (now < t._masteryIgniteHitCdUntil) return;
        t._masteryIgniteHitCdUntil = now + toNumber(tn.perTargetIcdSec);

        const m = ensureMastery(p);
        const coeff = toNumber(m.igniteCoeff) || toNumber(MASTERY_SHARED?.ignite?.coeffDefault);
        applyIgnite(t, p, { duration: toNumber(tn.durationSec), stacks: 1, coeff });
      },
    },
  ],
  might_05a_phoenix_covenant: [
    {
      id: "mastery:might_05a_phoenix_covenant:kill",
      trigger: "kill",
      when: (ctx) => !!ctx?.player && !!ctx?.enemy && StatusSystem.hasStatus(ctx.enemy, StatusId.Ignited),
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_05a_phoenix_covenant || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "phoenix");
        if ((cd.phoenix || 0) > 0) return;
        cd.phoenix = toNumber(t.cdSec);

        const heal =
          toNumber(t.healNonElite) +
          (ctx.enemy?.isElite ? toNumber(t.healEliteBonus) : 0) +
          (ctx.enemy?.isBoss ? toNumber(t.healBossBonus) : 0);
        p.hp = Math.min(p.hpMax, p.hp + heal);
        const m = ensureMastery(p);
        m.phoenixRegenTimer = Math.max(m.phoenixRegenTimer || 0, toNumber(t.buffDurationSec));
        m.phoenixMoveTimer = Math.max(m.phoenixMoveTimer || 0, toNumber(t.buffDurationSec));
      },
    },
    {
      id: "mastery:might_05a_phoenix_covenant:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_05a_phoenix_covenant || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        if ((m.phoenixRegenTimer || 0) > 0) {
          m.phoenixRegenTimer = Math.max(0, m.phoenixRegenTimer - dt);
          p.hp = Math.min(p.hpMax, p.hp + toNumber(t.regenPerSec) * dt);
        }
        if ((m.phoenixMoveTimer || 0) > 0) {
          m.phoenixMoveTimer = Math.max(0, m.phoenixMoveTimer - dt);
          p.combatBuffs.moveSpeedMult *= toNumber(t.moveSpeedMult);
        }
      },
    },
  ],
  might_05b_sanctified_hearth: [
    {
      id: "mastery:might_05b_sanctified_hearth:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_05b_sanctified_hearth || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "consecrate");
        if ((cd.consecrate || 0) > 0) return;
        cd.consecrate = toNumber(t.cdSec);
        ctx.state.shots = Array.isArray(ctx.state.shots) ? ctx.state.shots : [];
        ctx.state.shots.push(new MasteryConsecrateZone(ctx.state, p, p.x, p.y, { radius: toNumber(t.zoneRadius), life: toNumber(t.zoneLifeSec), igniteCoeff: toNumber(t.zoneIgniteCoeff) }));
      },
    },
  ],
  might_06_ember_spread: [
    {
      id: "mastery:might_06_ember_spread:kill",
      trigger: "kill",
      when: (ctx) => !!ctx?.player && !!ctx?.enemy && StatusSystem.hasStatus(ctx.enemy, StatusId.Ignited),
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_06_ember_spread || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "emberSpread");
        if ((cd.emberSpread || 0) > 0) return;
        cd.emberSpread = toNumber(t.cdSec);

        const radius = isAttuned(ctx, AttributeId.Might) ? toNumber(t.radiusAttuned) : toNumber(t.radius);
        const coeff = toNumber(ensureMastery(p).igniteCoeff) || toNumber(MASTERY_SHARED?.ignite?.coeffDefault);
        for (const e of ctx.state?.enemies || []) {
          if (!e || e.dead) continue;
          if (e === ctx.enemy) continue;
          if (StatusSystem.hasStatus(e, StatusId.Ignited)) continue;
          if (dist2(ctx.enemy.x, ctx.enemy.y, e.x, e.y) <= radius * radius) {
            applyIgnite(e, p, { duration: toNumber(t.durationSec), stacks: 1, coeff: coeff * toNumber(t.coeffMult) });
          }
        }
      },
    },
  ],
  might_07_flames_of_hearth: [
    {
      id: "mastery:might_07_flames_of_hearth:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_07_flames_of_hearth || {};
        const m = ensureMastery(ctx.player);
        m.hearthDecayMult = toNumber(t.hearthDecayMult);
      },
    },
  ],
  might_08_ignite_mastery: [
    {
      id: "mastery:might_08_ignite_mastery:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_08_ignite_mastery || {};
        const m = ensureMastery(ctx.player);
        m.igniteStacks = (toNumber(m.igniteStacks) || toNumber(MASTERY_SHARED?.ignite?.stacksDefault)) + toNumber(t.igniteStacksAdd);
      },
    },
  ],
  might_10a_cinderstorm_moment: [
    {
      id: "mastery:might_10a_cinderstorm_moment:kill",
      trigger: "kill",
      when: (ctx) => !!ctx?.player && !!ctx?.enemy && (ctx.enemy.isElite || ctx.enemy.isBoss),
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_10a_cinderstorm_moment || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "cinderstorm");
        if ((cd.cinderstorm || 0) > 0) return;
        cd.cinderstorm = toNumber(t.cdSec);

        const radius = toNumber(t.radius);
        const coeff = (toNumber(ensureMastery(p).igniteCoeff) || toNumber(MASTERY_SHARED?.ignite?.coeffDefault)) * toNumber(t.coeffMult);
        for (const e of ctx.state?.enemies || []) {
          if (!e || e.dead) continue;
          if (dist2(ctx.enemy.x, ctx.enemy.y, e.x, e.y) <= radius * radius) {
            applyIgnite(e, p, { duration: toNumber(t.durationSec), stacks: toNumber(t.stacks), coeff });
          }
        }
      },
    },
  ],
  might_10b_phoenix_rebirth: [
    {
      id: "mastery:might_10b_phoenix_rebirth:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Might?.might_10b_phoenix_rebirth || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        const cd = ensureCooldown(p, "phoenixRebirth");

        if ((m._rebirthDrTimer || 0) > 0) m._rebirthDrTimer = Math.max(0, m._rebirthDrTimer - dt);

        const pct = p.hpMax > 0 ? p.hp / p.hpMax : 1;
        if (pct > toNumber(t.hpPctThreshold)) return;
        if ((cd.phoenixRebirth || 0) > 0) return;

        // Consume hearth stacks as a one-shot rescue.
        const hearth = Math.max(0, Math.floor(m.hearth?.stacks || 0));
        if (hearth <= 0) return;
        cd.phoenixRebirth = toNumber(t.cdSec);

        const heal = toNumber(t.healBase) + hearth * toNumber(t.healPerHearth);
        p.hp = Math.min(p.hpMax, p.hp + heal);
        m._rebirthDrTimer = toNumber(t.drDurationSec);
        m._rebirthDrMult = toNumber(t.drMult);
      },
    },
    {
      id: "mastery:might_10b_phoenix_rebirth:dr",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const p = ctx.player;
        const m = ensureMastery(p);
        if ((m._rebirthDrTimer || 0) > 0) {
          p._masteryDamageTakenMultFactor = Math.min(p._masteryDamageTakenMultFactor || 1.0, m._rebirthDrMult || 1.0);
        }
      },
    },
  ],

  // --- WILL (Tide) ---
  will_01_soak: [
    {
      id: "mastery:will_01_soak:hit",
      trigger: "hit",
      when: (ctx) => !!ctx?.player && !!ctx?.target && !ctx.target.dead,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_01_soak || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        const slowMult = (m.soakSlowMult != null) ? m.soakSlowMult : toNumber(t.slowMultDefault);
        const dur = (m.soakDuration != null) ? m.soakDuration : toNumber(t.durationDefault);
        const wasSoaked = StatusSystem.hasStatus(ctx.target, StatusId.Soaked);
        applySoaked(ctx.target, p, { duration: dur, slowMult });
        const now = ctx?.game?.time || 0;
        if (!wasSoaked && Math.random() < toNumber(t.soakTextChance) && shouldProc(ctx.target, "mastery:soakText", toNumber(t.soakTextIcd), now)) {
          emitMasteryBurst({ x: ctx.target.x, y: ctx.target.y, colorToken: { token: "fx.uiAccent", alpha: 0.9 }, count: 7, speed: 130, size: 2.6, life: 0.28 });
          emitMasteryProcText({ x: ctx.target.x, y: ctx.target.y - (ctx.target.r || 12) - 12, text: "SOAKED", colorToken: { token: "fx.uiText", alpha: 0.95 }, size: 13, life: 0.55 });
        }
      },
    },
  ],
  will_02_undertow_drag: [
    {
      id: "mastery:will_02_undertow_drag:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_02_undertow_drag || {};
        const m = ensureMastery(ctx.player);
        m.pullMultOnSoaked = toNumber(t.pullMultOnSoaked);
      },
    },
  ],
  will_03_lunar_tide: [
    {
      id: "mastery:will_03_lunar_tide:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_03_lunar_tide || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        // Modest "drift": add magnetism while active.
        if (typeof m._baseMagnetism !== "number") m._baseMagnetism = toNumber(p.stats?.magnetism);
        const base = toNumber(m._baseMagnetism);
        const bonus = isAttuned(ctx, AttributeId.Will) ? toNumber(t.magnetismBonusAttuned) : toNumber(t.magnetismBonus);
        if (p.stats) p.stats.magnetism = base + bonus;
      },
    },
  ],
  will_04_conductive_water: [
    {
      id: "mastery:will_04_conductive_water:hit",
      trigger: "hit",
      when: (ctx) => !!ctx?.player && !!ctx?.target && StatusSystem.hasStatus(ctx.target, StatusId.Soaked),
      act: (ctx) => {
        const tn = MASTERY_ATTR?.Will?.will_04_conductive_water || {};
        const tgt = ctx.target;
        tgt._masteryConductiveHits = (tgt._masteryConductiveHits || 0) + 1;
        if (tgt._masteryConductiveHits < toNumber(tn.hitsRequired)) return;
        tgt._masteryConductiveHits = 0;
        const was = StatusSystem.hasStatus(tgt, StatusId.Conductive);
        StatusSystem.applyStatus(tgt, StatusId.Conductive, {
          source: ctx.player,
          stacks: 1,
          duration: toNumber(tn.durationSec),
          tickInterval: 9999,
          spec: null,
          snapshotPolicy: "snapshot",
          stackMode: "max",
          maxStacks: 1,
          vfx: {
            interval: 0.4,
            color: { token: "fx.uiText", alpha: 0.33 },
            count: 1,
            size: 2.1,
            life: 0.2,
            radiusAdd: 12,
          },
        });
        const now = ctx?.game?.time || 0;
        if (!was && Math.random() < toNumber(tn.conductiveTextChance) && shouldProc(tgt, "mastery:conductiveText", toNumber(tn.conductiveTextIcd), now)) {
          emitMasteryBurst({ x: tgt.x, y: tgt.y, colorToken: { token: "fx.uiText", alpha: 0.95 }, count: 9, speed: 150, size: 2.6, life: 0.28 });
          emitMasteryProcText({ x: tgt.x, y: tgt.y - (tgt.r || 12) - 12, text: "CONDUCTIVE", colorToken: { token: "fx.uiText", alpha: 0.95 }, size: 12, life: 0.55 });
        }
      },
    },
  ],
  will_05a_whirlpool_curse: [
    {
      id: "mastery:will_05a_whirlpool_curse:kill",
      trigger: "kill",
      when: (ctx) => !!ctx?.player && !!ctx?.state && !!ctx?.enemy,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_05a_whirlpool_curse || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "whirlpool");
        if ((cd.whirlpool || 0) > 0) return;
        cd.whirlpool = toNumber(t.cdSec);

        const major = isAttuned(ctx, AttributeId.Will) && ctx.player?._masteryHasWillCapstoneMaelstrom;
        const max = major ? toNumber(t.maxMajor) : toNumber(t.max);
        const radius = major ? toNumber(t.radiusMajor) : toNumber(t.radius);
        const pull = major ? toNumber(t.pullStrengthMajor) : toNumber(t.pullStrength);
        const life = major ? toNumber(t.lifeSecMajor) : toNumber(t.lifeSec);

        ctx.state.shots = Array.isArray(ctx.state.shots) ? ctx.state.shots : [];
        const existing = ctx.state.shots.filter((s) => s && s.isMasteryWhirlpool);
        if (existing.length >= max) {
          existing.sort((a, b) => (a.creationTime || 0) - (b.creationTime || 0));
          const oldest = existing[0];
          const idx = ctx.state.shots.indexOf(oldest);
          if (idx >= 0) ctx.state.shots.splice(idx, 1);
        }
        ctx.state.shots.push(new MasteryWhirlpool(ctx.state, p, ctx.enemy.x, ctx.enemy.y, { radius, pullStrength: pull, life }));
      },
    },
  ],
  will_05b_abyssal_tentacle: [
    {
      id: "mastery:will_05b_abyssal_tentacle:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_05b_abyssal_tentacle || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const cd = ensureCooldown(p, "tentacle");
        tickCooldown(p, dt);
        if ((cd.tentacle || 0) > 0) return;
        cd.tentacle = toNumber(t.cdSec);

        // Find a small cluster: closest enemy to player.
        let best = null;
        let bestD2 = toNumber(t.clusterRadius) * toNumber(t.clusterRadius);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          const d2 = dist2(p.x, p.y, e.x, e.y);
          if (d2 < bestD2) { bestD2 = d2; best = e; }
        }
        if (!best) return;

        const upgraded = isAttuned(ctx, AttributeId.Will) && p._masteryHasWillCapstoneDeep;
        const radius = upgraded ? toNumber(t.radiusUpgraded) : toNumber(t.radius);
        ctx.state.shots = Array.isArray(ctx.state.shots) ? ctx.state.shots : [];
        ctx.state.shots.push(new MasteryTentacleSlam(ctx.state, p, best.x, best.y, { radius, life: toNumber(t.lifeSec), upgraded }));
      },
    },
  ],
  will_06_high_tide_window: [
    {
      id: "mastery:will_06_high_tide_window:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_06_high_tide_window || {};
        const m = ensureMastery(ctx.player);
        m.soakDuration = toNumber(t.soakDuration);
        m.soakSlowMult = toNumber(t.soakSlowMult);
      },
    },
  ],
  will_07_tempest_conductor: [
    {
      id: "mastery:will_07_tempest_conductor:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_07_tempest_conductor || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        tickCooldown(p, dt);
        const cd = ensureCooldown(p, "conductiveArc");
        if ((cd.conductiveArc || 0) > 0) return;
        cd.conductiveArc = toNumber(t.cdSec);

        const enemies = ctx.state.enemies || [];
        for (const e of enemies) {
          if (!e || e.dead) continue;
          if (!StatusSystem.hasStatus(e, StatusId.Conductive)) continue;
          // Micro-pull: nudge toward player.
          pullToward({ x: p.x, y: p.y }, e, toNumber(t.microPullStrength), p);
          applySoaked(e, p, { duration: toNumber(t.soakedDuration), slowMult: toNumber(t.soakedSlowMult) });
          break;
        }
      },
    },
  ],
  will_08_moonbound_current: [
    {
      id: "mastery:will_08_moonbound_current:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Will?.will_08_moonbound_current || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        if (typeof m._lastSouls !== "number") m._lastSouls = toNumber(p.souls);
        const now = toNumber(p.souls);
        if (now > m._lastSouls) {
          m._moonboundTimer = toNumber(t.buffDurationSec);
        }
        m._lastSouls = now;
        if ((m._moonboundTimer || 0) > 0) {
          m._moonboundTimer = Math.max(0, m._moonboundTimer - dt);
          m.soakDuration = toNumber(t.soakDuration);
          m.soakSlowMult = toNumber(t.soakSlowMult);
        }
      },
    },
  ],
  will_10a_maelstrom: [
    {
      id: "mastery:will_10a_maelstrom:flag",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        ctx.player._masteryHasWillCapstoneMaelstrom = true;
      },
    },
  ],
  will_10b_call_of_the_deep: [
    {
      id: "mastery:will_10b_call_of_the_deep:flag",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        ctx.player._masteryHasWillCapstoneDeep = true;
      },
    },
  ],

  // --- ALACRITY (Gale) ---
  alac_01_windstep: [
    {
      id: "mastery:alac_01_windstep:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_01_windstep || {};
        if (!ctx.player.stats) return;
        ctx.player.stats.moveSpeedMult *= toNumber(t.moveSpeedMult);
      },
    },
  ],
  alac_02_quickhands: [
    {
      id: "mastery:alac_02_quickhands:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_02_quickhands || {};
        if (!ctx.player.stats) return;
        ctx.player.stats.attackSpeed *= toNumber(t.attackSpeedMult);
      },
    },
  ],
  alac_03_gust_spacing: [
    {
      id: "mastery:alac_03_gust_spacing:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_03_gust_spacing || {};
        const p = ctx.player;
        const strength = isAttuned(ctx, AttributeId.Alacrity) ? toNumber(t.strengthAttuned) : toNumber(t.strength);
        const r = toNumber(t.radius);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= r * r) pushAway(p, e, strength);
        }
      },
    },
  ],
  alac_04_guided_projectiles: [
    {
      id: "mastery:alac_04_guided_projectiles:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_04_guided_projectiles || {};
        if (!ctx.player.stats) return;
        ctx.player.stats.masteryProjectileGuidance = Math.max(ctx.player.stats.masteryProjectileGuidance || 0, toNumber(t.guidanceLevel));
      },
    },
  ],
  alac_05a_pinball_dash: [
    {
      id: "mastery:alac_05a_pinball_dash:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_05a_pinball_dash || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        m.pinball = m.pinball || { remaining: 0 };

        // Start/continue a chain on each dash end while attuned.
        if (!isAttuned(ctx, AttributeId.Alacrity)) {
          m.pinball.remaining = 0;
          return;
        }

        if (m.pinball.remaining <= 0) m.pinball.remaining = Math.floor(toNumber(t.chainCount));
        if (m.pinball.remaining <= 0) return;

        const radius = toNumber(t.targetRadius);
        let best = null;
        let bestD2 = radius * radius;
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          const d2 = dist2(p.x, p.y, e.x, e.y);
          if (d2 < bestD2) { bestD2 = d2; best = e; }
        }
        if (!best || p.dashCharges <= 0) {
          // End wave.
          const strength = toNumber(t.endWaveStrength);
          const r = toNumber(t.endWaveRadius);
          for (const e of ctx.state.enemies || []) {
            if (!e || e.dead) continue;
            if (dist2(p.x, p.y, e.x, e.y) <= r * r) pushAway(p, e, strength);
          }
          m.pinball.remaining = 0;
          return;
        }

        // Consume a charge, dash again toward target.
        p.dashCharges = Math.max(0, p.dashCharges - 1);
        const dx = best.x - p.x;
        const dy = best.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.dashVec = { x: dx / d, y: dy / d };
        p.dashTimer = toNumber(t.dashTimerSec);
        m.pinball.remaining -= 1;
      },
    },
  ],
  alac_05b_gale_dancer: [
    {
      id: "mastery:alac_05b_gale_dancer:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_05b_gale_dancer || {};
        const p = ctx.player;
        if (!isAttuned(ctx, AttributeId.Alacrity)) return;
        const m = ensureMastery(p);
        m.momentum = m.momentum || { stacks: 0, timer: 0 };
        m.momentum.stacks = Math.min(Math.floor(toNumber(t.maxStacks)), (m.momentum.stacks || 0) + 1);
        m.momentum.timer = toNumber(t.durationSec);
      },
    },
    {
      id: "mastery:alac_05b_gale_dancer:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_05b_gale_dancer || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        const mm = m.momentum;
        if (!mm) return;
        mm.timer = Math.max(0, (mm.timer || 0) - dt);
        if (mm.timer <= 0) mm.stacks = Math.max(0, (mm.stacks || 0) - dt * toNumber(t.decayPerSec));
        const stacks = Math.max(0, Math.floor(mm.stacks || 0));
        p.combatBuffs.moveSpeedMult *= 1 + stacks * toNumber(t.moveSpeedPerStack);
        p.combatBuffs.attackSpeedMult *= 1 + stacks * toNumber(t.attackSpeedPerStack);
      },
    },
  ],
  alac_06_extra_charge: [
    {
      id: "mastery:alac_06_extra_charge:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_06_extra_charge || {};
        const p = ctx.player;
        const base = toNumber(p.maxDashCharges) || 0;
        p.maxDashCharges = Math.max(base, 1) + Math.floor(toNumber(t.extraCharges));
        p.dashCharges = Math.min(p.maxDashCharges, Math.max(p.dashCharges, p.maxDashCharges));
      },
    },
    {
      id: "mastery:alac_06_extra_charge:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_06_extra_charge || {};
        const p = ctx.player;
        if (isAttuned(ctx, AttributeId.Alacrity)) p._masteryDashRechargeMult *= toNumber(t.rechargeMultAttuned);
      },
    },
  ],
  alac_07_slipstream: [
    {
      id: "mastery:alac_07_slipstream:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_07_slipstream || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        m.slipstream = m.slipstream || { stacks: 0 };
        const mv = p._sprite?.move || { x: 0, y: 0 };
        const moving = Math.abs(mv.x) + Math.abs(mv.y) > toNumber(t.movingThreshold) && (p.dashTimer || 0) <= 0;
        if (moving) m.slipstream.stacks = Math.min(Math.floor(toNumber(t.maxStacks)), (m.slipstream.stacks || 0) + dt * toNumber(t.buildPerSec));
        else m.slipstream.stacks = Math.max(0, (m.slipstream.stacks || 0) - dt * toNumber(t.decayPerSec));
        const stacks = Math.max(0, Math.floor(m.slipstream.stacks || 0));
        p.combatBuffs.moveSpeedMult *= (1 + stacks * toNumber(t.moveSpeedPerStack));
      },
    },
  ],
  alac_08_windguard: [
    {
      id: "mastery:alac_08_windguard:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player,
      act: (ctx) => {
        const m = ensureMastery(ctx.player);
        const t = MASTERY_ATTR?.Alacrity?.alac_08_windguard || {};
        m.windguard = toNumber(t.durationSec);
      },
    },
    {
      id: "mastery:alac_08_windguard:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_08_windguard || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        if ((m.windguard || 0) > 0) m.windguard = Math.max(0, m.windguard - dt);
        if ((m.windguard || 0) > 0) p._masteryDamageTakenMultFactor = Math.min(p._masteryDamageTakenMultFactor || 1.0, toNumber(t.damageTakenMult));
      },
    },
  ],
  alac_10a_cyclone_break: [
    {
      id: "mastery:alac_10a_cyclone_break:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_10a_cyclone_break || {};
        if (!isAttuned(ctx, AttributeId.Alacrity)) return;
        const p = ctx.player;
        const m = ensureMastery(p);
        const stacks = Math.floor(m?.momentum?.stacks || 0);
        if (stacks < Math.floor(toNumber(t.requiredMomentumStacks))) return;
        const r = toNumber(t.radius);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
            pushAway(p, e, toNumber(t.pushStrength));
            applySoaked(e, p, { duration: toNumber(t.soakedDuration), slowMult: toNumber(t.soakedSlowMult) });
          }
        }
      },
    },
  ],
  alac_10b_perfect_cadence: [
    {
      id: "mastery:alac_10b_perfect_cadence:dashEnd",
      trigger: "dash",
      when: (ctx) => ctx?.dash?.phase === "end" && !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_10b_perfect_cadence || {};
        if (!isAttuned(ctx, AttributeId.Alacrity)) return;
        const m = ensureMastery(ctx.player);
        m.cadence = { ready: true, timer: toNumber(t.windowSec) };
      },
    },
    {
      id: "mastery:alac_10b_perfect_cadence:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        if (!m.cadence) return;
        m.cadence.timer = Math.max(0, (m.cadence.timer || 0) - dt);
        if (m.cadence.timer <= 0) m.cadence.ready = false;
      },
    },
    {
      id: "mastery:alac_10b_perfect_cadence:hit",
      trigger: "hit",
      when: (ctx) => !!ctx?.player && !!ctx?.target,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Alacrity?.alac_10b_perfect_cadence || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        if (!m.cadence?.ready) return;
        if (!isAttuned(ctx, AttributeId.Alacrity)) return;
        m.cadence.ready = false;
        const spec = { id: "mastery:cadence", base: toNumber(t.damageBase), coeff: toNumber(t.damageCoeff), flat: 0, canCrit: false, tags: ["aoe"], snapshot: true };
        const snap = DamageSystem.snapshotOutgoing(p, spec);
        DamageSystem.dealDamage(p, ctx.target, spec, { state: ctx.state, snapshot: snap });
      },
    },
  ],

  // --- CONSTITUTION (Ossuary) ---
  con_01_ward_seed: [
    {
      id: "mastery:con_01_ward_seed:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_01_ward_seed || {};
        const p = ctx.player;
        p._wardEnabled = true;
        p.wardMax = Math.max(0, toNumber(p.wardMax) || 0) + toNumber(t.wardMaxAdd);
        p.ward = Math.max(toNumber(p.wardMax) || 0, Math.max(0, toNumber(p.ward) || 0));

        const now = ctx?.game?.time || 0;
        if (shouldProc(p, "mastery:wardOnline", toNumber(t.wardOnlineIcd), now)) {
          emitMasteryBurst({ x: p.x, y: p.y, colorToken: { token: "player.guard", alpha: 0.95 }, count: 16, speed: 190, size: 3.0, life: 0.35 });
          emitMasteryProcText({ x: p.x, y: p.y - (p.r || 12) - 18, text: "WARD ACTIVE", colorToken: { token: "player.guard", alpha: 0.95 }, size: 13, life: 0.8 });
        }
      },
    },
  ],
  con_02_stonehide: [
    {
      id: "mastery:con_02_stonehide:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player && !!ctx.player.stats,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_02_stonehide || {};
        ctx.player._masteryDamageTakenMultPersistent = (ctx.player._masteryDamageTakenMultPersistent || 1.0) * toNumber(t.damageTakenMult);
      },
    },
  ],
  con_03_thorn_marrow: [
    {
      id: "mastery:con_03_thorn_marrow:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player && !!ctx?.source,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_03_thorn_marrow || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "thorns");
        if ((cd.thorns || 0) > 0) return;
        cd.thorns = toNumber(t.cdSec);
        const mult = isAttuned(ctx, AttributeId.Constitution) ? toNumber(t.multAttuned) : 1.0;
        const spec = { id: "mastery:thorns", base: toNumber(t.damageBase), coeff: toNumber(t.damageCoeff) * mult, flat: 0, canCrit: false, tags: ["aoe"], snapshot: true };
        const snap = DamageSystem.snapshotOutgoing(p, spec);
        // Retaliate vs nearest enemy to the damage source location.
        const state = ctx.state;
        if (state?.enemies) {
          let best = null;
          let bestD2 = toNumber(t.targetRadius) * toNumber(t.targetRadius);
          for (const e of state.enemies) {
            if (!e || e.dead) continue;
            const d2 = dist2(ctx.source.x || p.x, ctx.source.y || p.y, e.x, e.y);
            if (d2 < bestD2) { bestD2 = d2; best = e; }
          }
          if (best) DamageSystem.dealDamage(p, best, spec, { state, snapshot: snap });
        }
      },
    },
  ],
  con_04_bone_plating: [
    {
      id: "mastery:con_04_bone_plating:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_04_bone_plating || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        // Approximate "big hit": low HP moment.
        const pct = p.hpMax > 0 ? p.hp / p.hpMax : 1;
        if (pct > toNumber(t.hpPctThreshold)) return;
        m.boneShieldTimer = Math.max(m.boneShieldTimer || 0, toNumber(t.durationSec));
      },
    },
    {
      id: "mastery:con_04_bone_plating:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_04_bone_plating || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        if ((m.boneShieldTimer || 0) > 0) m.boneShieldTimer = Math.max(0, m.boneShieldTimer - dt);
        if ((m.boneShieldTimer || 0) > 0) p._masteryDamageTakenMultFactor = Math.min(p._masteryDamageTakenMultFactor || 1.0, toNumber(t.damageTakenMult));
      },
    },
  ],
  con_05a_wardweaver: [
    {
      id: "mastery:con_05a_wardweaver:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_05a_wardweaver || {};
        const p = ctx.player;
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        const m = ensureMastery(p);
        // Out of danger regen: if no damage taken recently.
        m.lastDamageTimer = Math.max(0, (m.lastDamageTimer || 0) - dt);
        if ((m.lastDamageTimer || 0) <= 0 && (p._wardEnabled || false)) {
          p.ward = Math.min(toNumber(p.wardMax) || 0, (toNumber(p.ward) || 0) + toNumber(t.wardPerSec) * dt);
        }
      },
    },
    {
      id: "mastery:con_05a_wardweaver:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_05a_wardweaver || {};
        const m = ensureMastery(ctx.player);
        m.lastDamageTimer = toNumber(t.outOfDangerDelaySec);
      },
    },
  ],
  con_05b_bone_mirror: [
    {
      id: "mastery:con_05b_bone_mirror:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_05b_bone_mirror || {};
        const p = ctx.player;
        const m = ensureMastery(p);
        if ((m.boneShieldTimer || 0) <= 0) return;
        // Reflect as a small shard burst (capped).
        const cd = ensureCooldown(p, "boneMirror");
        if ((cd.boneMirror || 0) > 0) return;
        cd.boneMirror = toNumber(t.cdSec);
        const spec = { id: "mastery:boneMirror", base: toNumber(t.damageBase), coeff: toNumber(t.damageCoeff), flat: 0, canCrit: false, tags: ["aoe"], snapshot: true };
        const snap = DamageSystem.snapshotOutgoing(p, spec);
        const r = toNumber(t.radius);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
            DamageSystem.dealDamage(p, e, spec, { state: ctx.state, snapshot: snap });
          }
        }
      },
    },
  ],
  con_06_more_ward: [
    {
      id: "mastery:con_06_more_ward:runStart",
      trigger: "runStart",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_06_more_ward || {};
        ctx.player.wardMax = Math.max(0, toNumber(ctx.player.wardMax) || 0) + toNumber(t.wardMaxAdd);
      },
    },
  ],
  con_07_splinterburst: [
    {
      id: "mastery:con_07_splinterburst:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_07_splinterburst || {};
        const p = ctx.player;
        const cd = ensureCooldown(p, "splinterburst");
        if ((cd.splinterburst || 0) > 0) return;
        cd.splinterburst = toNumber(t.cdSec);
        const spec = { id: "mastery:splinterburst", base: toNumber(t.damageBase), coeff: toNumber(t.damageCoeff), flat: 0, canCrit: false, tags: ["aoe"], snapshot: true };
        const snap = DamageSystem.snapshotOutgoing(p, spec);
        const r = toNumber(t.radius);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
            DamageSystem.dealDamage(p, e, spec, { state: ctx.state, snapshot: snap });
            if (isAttuned(ctx, AttributeId.Constitution)) applySoaked(e, p, { duration: toNumber(t.soakedDurationAttuned), slowMult: toNumber(t.soakedSlowMultAttuned) });
          }
        }
      },
    },
  ],
  con_08_granite_oath: [
    {
      id: "mastery:con_08_granite_oath:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_08_granite_oath || {};
        const p = ctx.player;
        const max = toNumber(p.wardMax) || 0;
        const cur = toNumber(p.ward) || 0;
        if (max <= 0) return;
        const pct = cur / max;
        if (pct >= toNumber(t.wardPctThreshold)) p._masteryDamageTakenMultFactor = Math.min(p._masteryDamageTakenMultFactor || 1.0, toNumber(t.damageTakenMult));
      },
    },
  ],
  con_10a_fortress_protocol: [
    {
      id: "mastery:con_10a_fortress_protocol:tick",
      trigger: "tick",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const p = ctx.player;
        const m = ensureMastery(p);
        const dt = Math.max(0, toNumber(ctx.dt) || 0);
        if ((m._fortressProc || 0) > 0) m._fortressProc = Math.max(0, m._fortressProc - dt);
      },
    },
    {
      id: "mastery:con_10a_fortress_protocol:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_10a_fortress_protocol || {};
        const p = ctx.player;
        if (!(p._wardEnabled || false)) return;
        const cd = ensureCooldown(p, "fortress");
        if ((cd.fortress || 0) > 0) return;
        const ward = toNumber(p.ward) || 0;
        if (ward > 0) return;
        cd.fortress = toNumber(t.cdSec);
        p.ward = Math.min(toNumber(p.wardMax) || 0, (toNumber(p.wardMax) || 0) * toNumber(t.wardRefillPct));
        p.rooted = 0;
        p.rootImmunity = Math.max(p.rootImmunity || 0, toNumber(t.rootImmunitySec));
      },
    },
  ],
  con_10b_break_upon_me: [
    {
      id: "mastery:con_10b_break_upon_me:damageTaken",
      trigger: "damageTaken",
      when: (ctx) => !!ctx?.player && !!ctx?.state,
      act: (ctx) => {
        const t = MASTERY_ATTR?.Constitution?.con_10b_break_upon_me || {};
        const p = ctx.player;
        if (!(p._wardEnabled || false)) return;
        if ((toNumber(p.ward) || 0) <= 0) return;
        // Stronger thorns against elites while ward holds.
        const cd = ensureCooldown(p, "breakUponMe");
        if ((cd.breakUponMe || 0) > 0) return;
        cd.breakUponMe = toNumber(t.cdSec);
        const spec = { id: "mastery:breakUponMe", base: toNumber(t.damageBase), coeff: toNumber(t.damageCoeff), flat: 0, canCrit: false, tags: ["aoe"], snapshot: true };
        const snap = DamageSystem.snapshotOutgoing(p, spec);
        for (const e of ctx.state.enemies || []) {
          if (!e || e.dead) continue;
          if (!e.isElite && !e.isBoss) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= toNumber(t.radius) * toNumber(t.radius)) {
            DamageSystem.dealDamage(p, e, spec, { state: ctx.state, snapshot: snap });
          }
        }
      },
    },
  ],
};
