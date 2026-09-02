// §3.2 P1b — Semantic palette map. The replacement for nearest-in-Oklab.
//
// §3.2 asks for one thing: every pack resolved into the §2 fourteen so three
// packs go in and one game comes out. It specifies nearest-neighbour in Oklab
// as the means. P1 built that exactly and measured the result: 6 of 14 entries
// absorb all 329 models and 4 of those 6 are sky-and-light roles. Foliage
// locks to the literal sky colour — canopy (122,196,201) against sky
// (126,200,227), separated by its ink line alone.
//
// The cause is structural, not a weighting. Every Kenney source colour sits at
// Oklab L 0.78–1.00; the palette's *surface* colours top out at `metal`
// L=0.813, so absolute-lightness nearest-neighbour can only land on the bright
// entries, and the bright entries are the sky. Restricting targets to the
// surface subset collapses everything onto `metal` (674 of 693 mesh-uses);
// dropping the lightness term sends foliage to `water`, because the source
// foliage hue is genuinely cyan (h≈-176° vs `P.grass` at +137°). P1 tested all
// three.
//
// So: nearest-neighbour is reconstructing intent from RGB proximity when the
// pack already states intent in the material name. `leafsDark` is foliage
// whatever its numbers say. This module maps NAME -> ROLE and the numbers are
// never consulted. §3.2's goal is kept; its mechanism is not.
//
// Nothing here falls back. An unmapped material throws, because a silent
// fallback to nearest-neighbour reintroduces exactly the bug this replaces.
import { P, PC } from '../render/palette.js';

// --- §2 role policy -------------------------------------------------------
// `cloth` is the player and the ONLY red in the world — that is what makes the
// player findable in any frame. P1 flagged it as *reachable* as an albedo
// target under the LUT (`colorRedDark` lands on it under a hue-leaning metric,
// `colorRed` was one weight tweak away). Structurally impossible now, asserted
// below rather than avoided by convention.
export const PLAYER_ONLY_ROLE = 'cloth';

// The roles pack geometry may take. Sky and light roles are excluded on the
// same grounds as `cloth`: `skyDay`/`skyDusk` are gradient stops, `sun` is the
// light, `sear` is the impact flash, `ink` is the outline. A world surface
// wearing any of them is the P1 bug by another route.
export const ALBEDO_ROLES = ['grass', 'grassLo', 'rock', 'rockLo', 'soil', 'water', 'wood', 'metal'];

// --- The map --------------------------------------------------------------
// Source of truth for names and usage counts:
// assets/raw/kenney-nature-kit/palette.json (cross-checked 2026-09-02 against
// an independent parse of all 329 GLB JSON chunks — counts match exactly).
export const MATERIAL_ROLE = {
  grass:        'grass',    // 129 files
  dirt:         'soil',     //  98
  stone:        'rock',     //  89
  dirtDark:     'rockLo',   //  38
  leafsDark:    'grassLo',  //  38
  woodBark:     'wood',     //  37
  woodBarkDark: 'rockLo',   //  33
  wood:         'wood',     //  31
  leafsGreen:   'grass',    //  23
  stoneDark:    'rockLo',   //  23
  water:        'water',    //  18
  leafsFall:    'soil',     //  14
  woodBirch:    'rock',     //  14
  woodDark:     'rockLo',   //  11
  woodInner:    'wood',     //  11
  // `colorTan` is the cap of mushroom_tan/tanGroup/tanTall (16 t of cap over a
  // 32 t `_defaultMat` stem). Not in P1b's brief, which reaches those three
  // models only via "mushroom_tan* is the same three shapes in a colour that
  // does not fight §2" — they are kept, so the cap needs a role. `soil` is the
  // same call `leafsFall` gets: same hue family, one notch darker than the
  // pale stem, so a brown cap reads off a `rock` stem.
  colorTan:     'soil',     //   3
};

// Present in the pack, but only ever on models `EXCLUDED_MODELS` drops. Listed
// so the coverage check below can tell "deliberately roleless" from "someone
// added a material and nobody noticed". Seeing one on a loaded model throws.
export const EXCLUDED_ONLY_MATERIALS = {
  colorPurple: 'flower_purpleA/B/C',
  colorYellow: 'flower_yellowA/B/C',
  colorWhite:  'flower_purpleC, flower_redC, flower_yellowC',
  corn:        'crops_cornStageD',
};

// --- Recoloured, not excluded ---------------------------------------------
// `colorRed` is on eleven models, only three of which are flowers. §2's rule is
// that the player is the only red thing in the world, so the player is always
// findable; a red tent on a ridgeline competes with that directly. Brown canvas
// does not, and is more plausible regardless. Tents are unique geometry and
// worth keeping, so they are recoloured rather than dropped.
//
// Matched by model-name prefix, first hit wins.
export const MODEL_MATERIAL_OVERRIDES = [
  // tent_detailedClosed/detailedOpen/smallClosed/smallOpen — canvas + poles.
  ['tent_',      { colorRed: 'wood', colorRedDark: 'rockLo' }],
  ['lily_large', { colorRed: 'grassLo' }],
];

