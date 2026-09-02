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
- ~~The palette collapse above. Live, unfixed, by decision.~~ **Fixed in P1b.**
- ~~**`cloth` is reachable as an albedo target.**~~ **Fixed in P1b** — structurally
  impossible now, not avoided by convention. §2 says `cloth` is the player and the
  ONLY red in the world, but the LUT could map any reddish source onto it:
  `colorRedDark` landed on `cloth` under a hue-leaning metric and `colorRed` (11
  files) was one weight tweak away.
- ~~`src/render/lut.js`'s distance comment contradicts its code.~~ **Fixed in P1b**
  (comment corrected; the code is unchanged and still lightness-first).
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
- ~~**A semantic name→role map** as the answer to the palette collapse.~~ **Built in
  P1b** — see below.
- ~~Excluding `ink`, `sun`, `sear` and `cloth` from albedo LUT targets on role
  grounds.~~ **Built in P1b** as `ALBEDO_ROLES`, asserted at module load.
- Second shadow cascade (carried over from P0).



---

## P1b — Semantic palette map — ✅ gate met

P1 applied §3.2's palette lock exactly as written — nearest-in-Oklab against
`PALETTE_LIST` — and measured the result: 6 of 14 entries absorbed all 329
models, 4 of those 6 were sky-and-light roles, and foliage locked to the literal
sky colour. P1 also established the cause was structural rather than tunable.
P1b replaces the distance metric with a **material name → §2 role map**. §3.2's
goal (unify roles across packs) is kept; its stated mechanism is not.

Done now rather than before P5 because every phase between here and there gates
on screenshots, and tuning light, shadow and framing against foliage-as-sky
means gating on an image that is wrong in the most load-bearing way.

**Gate evidence:** `shots/p1b-silhouette-25.png` · `p1b-roles-25.png` ·
`p1b-canopy.png` · `p1b-pack-all.png` · `p1b-p0-recheck.png`

### Files (P1b)
- `src/world/roles.js` — **new.** The map, the exclusions, the recolours, the
  `_defaultMat` prefix rules, and the assertions. Nothing in it falls back.
- `src/world/props.js` — `prepareMesh` resolves name→role→colour; `packModels`
  filters the exclusions; `loadPackPalette` is now a coverage check, not a
  colour source. `SILHOUETTE_SET`: `mushroom_redTall` → `mushroom_tanTall`.
- `src/main.js` — palette-entry histogram on the pack load; `window.__props`
  instrument hook (screen-space prop bounds for the scanner).
- `src/render/lut.js` — **comment only**, no code change (proved below).
- `scripts/roles.mjs` + `npm run roles` — **new instrument.**
- `scripts/scan.mjs` + `npm run scan` — **new instrument.**

### The map
Names and usage cross-checked against `assets/raw/kenney-nature-kit/palette.json`
*and* an independent parse of all 329 GLB JSON chunks — the counts match exactly.

| material | files | role | | material | files | role |
|---|---|---|---|---|---|---|
| `grass` | 129 | `grass` | | `stoneDark` | 23 | `rockLo` |
| `dirt` | 98 | `soil` | | `water` | 18 | `water` |
| `stone` | 89 | `rock` | | `leafsFall` | 14 | `soil` |
| `dirtDark` | 38 | `rockLo` | | `woodBirch` | 14 | `rock` |
| `leafsDark` | 38 | `grassLo` | | `woodDark` | 11 | `rockLo` |
| `woodBark` | 37 | `wood` | | `woodInner` | 11 | `wood` |
| `woodBarkDark` | 33 | `rockLo` | | `colorTan` | 3 | `soil` |
| `wood` | 31 | `wood` | | | | |
| `leafsGreen` | 23 | `grass` | | | | |

`_defaultMat` (54 files) is core terrain geometry, not junk, and is pure white —
which is why nearest-neighbour was sending all of it to `sear`. It spans rock,
wood, foliage and crops, so it resolves by model-name prefix:

    rock_* stone_* cliff_* statue_* path_stone* pot_* mushroom_*  → rock
    path_wood* fence_* sign bed_floor tent_*                      → wood
    tree_*                                                        → grassLo
    crops_*                                                       → soil

**Excluded — not loaded** (13): `flower_red{A,B,C}`, `flower_yellow{A,B,C}`,
`flower_purple{A,B,C}`, `mushroom_red{,Group,Tall}`, `crops_cornStageD`.
Flowers carry the accent materials and §2 has no accent slot — the one saturated
accent is `cloth`, reserved for the player. Red mushrooms go because
`mushroom_tan*` is the same three shapes in a colour that does not fight §2.

**Recoloured, not excluded.** `colorRed` is on eleven models, only three of which
are flowers; it is also on all four `tent_*` and on `lily_large`. Tents are
unique geometry and worth keeping, and a red tent on a ridgeline competes with
"the player is the only red thing in the world" directly. Brown canvas does not,
and is more plausible regardless.

    tent_*      colorRed → wood     colorRedDark → rockLo
    lily_large  colorRed → grassLo

