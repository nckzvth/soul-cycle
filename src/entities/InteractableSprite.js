import { dist2 } from "../core/Utils.js";
import { color as c } from "../data/ColorTuning.js";

export default class InteractableSprite {
    constructor({
        x,
        y,
        sheet,
        anim,
        label = "",
        prompt = "",
        interactRadius = 52,
        scale = 1,
        anchor = "bottom-center",
        pixelArt = true,
        bobAmplitude = 4,
        bobSpeed = 2.2,
        liftOnHover = 10,
        auraColor = null,
        auraStroke = null,
        auraRadius = 18,
    } = {}) {
        this.x = x || 0;
        this.y = y || 0;
        this.sheet = sheet;
        this.anim = anim;
        this.label = label;
        this.prompt = prompt;
        this.interactRadius = interactRadius;
        this.scale = scale;
        this.anchor = anchor;
        this.pixelArt = !!pixelArt;

        this.bobAmplitude = bobAmplitude;
        this.bobSpeed = bobSpeed;
        this.liftOnHover = liftOnHover;

        // Interaction highlight: player-owned cue (P2), with muted alphas.
        this.auraColor = auraColor || c("interactable.auraFill") || c("player.core", 0.22) || "p2";
        this.auraStroke = auraStroke || c("interactable.auraStroke") || c("player.core", 0.35) || "p2";
        this.auraRadius = auraRadius;

        this._t = 0;
        this._hover = false;
        this._disabled = false;
        this._phase = (label ? Array.from(label).reduce((a, c) => a + c.charCodeAt(0), 0) : Math.floor(Math.random() * 1000)) * 0.17;
    }

    setDisabled(disabled) {
        this._disabled = !!disabled;
    }

    get hovered() {
        return this._hover;
    }

    get disabled() {
        return this._disabled;
    }

    update(dt, player) {
        this._t += Math.max(0, dt || 0);
        this.anim?.update?.(dt);
        if (!player) {
            this._hover = false;
            return true;
        }
        const r = Math.max(1, this.interactRadius);
        this._hover = !this._disabled && dist2(this.x, this.y, player.x, player.y) <= (r * r);
        return true;
    }

    tryInteract(player, pressed) {
        if (!pressed) return false;
        if (this._disabled) return false;
        if (!player) return false;
        if (!this._hover) return false;
        return true;
    }

    draw(ctx, s, { showPrompt = true, drawSprite = true } = {}) {
        if (!this.sheet?.image || !this.anim) return;
        const img = this.sheet.image;
        if (!img.complete) return;

        const bob = Math.sin((this._t * this.bobSpeed) + this._phase) * this.bobAmplitude;
        const lift = this._hover ? this.liftOnHover : 0;
        const yOffset = -bob - lift;

        const p = s(this.x, this.y + yOffset);
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

        if (drawSprite && this._hover) {
            const gp = s(this.x, this.y);
            const pulse = Math.sin(this._t * 3.5) * 0.5 + 0.5;
            const r = this.auraRadius * (1 + pulse * 0.08);
            ctx.save();
            const g = ctx.createRadialGradient(gp.x, gp.y, 0, gp.x, gp.y, r * 2.2);
            g.addColorStop(0, this.auraColor);
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, r * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.auraStroke;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(gp.x, gp.y, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (drawSprite) {
            const prevAlpha = ctx.globalAlpha;
            const prevSmoothing = ctx.imageSmoothingEnabled;
            if (this.pixelArt) ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = this._disabled ? (prevAlpha * 0.35) : prevAlpha;
            this.sheet.drawFrame(ctx, this.anim.frame, dx, dy, dw, dh);
            ctx.globalAlpha = prevAlpha;
            ctx.imageSmoothingEnabled = prevSmoothing;
        }

        if (showPrompt && this._hover && !this._disabled && this.prompt) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.font = "14px sans-serif";
            const text = this.prompt;
            const x = p.x;
            const y = dy - 10;
            const metrics = ctx.measureText(text);
            const padX = 10;
            const padY = 6;
            const w = Math.ceil(metrics.width + padX * 2);
            const h = 18 + padY;

            ctx.fillStyle = c("interactable.promptPanel") || c("fx.ink", 0.72) || "ink";
            ctx.strokeStyle = c("interactable.promptBorder") || c("fx.uiText", 0.12) || "parchment";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(x - w / 2, y - h + 4, w, h, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = c("interactable.promptText") || c("fx.uiText") || "parchment";
            ctx.shadowColor = c("interactable.promptShadow") || c("fx.ink", 0.65) || "ink";
            ctx.shadowBlur = 4;
            ctx.fillText(text, x, y);
            ctx.restore();
        }
    }
}
