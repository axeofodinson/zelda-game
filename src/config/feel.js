// §8 — Game feel. Every number that makes this feel like a game and not a tech
// demo. Implemented for real in Phase 6, but the camera constants are used from
// Phase 1 on.

export const CAMERA = {
  free: {
    stiffness: 8.0,
    damping: 0.9,
    distance: 5.2,
    height: 2.4,
    lookahead: 1.2, // in the direction of travel
  },
  locked: {
    distance: 4.6,
    height: 2.0,
    targetBias: 0.35, // frame midpoint biased toward the target
  },
  transitionMs: 220, // easeOutCubic between modes
  collisionRadius: 0.4, // sphere cast; pull in, never clip
  fov: 55,
};

// Hitstop — freeze BOTH actors (anim, physics, particles). ms.
export const HITSTOP = {
  light: 60,
  slash3: 90,
  plunge: 120,
  kill: 180,
};

// Kill slowdown.
export const KILL_SLOWMO = { timeScale: 0.25, holdMs: 200, easeMs: 300 };

// Screenshake — directional, decaying, small. Perlin-driven, not random.
export const SHAKE = {
  slash: 0.04,
  plunge: 0.18,
  vent: 0.22,
  crucibleStep: 0.06,
};

// Camera punch on vent: FOV +4 over 60ms then ease back over 240ms.
export const CAM_PUNCH = { fov: 4, upMs: 60, downMs: 240 };

// Squash & stretch (rig root scale).
export const SQUASH = { plungeRise: 1.12, land: 0.88, recoverMs: 180 };

// Impact flash — hit enemy material flashes to --sear for 50ms.
export const IMPACT_FLASH_MS = 50;
