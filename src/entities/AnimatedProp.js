export default class AnimatedProp {
    constructor({ x, y, sheet, anim, scale = 1, anchor = "bottom-center", alpha = 1, pixelArt = true } = {}) {
        this.x = x || 0;
        this.y = y || 0;
        this.sheet = sheet;
        this.anim = anim;
        this.scale = scale;
        this.anchor = anchor;
        this.alpha = alpha;
        this.pixelArt = !!pixelArt;
    }

    update(dt) {
        this.anim?.update?.(dt);
        return true;
    }

    draw(ctx, s) {
        if (!this.sheet?.image || !this.anim) return;
        const img = this.sheet.image;
        if (!img.complete) return;

        const p = s(this.x, this.y);
        const fw = this.sheet.frameWidth;
        const fh = this.sheet.frameHeight;
        const dw = fw * this.scale;
        const dh = fh * this.scale;

        let dx = p.x;
        let dy = p.y;
        if (this.anchor === "bottom-center") {
            dx = p.x - dw / 2;
            dy = p.y - dh;
        } else if (this.anchor === "center") {
            dx = p.x - dw / 2;
            dy = p.y - dh / 2;
        }

        const prevAlpha = ctx.globalAlpha;
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.globalAlpha = prevAlpha * (this.alpha ?? 1);
        if (this.pixelArt) ctx.imageSmoothingEnabled = false;
        this.sheet.drawFrame(ctx, this.anim.frame, dx, dy, dw, dh);
        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.globalAlpha = prevAlpha;
    }
}

