# CREDITS

Every third-party asset's licence is logged here **as it is added** (§0.2).

## Art assets
None yet. P0 ships no third-party art — the render gate uses palette-coloured
boxes and a procedurally-generated test rock (original, CC0-equivalent, not shipped
content). Real CC0 packs (Quaternius, Kenney, KayKit, Poly Pizza CC0) arrive in P1
and every one will be logged here with its pack name, author, source URL, and licence.

> Environment note: the usual CC0 hosts (kenney.nl, poly.pizza) are network-blocked
> in this build environment; only GitHub raw is reachable. P1 sources packs from
> GitHub-hosted CC0 mirrors.

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
