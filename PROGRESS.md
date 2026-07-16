# PROGRESS

Working title: **PLATEAU**. Build per `PLATEAU_BUILD_SPEC_V2.md`. One phase/session.

---

## P0 — Screenshot loop, then sky + shader — ✅ gate met

The screenshot loop was built first (§0.5), then the full inked render chain, then
a palette-box test scene on a heightmap, then the §3.2 import test.

**Gate evidence:** `shots/p0-dawn.png` · `p0-noon.png` · `p0-dusk.png` · `p0-rock.png`
- Boxes read as a *drawing*: warm ink silhouettes (inverted hull), interior
  creases (Roberts edge), blue shadow bands, flat palette colour.
- Sun scrub swings the whole palette together: dawn warm-pink → noon blue → dusk orange.
- Distant terrain flattens to pale bands, ink faded out (no distant scribble).
- **§3.2/§3.4:** rocks built from OFF-palette greys + SPLIT normals come out
  indistinguishable in style from the boxes. Palette lock + smooth-normal hull both work.

### Files (P0)
- tooling: `scripts/shot.mjs` (`npm run shot -- <name> [--hour h|--sun s] [--pos x,y,z] [--look x,y,z] [--quality low] [--orbit]`)
- render: `palette.js sky.js smoothNormals.js lut.js toon.js outline.js edges.js pipeline.js`
- world: `terrain.js` (placeholder heightmap — real bake is P5), `testprops.js` (§3.2 test rock)
- `main.js`, `index.html`, `package.json` (renamed → plateau, `shot` script)

### Decisions
- **Screenshot loop forwards ALL `--flags` as URL query params** (an early whitelist bug
  silently dropped debug flags and cost a long detour — fixed).
- **`normalRT` (edge prepass) MUST have its own depth buffer.** Without it the prepass had
  no depth test → occluded meshes still wrote normals/depth → the edge pass drew *phantom*
  silhouettes over whatever was actually in front (looked like "hollow boxes"). This was the
  single biggest P0 bug. Depth-buffer precision (16/24/32-bit) was NOT the cause.
- **Shadows: one tight cascade to ~40m, self-managed** (own ortho depth RT + light-space
  matrix, sampled in the toon frag with 3×3 PCF). Spec lists 2-cascade CSM (§3.7); deferred
  the second cascade to avoid fighting Three's material system in P0. Looks correct.
- **Raking key light.** `setHour` peaks the sun at elev 0.82, never overhead — an overhead
  sun puts every vertical face at the hard-ramp midpoint and the two bands collapse.
- **Aerial density centralised** in `sky.uniforms.uAerial` (0.0030, up from spec's 0.0022)
  because the P0 test terrain is only ~360 m; "push until distant terrain is featureless"
  (§3.6). Retune at P5 against the real bake.
- **Final-grade LUT (§3.7 step 6) intentionally OFF.** The material-level palette lock
  (§3.2) does the unifying; a harsh final 14-colour snap would collapse the lit/shadow
  two-band shading (lit = albedo·sunColor, shadow = albedo·ambientSky are off-palette by
  design). The grade machinery isn't built; §3.2 carries the gate.
- **AA:** 1.25× supersample + 4-tap box downsample on `high`; FXAA on `low` (§3.7 step 7).
- Rendering verified under **SwiftShader** (headless software WebGL) — the actual test target.

### Known issues
- Faint shadow-map banding on steep slopes at low sun (acne). Cosmetic; revisit with CSM.
- The terrain silhouette ridge line can read a touch heavy at some framings.
- GLB import path (`loadGLB`) was prototyped then removed — the local test GLB hung
  `window.__ready` (loader/fetch stall under the proxy). P1 writes the real asset loader.

### Proposed (not built — logged per §0.5)
- Second shadow cascade (full §3.7 CSM).
- Final-grade LUT as an *extended* palette (base + shadow tone) if flatness needs reinforcing.

### Next action
**P1 — Assets.** Pull CC0 packs (Quaternius/Kenney/KayKit/Poly Pizza), run every mesh
through `addSmoothNormals`, check silhouettes at 25 m, write the GLTF loader, log each
licence in `CREDITS.md` as added. Note: Kenney/Poly Pizza hosts are network-blocked here
(only GitHub raw reachable) — source packs from GitHub-hosted CC0 mirrors.

---

## §12 answers (recorded)
1. **Stamina is central** because it is the one number both layers read: climb/sprint/glide/
   swim/dodge all spend one wheel. Remove climbing → lose a verb; remove *stamina* → the
   vertical world goes free AND dodge-cancel loses its price at once (the §6.2 reconciliation
   collapses). It already passes the §0.4 "touches world+combat+structure" test.
2. **Rhythm risks:** (a) §4.1 regen (32/s after 0.4 s) — the delay must re-arm on *every*
   spend, not on idle, or the "~5 dodges" budget is effectively infinite under pressure;
   flag regen→~24/s or delay→0.6 s as a P4b tuning target. (b) §6.3 "Cancel +N" is ambiguous;
   implement as "recovery cancelable N ms after active ends; buffered input fires immediately"
   (light cadence ≈ 170 ms), in `config/combat.js` for P4b retune. H3 "none" still dodge-cancels.
