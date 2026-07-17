# PLATEAU — Build Spec v2

Working title. Rename it.

Single source of truth. **All previous documents are dead — delete them.**

Third-person open-world action-adventure. BotW's world, NieR/WuWa's combat, Dark Souls' structure, an inked flat-colour renderer. Original IP.

---

# 0. Read first

## 0.1 The three theses

1. **Everything obeys one rule set.** No special cases. That was BotW's actual magic, not its graphics.
2. **The sky is the renderer.** Sun, ambient, fog, and ink colour all derive from one procedural sky. Change the hour, the whole world moves together.
3. **Style carries the art, not assets.** Hard cel + ink lines + palette-locked flat colour. A crude shape with a line around it reads as *intentional*, because that's what drawn things look like. This is why one person can build it.

## 0.2 Hard constraints

- Vite + Three.js + vanilla JS. No framework, no TypeScript.
- **No Rapier in Tier 1.** Custom kinematic controller. Rapier arrives in Tier 2 with physics objects.
- All visuals from CC0 packs (Quaternius, Kenney, KayKit, Poly Pizza CC0). **You model nothing.**
- Mixamo is the canonical skeleton. Retarget everything to it.
- Target: 60fps on integrated graphics at `low`. Dev machine is a Chromebook.
- Log every asset's licence in `CREDITS.md` **as you add it**.

## 0.3 The IP line

Mechanics are not copyrightable. Art is.

- **Free:** climbing, stamina, gliding, perfect dodge, combos, break meters, bonfire loops, death drops, item-description lore, everything in this spec.
- **Never:** Hylian/Sheikah motifs, Link, Hyrule, triforce, Zelda names, Bokoblin/Lynel/Guardian designs, Souls' bonfire visual, NieR's characters, any Nintendo/miHoYo/FromSoft UI.
- **Test:** a lawyer sees a screenshot with the HUD off. "That's our game" = you crossed it. "That plays like our game" = you're Genshin, you're fine.

Never use a Zelda/Souls name as a placeholder. Placeholders survive.

## 0.4 The empty slot

Every reference has exactly one idea the others don't: BotW's chemistry, Souls' commitment, NieR's second combat layer, WuWa's echoes. **This spec currently has none of its own.** That's the difference between a good tribute and a game people remember.

Leave the slot empty. Don't invent one to fill it. The test for when you've found it: *it's a rule that touches the world, the combat, and the structure at once, and removing it breaks all three.* Until then, build the tribute — it'll be a good one.

## 0.5 How to work — read this twice

**One phase per session. Never two.**

**Session start:** read this spec + `PROGRESS.md`. Nothing else.
**Session end:** update `PROGRESS.md` — phase, status, files touched, decisions made, known issues, next action. Terse.

- **Do not narrate.** Build, then report in under 10 lines.
- **Do not explain code back.** It's readable.
- **Do not ask permission mid-phase.** Decide, log the decision, continue.
- **Do not refactor outside the current phase's files.**
- **Do not add anything not in this spec.** If you think it's needed, log under `Proposed` in `PROGRESS.md` and continue without it.
- **Prefer editing to rewriting.**
- **Gate fails once → fix it. Twice → log it and stop.**

### Debugging protocol

**Your eyes are for gestalt, not defects.** A screenshot can answer "does this read as a drawing." It cannot answer "is that face shadowed or transparent." That judgment requires pixels, and guessing at it is where budgets die.

**Before hypothesising a cause, state the defect as a testable assertion:**

> *"Pixel at (x,y) should be `P.rock` (#A89078). It reads as ____."*

Then check it with `npm run probe`. **If you cannot write that sentence, you do not have a bug — you have an impression.**

- **Confirm the defect exists before debugging it.** In P0, ~20 tool calls went into depth-precision, colour-format, and culling hypotheses for boxes that were never hollow. The answer was "I was misreading shadowed faces."
- **Verify the instrument before trusting it.** Same session: the shot tool silently dropped unknown params, so every debug shot rendered the *default* scene. Every conclusion drawn from those images was worthless, and it took ten rounds to notice.
- **Probe before the third hypothesis, not after the tenth.** Ground truth is cheap. Guessing is not.
- **Three hypotheses, then stop and write down what you KNOW vs what you ASSUME.** The false premise is always in the assumptions.
- **A failing probe beats a passing eye.** If the pixels say it's correct, it's correct — go find what you actually misread.

### The screenshot loop — P0's first deliverable

Claude Code cannot see. Every visual bug otherwise costs a human round trip, and that's where the token budget dies.

```bash
npm run shot  -- <name> [--any key value ...]
npm run probe -- <name> --at x,y[;x,y;...]
```

**`shot` requirements — all mandatory:**
- **Forward every param verbatim. No whitelist.** An unrecognised param is the caller's business, not the tool's. Silently dropping one makes every downstream conclusion false.
- **Burn the resolved URL into the PNG** — small monospace caption, top-left. A misforwarded param must be visible *in the artifact*, because that's the only place you'll look.
- Print the loaded URL to stdout.
- Exit nonzero on any console error. Filter nothing but favicon.
- **Self-test on first run:** render a known 2×2 colour grid and assert the four pixels. If the self-test fails, the instrument is broken and nothing else this session is trustworthy.

**`probe`** reads back pixels at given coordinates and prints RGB. **This is ground truth.** It is not a last resort — it is the second thing you reach for.

