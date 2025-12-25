import { color as c } from "../data/ColorTuning.js";
import { BALANCE } from "../data/Balance.js";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function halfLifeToFade(dt, halfLifeSec) {
  const hl = Math.max(0.0001, halfLifeSec || 0.0001);
  // Fraction to remove this frame so that remaining halves every `halfLifeSec`.
  return 1 - Math.pow(0.5, Math.max(0, dt || 0) / hl);
}

export default class DecalSystem {
  constructor(game) {
    this.game = game;
    this.chunks = new Map();
  }

  clear() {
    this.chunks.clear();
  }

  _cfg() {
    // Keep dials centralized; can be lifted into BALANCE later if desired.
    const cfg = BALANCE?.vfx?.decals?.blood;
    return {
      chunkSize: cfg?.chunkSize ?? 512,
      pixelScale: cfg?.pixelScale ?? 2,
      fadeHalfLifeSec: cfg?.fadeHalfLifeSec ?? 42,
      maxChunks: cfg?.maxChunks ?? 72,
      pruneAfterSec: cfg?.pruneAfterSec ?? 90,
      // Stamp behavior
      particlesBase: cfg?.particlesBase ?? 50,
      particlesRand: cfg?.particlesRand ?? 40,
      spread: cfg?.spread ?? 1.9,
      speedBase: cfg?.speedBase ?? 22,
      speedRand: cfg?.speedRand ?? 34,
      // How often a moving droplet "sticks" while it travels (matches the demo's style).
      consistency: cfg?.consistency ?? 0.2,
      // How many micro-steps a droplet simulates before stopping.
      simStepsMin: cfg?.simStepsMin ?? 10,
      simStepsMax: cfg?.simStepsMax ?? 18,
      // Scales how far a droplet moves per micro-step (higher => more spread).
      simStepScale: cfg?.simStepScale ?? 0.08,
      frictionMin: cfg?.frictionMin ?? 0.82,
      frictionMax: cfg?.frictionMax ?? 0.90,
      sizeMin: cfg?.sizeMin ?? 1.3,
      sizeMax: cfg?.sizeMax ?? 3.9,
      stampAlpha: cfg?.stampAlpha ?? 0.22,

      // Directional spray mix (adds "messy + directional" casts like the demo).
      sprayFrac: cfg?.sprayFrac ?? 0.35,
      spraySpeedMultMin: cfg?.spraySpeedMultMin ?? 1.7,
      spraySpeedMultMax: cfg?.spraySpeedMultMax ?? 2.6,
      sprayStepsMultMin: cfg?.sprayStepsMultMin ?? 1.15,
      sprayStepsMultMax: cfg?.sprayStepsMultMax ?? 1.85,
      spraySpreadMult: cfg?.spraySpreadMult ?? 0.75,
      sprayConsistencyMult: cfg?.sprayConsistencyMult ?? 0.75,
      backsprayFrac: cfg?.backsprayFrac ?? 0.10,

      // Puddle under-body (blob) — keep it, but less dominant.
      puddleCountMin: cfg?.puddleCountMin ?? 2,
      puddleCountMax: cfg?.puddleCountMax ?? 6,
      puddleChance: cfg?.puddleChance ?? 0.65,
      puddleAlphaMult: cfg?.puddleAlphaMult ?? 0.13,
      puddleSizeMin: cfg?.puddleSizeMin ?? 2.6,
      puddleSizeMax: cfg?.puddleSizeMax ?? 4.6,
      puddleRadiusMultX: cfg?.puddleRadiusMultX ?? 0.75,
      puddleRadiusMultY: cfg?.puddleRadiusMultY ?? 0.45,

      // Rendering
      chunkOverlap: cfg?.chunkOverlap ?? null,

      // Coverage governor (prevents full saturation)
      inkAdd: cfg?.inkAdd ?? 0.0016,
      inkDecayHalfLifeSec: cfg?.inkDecayHalfLifeSec ?? 18,
      inkAlphaMultAtFull: cfg?.inkAlphaMultAtFull ?? 0.45,
      // Subtle per-stamp alpha jitter
      alphaJitter: cfg?.alphaJitter ?? 0.08,
    };
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  _getChunk(cx, cy, cfg) {
    const key = this._key(cx, cy);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;

    const canvas = document.createElement("canvas");
    canvas.width = cfg.chunkSize;
    canvas.height = cfg.chunkSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;

    chunk = {
      key,
      cx,
      cy,
      canvas,
      ctx,
      lastUsedTime: this.game?.time ?? 0,
      ink: 0,
    };
    this.chunks.set(key, chunk);
    return chunk;
  }

  _stampPixel(chunk, wx, wy, size, color, alpha, cfg) {
    if (!chunk) return;
    const cs = cfg.chunkSize;
    const px = cfg.pixelScale;

    // Convert world coords to chunk-local.
    const ox = chunk.cx * cs;
    const oy = chunk.cy * cs;
    const lx = wx - ox;
    const ly = wy - oy;
    if (lx < -cs || ly < -cs || lx > cs * 2 || ly > cs * 2) return;

    const snappedX = Math.floor(lx / px) * px;
    const snappedY = Math.floor(ly / px) * px;

    let blockSize = Math.ceil((size * 2) / px) * px;
    if (blockSize < px) blockSize = px;

    const drawX = Math.floor((snappedX - blockSize / 2) / px) * px;
    const drawY = Math.floor((snappedY - blockSize / 2) / px) * px;

    const ctx = chunk.ctx;
    ctx.save();
    ctx.globalAlpha = clamp01(alpha);
    ctx.fillStyle = color;
    ctx.fillRect(drawX, drawY, blockSize, blockSize);
    ctx.restore();

    // Increase local coverage meter to reduce saturation over time.
    chunk.ink = clamp01(chunk.ink + cfg.inkAdd * clamp01(alpha) * (blockSize / px));
  }

  addEnemyDeathSpatter(enemy, state) {
    if (!enemy) return;
    const cfg = this._cfg();

    const x = enemy.x;
    const y = enemy.y;
    const r = Math.max(10, (enemy.r || 12) * 1.2);

    // Directionality: 8-way, east = row 1 (dir 0).
    const dir = enemy?._sprite?.dir ?? 0;
    // Enemy sprites face the player; for splatter we want the cast to project away (outward),
    // so flip by π.
    const impactAngle = (dir * Math.PI * 2) / 8 + Math.PI;
    const ux = Math.cos(impactAngle);
    const uy = Math.sin(impactAngle);

    const total = Math.max(0, Math.floor(cfg.particlesBase + Math.random() * cfg.particlesRand));
    const baseSpeed = cfg.speedBase + Math.random() * cfg.speedRand;
    const originSpread = r * 0.55;

    for (let i = 0; i < total; i++) {
      // Mixture model:
      // - Some droplets are slow/nearby (gives pooling/blotches)
      // - Some are fast directional sprays (gives "cast" like the demo)
      const isSpray = Math.random() < cfg.sprayFrac;
      const isBackspray = isSpray && Math.random() < cfg.backsprayFrac;
      const spreadMult = isSpray ? cfg.spraySpreadMult : 1.0;
      const spread = cfg.spread * spreadMult;

      // Origin jitter: slightly biased forward so the spray doesn't look like a centered blob.
      const lateral = (Math.random() - 0.5) * originSpread;
      const forward = (Math.random() - 0.5) * originSpread * (isSpray ? 0.55 : 0.35);
      const offsetX = lateral * -uy + forward * ux;
      const offsetY = lateral * ux + forward * uy;

      const angleVar = (Math.random() - 0.5) * spread * 2.2;
      const finalAngle = (isBackspray ? (impactAngle + Math.PI) : impactAngle) + angleVar;
      const speedMultiplier = 0.5 + Math.random();
      const spraySpeedMult = isSpray ? lerp(cfg.spraySpeedMultMin, cfg.spraySpeedMultMax, Math.random()) : 1.0;
      const spd = baseSpeed * speedMultiplier * spraySpeedMult;

      let px = x + offsetX;
      let py = y + offsetY;
      let vx = Math.cos(finalAngle) * spd;
      let vy = Math.sin(finalAngle) * spd;

      let size = cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin);
      if (isSpray) size *= 0.9;
      const friction = cfg.frictionMin + Math.random() * Math.max(0, cfg.frictionMax - cfg.frictionMin);
      const stepsBase = Math.max(cfg.simStepsMin, Math.floor(cfg.simStepsMin + Math.random() * Math.max(0, cfg.simStepsMax - cfg.simStepsMin)));
      const stepsMult = isSpray ? lerp(cfg.sprayStepsMultMin, cfg.sprayStepsMultMax, Math.random()) : 1.0;
      const steps = Math.max(1, Math.floor(stepsBase * stepsMult));
      const stepScale = Math.max(0.001, cfg.simStepScale);
      // Messy variability: some droplets stick more than others.
      const stickBase = clamp01(cfg.consistency * (isSpray ? cfg.sprayConsistencyMult : 1.0));
      const stickChance = clamp01(stickBase * (0.6 + Math.random() * 1.1));

      // Weighted blood colors (palette-driven)
      const baseAlpha = cfg.stampAlpha * (0.75 + Math.random() * 0.75);
      const jitter = (Math.random() - 0.5) * cfg.alphaJitter;
      const alpha0 = clamp01(baseAlpha + jitter);
      const col = Math.random() < 0.6 ? (c("fx.bloodMid") || "bloodMid") : (c("fx.bloodDeep") || "bloodDeep");

      // Micro-sim: move, slow down, and occasionally "stick" a stamp, like the demo's permanent canvas.
      for (let k = 0; k < steps; k++) {
        // Slight forward bias for sprays keeps the "cast" readable without making it uniform.
        const stepBias = isSpray ? (1.0 + Math.random() * 0.25) : 1.0;
        px += vx * stepScale * stepBias;
        py += vy * stepScale * stepBias;
        vx *= friction;
        vy *= friction;
        size = Math.max(0.15, size - 0.05);

        const cx = Math.floor(px / cfg.chunkSize);
        const cy = Math.floor(py / cfg.chunkSize);
        const chunk = this._getChunk(cx, cy, cfg);
        if (!chunk) continue;

        // Coverage governor: reduce stamp alpha in saturated chunks.
        const inkMult = lerp(1.0, cfg.inkAlphaMultAtFull, clamp01(chunk.ink));
        if (Math.random() < stickChance) {
          this._stampPixel(chunk, px, py, size, col, alpha0 * inkMult, cfg);
          chunk.lastUsedTime = this.game?.time ?? 0;
        }
      }

      // Final stamp (always)
      {
        const cx = Math.floor(px / cfg.chunkSize);
        const cy = Math.floor(py / cfg.chunkSize);
        const chunk = this._getChunk(cx, cy, cfg);
        if (chunk) {
          const inkMult = lerp(1.0, cfg.inkAlphaMultAtFull, clamp01(chunk.ink));
          this._stampPixel(chunk, px, py, size, col, alpha0 * inkMult, cfg);
          chunk.lastUsedTime = this.game?.time ?? 0;
        }
      }
    }

    // Small pooled "base" under the body (not every kill).
    if (Math.random() > clamp01(cfg.puddleChance)) return;
    const puddleCount = cfg.puddleCountMin + Math.floor(Math.random() * Math.max(0, (cfg.puddleCountMax - cfg.puddleCountMin) + 1));
    for (let i = 0; i < puddleCount; i++) {
      const ox = (Math.random() - 0.5) * r * cfg.puddleRadiusMultX;
      const oy = (Math.random() - 0.5) * r * cfg.puddleRadiusMultY;
      const px = x + ox;
      const py = y + oy;
      const cx = Math.floor(px / cfg.chunkSize);
      const cy = Math.floor(py / cfg.chunkSize);
      const chunk = this._getChunk(cx, cy, cfg);
      if (!chunk) continue;
      const col = Math.random() < 0.5 ? (c("fx.bloodDeep") || "bloodDeep") : (c("fx.bloodMid") || "bloodMid");
      const alpha = clamp01(cfg.stampAlpha * cfg.puddleAlphaMult);
      const inkMult = lerp(1.0, cfg.inkAlphaMultAtFull, clamp01(chunk.ink));
      const size = cfg.puddleSizeMin + Math.random() * Math.max(0, cfg.puddleSizeMax - cfg.puddleSizeMin);
      this._stampPixel(chunk, px, py, size, col, alpha * inkMult, cfg);
      chunk.lastUsedTime = this.game?.time ?? 0;
    }
  }

