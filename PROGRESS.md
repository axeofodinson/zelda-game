# Progress notes

## Pre-P1 rendering probe (2026-07-17)

Two things probed against the render pipeline before starting Phase 1. Note:
this codebase (Cindercast / Ashfall Basin) has no grass, no rocks, and no
day/night cycle — it's an ash-and-molten foundry theme (`src/render/palette.js`).
Read "box" as the `BoxGeometry` mold-shell/ground blocks and "grass at dusk" as
the ground plane under the kiln-sun sky gradient (`src/render/sky.js`), the
closest real analogues.

**1. Box silhouette / "ink" outline** — not a bug, doesn't apply here.
Searched the whole renderer (`src/render/*`) for any outline/edge-detection
pass (`EdgesGeometry`, `LineSegments`, a stencil/normal-based inverted-hull
outline, etc.) — there isn't one. Every shape (box, cylinder) is flat
vertex-lit with no silhouette ink line, by design (`pipeline.js`: "NO
per-pixel lighting... N64 didn't do linear lighting either"). Confirmed by
probing actual rendered pixels across a mold-shell box's edge against the sky:
the transition is a plain 2-3px monotonic blend (168→147→128→111) from the
bilinear upscale pass, not a distinct darker outline color. There's also no
"rock" asset in the codebase to compare against. Nothing to fix — this is
consistent (non-)behavior across every object type, not a box-specific
regression.

**2. Diagonal line across the ground plane** — real bug, fixed.
`bakeFlat()` in `src/render/geo.js` rolls its per-face "wear" jitter
(`opts.variance`) with `Math.random()` inside the per-*triangle* loop instead
of per-*face*. Every flat quad in the scene (built from exactly 2 triangles —
the 100×100 ground plane, every mold-shell box face, the runnel strips) is
non-indexed, so its two coplanar triangles land in that loop as separate
iterations and can draw different jitter values. Confirmed directly at the
data level (not just visually, since the effect is a non-deterministic
`Math.random()` draw and isn't guaranteed to be large enough to notice on any
given page load):

```
// before the fix — same face (normal.y=1), two different colors:
triangle at vtx 12  color= 0.3665 0.3014 0.2566
triangle at vtx 15  color= 0.3546 0.2916 0.2482
```

This is exactly the "diagonal line crossing the ground" symptom — a seam
along the shared diagonal of the quad — and not an intentional height/slope
color band (there's no such banding system in this codebase at all).

Fix: re-roll the jitter once every 2 triangles (once per quad face) instead
of every triangle. Verified after the fix that both triangles of a face now
get identical colors on every trial, while distinct objects still get
independent variance:

```
trial 0  vtx 12  color= 0.3622 0.2978 0.2535
trial 0  vtx 15  color= 0.3622 0.2978 0.2535   <- matches now
```

Also checked `CylinderGeometry` bakes (pools/patches) still produce no NaNs
and sane per-face shading after the change — cap wedges pair up two-at-a-time
but share the same normal already, so no new artifact there.

`npm run verify` gate passes clean (0 console/page errors, motion confirmed
across 3 frames) after the fix.
