import { dist2 } from "../core/Utils.js";
import Game from "../core/Game.js";

const particles = [];

const ParticleSystem = {
    update(dt, player) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
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
            
            if (p.options?.beam) {
                const pulse = Math.sin(Game.time * 20) * 0.2 + 0.8;
                const width = 20 * pulse;
                const grad = ctx.createLinearGradient(pos.x, pos.y - p.size, pos.x, pos.y);
                grad.addColorStop(0, 'rgba(215, 196, 138, 0)');
                grad.addColorStop(0.5, 'rgba(215, 196, 138, 0.7)');
                grad.addColorStop(1, 'rgba(215, 196, 138, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(pos.x - width / 2, pos.y - p.size, width, p.size);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    },

    emit(x, y, color, count, speed, size, life, target = null, options = {}) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const p = {
                x,
                y,
                vx: Math.cos(angle) * speed * (Math.random() * 0.5 + 0.5),
                vy: Math.sin(angle) * speed * (Math.random() * 0.5 + 0.5),
                color,
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
    }
};

export default ParticleSystem;