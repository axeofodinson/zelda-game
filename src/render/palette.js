// §2 — The palette. The one irreversible decision.
// 14 colours, global, never per-region. `cloth` is red and nothing else is.
import * as THREE from 'three';

export const P = {
  ink:     '#2A2118', // outlines. warm dark. never #000
  skyDay:  '#7EC8E3',
  skyDusk: '#F2A65A',
  sun:     '#FFF2C4',
  grass:   '#6DBE45',
  grassLo: '#2F7A3E',
  rock:    '#A89078',
  rockLo:  '#5C4A3D',
  soil:    '#8B5E3C',
  water:   '#3FA9C9',
  wood:    '#7A5230',
  cloth:   '#D94F3D', // the player. the ONLY red in the world.
  metal:   '#B8C4CC',
  sear:    '#FFF7D6', // impact flash, trails, death marker
};

// The 14 as THREE.Color, sRGB decoded to linear working space once.
export const PC = Object.fromEntries(
  Object.entries(P).map(([k, hex]) => [k, new THREE.Color(hex)])
);

// Ordered list used to build the palette LUT (§3.2). Order is irrelevant to
// output — nearest-in-Oklab wins — but kept stable for reproducibility.
export const PALETTE_LIST = Object.values(P).map((hex) => new THREE.Color(hex));

// §7.1 slice sub-palette. Six of the fourteen + cloth.
export const SLICE = ['ink', 'skyDay', 'sun', 'grass', 'grassLo', 'rock', 'cloth'];
