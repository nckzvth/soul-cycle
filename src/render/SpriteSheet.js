export default class SpriteSheet {
    constructor(image, { frameWidth, frameHeight, frameCount = null } = {}) {
        if (!image) throw new Error("SpriteSheet requires an Image");
        if (!frameWidth || !frameHeight) throw new Error("SpriteSheet requires frameWidth and frameHeight");

        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;

        const cols = Math.max(1, Math.floor((image.width || 0) / frameWidth));
        const rows = Math.max(1, Math.floor((image.height || 0) / frameHeight));
        this.cols = cols;
        this.rows = rows;

        const maxFrames = cols * rows;
        this.frameCount = typeof frameCount === "number" ? Math.min(frameCount, maxFrames) : maxFrames;
    }

    drawFrame(ctx, frameIndex, dx, dy, dw, dh) {
        const i = ((frameIndex % this.frameCount) + this.frameCount) % this.frameCount;
        const sx = (i % this.cols) * this.frameWidth;
        const sy = Math.floor(i / this.cols) * this.frameHeight;
        ctx.drawImage(
            this.image,
            sx, sy, this.frameWidth, this.frameHeight,
            dx, dy, dw, dh
        );
    }
}

