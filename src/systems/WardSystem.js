function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export const WardSystem = {
  isEnabled(player) {
    return !!player && (player._wardEnabled === true || (toNumber(player.wardMax) || 0) > 0);
  },

  getMax(player) {
    return Math.max(0, toNumber(player?.wardMax));
  },

  getCurrent(player) {
    return Math.max(0, toNumber(player?.ward));
  },

  setCurrent(player, value) {
    if (!player) return;
    const max = this.getMax(player);
    player.ward = Math.max(0, Math.min(max, toNumber(value)));
  },

  absorbDamage(player, incomingAmount) {
    const amount = Math.max(0, toNumber(incomingAmount));
    if (!this.isEnabled(player)) return { toHp: amount, absorbed: 0 };
    const cur = this.getCurrent(player);
    if (cur <= 0 || amount <= 0) return { toHp: amount, absorbed: 0 };
    const absorbed = Math.min(cur, amount);
    this.setCurrent(player, cur - absorbed);
    return { toHp: amount - absorbed, absorbed };
  },
};

export default WardSystem;