  update(dt, view) {
    const cfg = this._cfg();
    const t = this.game?.time ?? 0;

    // Decay coverage meter so stamps remain possible.
    const inkRemain = Math.pow(0.5, Math.max(0, dt || 0) / Math.max(0.0001, cfg.inkDecayHalfLifeSec));

    for (const chunk of this.chunks.values()) {
      chunk.ink = clamp01((chunk.ink || 0) * inkRemain);

      const fade = halfLifeToFade(dt, cfg.fadeHalfLifeSec);
      if (fade > 0) {
        const ctx = chunk.ctx;
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = clamp01(fade);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, cfg.chunkSize, cfg.chunkSize);
        ctx.restore();
      }

      if ((t - (chunk.lastUsedTime || 0)) > cfg.pruneAfterSec) {
        // Prune only if it's far from view (if view provided).
        if (view && typeof view.cameraX === "number" && typeof view.cameraY === "number") {
          const dx = (chunk.cx * cfg.chunkSize + cfg.chunkSize / 2) - view.cameraX;
          const dy = (chunk.cy * cfg.chunkSize + cfg.chunkSize / 2) - view.cameraY;
          const d2 = dx * dx + dy * dy;
          const r = ((view.canvasW || 0) / (view.zoom || 1)) * 1.25;
          if (d2 > r * r) this.chunks.delete(chunk.key);
        } else {
          this.chunks.delete(chunk.key);
        }
      }
    }

