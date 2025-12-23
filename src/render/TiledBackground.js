export default class TiledBackground {
    constructor(image, { scale = 1, alpha = 1, pixelArt = false } = {}) {
        if (!image) throw new Error("TiledBackground requires an Image");
        this.image = image;
        this.scale = typeof scale === "number" && Number.isFinite(scale) ? scale : 1;
        this.alpha = typeof alpha === "number" && Number.isFinite(alpha) ? alpha : 1;
        this.pixelArt = !!pixelArt;
    }

    // Draws in screen-space (assumes identity transform). Supports camera zoom by shrinking the
    // sampled world viewport (viewW/H = canvasW/H / zoom) and scaling tile draw size by zoom.
    draw(ctx, { cameraX, cameraY, canvasW, canvasH, zoom = 1 } = {}) {
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

        const z = Math.max(0.01, Number(zoom) || 1);
        const camX = this.pixelArt ? Math.round(cameraX || 0) : (cameraX || 0);
        const camY = this.pixelArt ? Math.round(cameraY || 0) : (cameraY || 0);
        const viewW = w / z;
        const viewH = h / z;
        const halfW = this.pixelArt ? Math.floor(viewW / 2) : (viewW / 2);
        const halfH = this.pixelArt ? Math.floor(viewH / 2) : (viewH / 2);

        const left = camX - halfW;
        const top = camY - halfH;
        const right = left + viewW;
        const bottom = top + viewH;

        const startX = Math.floor(left / tileW) * tileW;
        const startY = Math.floor(top / tileH) * tileH;

        const prevAlpha = ctx.globalAlpha;
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.globalAlpha = prevAlpha * (this.alpha ?? 1);
        if (this.pixelArt) ctx.imageSmoothingEnabled = false;

        const drawTileW = this.pixelArt ? Math.round(tileW * z) : (tileW * z);
        const drawTileH = this.pixelArt ? Math.round(tileH * z) : (tileH * z);

        for (let y = startY; y < bottom; y += tileH) {
            for (let x = startX; x < right; x += tileW) {
                const dx = this.pixelArt ? Math.round((x - left) * z) : ((x - left) * z);
                const dy = this.pixelArt ? Math.round((y - top) * z) : ((y - top) * z);
                // Slight overlap helps prevent seam lines under fractional zoom.
                ctx.drawImage(img, dx, dy, drawTileW + 1, drawTileH + 1);
            }
        }

        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.globalAlpha = prevAlpha;
    }
}
