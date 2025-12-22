Color System Spec
Identity Palette + Production Rules (v5)

Purpose
This project uses a semantic color system (colors have roles) optimized for:

* High on-screen density (many enemies, projectiles, particles).
* Muted gothic world (dark modern fairytale / occult whimsy).
* Strong ownership readability (player vs enemy vs neutral) across varied zone backgrounds.

Non-negotiables

1. Semantic roles only

* Never “borrow” colors across roles to solve a one-off art problem.
* If a system needs a new role, add a new semantic token instead of reusing an identity color.

2. Ink rim rule (mandatory for readability)

* All small moving gameplay elements (markers, bullets, particles, pickups, hit sparks) must have a 1–2px rim/outline using:

  * Ink outline: #0C0D12 (preferred), or
  * Soft near-black: #141623 (if you need a softer edge).
    This is required because backgrounds vary by zone and bloom/blur can wash out fills.

3. World stays muted

* Environment/props/buildings should not compete with identity colors.
* Identity colors are reserved for gameplay ownership, UI semantics, and deliberate callouts.

4. Blood looks like blood

* Blood uses the blood set (below), regardless of who caused it.
* Do not recolor blood using enemy magenta identity colors.

Core identity palette (ownership)
Player identity core (player-owned)
Use only for: player marker, player-owned projectiles, player-owned hit flashes, player resource UI accents, interaction highlights, selection outlines.

* P1 glow/spec (rare, not large fills): #6CEDED
* P2 primary (default ownership fill): #6CB9C9
* P3 secondary (subdued player support): #6D85A5
* P4 accent/guard (defense/shield): #6E5181

Enemy identity core (enemy-owned)
Use only for: enemy markers, enemy-owned projectiles, enemy-owned hit flashes, enemy health UI, hostile traps and hostile “ownership” cues.

* E1 primary/elite: #6F1D5C
* E2 secondary/standard hostile: #4F1446
* E3 deep/swarm mass: #2E0A30
* E4 abyss/ominous depth: #0D001A

Global neutrals + UI foundation (structure)
These are the backbone for outlines, hatching, UI panels, borders, and value control.

* Ink outline (hard linework, rims): #0C0D12
* Soft near-black (shadow fill, UI panels): #141623
* Cold slate (dark mid for surfaces/insets): #25283A
* Weathered iron (mid neutral, borders/frames): #3B3F52
* Dust gray (light neutral, fog/disabled): #6E7386
* Bone highlight (premium highlight): #D2C8BC
* Parchment light (UI text/spec only): #EFE6D8

World materials (environment, props, buildings)
Use for: terrain, stone, wood, leather, metal warmth, moss/age.
Do not use player/enemy identity colors on broad world surfaces.

* Rotwood (wood/leather base): #4A2F2A
* Rust ochre (warm wear, earth, bounce): #8A5A3C
* Grave moss (moss/rot as world detail, not enemy identity): #4A6A4E
* Deep stone (stone base): #1F2230
* Mid stone (stone mid): #34384B

FX palette (combat semantics, not ownership)
Blood (always blood)

* Blood deep: #3D0B18
* Blood mid: #7A1B2E
* Blood bright: #B3424A

Heat / fire

* Ember: #C06A3A
* Ember deep: #7E3B22

Toxic / curse (reserved, sparse)

* Toxic: #8BC45A
* Toxic deep: #3D5A2D

Arcane deep (player spell support without drifting into enemy space)

* Arcane deep: #2A6674

Skin midtones (desaturated, with universal rules)
Universal skin rules

* Creases/contact: Ink #0C0D12
* Shadow fill: Soft near-black #141623
* Highlight: Bone #D2C8BC
* Spec hits (tiny only): Parchment #EFE6D8

Skin midtone options (choose one per character)

* Pale / moonlit: #6E7386
* Neutral human (mid): #8A7F7A
* Tan / sun-worn: #8A5A3C (thin, not flat)
* Sallow / haunted (mid): #7B8579
* Bloodless (mid): #4C556D
* Pale-warm A: #C4B2A2
* Pale-warm B: #C7B8A9

Skin guardrails

