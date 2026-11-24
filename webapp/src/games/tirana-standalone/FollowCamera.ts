import * as T from 'three';

export type WalkingView = 'shoulder' | 'wide' | 'eyes';
export type DrivingView = 'chase' | 'wide' | 'cockpit';
type Point = { x: number; y: number; z: number };
type Cast = (origin: Point, direction: Point, distance: number) => number;

/** A damped orbit with an immediate inward collision response. Rays cover the
 * near-plane edges, not just the eye, so portrait framing stays clear of walls.
 * No scene traversal or per-frame Three.js allocations. */
export class FollowCamera {
  private desired = new T.Vector3();
  private direction = new T.Vector3();
  private right = new T.Vector3();
  private up = new T.Vector3();
  private origin = new T.Vector3();
  private previousAnchor = new T.Vector3();
  private anchor = new T.Vector3();
  private key = '';
  private distance = 0;

  reset() { this.key = ''; }

  update(camera: T.PerspectiveCamera, options: {
    key: string; anchor: Point; yaw: number; pitch: number; distance: number;
    shoulder?: number; lookPitch?: number; aimTarget?: Point; dt: number; cast: Cast; ground: (x: number, z: number) => number;
  }) {
    const o = options;
    const dt = Math.max(0, Math.min(.15, o.dt));
    const snap = this.key !== o.key || this.previousAnchor.distanceTo(o.anchor) > 20;
    this.key = o.key;
    this.previousAnchor.copy(o.anchor);
    // Smooth crouch/steps but keep lateral motion attached to the player/car.
    if (snap) this.anchor.copy(o.anchor);
    else {
      this.anchor.x = o.anchor.x; this.anchor.z = o.anchor.z;
      this.anchor.y += (o.anchor.y - this.anchor.y) * (1 - Math.exp(-dt * 18));
    }
    const pitch = T.MathUtils.clamp(o.pitch, -.85, .7);
    this.direction.set(-Math.sin(o.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(o.yaw) * Math.cos(pitch));
    this.right.set(Math.cos(o.yaw), 0, -Math.sin(o.yaw));
    this.desired.copy(this.anchor).addScaledVector(this.direction, -o.distance)
      .addScaledVector(this.right, o.shoulder || 0);
    // Correct the requested position before casting: lifting after collision
    // could push the camera through a bridge or ceiling.
    this.desired.y = Math.max(this.desired.y, o.ground(this.desired.x, this.desired.z) + .28);
    this.direction.subVectors(this.desired, this.anchor);
    const requested = this.direction.length();
    this.direction.normalize();
    this.up.crossVectors(this.direction, this.right).normalize();
    const halfHeight = Math.tan(camera.fov * Math.PI / 360) * camera.near + .12;
    const halfWidth = halfHeight * Math.max(1, camera.aspect);
    let safe = requested;
    for (const [x, y] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      this.origin.copy(this.anchor).addScaledVector(this.right, x * halfWidth).addScaledVector(this.up, y * halfHeight);
      const hit = o.cast(this.origin, this.direction, requested);
      if (Number.isFinite(hit) && hit < requested) safe = Math.min(safe, Math.max(0, hit - .2));
    }
    // Never enforce a minimum distance through a wall. Recover outward slowly.
    this.distance = snap || safe < this.distance ? safe
      : this.distance + (safe - this.distance) * (1 - Math.exp(-dt * 7));
    camera.position.copy(this.anchor).addScaledVector(this.direction, this.distance);
    camera.up.set(0, 1, 0);
    // Look along the player's actual aim line; aiming itself uses the eye view.
    const lookPitch = o.lookPitch ?? pitch;
    this.desired.set(-Math.sin(o.yaw) * Math.cos(lookPitch), Math.sin(lookPitch), -Math.cos(o.yaw) * Math.cos(lookPitch));
    const focus = o.aimTarget ? 1 : Math.max(.5, Math.min(60, o.cast(o.anchor, this.desired, 60)));
    this.desired.multiplyScalar(focus).add(o.anchor);
    if (o.aimTarget) this.desired.copy(o.aimTarget);
    camera.lookAt(this.desired);
  }
}
