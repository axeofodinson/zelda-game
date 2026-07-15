import { Color } from 'three';

// The foundry palette — §2. Six values. NOTHING else in the codebase
// hardcodes a hex; everything derives from these.
//
//   ash        sky, fog, falling ash
//   iron       Tinn, cold blade, shadow, mold shells
//   slag       ground, dead bronze, rubble
//   molten     runnels, enemy cores, heat
//   sear       white-hot blade, impact flash
//   verdigris  cooled bronze, statues, safe zones, quench steam
export const HEX = {
  ash: 0xb7b2a8,
  iron: 0x2b2f33,
  slag: 0x5a4a3f,
  molten: 0xff6b1a,
  sear: 0xffe9c4,
  verdigris: 0x4fbfa8,
};

// Pre-built THREE.Color instances (do not mutate — clone if you need to).
export const COL = Object.freeze(
  Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, new Color(v)]))
);

// Raw display-space rgb triplets (0..1). We run the whole renderer with
// THREE.ColorManagement disabled and no OETF in the post chain, so palette
// hexes land on screen ~as authored — exactly the control a stylized retro
// look wants. All lighting math is therefore gamma-space, which is fine (and
// era-accurate: N64 didn't do linear lighting either).
export const RGB = Object.freeze(
  Object.fromEntries(Object.entries(HEX).map(([k, v]) => [
    k,
    [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255],
  ]))
);

// Convenience: a fresh clone so callers never alias the frozen originals.
export function col(name) {
  return COL[name].clone();
}
