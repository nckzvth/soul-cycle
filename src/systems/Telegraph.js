// src/systems/Telegraph.js

const Telegraph = {
    telegraphs: [],

    // type: 'rect' | 'circle'
    create(x, y, width, height, duration, type = 'rect') {
        const telegraph = {
            x,
            y,
            width,
            height,
            duration,
            timer: duration,
            type
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
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)'; // Reddish
        this.telegraphs.forEach(t => {
            const pos = s(t.x, t.y);
            ctx.beginPath();
            if (t.type === 'circle') {
                // width is diameter
                ctx.arc(pos.x, pos.y, t.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(pos.x - t.width / 2, pos.y - t.height / 2, t.width, t.height);
            }
        });
        ctx.globalAlpha = 1;
    }
};

export default Telegraph;
