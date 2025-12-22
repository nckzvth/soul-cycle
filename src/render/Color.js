import { PALETTE } from "../data/Palette.js";

const HEX_SHORT_RE = /^#([0-9a-f]{3})$/i;
const HEX_LONG_RE = /^#([0-9a-f]{6})$/i;

export function hexToRgb(hex) {
    if (typeof hex !== "string") return null;
    const s = hex.trim();
    const short = HEX_SHORT_RE.exec(s);
    if (short) {
        const [r, g, b] = short[1].split("").map(ch => parseInt(ch + ch, 16));
        return { r, g, b };
    }
    const long = HEX_LONG_RE.exec(s);
    if (long) {
        const n = long[1];
        return {
            r: parseInt(n.slice(0, 2), 16),
            g: parseInt(n.slice(2, 4), 16),
            b: parseInt(n.slice(4, 6), 16),
        };
    }
    return null;
}

export function rgbaFromHex(hex, alpha = 1) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const a = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function resolvePaletteKey(key) {
    if (typeof key !== "string") return null;
    return PALETTE[key] || null;
}

/**
 * Resolves a color input into a CSS/canvas color string.
 * Supported:
 * - palette keys: "p2", "e1", "ink", "ember", ...
 * - direct hex/rgb(a)/hsl(a) strings (passed through)
 * - structured tokens: { token: "p2", alpha: 0.8 } or { color: "ember", alpha: 0.6 }
 */
export function resolveColor(input, { alpha = null } = {}) {
    if (input == null) return null;

    if (typeof input === "object") {
        const token = input.token ?? input.color ?? null;
        const a = input.alpha ?? alpha;
        const resolved = typeof token === "string" ? (resolvePaletteKey(token) || token) : String(token);
        if (typeof a === "number") {
            return resolved && resolved.startsWith("#") ? (rgbaFromHex(resolved, a) || resolved) : resolved;
        }
        return resolved;
    }

    if (typeof input !== "string") return String(input);
    const s = input.trim();
    if (!s) return null;

    const byKey = resolvePaletteKey(s);
    const resolved = byKey || s;

    if (typeof alpha === "number" && resolved.startsWith("#")) {
        return rgbaFromHex(resolved, alpha) || resolved;
    }
    return resolved;
}

export function applyInkRim(ctx, draw, { rimColor = "ink", rimWidth = 1 } = {}) {
    const w = typeof rimWidth === "number" && Number.isFinite(rimWidth) ? rimWidth : 1;
    if (w <= 0) {
        draw();
        return;
    }

    const prev = ctx.strokeStyle;
    const prevWidth = ctx.lineWidth;
    ctx.strokeStyle = resolveColor(rimColor) || PALETTE.ink;
    ctx.lineWidth = prevWidth + w * 2;
    draw({ strokeOnly: true });
    ctx.strokeStyle = prev;
    ctx.lineWidth = prevWidth;
    draw({ strokeOnly: false });
}

