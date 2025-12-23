export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;

export const circleIntersectsAABB = (cx, cy, cr, ax, ay, aw, ah) => {
    const x = clamp(cx, ax, ax + aw);
    const y = clamp(cy, ay, ay + ah);
    const dx = cx - x;
    const dy = cy - y;
    return (dx * dx + dy * dy) <= (cr * cr);
};

export const pushCircleOutOfAABB = (cx, cy, cr, ax, ay, aw, ah) => {
    const bx0 = ax, bx1 = ax + aw;
    const by0 = ay, by1 = ay + ah;

    // Outside or on edge: push along closest-point normal if overlapping.
    const closestX = clamp(cx, bx0, bx1);
    const closestY = clamp(cy, by0, by1);
    let dx = cx - closestX;
    let dy = cy - closestY;

    const inside = (cx > bx0 && cx < bx1 && cy > by0 && cy < by1);
    if (inside) {
        // If the circle center is inside the box, push it out through the nearest face.
        const left = cx - bx0;
        const right = bx1 - cx;
        const top = cy - by0;
        const bottom = by1 - cy;
        const m = Math.min(left, right, top, bottom);

        if (m === left) return { x: -(left + cr), y: 0 };
        if (m === right) return { x: (right + cr), y: 0 };
        if (m === top) return { x: 0, y: -(top + cr) };
        return { x: 0, y: (bottom + cr) };
    }

    const d2 = dx * dx + dy * dy;
    if (d2 <= 1e-9) return null;
    if (d2 >= cr * cr) return null;
    const d = Math.sqrt(d2);
    const overlap = cr - d;
    return { x: (dx / d) * overlap, y: (dy / d) * overlap };
};

export class RNG {
    constructor(s) { this.s = s || 12345; }
    next() { this.s ^= this.s << 13; this.s ^= this.s >> 17; this.s ^= this.s << 5; return this.s >>> 0; }
    float() { return this.next() / 4294967296; }
    range(a, b) { return a + (b - a) * this.float(); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}
