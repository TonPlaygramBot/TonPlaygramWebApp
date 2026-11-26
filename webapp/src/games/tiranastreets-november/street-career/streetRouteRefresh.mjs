// Route planning uses a static graph. A 750 ms polling tick is useful for a
// moving racer, but repeatedly solving the same route stalls the city loop.
export class StreetRouteRefresh {
  #last;
  clear() { this.#last = undefined; }
  request(mode, origin, target) {
    const last = this.#last;
    if (!Number.isFinite(origin.x) || !Number.isFinite(origin.z) ||
        !Number.isFinite(target.x) || !Number.isFinite(target.z)) {
      this.clear();
      return true;
    }
    if (last && last.mode === mode && origin.x === last.x && origin.z === last.z &&
        target.x === last.targetX && target.z === last.targetZ) return false;
    this.#last = { mode, x: origin.x, z: origin.z, targetX: target.x, targetZ: target.z };
    return true;
  }
}
