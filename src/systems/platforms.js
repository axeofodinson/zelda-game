// Ground-height + standability (§3/§4: cooled enemies become climbable geometry;
// the Crucible becomes a platform you *need*). A platform is an axis-aligned
// footprint with a top height. Tinn samples the tallest platform under his XZ
// and steps up onto it (within a step limit) or is blocked by it as a wall.
export class Platforms {
  constructor() {
    this.list = []; // { minX, maxX, minZ, maxZ, top, tag }
  }

  add(aabb) {
    this.list.push(aabb);
    return aabb;
  }
  remove(aabb) {
    const i = this.list.indexOf(aabb);
    if (i >= 0) this.list.splice(i, 1);
  }

  // Highest platform top strictly under (x,z); 0 (the basin floor) otherwise.
  heightAt(x, z) {
    let h = 0;
    for (const p of this.list) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.top > h) h = p.top;
    }
    return h;
  }

  // Is (x,z) over any platform whose top is more than `step` above `y`? (a wall)
  blockedAt(x, z, y, step) {
    for (const p of this.list) {
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && p.top - y > step) return true;
    }
    return false;
  }
}
