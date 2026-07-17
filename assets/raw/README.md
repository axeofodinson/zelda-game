# assets/raw — CC0 pack drop zone (P1)

**Human step.** Claude Code's network cannot reach kenney.nl, quaternius.com,
itch.io, or Poly Pizza (only GitHub raw is reachable). Download CC0 packs
(Quaternius / Kenney / KayKit / Poly Pizza CC0) and drop the `.glb` / `.gltf`
files here.

P1 loads whatever is in this folder, runs `smoothNormals` over every mesh,
checks silhouettes at 25 m, logs each licence in `CREDITS.md`, and picks a
primary pack. If this folder is empty at session start, P1 stops and says so.
