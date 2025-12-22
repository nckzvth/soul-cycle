import { dist2 } from "../core/Utils.js";
import Game from "../core/Game.js";
import { color as col } from "../data/ColorTuning.js";
import { hexToRgb, resolveColor as resolveTokenColor } from "../render/Color.js";

const particles = [];

const resolveColor = (color) => {
    if (!color) return col("fx.uiText") || "parchment";
    if (typeof color === "object") return resolveTokenColor(color) || (col("fx.uiText") || "parchment");
    if (typeof color !== "string") return String(color);
    const c = color.trim();
    if (!c) return col("fx.uiText") || "parchment";
    if (c === "transparent") return "transparent";
    if (c.startsWith("#") || c.startsWith("rgb(") || c.startsWith("rgba(") || c.startsWith("hsl(") || c.startsWith("hsla(")) return c;
    const resolved = resolveTokenColor(c);
    if (resolved && resolved !== c) return resolved;

    const named = {
        white: col("fx.uiText") || "parchment",
        black: col("fx.ink") || "ink",
        gray: col("fx.uiMuted") || "dust",
        grey: col("fx.uiMuted") || "dust",
        gold: col("ui.xp") || "p3",
        red: col("fx.bloodBright") || "bloodBright",
        purple: col("player.guard") || "p4",
        orange: col("fx.ember") || "ember",
        lightblue: col("player.core") || "p2",
        cyan: col("player.core") || "p2",
        teal: col("player.support") || "p3",
    }[c.toLowerCase()];

    return named || c;
};

const ParticleSystem = {
    update(dt, player) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }

            if (p.isText) {
                p.vy += 100 * dt; // Gravity
            }

            if (p.options?.anchoredTo) {
                p.x = p.options.anchoredTo.x + p.offsetX;
                p.y = p.options.anchoredTo.y + p.offsetY;
            } else {
                if (p.target) {
                    const dx = p.target.x - p.x;
                    const dy = p.target.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 10) {
                        p.life = 0; // Reached target
                        continue;
                    }
                    p.vx = (dx / dist) * p.speed;
                    p.vy = (dy / dist) * p.speed;
                }

                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
            p.alpha = p.life / p.startLife;
        }
    },

    render(ctx, s) {
        for (const p of particles) {
            const pos = s(p.x, p.y);
            ctx.globalAlpha = p.alpha;
            
            if (p.isText) {
                const scale = 1 + (1 - (p.life / p.startLife));
                ctx.font = `bold ${Math.floor(p.size / scale)}px sans-serif`;
                ctx.fillStyle = p.color;
                ctx.textAlign = 'center';
                ctx.fillText(p.text, pos.x, pos.y);
            } else if (p.options?.beam) {
                const pulse = Math.sin(Game.time * 20) * 0.2 + 0.8;
                const width = 20 * pulse;
                const grad = ctx.createLinearGradient(pos.x, pos.y - p.size, pos.x, pos.y);
                const base = resolveColor(p.color) || (col("player.support") || "p3");
                const rgb = base && typeof base === "string" ? hexToRgb(base) : null;
                const stop0 = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)` : "transparent";
                const stopMid = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)` : (col("player.support", 0.7) || "p3");
                grad.addColorStop(0, stop0);
                grad.addColorStop(0.5, stopMid);
                grad.addColorStop(1, stop0);
                ctx.fillStyle = grad;
                ctx.fillRect(pos.x - width / 2, pos.y - p.size, width, p.size);
            } else {
                const colr = resolveColor(p.color) || (col("fx.uiText") || "parchment");
                const rim = p.options?.rim === false ? null : resolveColor(p.options?.rimColor || (col("fx.ink") || "ink"));
                const rimW = typeof p.options?.rimWidth === "number" ? p.options.rimWidth : 1;
                if (rim && colr !== "transparent") {
                    ctx.fillStyle = rim;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, p.size + rimW, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (colr !== "transparent") {
                    ctx.fillStyle = colr;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left'; // Reset alignment
    },

    emit(x, y, color, count, speed, size, life, target = null, options = {}) {
        const resolvedColor = resolveColor(color);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const p = {
                x,
                y,
                vx: Math.cos(angle) * speed * (Math.random() * 0.5 + 0.5),
                vy: Math.sin(angle) * speed * (Math.random() * 0.5 + 0.5),
                color: resolvedColor,
                size,
                life,
                startLife: life,
                alpha: 1,
                target,
                speed: speed * 2, // Speed for seeking
                options
            };

            if (options.anchoredTo) {
                p.offsetX = x - options.anchoredTo.x;
                p.offsetY = y - options.anchoredTo.y;
            }

            particles.push(p);
        }
    },

    emitText(x, y, text, options = {}) {
        const p = {
            x: x + (Math.random() - 0.5) * 20,
            y,
            vx: (Math.random() - 0.5) * 30,
            vy: -80,
            life: options.life || 1.0,
            startLife: options.life || 1.0,
            alpha: 1,
            text,
            color: resolveColor(options.color || "parchment"),
            size: options.size || 24,
            isText: true,
            options
        };
        particles.push(p);
    }
};

export default ParticleSystem;
