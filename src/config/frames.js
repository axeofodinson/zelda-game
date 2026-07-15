// §5 — Moveset frame data. All times in MILLISECONDS. No magic numbers in
// systems code; everything reads from here. Tables in §4/§5 are a starting
// point, not scripture — expect Phase 6 to retune (changes logged there).

export const FRAMES = {
  slash1: { windup: 90, active: 70, recovery: 180, cancelAt: 100 },
  slash2: { windup: 70, active: 70, recovery: 200, cancelAt: 110 },
  slash3: { windup: 140, active: 110, recovery: 340, cancelAt: null }, // committed
  roll: { total: 500, iFrom: 80, iTo: 320 },
  backhop: { total: 380, iFrom: 40, iTo: 200 },
  sidehop: { total: 420, iFrom: 60, iTo: 240 },
  plunge: { windup: 180, active: 60, recovery: 420 }, // i-frames during rise
  vent: { minHold: 400, fullHold: 900, active: 180, recovery: 500, iFrom: 0, iTo: 180 },
  wardRaise: { windup: 120, recovery: 100 },
};

// §5 — input buffering. A slash pressed during recovery fires the instant the
// cancel window opens. This is most of what "responsive" means.
export const INPUT_BUFFER_MS = 150;

// Vent held past fullHold gives +15% radius (skill reward, not requirement).
export const VENT_OVERCHARGE_BONUS = 0.15;

// Movement (units/sec). Not in §5's tables but needed by the controller.
export const MOVE = {
  runSpeed: 5.2,
  walkSpeed: 2.6,
  accel: 40, // ground acceleration
  friction: 14,
  rollSpeed: 8.5, // peak speed of a roll
  turnLerp: 14, // how fast Tinn faces his move direction
  hopSpeed: 7.0,
};
