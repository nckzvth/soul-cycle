import DamageSystem from "./DamageSystem.js";
import ParticleSystem from "./Particles.js";

function ensureContainer(target) {
  if (!target.statuses) target.statuses = new Map();
  return target.statuses;
}

const StatusSystem = {
  init(target) {
    ensureContainer(target);
  },

  getStatus(target, statusId) {
    if (!target?.statuses) return null;
    return target.statuses.get(statusId) || null;
  },

  getStacks(target, statusId) {
    const st = this.getStatus(target, statusId);
    return st?.stacks || 0;
  },

  hasStatus(target, statusId) {
    return this.getStacks(target, statusId) > 0;
  },

  applyStatus(target, statusId, opts) {
    const statuses = ensureContainer(target);
    const existing = statuses.get(statusId);

    const next = {
      id: statusId,
      source: opts.source,
      stacks: opts.stacks ?? 1,
      duration: opts.duration ?? 0,
      elapsed: 0,
      tickInterval: opts.tickInterval ?? 1,
      nextTickAt: opts.tickInterval ?? 1,
      vfx: opts.vfx ?? null,
      vfxInterval: opts.vfx?.interval ?? null,
      nextVfxAt: opts.vfx?.interval ?? null,
      spec: opts.spec,
      snapshotPolicy: opts.snapshotPolicy ?? "snapshot",
      triggerOnHit: opts.triggerOnHit ?? false,
      dotTextMode: opts.dotTextMode,
      stackMode: opts.stackMode ?? "max", // 'max' | 'add'
      maxStacks: opts.maxStacks ?? null,
      onExpire: opts.onExpire ?? null,
      onExpireData: opts.onExpireData ?? null,
      snapshot: null,
    };

    if (existing) {
      // Refresh duration and stacks; keep semantics simple and predictable.
      if (next.stackMode === "add") {
        next.stacks = existing.stacks + next.stacks;
      } else {
        next.stacks = Math.max(existing.stacks, next.stacks);
      }
      next.duration = Math.max(existing.duration, next.duration);
      // Preserve expire hook if caller doesn't override it.
      if (!next.onExpire) next.onExpire = existing.onExpire;
      if (!next.onExpireData) next.onExpireData = existing.onExpireData;
      if (!next.vfx) {
        next.vfx = existing.vfx;
        next.vfxInterval = existing.vfxInterval;
        next.nextVfxAt = existing.nextVfxAt;
      }
    }

    if (typeof next.maxStacks === "number") {
      next.stacks = Math.min(next.stacks, next.maxStacks);
    }

    if (next.snapshotPolicy === "snapshot") {
      // Snapshot attacker-side only; target mult applied on tick.
      if (next.spec) {
        next.snapshot = DamageSystem.snapshotOutgoing(next.source, next.spec, opts.context || {});
      }
    }

    statuses.set(statusId, next);

    // Optional one-shot feedback on apply.
    if (next.vfx?.applyText) {
      ParticleSystem.emitText(target.x, target.y - (target.r || 0) - 10, next.vfx.applyText, {
        color: next.vfx.textColor || "parchment",
        size: next.vfx.textSize || 14,
        life: next.vfx.textLife || 0.6,
      });
    }
    if (typeof next.vfx?.applyBurstCount === "number" && next.vfx.applyBurstCount > 0) {
      ParticleSystem.emit(
        target.x,
        target.y,
        next.vfx.color || "parchment",
        next.vfx.applyBurstCount,
        next.vfx.applyBurstSpeed ?? 120,
        next.vfx.applyBurstSize ?? 2.8,
        next.vfx.applyBurstLife ?? 0.25
      );
    }
  },

  update(target, dt, state) {
    if (!target.statuses || target.statuses.size === 0) return;
    for (const [id, st] of target.statuses) {
      st.elapsed += dt;

      if (st.vfx && st.vfxInterval && typeof st.nextVfxAt === "number") {
        while (st.elapsed + 1e-9 >= st.nextVfxAt && st.nextVfxAt <= st.duration + 1e-9) {
          const radius = (target.r || 0) + (st.vfx.radiusAdd ?? 10);
          const x = target.x + (Math.random() - 0.5) * radius * 2;
          const y = target.y + (Math.random() - 0.5) * radius * 2;
          const baseCount = st.vfx.count ?? 1;
          const perStack = st.vfx.countPerStack ?? 0;
          const count = Math.max(1, Math.round(baseCount + perStack * Math.max(0, (st.stacks || 1) - 1)));
          ParticleSystem.emit(x, y, st.vfx.color || "parchment", count, st.vfx.speed ?? 0, st.vfx.size ?? 2.5, st.vfx.life ?? 0.25, null, {
            anchoredTo: st.vfx.anchoredToTarget === false ? null : target,
          });
          st.nextVfxAt += st.vfxInterval;
        }
      }

      if (st.spec) {
        while (st.elapsed + 1e-9 >= st.nextTickAt && st.nextTickAt <= st.duration + 1e-9) {
          DamageSystem.dealDamage(st.source, target, st.spec, {
            state,
            isDoT: true,
            snapshot: st.snapshot,
            triggerOnHit: st.triggerOnHit,
            dotTextMode: st.dotTextMode,
            particles: ParticleSystem,
          });
          st.nextTickAt += st.tickInterval;
        }
      }

      if (st.elapsed >= st.duration) {
        target.statuses.delete(id);
        if (typeof st.onExpire === "function") st.onExpire(target, st, state);
      }
    }
  },
};

export default StatusSystem;