Build both before the renderer. Closing this loop is worth more than everything else in this document, *and only if the loop is verified.*

---

# 1. Tiers

| Tier | Contents |
|---|---|
| **1 — v1 ships this** | Renderer, baked terrain, controller/climb/glide/stamina, grass, animation-lite, full combat, 3 enemies, 1 boss, 3 checkpoints, death drop, silence |
| **2 — if budget remains** | Rapier + physics objects, chemistry, the animation re-timer, NPCs, Estus, weapon types + upgrades, fog gates, halftone, support unit |
| **3 — post-v1** | Procedural terrain, more regions, area-as-hue transitions, second boss |

**~4,500 lines in Tier 1. Expect 10–14 sessions.** Whether that fits your budget depends mostly on how much the shader work fights back — front-load that pain in Phase 0, deliberately.

Tier 2 items appear in this spec marked **[T2]**. Skip them entirely on the first pass. Do not stub them.

---

# 2. Palette

`src/render/palette.js`. **The one irreversible decision in the project.** 14 colours, global, never per-region.

```js
export const P = {
  ink:      '#2A2118',   // outlines. warm dark. never #000
  skyDay:   '#7EC8E3',
  skyDusk:  '#F2A65A',
  sun:      '#FFF2C4',
  grass:    '#6DBE45',
  grassLo:  '#2F7A3E',
  rock:     '#A89078',
  rockLo:   '#5C4A3D',
  soil:     '#8B5E3C',
  water:    '#3FA9C9',
  wood:     '#7A5230',
  cloth:    '#D94F3D',   // the player. the ONLY red in the world.
  metal:    '#B8C4CC',
  sear:     '#FFF7D6',   // impact flash, trails, death marker
};
```

`cloth` is red and nothing else is. Complementary to `grass`, so the player reads at any distance in any light. Swap the hexes if you like — keep the structure and keep the player's colour unique.

**Slice sub-palette (§7.1):** `ink, skyDay, sun, grass, grassLo, rock` + `cloth`.

---

# 3. Render

Reference: **Sable, Hi-Fi Rush, Okami.** Not BotW.

## 3.1 Sky drives everything

```js
sunColor   = sky.sample(sunDir)      // lit tone
ambientSky = sky.sample(up)          // shadow tone — BLUE, never grey
fogColor   = sky.sample(horizonDir)
```

Procedural gradient keyed by sun elevation + a warm lobe near the sun. Every material, the fog, and the grass read from these. Build it first.

## 3.2 Palette lock — the unifier

From every pack you use: **mesh, rig, animation clips. Nothing else.** Discard normal/roughness/metalness/AO/emissive maps — do not import them.

```
albedo = paletteLUT.sample(albedo_source)
```

32³ LUT built at load. Nearest palette entry by **Oklab distance, not RGB** — RGB nearest-neighbour picks arbitrary garbage. Three packs go in, one game comes out.

Banding is not a bug. Flat colour is the brief.

## 3.3 Hard ramp

```glsl
float ndl = dot(N,L)*0.5 + 0.5;
float lit = smoothstep(0.49, 0.51, ndl);   // the window is ANTIALIASING, not softening
vec3  col = mix(albedo*ambientSky, albedo*sunColor, lit);
```

Never widen past 0.03. Two bands. A third mid-tone is allowed on characters only, and usually isn't needed.

- **Specular:** `step(0.98, pow(dot(N,H),64.0))` in `sear`, or nothing.
- **Rim:** `step(0.72, pow(1.0-dot(N,V), 2.0))` in `ambientSky`. Hard edge, not a glow.

## 3.4 Inverted-hull outlines

```glsl
vec3  sN      = normalize(normalMatrix * smoothNormal);
vec4  viewPos = modelViewMatrix * vec4(position,1.0);
float depth   = -viewPos.z;
float weight  = mix(1.45, 0.65, dot(sN, viewLightDir)*0.5+0.5);
viewPos.xyz  += sN * (0.0022 * depth * weight);
gl_Position   = projectionMatrix * viewPos;
```

Front-face culled, `ink`, depth-write on, before the main pass.

Three things, all load-bearing:

- **`thickness * depth`** = constant screen-space width. Skip it and near lines balloon, far lines vanish.
- **`smoothNormal` is a baked attribute, not `normal`.** Hard-edged meshes have split verts — three normals at one corner. Extrude along those and the hull tears open at every corner. **This kills inverted hull on every asset pack.** Fix: `src/render/smoothNormals.js` — accumulate face normals per unique position (quantize 1e-4), normalize, write to a `smoothNormal` attribute. Run every imported mesh through it, always. Shade with the original `normal`.
- **Weight by N·L** is how illustrators ink — heavier where the form turns from the light. One `mix()`.

## 3.5 Interior lines

Hull gives silhouettes only. Creases need a post pass over a depth+normal prepass. Roberts cross:

```glsl
float gd = length(vec2(d0-d1, d2-d3));
float gn = length(n0-n1) + length(n2-n3);
float edge = max(step(depthThresh * d0, gd), step(normalThresh, gn));
```

**`depthThresh * d0`** — scale by depth. Fixed threshold turns the horizon into a black scribble. Start `0.015` / `0.4`.

## 3.6 Atmospheric perspective + line fade

```glsl
float aer = 1.0 - exp(-dist * 0.0022);
color = mix(color, fogColor, aer * 0.92);   // 0.92. not 0.5.
```

