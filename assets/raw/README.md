# assets/raw — CC0 pack drop zone (P1)

**Human step.** Hassan downloads packs on his own machine and pushes them here.
Do **not** try to source packs from GitHub-hosted CC0 mirrors — this was checked
(2026-09-01) and the mirrors are stale: the Quaternius one is the Dec-2016 pack,
13 models, FBX/OBJ only, no GLB. Dead end.

## Layout

One subfolder per pack, named `<author>-<pack>`:

    assets/raw/kenney-nature-kit/*.glb
    assets/raw/kenney-nature-kit/Textures/colormap.png

P1 scans this folder **recursively** for `.glb` / `.gltf`. One subfolder per pack
because `CREDITS.md` logs licence per pack, and a flat dump loses that mapping.

## Pack notes

- **Kenney Nature Kit — primary.** 330 models, CC0, ships GLB directly. Materials
  are a shared palette atlas: UVs index solid-colour regions of one texture map.
  This means the Oklab LUT quantisation happens **once, offline, on the atlas PNG**
  — every model then inherits the locked palette. No per-material or shader-side
  quantisation needed. Do not re-compress the atlas; it bands, and banding in the
  source corrupts the LUT mapping before the shader sees it.

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
