export default class TiledBackground {
    constructor(image, { scale = 1, alpha = 1, pixelArt = false } = {}) {
        if (!image) throw new Error("TiledBackground requires an Image");
        this.image = image;
        this.scale = typeof scale === "number" && Number.isFinite(scale) ? scale : 1;
        this.alpha = typeof alpha === "number" && Number.isFinite(alpha) ? alpha : 1;
        this.pixelArt = !!pixelArt;
    }

    draw(ctx, { cameraX, cameraY, canvasW, canvasH } = {}) {
        const img = this.image;
        if (!img?.complete) return;
        const w = canvasW ?? ctx.canvas.width;
        const h = canvasH ?? ctx.canvas.height;
        if (!w || !h) return;

        // Pixel-art tiling: snap to integer scale + integer camera to avoid seam lines.
        const rawScale = this.scale;
        const scale = this.pixelArt ? Math.max(1, Math.round(rawScale || 1)) : (rawScale || 1);
        const tileW = Math.max(1, Math.round((img.width || 1) * scale));
        const tileH = Math.max(1, Math.round((img.height || 1) * scale));

        const camX = this.pixelArt ? Math.round(cameraX || 0) : (cameraX || 0);
        const camY = this.pixelArt ? Math.round(cameraY || 0) : (cameraY || 0);
        const halfW = this.pixelArt ? Math.floor(w / 2) : (w / 2);
        const halfH = this.pixelArt ? Math.floor(h / 2) : (h / 2);

        const left = camX - halfW;
        const top = camY - halfH;
        const right = left + w;
        const bottom = top + h;

        const startX = Math.floor(left / tileW) * tileW;
        const startY = Math.floor(top / tileH) * tileH;

        const prevAlpha = ctx.globalAlpha;
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.globalAlpha = prevAlpha * (this.alpha ?? 1);
        if (this.pixelArt) ctx.imageSmoothingEnabled = false;

        for (let y = startY; y < bottom; y += tileH) {
            for (let x = startX; x < right; x += tileW) {
                const dx = this.pixelArt ? Math.round(x - left) : (x - left);
                const dy = this.pixelArt ? Math.round(y - top) : (y - top);
                ctx.drawImage(img, dx, dy, tileW, tileH);
            }
        }

        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.globalAlpha = prevAlpha;
    }
}