**Multiply ink opacity by `(1-aer)` in both line passes.** Otherwise distant hills become a tangle of black — the failure mode that makes toon open worlds look cheap.

Push until distant terrain is nearly featureless colour bands. That falloff *is* the vastness.

## 3.7 Rest of the chain

1. Depth+normal prepass → RT
2. Hull pass
3. Main pass (ramp, rim, aerial)
4. Edge detect → composite
5. Bloom — threshold 0.9, strength 0.5
6. Palette LUT final grade
7. **AA: 1.25× supersample + downsample on `high`. FXAA on `low` only** — FXAA smears hard lines, which are the whole image.

**No SSAO** (muddies flat shadows). **No PBR.** **No env reflections.** **Shadows: 2-cascade CSM to 40m, then nothing.**

**[T2] Halftone.** Screen-space 45° Ben-Day dots in a ~15% band at the terminator. `dotSize 4.0`. Screen-space, never UV — it's ink on paper, it belongs to the image plane.

## 3.8 Grass

- 6-vert tapered blade, 0.3–0.6m, **80k instances**, 30m radius, height-fade at the edge.
- Wind: bend `∝ (vertHeight/bladeHeight)²` — hinges at the base. One global `wind(t)` gust function drives grass, cloth, and every ambient motion. **One clock.**
- Tint from sky. Orange grass at sunset.
- Bend away from player within 1m.
- **[T2]** burnable.

Density beats height. Cut height, never count.

## 3.9 Terrain

- Flat colour bands by height and slope, palette-locked.
- Ridges/creases from §3.5. That's what draws the landscape.
- No hull (does nothing on a heightmap).

---

# 4. World & traversal

## 4.1 Stamina — the universal currency

One wheel, 100. Everything spends it.

| Action | Cost |
|---|---|
| Climb | 12/s |
| Climb, overhang >90° | 26/s |
| Climb jump | 22 |
| Sprint | 14/s |
| Glide | 6/s |
| Swim | 18/s |
| **Dodge** | **18** |
| Regen | 32/s, after 0.4s delay |

**Running out mid-climb drops you.** That's the tension, not a punishment.

**The 0.4s delay re-arms on every stamina spend, not on return to idle.**

Otherwise regen ticks between combo steps and "~5 dodges before empty" becomes unlimited under pressure — which collapses §6.2's reconciliation, and that reconciliation is what the whole design rests on.

P4b tuning targets if dodge-heavy play still doesn't tax the wheel across a sustained exchange: `regen → 24/s` or `delay → 0.6s`.

## 4.2 Climb anything

**If you can see it, you can climb it. No climbable-surface tagging, ever.** The moment one wall is special-cased, the player stops trusting the world and the game is dead.

- Slope >45° + forward → climb mode.
- Overhangs work, 2.2× cost.
- **[T2]** Rain slips (recoverable by regripping).
- Climb-jump: 22 stamina, ~1.4m.
- Lip vault: automatic, free.

## 4.3 The glider

**The loop: see something → climb → glide toward it → find something else.** One sentence, whole game.

- Glide ratio 3.2:1, terminal descent 3.4 m/s.
- Dive trades altitude for speed. Flare costs stamina.
- Fall damage above 6m. Deploy cancels it.
- Deploy animation: **4 frames.** It snaps. Most-repeated animation in the game.
- **[T2]** Updrafts from fire.

## 4.4 Controller (Tier 1, no Rapier)

Custom kinematic capsule. Raycast down for ground, slide along normals, step offset 0.4m, slope limit 50° (above that → climb). Forward raycast for climb detection. ~400 lines. Don't over-engineer it.

## 4.5 [T2] Physics & chemistry

Rapier. Every prop a rigid body with real mass/friction/buoyancy — **no decorative objects**; one fake barrel and the player stops testing the world.

| Element | Rules |
|---|---|
| Fire | Spreads on grass 2.6 m/s, wind-directional, out in 8s, ignites wood, killed by water |
| Heat | **Rises. Updraft column above any fire.** |
| Electricity | Conducts through metal + water, chains 3m, lightning seeks metal in storms |
| Wind | Pushes light objects, spreads fire, lifts the glider |
| Water | Extinguishes, conducts, floats wood, sinks metal |

**Fire → updraft → glide** is the best moment in the reference and it's three systems you built anyway, intersecting. No `burnable` flag. Materials have properties; rules read properties.

---

# 5. Animation

**Real motion is continuous. Stylized motion is pose-to-pose.** A Genshin attack is four *drawings*, held, with fast transitions. A body can't hold a pose mid-swing — that's exactly why it looks better than real.

## 5.1 Pipeline

Mixamo base clips → `stylize()` → 8 hand-keyed signatures.

You **want** mocap as input. It gets the physical foundation right for free, and the stylizer's job is removing the realism. A crude hand-keyed pack clip is a worse start — the stylizer can push good structure into greatness, not rescue mush.

## 5.2 `stylize(clip, opts)` — Tier 1

Runs once per clip at load. `AnimationClip` in, out.

| Op | What |
|---|---|
| **Overlap** | Offset each track: `weapon -1, hips 0, spine 2, chest 3, neck 4, head 5, hair 6, cloth 7` frames. Hips lead, weapon leads them. **The eye tracks the weapon, so it arrives first — free anticipation.** |
| **Amplify** | `q = slerp(q_rest, q_clip, 1.22)` — t>1 extrapolates past the original. Clamp per-bone. Hands 1.35, spine 1.1. |
| **Overshoot** | Every settle-to-rest uses `easeOutBack(0.14)`. Nothing stops *at* rest. |
| **Secondary** | Springs on hair/cloth, **underdamped**: `k=9.0, d=0.55`. Physically wrong, correct for the reference. |

