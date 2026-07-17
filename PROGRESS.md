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
- **GLB loading hung `__ready` in P0** (loader or fetch). Unresolved — the loader was removed
  as out-of-phase. **This is P1's first real bug.** Suspect the proxy 403 that also broke the
  `raw=1` probe.
- **Intermittent proxy 403s can prevent module boot with NO `pageerror`.** If a page fails to
  initialise and there's no JS exception, suspect the network before the code. Cost several
  rounds in P0.

### Instrument (SPEC_PATCH_01 applied — doc edit, not a phase)
Upgraded the screenshot loop to the patch's mandatory spec and verified all of it:
- `shot` forwards **every** `--flag` verbatim (no whitelist).
- Every PNG carries a **burned-in URL caption** (top-left monospace) — a misforwarded param
  is visible in the artifact.
- `npm run probe -- <name> --at x,y[;x,y]` prints canvas RGB (ground truth). Verified:
  red box → `#cc5b4f`, green box → `#6abb56`.
- `shot` **self-test** (independent `selftest.html`, 2×2 colour grid) runs on first use / via
  `--selftest`. Verified: TL red, TR green, BL blue, BR white read back exactly.
The spec was materialised into the repo (`PLATEAU_BUILD_SPEC_V2.md`) and all SPEC_PATCH_01
edits folded in (debugging protocol, screenshot-loop rewrite, §4.1/§6.3 patches, §11 don'ts,
§10 P0-gate addendum + P1 rewrite).

### Proposed (not built — logged per §0.5)
- Second shadow cascade (full §3.7 CSM).
- Final-grade LUT as an *extended* palette (base + shadow tone) if flatness needs reinforcing.

### Next action
**P1 — Assets. Blocked on a human step (§10).** Hassan drops CC0 GLBs in `assets/raw/`
(Claude Code's network can't reach the asset hosts). **If `assets/raw/` is empty at session
start, stop and say so — do not improvise a procedural stand-in** (P0's rock already
validated §3.2/§3.4). Once populated: load, run `smoothNormals` over every mesh, check
silhouettes at 25 m, log licences in `CREDITS.md`, pick a primary pack. First real bug to
expect: the GLB loader hang (see Known issues).

### Pre-P1 probe (two suspected P0 defects, checked before starting assets)
Both probed with numpy pixel readback against the saved `shots/p0-*.png` (ground truth,
same discipline as `probe`), not by eyeballing. **Neither was a real bug.**
1. **Box hull outline "may be missing" vs rocks — false alarm.** Sampled the grey box's
   top+right silhouette against sky in `p0-rock.png` column-by-column (incl. the 90° corner):
   the ink line is continuous, no dropouts, darkest pixel `(58,73,78)` — distance 69 from
   `PC.ink #2A2118`, essentially the same order as the tan rock's silhouette darkest pixel
   `(64,71,71)`, distance 64. Boxes only *look* less inked because a flat box has one crease
   vs. a faceted rock's dozens (§3.4 Roberts-edge lines), not because the inverted-hull
   (§3.4, `addSmoothNormals` + `makeHull`) is failing on box geometry.
2. **Diagonal band across the grass at dusk — a real shadow, not a seam.** Vertical probes
   through the band in `p0-dusk.png` (x=900, x=955) show a smooth ~20-50 px colour ramp
   (soil `170,138,99`→`120,116,102`, grass `130,162,76`→`114,134,79`), matching the 3×3 PCF
   soft-shadow edge, not a hard single-pixel discontinuity. Confirmed directional: the
   identical framing in `p0-noon.png` has no band at all — it only appears under the
   raking dusk sun, i.e. it's the tall grey box's cast shadow, not a terrain/LOD seam.

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
