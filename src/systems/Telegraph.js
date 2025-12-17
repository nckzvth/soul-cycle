// src/systems/Telegraph.js

const Telegraph = {
    telegraphs: [],

    // type: 'rect' | 'circle'
    create(x, y, width, height, duration, type = 'rect', rotationOrOptions = 0) {
        let rotation = 0;
        let options = null;
        if (rotationOrOptions && typeof rotationOrOptions === "object") {
            options = rotationOrOptions;
            rotation = rotationOrOptions.rotation || 0;
        } else {
            rotation = rotationOrOptions || 0;
        }
        const telegraph = {
            x,
            y,
            width,
            height,
            duration,
            timer: duration,
            type,
            rotation,
            options
        };
        this.telegraphs.push(telegraph);
    },

    update(dt) {
        this.telegraphs = this.telegraphs.filter(t => {
            t.timer -= dt;
            return t.timer > 0;
        });
    },

    render(ctx, s) {
        this.telegraphs.forEach(t => {
            const pos = s(t.x, t.y);

            const ratio = t.duration > 0 ? Math.max(0, Math.min(1, t.timer / t.duration)) : 0;
            const alpha = 0.15 + 0.45 * ratio;
            const progress = 1 - ratio;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 50, 50, 0.5)'; // Reddish fill
            ctx.strokeStyle = 'rgba(255, 180, 180, 0.7)';
            ctx.lineWidth = 2;

            if (t.type === 'circle') {
                // width is diameter
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, t.width / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.translate(pos.x, pos.y);
                ctx.rotate(t.rotation || 0);
                ctx.beginPath();
                const opt = t.options || {};
                const grow = !!opt.grow;
                const anchor = opt.anchor || "center"; // "center" | "start"
                const w = grow ? (t.width * progress) : t.width;
                const h = t.height;
                if (anchor === "start") {
                    // Start anchored at origin extending forward (+X after rotation).
                    ctx.rect(0, -h / 2, w, h);
                } else {
                    ctx.rect(-w / 2, -h / 2, w, h);
                }
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        });
    }
};

export default Telegraph;