~50 lines, ~60% of the effect.

## 5.3 [T2] The re-timer — the other 40%

Resample 60fps → find extremes on a dominant track (root, or weapon hand) → rebuild as `hold(4) → cross(2) → hold(4)`.

- **One warp for all tracks.** Per-track warps desync the body instantly.
- **Duration-preserving and pin-preserving.** Pass contact times in `pin[]`; the warp must fix them. **Style may never edit gameplay timing** or §6's hitboxes start lying.

## 5.4 Timing — a stylized heavy attack

| Beat | Frames | ms | Curve |
|---|---|---|---|
| Anticipation | 10 | 167 | `easeOutSine` — decelerate *into* the pose |
| **Hold (wound)** | **3** | **50** | — |
| Snap | 2 | 33 | linear |
| **Hold (contact)** | **4** | **67** | — |
| Follow-through | 8 | 133 | `easeOutQuad` |
| Settle | 10 | 167 | `easeOutBack(0.14)` |

**The two holds are the whole trick.** Delete them and it's mocap again.

Land: squash 0.88 over 3f, recover 10f `easeOutBack`. Jump: stretch 1.10 on the rise.

## 5.5 Idle — never still

| Layer | Rate | Amount |
|---|---|---|
| Breath | 0.25 Hz | chest ±1.5%, shoulder ±1.2° |
| Weight shift | 0.09 Hz | hips ±0.02m, roll ±2° |
| Micro | Perlin 2.1 Hz | all bones ±0.35° |

Three incommensurate rates → never visibly loops. Four still frames reads as broken.

## 5.6 Foot IK — the floaty-killer

Two-bone IK per leg, raycast down, plant to hit, hip to lower foot (blend 6f), foot rotation to normal clamped 30°. Skipping this undoes everything above — pushed poses float without anchored feet.

## 5.7 Trails

Ribbon from weapon tip+base over the last 10 frames. Width ∝ tip velocity. Additive, `sear`, fade by `age²`. Active frames only.

**Trails get no ink outline.** The one exception to §3.4, and it's correct: they're light, and light has no outline. In an inked world an unlined glowing ribbon is the most legible thing on screen.

## 5.8 Signatures — hand-keyed pose tables

`GLIDE_OPEN, GLIDE_IDLE, CLIMB_JUMP, LAND_HEAVY, ATTACK_1..3, ATTACK_CHARGE`

```js
export const ATTACK_1 = {
  duration: 617,
  pin: [267],                                  // contact — gameplay, cannot move
  keys: [
    { t:0,   hips:[0,-24,0], chest:[0,-30,0], armR:[-18,0,0], head:[4,-12,0] },
    { t:167, hips:[0,-40,0], chest:[0,-52,0], armR:[-42,0,0], head:[9,-20,0], ease:'outSine' },
    { t:217, hold:true },
    { t:250, hips:[0, 26,0], chest:[0, 38,0], armR:[ 14,0,0], head:[-5,14,0], ease:'linear' },
    { t:317, hold:true },
    { t:450, hips:[0, 10,0], chest:[0, 14,0], armR:[  4,0,0], head:[-2, 5,0], ease:'outQuad' },
    { t:617, hips:[0,  0,0], chest:[0,  0,0], armR:[  0,0,0], head:[ 0, 0,0], ease:'outBack' },
  ]
};
```

Omitted bones hold. Wind up further than feels right — −52° chest on a light swing. Never key contact *at* rest. `hold:true` is the frame the player reads.

## 5.9 [T2] Stepped playback

Distant enemies at effective 30fps: `floor(t*30)/30`. Reads as limited animation, halves skinning cost. **Never the player** — responsiveness beats every technique here combined.

---

# 6. Combat

Reference: **NieR:Automata, WuWa.** Platinum-lineage.

**No weapon durability.** It cannot coexist with combos — breaking on hit 30 is miserable and it's why Genshin and WuWa both cut it after inheriting everything else from BotW. **[T2]** Weapon *types* with different combo trees do durability's job: you carry three and swap for expression.

## 6.1 Hitboxes

**Never mesh colliders.** Capsules/spheres/boxes on bones.

### Multi-part hurtboxes — this is why enemies feel like barrels

| Part | Shape | Mult |
|---|---|---|
| Head | sphere r.14 | **2.0×** |
| Torso | capsule r.22 h.50 | 1.0× |
| Arm L/R | capsule r.09 h.40 | 0.7×, breakable |
| Leg L/R | capsule r.11 h.50 | 0.7×, breakable |
| **Weak point** | sphere, per-enemy | **3.0×** |

Seven minimum, each parented to its bone, following every frame. One capsule = hitting a barrel. Seven = hitting a creature.

Limb breaks at 40% of enemy HP into one limb: visual change, that limb's attacks leave its AI pool, +25% damage taken globally.

### Swept collision

A sword tip covers **2–3m between frames** at combo speed. Discrete overlap tests pass clean through a person. **If attacks ever whiff on visible contact, this is always why.**

```js
const motion = curr.position.clone().sub(prev.position);
const hit = shapeCast(prev, motion, shape, filter);   // sweep. never static-test a moving box.
```