### Two holes in the map, found by verification and filled
The brief's map does not cover four of the 316 loaded models. Both gaps are on
models the brief explicitly *keeps*, so they were filled rather than left to
fail; flagged here because they are decisions, not transcription.
1. **`colorTan` had no role.** It is the cap of `mushroom_tan{,Group,Tall}` (16 t
   of cap over a 32 t stem). Given `soil` — the same call `leafsFall` gets, same
   hue family, and it reads as a brown cap against a pale stem.
2. **`_defaultMat` matched no prefix on `mushroom_tan*` and `tent_smallClosed`.**
   Added `mushroom_` → `rock` (the stem; the call `statue_*` and `path_stone*`
   already get for white structural geometry) and `tent_` → `wood` (4 t out of
   220 on that model, and the rest of the tent is `wood`).

Everything else the brief left unlisted checked out as genuinely excluded-only:
`colorPurple`, `colorYellow`, `colorWhite` and `corn` appear on no loaded model.
They are named in `EXCLUDED_ONLY_MATERIALS` so "deliberately roleless" is
distinguishable from "nobody noticed", and seeing one on a loaded model throws.

### Hard assertions — verified firing, not assumed
All at module load, so a bad map fails the build rather than a playtest.
- **No pack material may resolve to `cloth`.** Verified: pointing `MATERIAL_ROLE.grass`
  at `cloth` throws *"§2 violation: … `cloth` is the player and the ONLY red in the
  world"*.
- **Nor to any sky or light role.** `ALBEDO_ROLES` allows only the eight surface
  entries. Verified: pointing `tree_*` at `skyDay` throws.
- **No fallback anywhere.** An unmapped material, an unmatched `_defaultMat`, an
  excluded-only material on a loaded model, an excluded model, or a pack material
  with no role — five failure paths, all verified throwing by
  `npm run roles`'s own self-test (same discipline as `shot --selftest`: a map
  whose failure path is broken is the silent fallback wearing a seatbelt).

### Verify — the instrument, not the eye

**1. Silhouette scan at 25 m — hull continuity holds.** P0 and P1 both gated on
this and neither committed the scanner, so `scripts/scan.mjs` is committed now
and P1's numbers were re-measured with it. Baseline is a worktree at `9dc76ae`
(merged P1) scanned by the *identical* scanner — the comparison is paired, not
against P1's published table. Cross-check that the scanner is sound: on the
baseline it reproduces P1's table closely (`mushroom` 64.9 vs 64.9,
`cliff_blockSlope_rock` 99.3 vs 101.4, `stone_largeD` 78.3 vs 81.8); it scans the
full projected width rather than P1's 41 columns, which is where the rest of the
spread comes from.

| model | darkMin P1 → P1b | fillMed P1 → P1b | drop(bg) P1 → P1b |
|---|---|---|---|
| tree_default | 57.6 → 57.6 | 177.9 → 163.0 | 0 → 0 |
| tree_pineTallD | 55.7 → 52.9 | 146.2 → 110.2 | 0 → 0 |
| plant_bushLarge | 63.1 → 63.1 | 128.9 → 117.9 | 0 → 0 |
| rock_tallE | 74.0 → 71.3 | 156.8 → 156.8 | 55 → 43 |
| stone_largeD | 78.3 → 73.1 | 221.7 → 138.7 | 49 → 49 |
| cliff_blockSlope_rock | 99.3 → 87.7 | 173.3 → 108.4 | 0 → 0 |
| stump_round | 64.1 → 64.1 | 156.8 → 100.1 | 0 → 0 |
| mushroom_(red→tan)Tall | 64.9 → 64.9 | 152.5 → 105.3 | 0 → 0 |

**Read: the ink line did not move.** `darkMin` is identical or *darker* on every
one of the eight (0 to −11.6), never brighter, so no silhouette lost contrast;
the band sits where P0's verified test rock (69.8) sits. `drop(bg)` — separation
from the backdrop, the metric that actually detects a torn hull — is unchanged or
better everywhere. What did move is `fillMed`: interiors are markedly darker now,
which is the entire point (a canopy is no longer sky-bright). That narrows the
ink-vs-*interior* contrast, so `drop(fill)` ticks up a few columns per model —
a consequence of the fix, not a defect, and `drop(fill)` was already flagged in
P1 as the softer of the two metrics.

**2. Canopy vs sky — 5.0× better separated.** `tree_plateau` (`leafsGreen` +
`woodBark`), same rig, same pixel, both revisions:

| | canopy lit | canopy shadow band | sky |
|---|---|---|---|
| P1 | `(121,196,201)` | `(61,142,194)` | `(126,200,227)` |
| P1b | `(107,187,84)` | `(55,136,83)` | `(126,200,227)` |

