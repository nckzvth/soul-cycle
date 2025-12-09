export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export class RNG {
    constructor(s) { this.s = s || 12345; }
    next() { this.s ^= this.s << 13; this.s ^= this.s >> 17; this.s ^= this.s << 5; return this.s >>> 0; }
    float() { return this.next() / 4294967296; }
    range(a, b) { return a + (b - a) * this.float(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}