* Rust (#8A5A3C) is never a flat fill on face planes; only tiny dither clusters for warmth.
* Highlights stay Bone-dominant; Parchment is rare spec only.
* Form is created primarily by hatch density/direction, not extra hues.

NPC alignment rules (friendly / neutral / hostile)
NPCs are not “world by default.” Their alignment has a controlled accent language.

Friendly NPCs

* Base: neutrals + world materials (not identity cores).
* Accent allowed: P3 #6D85A5 and P4 #6E5181 only.
* Forbidden: P1/P2 as clothing fills. P1 may appear only as a tiny interaction glint (1–2px max).

Neutral NPCs (merchants/civilians)

* Live in world materials + Dust/Bone.
* Allowed accents: #6E7386 (Dust), #8A5A3C (Rust), #4A2F2A (Rotwood).
* Avoid both player core (P1/P2) and enemy core (E1/E2).

Hostile NPCs (cultists/bandits/possessed humans)

* Use enemy identity accents:

  * Standard hostile: E2 #4F1446
  * Elite/leader: E1 #6F1D5C
  * Swarm/deep: E3 #2E0A30
* Blood remains blood (blood set), not enemy magenta.

Props & buildings (ultra-specific rules)
Material ladder (3-step max per material)

* Shadow: #141623
* Mid: choose one material mid (stone/wood/metal)
* Highlight: #6E7386 then tiny #D2C8BC chips

Stone buildings

* Mid: #1F2230 and/or #34384B
* Chips: #D2C8BC tiny
* Moss: #4A6A4E sparingly, small patches only

Wood buildings/props

* Mid: #4A2F2A
* Wear: #8A5A3C
* Chips: #D2C8BC tiny

Metal props

* Mid: #3B3F52
* Highlight: #6E7386
* Warm bounce: #8A5A3C subtle

Building color budgets (hard caps)

* Accents must be <5% of surface area.
* Identity cores (player/enemy) are forbidden as broad building colors.
* Signage/labels: Parchment/Bone only (UI-like), or Dust gray for worn paint.

Cursed/hostile architecture (allowed but constrained)

* Use E3 #2E0A30 or E4 #0D001A only in cracks, seams, trim lines, and small rune cuts.
* Never paint entire walls with E1/E2.

Light props (lanterns/torches)

* Flame core: Ember #C06A3A
* Deep: #7E3B22
* Rim: Ink #0C0D12 if sprite is small
* Keep glows tight; avoid large constant halos in combat zones.

Gameplay ownership: markers, projectiles, hit effects (must be consistent)
Player marker

* Fill: P2 #6CB9C9
* Optional glow/spec: P1 #6CEDED (thin edge or brief pulse only)
* Rim: Ink #0C0D12 mandatory

Enemy marker

* Standard: E2 #4F1446
* Elite: E1 #6F1D5C
* Swarm/far: E3 #2E0A30
* Rim: Ink #0C0D12 mandatory
* Avoid glow by default.

Player-owned projectiles

* Body: P2/P3
* Sparkle/spec: tiny P1
* Rim: Ink mandatory

Enemy-owned projectiles

* Body: E2/E3 (E1 for elite/boss projectiles)
* Rim: Ink mandatory
* Toxic mechanics only: add tiny Toxic #8BC45A specks, sparse.

Hit FX ownership (core rule)
Player damages enemies (player-owned hit feedback)

* Impact flash: P2 #6CB9C9
* Confirm/crit: P1 #6CEDED (brief)
* Heat skills: Ember #C06A3A
* Guard/shield hit: P4 #6E5181
* Rim: Ink on small sparks

Enemy damages player (enemy-owned hit feedback)

* Impact flash: E2 #4F1446 (or E1 for elites)
* Deep secondary: E3 #2E0A30 (sparks/shards)
* Blood: blood set (#3D0B18 / #7A1B2E / #B3424A)
* Toxic/curse: Toxic #8BC45A (reserved, sparse)
* Rim: Ink on small sparks

Neutral/environment impacts

* Dust #6E7386 + Bone #D2C8BC specks
* Rim: Ink on small particles

UI semantics (so code refactors don’t break meaning)
UI surfaces

* Screen/panel background: #141623 or #0C0D12
* Panel inset: #25283A
* Borders/frames: #3B3F52
* Primary text/icons: #EFE6D8
* Secondary text: #D2C8BC
* Disabled: #6E7386

Bars and meters (recommended defaults)

* Player HP: Blood bright #B3424A (track #25283A, border #3B3F52)
* Enemy HP: Enemy E1 #6F1D5C (track #25283A, border #3B3F52)
* Player resource (mana/energy): P2 #6CB9C9 with P1 top edge highlight
* Shield/guard: P4 #6E5181
* XP/progress: P3 #6D85A5
* Warnings: Ember #C06A3A
* Toxic status: Toxic #8BC45A (reserved)

Do not do this (common failure modes)

* Do not use Grave moss (#4A6A4E) as “enemy identity.” Enemies are magenta-violet now.
* Do not use P1 (#6CEDED) as a large fill on characters or world; it is glow/spec only.
* Do not use enemy identity magenta as blood. Blood has its own set.
* Do not remove Ink rims on moving sprites; zone variability will break readability.

Implementation guidance for refactors (for AI agents)

1. Replace raw hex usage with semantic tokens

* Example token map:

  * PLAYER_PRIMARY = #6CB9C9
  * PLAYER_GLOW = #6CEDED
  * ENEMY_PRIMARY = #4F1446
  * ENEMY_ELITE = #6F1D5C
  * INK = #0C0D12
  * PANEL_BG = #141623
  * etc.
* Agents should refactor by semantic intent (ownership/UI/world/FX), not by hue similarity.

2. Enforce the rim rule in render systems

* If shaders exist: outline pass or stroke.
* If sprite-based: draw a slightly larger Ink silhouette behind the sprite.

3. Zone backgrounds must not change identity colors

* Preserve player/enemy identity cores project-wide.
* Achieve contrast through value, rim, and muted environment budgets.

End of spec (v5)