### Generosity — asymmetric, invisible, essential

| Box | Scale vs visual |
|---|---|
| Player hitbox | **1.25×** |
| Player hurtbox | **0.85×** |
| Enemy hitbox | 0.90× |
| Enemy hurtbox | 1.10× |

Honest hitboxes feel broken. Every action game does this.

### Registration

Hitboxes exist **only during active frames** — never through recovery. Each activation carries a hit list: one hurtbox once. Overlapping hurtboxes resolve to **highest multiplier**, not first found.

## 6.2 Perfect dodge

**An i-frame that actually saved you** — not a timing window guess. No per-attack threat data, unspoofable, falls out of the hitbox system.

```js
onHitboxWouldHitPlayer(hb) {
  if (!player.iframesActive) return HIT;
  return (now - player.dodgeStart < 190) ? PERFECT : DODGE;
}
```

| | ms |
|---|---|
| Dodge total | 500 |
| i-frames | 40–260 |
| Perfect window | 40–190 |
| Stamina | 18 |

**Reward:** `timeScale 0.25` for 700ms with the player at 0.6 (≈2.4× relative). Afterimages: 5 ghosts over 400ms, **ink-only, no fill** — outline with transparent interior, native to §3 and nearly free. Counter window 700ms: one attack at 3× damage, +40 poise, unique animation.

**Dodge cancels anything** — any attack, any frame. That's Platinum. **Stamina is the price**: ~5 dodges before you're empty in front of something angry. Freedom with a cost, no cooldowns. This is the reconciliation the whole design rests on.

## 6.3 Combos

| Move | Windup | Active | Recovery | Cancel |
|---|---|---|---|---|
| L1 | 70 | 50 | 160 | +50 |
| L2 | 60 | 50 | 170 | +55 |
| L3 | 80 | 60 | 190 | +60 |
| L4 | 110 | 80 | 280 | +90 |
| H1 | 160 | 90 | 320 | +120 |
| H2 | 180 | 100 | 340 | +130 |
| H3 | 240 | 130 | 460 | none |

| Input | Ender |
|---|---|
| `H` | overhead, +22 poise |
| `L→H` | **launcher** |
| `L,L→H` | 180° sweep |
| `L,L,L→H` | thrust, longest reach |

Air: launcher → jump to follow. Light chains airborne; heavy is a dive slam.

**"Cancel +N" = recovery becomes cancelable N ms after active frames end.** A buffered input fires immediately at that point. Light-hit cadence ≈ windup + active + N ≈ 170ms.

**H3's "none" blocks combo-cancel only. Dodge still cancels it (§6.2).** So H3 is a true hard commit whose only exit is a stamina-priced dodge. That's deliberate: it's the one place the combo tree and the dodge economy touch, and it's the only commitment in the kit.

Both values live in `config/combat.js` for P4b retune.

**Input buffer 150ms.** The single feature that most defines "responsive."

## 6.4 Poise & break — the win condition

| Source | Poise |
|---|---|
| Light | +8 |
| Heavy | +22 |
| Launcher | +30 |
| **Counter** | **+40** |
| Limb break | +35 |

0–100, decays 6/s after 2s. At 100 → **BREAK**: 3s stagger, **2.5× damage**, unique animation, big audio.

You don't out-damage enemies. You break them. Note what +40 does: two counters is nearly a break. **The game is telling you that dodging toward danger is the fastest way to win.** That's Platinum's thesis as a number.

## 6.5 Enemy rules — all six, every enemy

1. **Readable silhouette at 25m.** Everything is a black shape at distance — that's the style. Two enemies sharing a silhouette means one is wrong.
2. **Telegraph through the ink line** (below).
3. **One weak point, 3.0×**, placed so reaching it demands a specific move. Behind → dodge through. High → launcher. The weak point *is* the design.
4. **Melee and ranged.** Even brawlers fire something. Two threat types keeps the player reading.
5. **A break-punish window** — one attack with recovery long enough to punish free. The teachable moment.
6. **Aggression scales with distance.** Backing off isn't safety, it's a different fight.

### The telegraph is the ink line

```glsl
thickness *= 1.0 + windupProgress * 2.5;
```

**The outline thickens and flares during windup**, peaking on the active frame, snapping back after. Plus a `sear` rim flare on the active frame.

Stylistically native — an artist inks the thing about to happen more heavily. Readable at any distance. One uniform. A red flash would be a HUD element cosplaying as art; this *is* art.

## 6.6 Feel

| Event | Hitstop | Shake |
|---|---|---|
| Light | 60ms | 0.04 |
| Heavy | 90ms | 0.09 |
| Launcher | 110ms | 0.12 |
| Counter | 140ms | 0.16 |
| **Break** | **200ms** | **0.24** |
| Kill | 180ms + `timeScale 0.25`/220ms | 0.20 |

Hitstop = **freeze**: animation, particles, trails, both actors. Platinum's is famous because it's absolute.

Impact flash: hit hurtbox's parent → `sear` for 50ms. Violent under flat colour, perfect. Knockback along the hit normal, never toward a fixed point. **Never a silent input** — every press produces something, even a refusal.

## 6.7 [T2] Support unit

Auto-fires at the locked target. Never interrupts melee, no stamina, no input. Modes: rapid (chip+poise) / heavy (knockback, moves physics objects) / beam. **~8% of your DPS** — it's presence, not a weapon.

