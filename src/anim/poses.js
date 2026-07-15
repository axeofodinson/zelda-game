// Animation pose tables. Each animation: { duration (s), loop, keys:[{t,pose}] }.
// A pose maps bone name -> [rx,ry,rz] euler offset (radians) on top of rest.
// Rest pose (defined in tinn.js) has arms hanging down at the sides.
//
// Bones: pelvis torso head  shoulderL shoulderR armL armR  hipL hipR legL legR
//        footL footR  (handR holds the blade).

export const ANIM = {
  idle: {
    duration: 2.6,
    loop: true,
    keys: [
      { t: 0.0, pose: { torso: [0.02, 0, 0], head: [0.03, 0.04, 0], shoulderL: [0, 0, 0.06], shoulderR: [0, 0, -0.06] } },
      { t: 1.3, pose: { torso: [-0.03, 0, 0], head: [-0.02, -0.05, 0], shoulderL: [0, 0, 0.1], shoulderR: [0, 0, -0.1] } },
      { t: 2.6, pose: { torso: [0.02, 0, 0], head: [0.03, 0.04, 0], shoulderL: [0, 0, 0.06], shoulderR: [0, 0, -0.06] } },
    ],
  },

  walk: {
    duration: 0.72,
    loop: true,
    keys: [
      { t: 0.0, pose: { pelvis: [0.04, 0, 0], hipL: [0.45, 0, 0], legL: [-0.1, 0, 0], hipR: [-0.4, 0, 0], legR: [-0.5, 0, 0], shoulderL: [-0.3, 0, 0.05], shoulderR: [0.3, 0, -0.05], torso: [0.05, 0.08, 0] } },
      { t: 0.36, pose: { pelvis: [0.04, 0, 0], hipL: [-0.4, 0, 0], legL: [-0.5, 0, 0], hipR: [0.45, 0, 0], legR: [-0.1, 0, 0], shoulderL: [0.3, 0, 0.05], shoulderR: [-0.3, 0, -0.05], torso: [0.05, -0.08, 0] } },
      { t: 0.72, pose: { pelvis: [0.04, 0, 0], hipL: [0.45, 0, 0], legL: [-0.1, 0, 0], hipR: [-0.4, 0, 0], legR: [-0.5, 0, 0], shoulderL: [-0.3, 0, 0.05], shoulderR: [0.3, 0, -0.05], torso: [0.05, 0.08, 0] } },
    ],
  },

  run: {
    duration: 0.46,
    loop: true,
    keys: [
      { t: 0.0, pose: { pelvis: [0.16, 0, 0], hipL: [0.8, 0, 0], legL: [-0.35, 0, 0], hipR: [-0.6, 0, 0], legR: [-0.9, 0, 0], shoulderL: [-0.7, 0, 0.05], shoulderR: [0.7, 0, -0.05], armL: [-0.3, 0, 0], armR: [-0.3, 0, 0], torso: [0.14, 0.12, 0], head: [-0.08, 0, 0] } },
      { t: 0.23, pose: { pelvis: [0.16, 0, 0], hipL: [-0.6, 0, 0], legL: [-0.9, 0, 0], hipR: [0.8, 0, 0], legR: [-0.35, 0, 0], shoulderL: [0.7, 0, 0.05], shoulderR: [-0.7, 0, -0.05], armL: [-0.3, 0, 0], armR: [-0.3, 0, 0], torso: [0.14, -0.12, 0], head: [-0.08, 0, 0] } },
      { t: 0.46, pose: { pelvis: [0.16, 0, 0], hipL: [0.8, 0, 0], legL: [-0.35, 0, 0], hipR: [-0.6, 0, 0], legR: [-0.9, 0, 0], shoulderL: [-0.7, 0, 0.05], shoulderR: [0.7, 0, -0.05], armL: [-0.3, 0, 0], armR: [-0.3, 0, 0], torso: [0.14, 0.12, 0], head: [-0.08, 0, 0] } },
    ],
  },

  // Not looped; duration matches FRAMES.roll.total. A forward tuck-and-roll.
  roll: {
    duration: 0.5,
    loop: false,
    keys: [
      { t: 0.0, pose: { pelvis: [0, 0, 0], torso: [0, 0, 0], head: [0, 0, 0], hipL: [0, 0, 0], hipR: [0, 0, 0] } },
      { t: 0.14, pose: { pelvis: [0.9, 0, 0], torso: [0.9, 0, 0], head: [0.6, 0, 0], hipL: [1.5, 0, 0], legL: [-1.6, 0, 0], hipR: [1.5, 0, 0], legR: [-1.6, 0, 0], shoulderL: [-1.4, 0, 0], shoulderR: [-1.4, 0, 0] } },
      { t: 0.32, pose: { pelvis: [1.6, 0, 0], torso: [1.4, 0, 0], head: [1.0, 0, 0], hipL: [1.8, 0, 0], legL: [-1.9, 0, 0], hipR: [1.8, 0, 0], legR: [-1.9, 0, 0], shoulderL: [-1.8, 0, 0], shoulderR: [-1.8, 0, 0] } },
      { t: 0.5, pose: { pelvis: [0.1, 0, 0], torso: [0.15, 0, 0], head: [0.1, 0, 0], hipL: [0.2, 0, 0], hipR: [0.2, 0, 0] } },
    ],
  },
};
