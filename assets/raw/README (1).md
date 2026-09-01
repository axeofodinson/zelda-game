# assets/raw — CC0 pack drop zone (P1)

**Human step.** Hassan downloads packs on his own machine and pushes them here.
Do **not** try to source packs from GitHub-hosted CC0 mirrors — this was checked
(2026-09-01) and the mirrors are stale: the Quaternius one is the Dec-2016 pack,
13 models, FBX/OBJ only, no GLB. Dead end.

## Layout

One subfolder per pack, named `<author>-<pack>`:

    assets/raw/kenney-nature-kit/*.glb
    assets/raw/kenney-nature-kit/palette.json

P1 scans this folder **recursively** for `.glb` / `.gltf`. One subfolder per pack
because `CREDITS.md` logs licence per pack, and a flat dump loses that mapping.

## Pack notes

- **Kenney Nature Kit — primary.** 329 models, CC0, GLB, 3.6 MB total. Lives in
  `kenney-nature-kit/`.

  **Materials: there are no textures.** All 329 files contain zero images and zero
  texture samplers — Kenney's shared colour atlas was flattened into per-material
  `baseColorFactor` values at export. Verified 2026-09-02 by parsing every GLB.

  What exists instead: **23 named materials resolving to 21 unique colours**, reused
  across the whole kit (`grass` in 129 files, `dirt` in 98, `stone` in 89). Material
  names are stable across models, so `woodBark` is the same value everywhere.

  This makes the palette lock trivial. Quantise those 21 colours through the Oklab
  LUT **once**, build a name→colour map, and assign by material name at load time.
  No image processing, no per-model work, no shader-side quantisation. The full
  table is committed at `kenney-nature-kit/palette.json`.

  Two gotchas. `baseColorFactor` is **linear-space** per the glTF spec — do not
  gamma-correct it before feeding the LUT. And the palette is genuinely mint/teal:
  `grass` is (0.17, 0.85, 0.72), blue above red. That looks wrong but isn't —
  confirmed against the kit's own `Isometric/` preview renders. Do not "fix" it.

  Meshes carry `TEXCOORD_0` that nothing references, left over from the atlas
  mapping. Harmless; ignore it.

- **Quaternius nature packs — secondary, conversion required.** Ultimate Nature
  Pack (150 models) and Simple Nature Pack ship `.Blend` / `.FBX` / `.OBJ` only,
  no glTF. Untextured flat materials; base colours live as `Kd` values in the
  `.mtl`. Needs a headless Blender OBJ→GLB batch before anything here can load it.

- **Ultimate Stylized Nature Pack** does have GLB, but seamless textures plus
  normal maps — wrong input for a flat cel shader with a locked palette.

## P1 contract

Load recursively, run `smoothNormals` over every mesh, check silhouettes at 25 m,
log each licence in `CREDITS.md`, pick a primary pack. If no `.glb` / `.gltf` is
found at session start, **stop and say so** — do not improvise a procedural
stand-in (P0's rock already validated §3.2/§3.4).

**Open first move:** load exactly one small GLB and confirm `__ready` fires before
ingesting a whole pack. The P0 loader hang is the expected first bug.
