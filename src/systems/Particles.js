import { dist2 } from "../core/Utils.js";

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
            p.alpha = p.life / p.startLife;
        }
    },

    render(ctx, s) {
        for (const p of particles) {
            const pos = s(p.x, p.y);
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    },

    emit(x, y, color, count, speed, size, life, target = null) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            particles.push({
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
                speed: speed * 2 // Speed for seeking
            });
        }
    }
};

export default ParticleSystem;