import { Vector3 } from 'three';
import { ENEMY } from '../config/heat.js';

const _d = new Vector3();

// Shared enemy behaviour helpers. The signature behaviour — break off and run
// for the nearest runnel to re-heat when cold (§4) — lives here; it does more
// for perceived intelligence than any state machine.
export function faceTo(enemy, pos, dt, rate = 8) {
  _d.copy(pos).sub(enemy.position).setY(0);
  if (_d.lengthSq() < 1e-5) return;
  const target = Math.atan2(_d.x, _d.z);
  let cur = enemy.root.rotation.y;
  let diff = target - cur;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  enemy.root.rotation.y = cur + diff * (1 - Math.exp(-rate * dt));
}

export function moveToward(enemy, pos, speed, dt, stopAt = 0) {
  _d.copy(pos).sub(enemy.position).setY(0);
  const dist = _d.length();
  if (dist <= stopAt) return dist;
  _d.normalize().multiplyScalar(speed * dt);
  enemy.position.x += _d.x;
  enemy.position.z += _d.z;
  return dist;
}

export function nearestRunnel(pos, runnels) {
  let best = null;
  let bd = Infinity;
  for (const r of runnels) {
    const d = _d.set(r.x - pos.x, 0, r.z - pos.z).lengthSq();
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

// Returns true if the enemy is (and should keep) retreating to reheat.
export function maybeRetreatToRunnel(enemy, ctx, speed) {
  if (!ctx.runnels || !ctx.runnels.length) return false;
  const cold = enemy.heat < ENEMY.brittleAt + 5;
  if (!cold) return false;
  const r = nearestRunnel(enemy.position, ctx.runnels);
  if (!r) return false;
  const atR = ctx.runnelAt && ctx.runnelAt(enemy.position.x, enemy.position.z);
  if (!atR) {
    faceTo(enemy, new Vector3(r.x, 0, r.z), ctx.dt, 6);
    moveToward(enemy, new Vector3(r.x, 0, r.z), speed * (enemy.brittle ? ENEMY.brittleSpeedMult : 1), ctx.dt);
  }
  return true; // reheating handled by base runnelAt check
}

export const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
