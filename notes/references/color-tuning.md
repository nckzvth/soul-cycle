# Color Tuning (v5)

This project separates **what a color means** (role/semantic wiring) from **what the color is** (hex values).

## Where to change what

### 1) Change the actual colors (hex values)

- Edit `src/data/Palette.js` (`TOKENS_V5` + `PALETTE` aliases).
- This is where you tweak the canonical palette values (P1/P2/E1/etc, neutrals, FX sets).

### 2) Re-wire meanings (which systems use which tokens)

- Edit `src/data/ColorTuning.js` (`COLOR_TUNING`).
- This is where you decide things like:
  - “Thralls should read as `e3` instead of `e2`”
  - “Town portal uses `arcaneDeep`”
  - “UI confirm glow uses `player.core`”

Most systems should call `color(path, alphaOverride?)` from `src/data/ColorTuning.js` rather than hardcoding `PALETTE.*` or inventing new colors.

### 3) UI/CSS colors

- Edit `index.html` `:root{...}` tokens for CSS-driven UI.
- Use `rgba(var(--…-rgb), <alpha>)` for alpha variants (no numeric `rgba(r,g,b,a)` literals).

## How to use in code

### Canvas/UI draw code

Use roles:

- `import { color as c } from "../data/ColorTuning.js";`
- `ctx.fillStyle = c("enemy.body.standard")`
- `ctx.strokeStyle = c("fx.ink", 0.6)`

### Token objects (particles/VFX configs)

When you already have `{ token, alpha }` objects (common in VFX configs), keep using `resolveColor(...)` from `src/render/Color.js`.

## Guardrails

- `scripts/lint_colors.py --strict` checks for raw literals and also flags world-material role borrowing (`PALETTE.moss`, `PALETTE.rotwood`, etc.) in sensitive gameplay/UI files.

