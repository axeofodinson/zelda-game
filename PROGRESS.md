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
- ~~**GLB loading hung `__ready` in P0**~~ — **did not reproduce in P1**, and the proxy-403
  suspicion was wrong: the pack is repo-local, so no proxy is involved. See P1 below.
- **Intermittent proxy 403s can prevent module boot with NO `pageerror`.** If a page fails to
  initialise and there's no JS exception, suspect the network before the code. Cost several
  rounds in P0. (Still worth keeping — it just wasn't the cause of the GLB hang.)

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

## P1 — Asset pipeline — ✅ gate met

`assets/raw/` was populated before session start (329 Kenney Nature Kit GLBs, CC0,
3.6 MB). The §10 human step is DONE.

**Gate evidence:** `shots/p1-silhouette-25.png` · `p1-pack-all.png` · `p1-dusk.png`
· `p1-glb-one.png` · `p0-rock-recheck.png`
- All **329 models load**: 699 meshes, 36,311 tris, 693 stale UV attributes dropped,
  23 materials resolved, **0 unmapped**. Tri count cross-checks exactly against an
  independent offline parse of the GLB JSON chunks.
- `smoothNormals` runs over every mesh; the inverted hull holds on real pack
  geometry (numbers below).
- Palette lock applied by material name from `palette.json`.

### Files (P1)
- `src/world/glb.js` — fetch-first GLB loader (fetch → `GLTFLoader.parse`).
- `src/world/props.js` — the pipeline: palette lock, `smoothNormals`, hull, scale.
- `scripts/manifest.mjs` + `npm run assets` → `assets/raw/manifest.json`.
- `src/main.js` — `?glb=<model>` (loader smoke test), `?p1=<dist>` (silhouette rig),
  `?set=a,b,c|all`. Both paths gate `__ready` on the load finishing.
- `src/render/sky.js` — **one render fix, see Bugs below.**
- `CREDITS.md` — Kenney Nature Kit, Kenney (kenney.nl), CC0 1.0.

### Primary pack — decided: Kenney Nature Kit
Only one pack is present, so this is recorded rather than deferred. It would win a
field anyway on the two criteria in §10:
- **Silhouette:** chunky, low-poly, few large planes per form — exactly what an
  inverted hull + Roberts crease pass wants. Measured continuous at 25 m (below).
- **Rig quality:** *no rig at all* — 0 skins, 0 animation clips across all 329
  files. Irrelevant here: this is a set dressing pack, and §3.2 takes "mesh, rig,
  animation clips" but props need none. Characters and enemies come from Mixamo in
  P2/P4c, which is where rig quality actually gets judged.
- 329 models beats Quaternius' 150, ships GLB with no conversion step, and is CC0.

**Pack scale = 4.0** (`PACK.scale`). The kit is authored small — tallest model is
2.08 units. At 1 unit = 1 m a "tall pine" is chest height and has no silhouette at
25 m. ×4 puts `tree_default` at 6.83 m and `tree_pineTallD` at 8.30 m, which reads.

### Bugs found and fixed
1. **Hull recursion — `Maximum call stack size exceeded` on every model.**
   `prepareMesh` parents a hull onto each mesh; running it inside `traverse()` meant
   traverse walked into the hull it had just added and hulled the hull, forever.
   Fix: collect meshes first, prepare second (`src/world/props.js`).
2. **Sky dome punched a black hole in the sky — this one is in `src/render/sky.js`,
   flagged explicitly.** A P0 defect that P1's framing exposed, not a P1 defect.
   The dome was a sphere of radius 4000 fixed at the origin and `camera.far` is
   4000, so the moment the camera leaves the origin the dome's forward cap falls
   outside the far plane and is clipped, showing the RT clear colour. Confirmed by
   prediction, not by eye: the hole's angular radius must scale with camera offset,
   and moving the camera from z=25 to z=200 grew it from ~6° to ~16.4° (predicted
   18°, the gap is the dome's 32×16 faceting). Probe at (640,325): `(0,0,0)` before,
   `#7ec8e3` = exactly `P.skyDay` after. Fix: radius 3000 **and** re-centre the dome
   on the camera each frame — both are needed, since centring alone still grazes the
   far plane. Would have broken every phase with a moving camera. P0's rig
   re-rendered clean afterwards (`p0-rock-recheck.png`).

The P0 "GLB loading hung `__ready`" issue did **not** reproduce, and the suspected
proxy 403 was a red herring — the pack is repo-local, so no proxy is involved.
First move (one GLB, `tree_plateau`): HTTP **200**, `model/gltf-binary`, 16304 bytes
(exact on-disk size), parsed, `__ready` true in 2.3 s. The loader is fetch-first
anyway (`fetch` → `GLTFLoader.parse`) so the HTTP status is always in hand — three's
XHR path swallows it, which is what made P0 undiagnosable.

### Silhouettes at 25 m — measured, not eyeballed
Column scan over a canvas readback (same path `probe` uses): per column, first
non-background pixel, then the darkest luminance across that transition.
`drop(bg)` counts columns where no line is measurably darker than the backdrop.

| model | cols | darkMin | darkMed | fillMed | bgMed | drop(fill) | drop(bg) |
|---|---|---|---|---|---|---|---|
| tree_default | 41 | 60.9 | 78.0 | 180.6 | 186.2 | 0 | 0 |
| tree_pineTallD | 41 | 71.7 | 128.2 | 160.5 | 186.2 | 15 | 3 |
| plant_bushLarge | 41 | 85.1 | 117.1 | 116.2 | 156.8 | 25 | 8 |
| rock_tallE | 41 | 71.8 | 87.5 | 173.3 | 156.8 | 1 | 0 |
| stone_largeD | 41 | 81.8 | 82.7 | 235.5 | 98.8 | 0 | 41 |
| cliff_blockSlope_rock | 41 | 101.4 | 101.4 | 173.3 | 170.4 | 0 | 0 |
| stump_round | 41 | 65.0 | 82.6 | 172.1 | 156.8 | 1 | 1 |
| mushroom_redTall | 25 | 64.9 | 74.5 | 153.0 | 156.8 | 2 | 4 |

**Read: the hull is continuous on all eight.** `darkMin` 61–101 sits in the same
band as P0's verified test rock (darkest silhouette pixel luminance 69.8), which is
the cross-check that matters — a torn hull from split verts would show as bright
gaps with `dark ≈ fill` on most columns, and does not. Two caveats, both metric
artifacts rather than defects: `stone_largeD`'s 41 `drop(bg)` is because its
backdrop is the fogged horizon band (lum 98.8), *darker* than its own ink line —
`drop(fill)` = 0 there. `plant_bushLarge` and `tree_pineTallD` inflate `drop(fill)`
because sampling straight down from a steep or sub-metre silhouette lands on edge
or ground, not interior fill; their `drop(bg)` is 8/41 and 3/41.

### The finding: the palette lock collapses onto sky roles
Applied exactly as §3.2 and `assets/raw/README.md` specify — the 21 unique linear
`baseColorFactor` values quantised through the Oklab LUT once, assigned by material
name, no gamma correction. The result is that **6 of the 14 palette entries absorb
the entire kit, and 4 of those 6 are §2's sky-and-light roles, not surface roles:**

| locked to | role in §2 | source materials | files |
|---|---|---|---|
| `skyDusk` #F2A65A | sky gradient stop | dirt, dirtDark, woodBark, woodBarkDark, wood, woodDark, leafsFall, colorRed | 242 |
| `skyDay` #7EC8E3 | sky gradient stop | grass, leafsGreen, leafsDark | 190 |
| `sear` #FFF7D6 | impact flash / trails | stone, water, woodBirch, woodInner, colorWhite, _defaultMat | 189 |
| `metal` #B8C4CC | surface | stoneDark, colorPurple | 26 |
| `sun` #FFF2C4 | the light | colorTan, colorYellow, corn | 7 |
| `rock` #A89078 | surface | colorRedDark | 3 |

`grass`, `grassLo`, `rockLo`, `soil`, `water`, `wood`, `cloth` and `ink` are used by
**nothing**. Foliage becomes the literal sky colour: canopy fill probes
`(122,196,201)` against a sky of `(126,200,227)` — a tree at 25 m is separated from
the sky by its ink line alone.

**Cause, established numerically — it is not a tunable.** Every source colour has
Oklab L between 0.778 and 1.000 (median 0.85); the palette's *surface* colours top
out at `metal` L=0.813, so any nearest-neighbour on absolute lightness lands on the
few bright entries, which are the sky ones. Restricting the LUT's targets to the
surface subset does not help — it collapses everything onto `metal` (674 of 693
mesh-uses) — and dropping the lightness term entirely gives foliage→`water`, since
the source foliage hue is genuinely cyan (h≈−176° vs `P.grass` at +137°). Tested
all three; none is an improvement. §3.2's premise assumes source albedos
distributed like surface colours, and this pack's are near-white pastels rotated
40–90° in hue from ours.

Left as specified, not improvised around (§0.5, §11). It does not fail P1's gate —
silhouettes and style are correct — but it will fail **P7's colour gate**, which
wants a dominant saturated hue that is not the sky's.

### Known issues
- The palette collapse above. Live, unfixed, by decision.
- **`cloth` is reachable as an albedo target.** §2 says `cloth` is the player and
  the ONLY red in the world, but the LUT can map any reddish source onto it —
  `colorRedDark` lands on `cloth` under a hue-leaning metric, and `colorRed` (11
  files) is one weight tweak away. Latent, not currently firing.
- `src/render/lut.js`'s distance comment says "Lightness weighted slightly under
  chroma: keep hue families together", but `0.9·dL² + da² + db²` cannot do that:
  Oklab L spans 0.25–0.97 while our palette's chroma tops out at 0.18, so dL²
  dominates by ~25×. Code and stated intent disagree. Not changed — every
  alternative weighting tested was worse (see above).
- `plant_bushLarge` (0.97 m) is at the resolution limit at 25 m; sub-metre props
  will need an LOD or cull rule, not a hull fix.
- The single-file ship target (`vite-plugin-singlefile`) will not inline
  `assets/raw/**`. P7 problem, noted now.

### Flagged for later — NOT built (§0.5)
- **Grass tufts need GPU instancing.** `grass` (132 t), `grass_large` (224 t),
  `grass_leafs` (36 t), `grass_leafsLarge` (144 t) will be placed in the thousands.
  Routed through the standard prop pipeline each becomes an individual mesh **plus
  its own hull mesh** — 2 draw calls per tuft, so 4,000 tufts = 8,000 draw calls.
  Will not scale. Needs `InstancedMesh` with a per-instance hull pass. §3.8's 80k
  blades are a separate procedural system; this is about the kit's tuft models.
- **A semantic name→role map** as the answer to the palette collapse:
  `grass`/`leafsGreen`→`P.grass`, `leafsDark`→`P.grassLo`, `woodBark`→`P.wood`,
  `dirt`→`P.soil`, `stone`→`P.rock`, `stoneDark`→`P.rockLo`, `water`→`P.water`.
  The kit's material names are stable across all 329 files, so this is reliable and
  cheap. It is *not* nearest-neighbour, so it is outside §3.2 as written — hence
  logged, not built. **This is the decision worth making before P5.**
- Excluding `ink`, `sun`, `sear` and `cloth` from albedo LUT targets on role
  grounds (see Known issues).
- Second shadow cascade (carried over from P0).

### Next action
**P2 — Movement.** Controller, camera, sprint, stamina wheel, climbing. Mixamo +
`stylize()` + foot IK. Rig quality gets judged there, not in P1 — the Nature Kit
carries no skins or clips at all.



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