Earns its place because you have a glider: a layer that works while climbing or repositioning makes the whole world an arena.

---

# 7. Structure — the Souls layer

## 7.0 The guard — read before anything else

**Dark Souls is not grey. Its imitators are grey, and that's why they're boring.** Anor Londo is gold. Ash Lake is teal under white trees. Caelid is a red scream. All four references have vibrant worlds.

**Souls' darkness is structural, not chromatic.** It lives in distance-since-checkpoint, in not knowing what's around the corner, in the cost of dying, in silence. Anor Londo is terrifying *because* it's beautiful — the beauty is the information that something enormous lived here and doesn't care about you.

1. **This layer has no chromatic authority. It may not touch `palette.js`.**
2. **Never desaturate anything.**
3. **Ruins are information, not mood.**
4. **If this section makes the game duller, it's implemented wrong.**

## 7.1 Area-as-hue

- Region sub-palette: **6 of the 14.** Committed absolutely.
- **One dominant hue owns ~55% of screen pixels.** Not 30%. Commit.
- **Adjacent regions ≥70° apart on the hue wheel.** Hard constraint, checked at generation.
- The boundary is a **designed reveal, not a gradient.** Crest a ridge, the world changes colour.

**The slice's payoff:** §8's cliff edge. Glide off, and the region below is a different hue. Great Plateau reveal and Anor Londo reveal in the same second.

## 7.2 Checkpoints on peaks — the glider is the shortcut

Souls' checkpoint scarcity assumes compact levels; in an open world it becomes travel time. The glider fixes it, and the fit is almost suspicious.

**Climb** to a checkpoint — slow, stamina-priced. **Glide** from it — fast, free, any direction. That's exactly Souls' shortcut structure: a reward that makes the world smaller. §4.3's loop was already the bonfire loop.

- **Three checkpoints in the slice.** Danger is distance-since-checkpoint, never enemy HP.
- Resting respawns enemies and restores consumables. That's what makes it a decision.
- **No save-anywhere.** It's what makes distance mean anything.

## 7.3 Enemy placement as authorship

**The most transferable thing in Souls, and it costs only discipline.** Souls' enemies are level design, not encounters.

| Placement | Punishes |
|---|---|
| Blind corner | Running |
| Archer on a ledge | Standing still |
| Two in a corridor | Greed |
| One behind a visible item | Greed, harder |
| Ambush after a long safe stretch | Relaxing |
| Narrow ledge over a drop | Panic-dodging |

**Every enemy answers: what mistake does this punish? No answer → delete it.**

No random spawns. No density scripts. Place relative to the routes §8 authored. Groups over individuals — the threat is the arrangement. The player must always be able to retreat and re-approach; that's what makes it fair.

**The camp is hand-placed. All of it. Every one.**

## 7.4 Death economy

Currency drops where you fell. One chance. Die again, gone.

You die downhill of a peak far more often than uphill — **so the run back is a glide.** Souls' worst-aged mechanic becomes a reason to use your favourite verb.

Mark the drop with a thin vertical `sear` line, visible through terrain, faded by §3.6. No minimap, no compass. It's in the sky; you look for it.

## 7.5 Progression

| | Source | Lost on death |
|---|---|---|
| **Currency** | Combat | **Yes** |
| **Growth** (stamina, health) | **Exploration only** | Never |

Souls' currency-as-XP is what makes people quit — losing ten hours to a bad fall isn't tension, it's an ending. Split it: death costs *stuff*, never *progress*. A stuck player gets stronger by going out, not by grinding. That's the answer both references actually give, and it keeps the world as the source of power.

## 7.6 Silence

**No ambient music. Ever.** Only bosses get a track — which is why music starting *is* the warning. Souls and BotW agree completely here, so there's no tension to resolve.

- Overworld: ambience only. Wind, grass, water, birds.
- Sparse piano stings on discovery. Three notes, not a cue.
- Combat: percussion only, in on the first hit landed, out 4s after the last.
- Boss: full track on the arena trigger.

You need ambience and one boss track, not a soundtrack. Correct artistically *and* a large production saving.

## 7.7 Bosses as lessons

- **8–14 attacks.** Each with a distinct tell (§6.5) and a distinct punish.
- **No unreactable attacks.** If the answer is memorisation rather than reading, delete it.
- **You lose because you didn't learn.** Sequence order can vary; the attacks can't.
- **Phase 2 at 50% adds 3–4 attacks. Never removes any.** Removing invalidates what the player just learned — the most common boss failure there is.
- **The arena teaches.** Useful cover. A drop that punishes the tempting dodge.
- **Poise/break (§6.4) is the win condition.**

One boss in the slice. Make it the best thing in the game.

## 7.8 No handholding

No cutscenes, no exposition, no tutorial text, no quest markers, no journal. The world teaches by geography. Item descriptions carry the lore — everything known is inferred. **If a system needs a paragraph, the system is wrong.**

## 7.9 [T2] NPCs

**Not quest dispensers. Travellers whose journey crosses yours.**

1. Every NPC has a destination, and it isn't you.
2. **Location is the story.** Nothing else reports it.
3. They move when the **world** changes, not when you talk.
4. **Missable, silent, unmarked.** Missing an entire arc is the correct default outcome.
5. **Six lines each.** You'll hear them thirty times. Text only.
6. They never tell you where to go. They tell you who they are.
7. **They can die permanently. You can kill them.** Kill the smith, no more smith, forever, no warning.

