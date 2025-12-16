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
      spec: opts.spec,
      snapshotPolicy: opts.snapshotPolicy ?? "snapshot",
      triggerOnHit: opts.triggerOnHit ?? false,
      dotTextMode: opts.dotTextMode,
      snapshot: null,
    };

    if (existing) {
      // Refresh duration and stacks; keep semantics simple and predictable.
      next.stacks = Math.max(existing.stacks, next.stacks);
      next.duration = Math.max(existing.duration, next.duration);
    }

    if (next.snapshotPolicy === "snapshot") {
      // Snapshot attacker-side only; target mult applied on tick.
      next.snapshot = DamageSystem.snapshotOutgoing(next.source, next.spec, opts.context || {});
    }

    statuses.set(statusId, next);
  },

  update(target, dt, state) {
    if (!target.statuses || target.statuses.size === 0) return;
    for (const [id, st] of target.statuses) {
      st.elapsed += dt;

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

      if (st.elapsed >= st.duration) target.statuses.delete(id);
    }
  },
};

export default StatusSystem;