    // Hard cap to bound memory in extreme play.
    if (this.chunks.size > cfg.maxChunks) {
      const arr = Array.from(this.chunks.values()).sort((a, b) => (a.lastUsedTime || 0) - (b.lastUsedTime || 0));
      const remove = this.chunks.size - cfg.maxChunks;
      for (let i = 0; i < remove; i++) this.chunks.delete(arr[i].key);
    }
  }

  renderWorld(ctx, view) {
    const cfg = this._cfg();
    if (this.chunks.size === 0) return;

    const camX = view?.cameraX ?? 0;
    const camY = view?.cameraY ?? 0;
    const zoom = view?.zoom ?? 1;
    const w = view?.canvasW ?? 0;
    const h = view?.canvasH ?? 0;

    const halfW = w / (2 * zoom);
    const halfH = h / (2 * zoom);
    const pad = cfg.chunkSize;
    const left = camX - halfW - pad;
    const right = camX + halfW + pad;
    const top = camY - halfH - pad;
    const bottom = camY + halfH + pad;

    const minCx = Math.floor(left / cfg.chunkSize);
    const maxCx = Math.floor(right / cfg.chunkSize);
    const minCy = Math.floor(top / cfg.chunkSize);
    const maxCy = Math.floor(bottom / cfg.chunkSize);

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;

    // Slight overlap avoids visible seams between chunk textures under zoom/subpixel transforms.
    const overlap = (typeof cfg.chunkOverlap === "number" && Number.isFinite(cfg.chunkOverlap))
      ? Math.max(0, cfg.chunkOverlap)
      : Math.max(1, cfg.pixelScale);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.chunks.get(this._key(cx, cy));
        if (!chunk) continue;
        const x = cx * cfg.chunkSize;
        const y = cy * cfg.chunkSize;
        ctx.drawImage(chunk.canvas, x - overlap / 2, y - overlap / 2, cfg.chunkSize + overlap, cfg.chunkSize + overlap);
      }
    }

    ctx.imageSmoothingEnabled = prevSmoothing;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}