**The anchor:** one NPC never leaves, never dies, always competent, always warm. Give him the upgrade bench. **The anchor is what makes everyone else's transience mean something** — without a fixed point it's churn, not loss. **Do not give him an arc.** That's the point.

**Summons:** an arc in the right state → they appear at a boss. That's the only reward the arc gives. No items, no stats.

State machine on world flags. `{ id, anchor, states:{...}, transitions:[{from,to,when}] }`. The arc fails silently if the player didn't do the unmarked thing. **Don't add a warning.**

**Slice: two NPCs.** The anchor, and one wanderer with a three-state arc.

## 7.10 [T2] Estus

**Don't take BotW's cooking.** Sixty meals in a bag means no fight is dangerous. It's why BotW's combat is low-stakes and it's BotW's worst system.

- **5 charges.** Refill at a checkpoint only.
- **Heals 40% over 1.2s.** Not instant — you *commit*.
- Upgraded by exploration, not currency.

> **Heal is the only thing dodge cannot cancel.**

The single exception to §6.2, forever. Dodge-cancelling costs **stamina**; healing costs **commitment** — different currency, no rule broken. One moment per fight where you're genuinely vulnerable, and you chose it. **Never add a second exception.**

## 7.11 What Souls does NOT get

❌ Attack commitment (§6.2's cancel stands — this fork was chosen; half-measures feel like neither game)
❌ Stamina gating attacks (dodges only, or §6.3 doesn't exist)
❌ Poise-trading / hyper-armour
❌ Souls-as-XP (§7.5)
❌ Equipment weight, roll types, covenants, invasions, messages, hollowing
❌ **The palette** (§7.0)

---

# 8. The slice

~1 km². Elevated, cliff-edged — **the glider is the only exit**, so geography teaches the loop instead of text.

- **One central peak.** Visible from everywhere. Climbable. The plateau is legible from its top.
- **4 landmarks**, each visible from ≥2 others.
- **One enemy camp** — 4 enemies, hand-placed to §7.3, a weapon rack, something to roll onto them.
- **One puzzle structure.** Your own thing, not a shrine.
- **[T2] One dense grass field downhill of a fire source.** Players discover fire→updraft→glide here alone and never forget it.
- **Three checkpoints.** Peaks.
- **The cliff edge.** Exit. Costs the glider and a full wheel. Reveals a different-hued region (§7.1).

**These numbers do not move.** 1km², 2 NPCs, 1 boss, 1 camp, 3 checkpoints — no matter what else gets added to this spec. If something must be cut, **cut breadth in the slice, never depth in a system.** One camp done to §7.3's standard beats five populated by a script.

## Terrain — a baked asset, not a system

Write `tools/genterrain.js` as a **throwaway**: fBm + ridged noise + hydraulic erosion. Run it once. Bake `assets/heightmap.png`. **Ship the PNG. Delete the generator from the runtime.**

§7.3 says placement must be authored — the ground should be too. Procedural gen is for scaling past the slice, which is Tier 3.

**The triangle rule** (Nintendo's, from GDC) governs the bake:
- **Large triangles** block the view and force a route decision.
- **Small triangles** are climbable and reveal what's behind.
- **Something interesting always breaks the horizon** — that's how you move players across a world with no markers.
- **Routes are suggestions the terrain makes, never corridors.**
- **No invisible walls, anywhere.** See it, reach it. The trust contract of the genre.

---

# 9. Architecture

```
src/
  main.js               // boot, fixed 60Hz sim + interpolated render
  config/  stamina.js  frames.js  feel.js  combat.js
  render/
    pipeline.js  palette.js  sky.js  toon.js
    outline.js  edges.js  smoothNormals.js  lut.js
  world/  terrain.js  grass.js  wind.js  checkpoints.js
  actors/ player.js  controller.js  climb.js  glide.js
          enemies/ base.js  ai.js  <three>.js  boss.js
  combat/ hitbox.js  hurtbox.js  sweep.js  combo.js  dodge.js  poise.js
  anim/   rig.js  stylize.js  poses.js  ik.js  trails.js
  audio/  ambience.js  percussion.js
tools/    genterrain.js         // throwaway
shots/                          // npm run shot output
PROGRESS.md  CREDITS.md
```

Fixed timestep 60Hz sim, interpolated render. **Hitstop is a sim-level pause, not a render trick.**

**Quality toggle from Phase 0, not Phase 7.** `low`: 40k grass, one cascade, no bloom, FXAA. **Test on `low` weekly — it's the actual target.**

---

# 10. Phases

Every gate: `npm run shot`, zero console errors, **`view` the PNG yourself.** Never report a phase done because code exists. Report it done because the picture is right.

**P0 — Screenshot loop, then sky + shader.** `npm run shot` first. Then procedural sky driving everything, hard ramp, hull with baked smooth normals, depth+normal prepass, edge pass, palette LUT, aerial + line fade, CSM, bloom. Palette-coloured boxes on a heightmap.
> **Gate:** boxes that read as a *drawing*. Crisp ink on silhouettes, creases where forms meet, blue shadow bands, distant terrain flattened to pale bands with lines faded out. Scrub the sun a full day — the whole palette swings together. Then import one pack rock: **it must be indistinguishable in style from the boxes.** If not, §3.2 isn't working and nothing downstream saves it.
> **Also required** (retroactive; verify before P1): the shot tool's self-test passes, `shot` forwards arbitrary params, PNGs carry a burned-in URL caption, and `probe` returns correct RGB on a known box. If any are missing, fix them at the start of P1 — the instrument is load-bearing for every remaining phase.

**P1 — Assets. Starts with a human step.**

**Claude Code's network cannot reach kenney.nl, quaternius.com, itch.io, or Poly Pizza.** P0 confirmed this. Do not spend tokens rediscovering it, and do not substitute a procedural stand-in for a real pack — P0's procedural rock already validated §3.2/§3.4, which was its whole job.

**Hassan downloads the packs and drops the GLBs in `assets/raw/`.** Claude Code cannot do this step and should not try.

Once `assets/raw/` is populated, P1 is: load, run `smoothNormals` over every mesh, check silhouettes at 25m, log licences in `CREDITS.md`, pick a primary pack by silhouette and rig quality. Routine — §3.2 already discards everything that made packs clash.

**If `assets/raw/` is empty at session start, stop and say so.** Do not proceed. Do not improvise.

**P2 — Movement.** Controller, camera, sprint, stamina wheel, climbing. Mixamo + `stylize()` + foot IK.
> **Gate:** climbing a cliff and *just barely* making it feels good. If running out at altitude isn't thrilling, tune §4.1 until it is. Also: raw Mixamo run vs stylized, same frame, side by side — pushed poses, head lagging hips, overshooting settle. Can't tell them apart → §5.2 isn't wired.

**P3 — Glider.** Deploy, ratio, dive, fall damage.
> **Gate:** climb the peak, glide off, land somewhere you chose from the air.

**P4a — Hitboxes.** Multi-part hurtboxes on a dummy, swept casts, registration, generosity.
> **Gate:** debug-draw every box and screenshot it. Three multipliers fire on head/arm/torso. Then swing at max combo speed — **nothing tunnels.**

**P4b — The kit.** Combos, branches, air, dodge, perfect dodge, counter, stamina.
> **Gate:** perfect-dodge and get time dilation, ink afterimages, 3× counter. **If perfect dodge isn't the best thing in the game, the numbers are wrong.** Everything is built on it.

**P4c — Enemies.** Three, all six of §6.5. AI, poise, break, limb breaks.

**P5 — Terrain + grass.** Bake the heightmap. Grass, wind, the triangle rule.
> **Gate:** stand anywhere, spin 360°. Something interesting breaks the horizon from every angle. A dead direction means the bake failed.

**P6 — The boss.** §7.7.

**P7 — Assembly.** The plateau for real. Checkpoints, death drop, camp placement, audio, UI. Playtest and re-tune every number in §4 and §6 — **expect to; the tables are a start, not scripture.** Report what changed and why.
> **Colour gate:** histogram from the peak, the camp, the cliff. Dominant hue ≥50% of pixels and genuinely saturated in all three. Any reads grey/brown/desaturated → §7 leaked into the palette. Pull it out.
> **Placement gate:** one sentence per enemy — *what mistake does this punish?* No sentence → it comes out. No exceptions.
> **Silence gate:** ten minutes, no combat. No music at any point, and it must not feel empty. Empty means the world needs more to find — **never a music bed.**

---

# 11. Do not

- ❌ Soft-shade anything. §3.3's window never exceeds 0.03.
- ❌ Grey shadows. `ambientSky * 0.75`. Always blue.
- ❌ Pure black ink. `P.ink`, warm.
- ❌ Import a pack's textures, normals, or materials. Mesh + rig + clips only.
- ❌ `normal` in the hull pass. `smoothNormal`, baked. Every mesh.
- ❌ Fixed thresholds in §3.4/§3.5. Scale by depth.
- ❌ Forget the line fade (§3.6). Distant scribble is the tell.
- ❌ Static overlap tests on moving hitboxes. Sweep.
- ❌ One capsule per enemy.
- ❌ Honest hitboxes. §6.1's asymmetry is invisible and essential.
- ❌ Hitboxes alive through recovery.
- ❌ A second exception to dodge-cancel. Healing is the only one.
- ❌ Climbable-surface tags. Ever.
- ❌ Any music outside a boss.
- ❌ Quest markers, journals, tutorials, cutscenes.
- ❌ Desaturate anything, for any reason.
- ❌ Random enemy placement.
- ❌ Weapon durability. Cooking. Souls-as-XP.
- ❌ SSAO, PBR, env maps, MeshStandardMaterial.
- ❌ FXAA on `high`.
- ❌ Stub a **[T2]** item. Skip it entirely.
- ❌ Nintendo/FromSoft/miHoYo names, motifs, or UI — including as placeholders.
- ❌ **An RT that renders geometry without a depth buffer.** P0's normal prepass had none, so it wrote normals through occluders and the edge pass drew phantom silhouettes over terrain. Every geometry RT gets depth. No exceptions, including any added later.
- ❌ **Backticks inside GLSL template literals — including in comments.** They close the string. Use quotes in shader comments.
- ❌ **Diagnosing a render bug from a screenshot.** Probe.
- ❌ **Trusting a tool you haven't verified this session.**

---

# 12. First message back

1. Why **stamina** — not climbing, not the glider — is the central mechanic, and what breaks without it.
2. Anything in §4.1 or §6.3's numbers that will produce a bad rhythm, and your fix.
3. Your P0 plan.

Then build P0 and show me `shots/p0-boxes.png` at three times of day.