P1's lit canopy is `ΔE_oklab = 0.0375` from the sky it stands against —
separated by its ink line alone, exactly as P1 reported (their probe read
`(122,196,201)`; this reproduces it to one count). P1b's reads **0.1886, a 5.0×
gain**; the shadow band goes 0.1789 → 0.2595. The canopy is `P.grass` `#6DBE45`
under the sun ramp, unambiguously green and unambiguously not the sky.

**3. Palette-entry histogram — 7 roles in use, all of them surface roles.**
All 316 models loaded in the browser, 0 failed, 13 excluded.

| role | hex | meshes | files |
|---|---|---|---|
| `grass` | `#6DBE45` | 144 | 142 |
| `rock` | `#A89078` | 143 | 123 |
| `soil` | `#8B5E3C` | 116 | 116 |
| `rockLo` | `#5C4A3D` | 109 | 108 |
| `wood` | `#7A5230` | 90 | 64 |
| `grassLo` | `#2F7A3E` | 43 | 40 |
| `water` | `#3FA9C9` | 18 | 18 |

**Unused: `ink`, `skyDay`, `skyDusk`, `sun`, `sear`, `cloth`, `metal`.** Sky and
light roles now appear on nothing but sky and light, and `cloth` appears on
nothing but the player. `grass`, `grassLo`, `soil`, `wood`, `rockLo`, `rock` and
`water` — the seven P1 asked for — are all in use; every one of them was used by
*nothing* before. `metal` is unused by this pack but stays a legal target for the
next one. `npm run roles` computes the same histogram offline from the GLB JSON
chunks and agrees (it counts material declarations, the browser counts mesh
primitives, hence 661 vs 663).

**4. P0 rig regression — bit-identical.** The only `src/render/*` change is a
comment, and that is provable rather than assertable: rendering P0's rig
(`?rock=1`, default framing) on both revisions and hashing the full canvas
readback gives `sha256 46f3099…81db83` on **both**, over all 921,600 pixels.

### Bugs found and fixed
1. **The scan instrument could silently measure the wrong repository.** A vite
   left from an earlier run holds the port, `--strictPort` makes the new one
   exit, and the script — which resolves its server start on a *timeout* —
   scanned whatever the stale server was serving. It surfaced as a "baseline"
   run at the previous revision handing back the current tree's numbers,
   identical to the decimal. `scan.mjs` now refuses to start on a busy port,
   prints the tree it is serving, and takes `--port`. `shot.mjs` and `probe.mjs`
   share the pattern and are worth the same guard.
2. **A comment edit silently deleted the line it documented.** Rewriting
   `lut.js`'s distance comment dropped `const d = dl*dl*0.9 + …`. Caught by
   reading the file back before running anything. The pixel-hash in Verify 4 is
   what proves the final state is a comment-only change.

### Decisions
- **The map is the mechanism; §3.2's text is not.** §3.2 specifies nearest-in-Oklab
  as the *means* to "three packs go in, one game comes out". P1 established the
  means cannot reach the end for this pack. The end is kept.
- **Nothing falls back.** A fallback to nearest-neighbour on an unknown material
  reintroduces the exact bug this replaces, and does it silently — the failure
  mode would be one prop the colour of the sky in a scene of 300.
- **The LUT stays.** It is no longer how pack albedo is unified, but it is still
  the shader-side lock for already-in-palette colours (terrain, the P0 boxes) and
  the §3.7 grade hook. `lutMix` is 0 on pack materials: the colour *is* a palette
  entry, so snapping it again is a no-op at best.
- **Exclusions are filtered in `packModels()`**, not at call sites, so "load the
  pack" cannot quietly come to mean "load the pack plus the red flowers".

### Known issues
- `plant_bushLarge` (0.97 m) is still at the resolution limit at 25 m — unchanged
  by P1b; sub-metre props need an LOD or cull rule, not a hull fix.
- The single-file ship target won't inline `assets/raw/**`. P7 problem.
- One transient `404` appeared on a single `shot` run and did not reproduce on
  the identical command; every subsequent run is clean. Noted, not chased.

### Flagged for later — NOT built (§0.5)
- **Grass tufts need GPU instancing.** Carried forward from P1 unchanged and
  deliberately not built: `grass` (132 t), `grass_large` (224 t), `grass_leafs`
  (36 t), `grass_leafsLarge` (144 t) go through the standard prop pipeline as an
  individual mesh **plus its own hull mesh** — 2 draw calls per tuft, so 4,000
  tufts = 8,000 draw calls. Needs `InstancedMesh` with a per-instance hull pass.
  §3.8's 80k blades are a separate procedural system.
- The busy-port guard from Bugs 1 belongs in `shot.mjs` and `probe.mjs` too.
- Second shadow cascade (carried from P0).

### Next action
**P2 — Movement.** Controller, camera, sprint, stamina wheel, climbing. Mixamo +
`stylize()` + foot IK. Rig quality gets judged there — the Nature Kit carries no
skins or clips at all.


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