// --- `_defaultMat` --------------------------------------------------------
// 54 files, and it is not junk: it is core terrain geometry. Verified
// 2026-09-02 across all 329 GLBs — every `rock_tall*`, every `stone_tall*`, the
// waterfall cliffs, `statue_*`, `path_stone*`, `tree_detailed*`, `sign`,
// `pot_small`, `bed_floor`, the `fence_*Center` pieces and `crops_wheatStageB`.
// It is pure white (1,1,1), which is why nearest-neighbour was sending all of
// it to `sear`.
//
// It cannot take a single role — it spans rock, wood, foliage and crops — so it
// resolves by model-name prefix. Ordered; first match wins. No fallback: an
// unmatched `_defaultMat` model throws.
export const DEFAULT_MAT_PREFIX = [
  ['rock_',       'rock'],
  ['stone_',      'rock'],
  ['cliff_',      'rock'],
  ['statue_',     'rock'],
  ['path_stone',  'rock'],
  ['pot_',        'rock'],
  // Not in P1b's brief: `mushroom_tan*`, where `_defaultMat` is the stem (32 t
  // against a 16 t cap). Pale stem, so `rock` — the same call `statue_*` and
  // `path_stone*` get for white structural geometry.
  ['mushroom_',   'rock'],
  ['path_wood',   'wood'],
  ['fence_',      'wood'],
  ['sign',        'wood'],
  ['bed_floor',   'wood'],
  // Not in P1b's brief: `tent_smallClosed` carries 4 t of `_defaultMat` against
  // 220 t of tent. It goes with the rest of the tent, which is `wood` above.
  ['tent_',       'wood'],
  ['tree_',       'grassLo'],
  ['crops_',      'soil'],
];

// --- Excluded models — do not load ----------------------------------------
// Flowers carry colorRed/colorYellow/colorPurple/colorWhite and §2 has no
// accent slot; the one saturated accent is `cloth`, reserved for the player.
// Red mushrooms go because `mushroom_tan*` is the same three shapes in a colour
// that does not fight §2 — nothing is lost but a duplicate.
export const EXCLUDED_MODELS = new Set([
  'flower_redA', 'flower_redB', 'flower_redC',
  'flower_yellowA', 'flower_yellowB', 'flower_yellowC',
  'flower_purpleA', 'flower_purpleB', 'flower_purpleC',
  'mushroom_red', 'mushroom_redGroup', 'mushroom_redTall',
  'crops_cornStageD',
]);

// --- Assertions (module load — a bad map fails the build, not a playtest) ---
function assertRole(role, where) {
  if (role === PLAYER_ONLY_ROLE) {
    throw new Error(
      `§2 violation: ${where} resolves to \`${PLAYER_ONLY_ROLE}\`. ` +
      '`cloth` is the player and the ONLY red in the world — no pack material may take it.'
    );
  }
  if (!(role in P)) throw new Error(`${where}: "${role}" is not one of §2's fourteen`);
  if (!ALBEDO_ROLES.includes(role)) {
    throw new Error(
      `${where}: "${role}" is a sky/light role, not a surface role. ` +
      `Pack albedo may only take: ${ALBEDO_ROLES.join(', ')}.`
    );
  }
}

for (const [mat, role] of Object.entries(MATERIAL_ROLE)) assertRole(role, `MATERIAL_ROLE.${mat}`);
for (const [prefix, role] of DEFAULT_MAT_PREFIX) assertRole(role, `DEFAULT_MAT_PREFIX["${prefix}"]`);
for (const [prefix, mats] of MODEL_MATERIAL_OVERRIDES) {
  for (const [mat, role] of Object.entries(mats)) assertRole(role, `MODEL_MATERIAL_OVERRIDES["${prefix}"].${mat}`);
}

// --- Resolution -----------------------------------------------------------
export function isExcluded(model) {
  return EXCLUDED_MODELS.has(model);
}

// model + glTF material name -> §2 role name. Throws rather than guessing.
export function resolveRole(model, material) {
  if (EXCLUDED_MODELS.has(model)) {
    throw new Error(`model "${model}" is excluded (§2 accent rule) and must not be loaded`);
  }

  for (const [prefix, mats] of MODEL_MATERIAL_OVERRIDES) {
    if (model.startsWith(prefix) && material in mats) return mats[material];
  }

  if (material === '_defaultMat') {
    for (const [prefix, role] of DEFAULT_MAT_PREFIX) if (model.startsWith(prefix)) return role;
    throw new Error(
      `"${model}" uses _defaultMat and matches no prefix in DEFAULT_MAT_PREFIX. ` +
      '_defaultMat is pure white and spans rock, wood, foliage and crops — it has no single ' +
      'role, so it resolves by model name. Add a prefix rule; do not add a fallback.'
    );
  }

  const role = MATERIAL_ROLE[material];
  if (role) return role;

  if (material in EXCLUDED_ONLY_MATERIALS) {
    throw new Error(
      `material "${material}" appeared on "${model}", but it was only ever on excluded models ` +
      `(${EXCLUDED_ONLY_MATERIALS[material]}). Either the pack changed or the exclusion list did — ` +
      'give it a role or exclude the model.'
    );
  }

  throw new Error(
    `material "${material}" on "${model}" is not in MATERIAL_ROLE and is not excluded. ` +
    'P1b replaced nearest-in-Oklab with a name->role map precisely so this cannot fall back — ' +
    'a silent fallback reintroduces the palette collapse. Add it to the map.'
  );
}

// Role name -> the §2 colour, already linear (PC decodes once at module load).
export function roleColour(role) {
  const c = PC[role];
  if (!c) throw new Error(`unknown role "${role}"`);
  return c;
}

// Coverage: every material the pack declares must be classified. Called with
// palette.json's material table at load, so a pack update that introduces a
// material fails immediately instead of at whatever framing first shows it.
export function assertCoverage(materialNames) {
  const perModel = new Set(MODEL_MATERIAL_OVERRIDES.flatMap(([, m]) => Object.keys(m)));
  const missing = materialNames.filter((n) =>
    n !== '_defaultMat' && !(n in MATERIAL_ROLE) && !(n in EXCLUDED_ONLY_MATERIALS) && !perModel.has(n));
  if (missing.length) {
    throw new Error(`pack materials with no role: ${missing.join(', ')} — add them to MATERIAL_ROLE`);
  }
  return materialNames.length;
}
