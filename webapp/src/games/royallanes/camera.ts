import * as T from 'three';
import { LANE_SPACING } from './shared/physicsCore.mjs';

export type CameraFrame = {
  ball: T.Vector3;
  /** Seconds since authoritative release; negative during the approach. */
  releaseElapsed: number;
  duration: number;
  hasRoll: boolean;
};

/** Full-body approach, ball chase, pin-deck hold, then return for the next turn. */
export class BowlingCamera {
  private initialized = false;
  private position = new T.Vector3();
  private look = new T.Vector3();
  private targetLook = new T.Vector3();
  private overview = new T.Vector3(0, 3, 7.7);
  private overviewLook = new T.Vector3(0, 0.95, -0.8);
  constructor(private camera: T.PerspectiveCamera) {}

  update(dt: number, frame: CameraFrame) {
    const { ball, releaseElapsed: elapsed, duration, hasRoll } = frame;
    const chase = hasRoll
      ? T.MathUtils.smoothstep(elapsed, 0, 0.7) *
        (1 - T.MathUtils.smoothstep(elapsed, duration + 0.8, duration + 2.1))
      : 0;
    const deck = T.MathUtils.smoothstep(-ball.z, 15.8, 18.2);
    // A phone frames the player and the right neighbouring bowler prominently;
    // wider screens can include both neighbouring lanes without shrinking people.
    const portrait = this.camera.aspect < 1;
    this.overview.x = this.overviewLook.x = portrait ? 1.1 : 0;
    this.position.set(
      ball.x * 0.55 * (1 - deck),
      T.MathUtils.lerp(1.45, 2.05, deck),
      Math.max(-15.6, ball.z + 3.6)
    );
    this.targetLook.set(
      ball.x * (1 - deck),
      0.15,
      Math.max(-19.1, ball.z - 1.25)
    );
    this.position.lerpVectors(this.overview, this.position, chase);
    this.targetLook.lerpVectors(this.overviewLook, this.targetLook, chase);
    const halfWidth = portrait ? LANE_SPACING / 2 + 0.8 : LANE_SPACING + 0.65;
    const overviewFov = T.MathUtils.radToDeg(
      2 * Math.atan(halfWidth / (5.5 * Math.max(0.35, this.camera.aspect)))
    );
    const fov = T.MathUtils.lerp(
      T.MathUtils.clamp(overviewFov, 48, 124),
      this.camera.aspect < 0.7 ? 72 : 58,
      chase
    );
    const blend = this.initialized ? 1 - Math.exp(-Math.max(0, dt) * 9) : 1;
    this.camera.position.lerp(this.position, blend);
    this.look.lerp(this.targetLook, blend);
    this.camera.fov = T.MathUtils.lerp(this.camera.fov, fov, blend);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld(true);
    this.initialized = true;
  }
}
