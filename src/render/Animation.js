export default class Animation {
    constructor({ fps = 8, frames = null, frameCount = null, loop = true } = {}) {
        const resolvedFrames = Array.isArray(frames)
            ? frames.map((n) => Math.max(0, Math.floor(n)))
            : null;

        const count = typeof frameCount === "number" ? Math.max(1, Math.floor(frameCount)) : null;
        const autoFrames = count ? Array.from({ length: count }, (_, i) => i) : null;

        this.frames = resolvedFrames || autoFrames;
        if (!this.frames || this.frames.length === 0) throw new Error("Animation requires frames or frameCount");

        this.fps = Math.max(0.01, Number(fps) || 8);
        this.loop = !!loop;

        this._t = 0;
        this._idx = 0;
        this._frameDuration = 1 / this.fps;
    }

    reset() {
        this._t = 0;
        this._idx = 0;
    }

    update(dt) {
        const step = this._frameDuration;
        this._t += Math.max(0, dt || 0);
        while (this._t >= step) {
            this._t -= step;
            if (this._idx < this.frames.length - 1) {
                this._idx++;
            } else if (this.loop) {
                this._idx = 0;
            } else {
                this._idx = this.frames.length - 1;
                this._t = 0;
                break;
            }
        }
    }

    get frame() {
        return this.frames[this._idx] ?? this.frames[0];
    }
}

