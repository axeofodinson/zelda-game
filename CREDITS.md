# CREDITS

Every third-party asset's licence is logged here **as it is added** (§0.2).

## Art assets

| Pack | Author | Source | Licence | Contents | Used |
|---|---|---|---|---|---|
| **Nature Kit** | Kenney | [kenney.nl/assets/nature-kit](https://kenney.nl/assets/nature-kit) | **CC0 1.0 Universal** (public domain) | 329 GLB models, 3.6 MB | **Primary pack** (P1) |

Kenney's assets are released into the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): no attribution is
required. It is logged here anyway, per §0.2 — every third-party asset gets an
entry as it is added.

**What is imported:** mesh geometry only. Per §3.2 the pack's materials are
discarded and rebuilt as palette-locked toon materials; the kit ships no
textures, normal maps, rigs, or animation clips, so nothing else exists to take.
The unreferenced `TEXCOORD_0` attribute left over from Kenney's atlas export is
deleted at load.

Lives in `assets/raw/kenney-nature-kit/`. `npm run assets` regenerates
`assets/raw/manifest.json` (the model list the app fetches — a browser cannot
list a directory).

> Environment note: the usual CC0 hosts (kenney.nl, quaternius.com, itch.io,
> poly.pizza) are unreachable from the build environment. Packs are downloaded
> by hand and pushed to `assets/raw/`. GitHub-hosted mirrors were checked and
> rejected — stale, and no GLB. See `assets/raw/README.md`.

**Not used (evaluated, rejected — see PROGRESS.md P1):** Quaternius Ultimate /
Simple Nature Packs (CC0, but `.Blend`/`.FBX`/`.OBJ` only — needs a headless
Blender conversion), Ultimate Stylized Nature Pack (has GLB, but seamless
textures + normal maps: wrong input for a flat cel shader with a locked palette).

## Audio
None yet. (Overworld is silent by design — §7.6. Only a boss track + ambience later.)

## Tooling / libraries
| Library | Licence | Use |
|---|---|---|
| [three.js](https://github.com/mrdoob/three.js) ^0.169 | MIT | renderer |
| [Vite](https://vitejs.dev) ^5.4 | MIT | dev server / build |
| [Playwright](https://playwright.dev) ^1.48 | Apache-2.0 | headless screenshot loop |
| vite-plugin-singlefile ^2 | MIT | single-file ship target |

## Original work
All game code, shaders, the palette, and the procedural terrain/rock are original
to this project.
