import { Vector3 } from 'three';

const _to = new Vector3();

// Knell-Lock (§5): hold Shift to lock the nearest valid target; release to
// drop. Camera orbits, WASD becomes strafe (handled by the controller reading
// `active`). The target stays locked while alive and within a generous range.
export class LockOn {
  constructor(getEnemies, { range = 15 } = {}) {
    this.getEnemies = getEnemies;
    this.range = range;
    this.target = null;
    this.active = false;
  }

  update(held, fromPos) {
    if (!held) {
      this.active = false;
      this.target = null;
      return;
    }
    // Keep an existing target if still valid.
    if (this.target && (this.target.dead || this._dist(fromPos, this.target) > this.range * 1.25)) {
      this.target = null;
    }
    if (!this.target) this.target = this._acquire(fromPos);
    this.active = !!this.target;
  }

  _dist(from, e) {
    return _to.copy(e.position).sub(from).length();
  }

  _acquire(fromPos) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.getEnemies()) {
      if (e.dead) continue;
      const d = this._dist(fromPos, e);
      if (d < this.range && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }
}
