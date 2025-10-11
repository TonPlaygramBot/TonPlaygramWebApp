// @ts-nocheck
import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const TMP_VEC_A = new THREE.Vector3();
const TMP_VEC_B = new THREE.Vector3();
const TMP_VEC_C = new THREE.Vector3();
const TMP_VEC_D = new THREE.Vector3();
const TMP_VEC_E = new THREE.Vector3();
const TMP_VEC_F = new THREE.Vector3();
const TMP_VEC_G = new THREE.Vector3();
const TMP_MAT = new THREE.Matrix4();
const TMP_NDC_TIP = new THREE.Vector3();
const TMP_NDC_FOCUS = new THREE.Vector3();
const TMP_CAMERA_RIGHT = new THREE.Vector3();
const TMP_FORWARD = new THREE.Vector3();
const TMP_RIGHT = new THREE.Vector3();
const TMP_UP = new THREE.Vector3();
const tmpForward = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpCross = new THREE.Vector3();
const tmpDesiredUp = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const cueLocalForward = new THREE.Vector3(0, 0, -1);
const cueLocalUp = new THREE.Vector3(0, 1, 0);
const cueTipOffset = new THREE.Vector3();
const cueContact = new THREE.Vector3();
const cueDirection = new THREE.Vector3();
const cueButt = new THREE.Vector3();
const sharedUp = new THREE.Vector3(0, 1, 0);

const PAD = 0.06;
const PAD_LIMIT = 1 - PAD * 2;
const INSIDE_LIMIT = 0.6;
const TIGHT_LIMIT = 0.75;
const FALLBACK_DISTANCE = 3;
const BACK_BASE = 0.28;
const BACK_MIN = 0.22;
const BACK_MAX = 0.5;
const H_BASE = 0.12;
const H_MIN = 0.08;
const H_MAX = 0.18;
const SIDE_BASE = 0.035;
const SIDE_MIN = -0.06;
const SIDE_MAX = 0.06;
const FOV_BASE = 50;
const FOV_MIN = 46;
const FOV_MAX = 52;
const FOV_STEP = 0.3;
const SMOOTH_TAU = 0.1;
const HEIGHT_PAD = 0.01;
const TABLE_SOFT_MARGIN = 0.02;
const NEAR_GUARD = 0.08;
const SIDE_FLIP_THRESHOLD = 0.1;
const MAX_DT = 0.25;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function angleDelta(target: number, current: number) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function computeRFit(
  viewHeight: number,
  viewWidth: number,
  tableWidth: number,
  tableHeight: number,
  thetaRad: number
) {
  const safeWidth = viewWidth > 1e-6 ? viewWidth : 1;
  const safeHeight = viewHeight > 1e-6 ? viewHeight : 1;
  const aspect = safeHeight / safeWidth;
  const vFov = 50 * DEG2RAD;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (1 / aspect));
  const hx = 0.5 * tableWidth * TABLE_MARGIN_SCALE;
  const hz = 0.5 * tableHeight * TABLE_MARGIN_SCALE;
  const rW = hx / Math.tan(hFov / 2);
  const cosTheta = Math.max(Math.cos(thetaRad), 1e-4);
  const rH = (hz / cosTheta) / Math.tan(vFov / 2);
  return Math.max(rW, rH) * FIT_EXTRA_MARGIN;
}

type CameraOptions = {
  theta?: number;
  phi?: number;
  radius?: number;
};

export class MobilePortraitCameraRig {
  private camera: THREE.PerspectiveCamera;
  private viewWidth: number;
  private viewHeight: number;
  private tableWidth: number;
  private tableHeight: number;
  private tableSurfaceY: number;
  private railTopY: number;
  private lastUpdate = performance.now();
  private back = BACK_BASE;
  private backTarget = BACK_BASE;
  private h = H_BASE;
  private hTarget = H_BASE;
  private side = SIDE_BASE;
  private sideTarget = SIDE_BASE;
  private vFovDeg = FOV_BASE;
  private fovTarget = FOV_BASE;
  private focusPoint: THREE.Vector3;
  private anchor: THREE.Vector3;
  private ndcTip: THREE.Vector3;
  private ndcFocus: THREE.Vector3;
  private ballPositions: THREE.Vector3[];
  private ballCount = 0;
  private ballCenterY = 0;
  private theta: number;
  private phi: number;
  private radius: number;
  private radiusTarget: number;

  constructor(camera: THREE.PerspectiveCamera, options: CameraOptions = {}) {
    this.camera = camera;
    this.camera.fov = FOV_BASE;
    this.camera.near = 0.03;
    this.camera.far = 1000;
    this.camera.up.copy(WORLD_UP);
    this.camera.updateProjectionMatrix();
    this.viewWidth = 1;
    this.viewHeight = 1;
    this.tableWidth = 3.6;
    this.tableHeight = 7.2;
    this.tableSurfaceY = 0;
    this.railTopY = 0.12;
    this.focusPoint = new THREE.Vector3();
    this.anchor = new THREE.Vector3();
    this.ndcTip = new THREE.Vector3();
    this.ndcFocus = new THREE.Vector3();
    this.ballPositions = [];
    this.theta = options.theta ?? 0;
    this.phi = options.phi ?? 0;
    this.radius = options.radius ?? BACK_BASE;
    this.radiusTarget = this.radius;
  }

  setViewport(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width <= 1e-3 || height <= 1e-3) return;
    this.viewWidth = width;
    this.viewHeight = height;
    const aspect = width / height;
    if (Math.abs(this.camera.aspect - aspect) > 1e-4) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  setTableDimensions(width: number, height: number, options: any = {}) {
    if (Number.isFinite(width) && width > 0) this.tableWidth = width;
    if (Number.isFinite(height) && height > 0) this.tableHeight = height;
    if (Number.isFinite(options.surfaceY)) this.tableSurfaceY = options.surfaceY;
    if (Number.isFinite(options.railTop)) this.railTopY = options.railTop;
  }

  orbit(deltaPhi: number, deltaTheta: number) {
    if (Number.isFinite(deltaPhi)) {
      this.sideTarget = THREE.MathUtils.clamp(
        this.sideTarget + deltaPhi * 0.25,
        SIDE_MIN,
        SIDE_MAX
      );
    }
    if (Number.isFinite(deltaTheta)) {
      this.hTarget = THREE.MathUtils.clamp(
        this.hTarget - deltaTheta * 0.18,
        H_MIN,
        H_MAX
      );
    }
  }

  setPhiTarget(value: number) {
    if (!Number.isFinite(value)) return;
    this.phi = value;
  }

  zoomBy(scale: number) {
    if (!Number.isFinite(scale) || scale === 0) return;
    const clamped = THREE.MathUtils.clamp(scale, 0.5, 2);
    const next = THREE.MathUtils.clamp(this.fovTarget / clamped, FOV_MIN, FOV_MAX);
    this.fovTarget = next;
  }

  setRadiusTarget(value: number) {
    if (!Number.isFinite(value)) return;
    this.radiusTarget = THREE.MathUtils.clamp(value, BACK_MIN, BACK_MAX);
  }

  private ensureBallCache(size: number) {
    for (let i = this.ballPositions.length; i < size; i++) {
      this.ballPositions.push(new THREE.Vector3());
    }
  }

  private prepareBalls(balls: any[], cueBallRef: any, worldScale: number, ballCenterY: number) {
    this.ballCount = 0;
    if (!Array.isArray(balls)) return;
    this.ballCenterY = ballCenterY;
    const count = balls.length;
    this.ensureBallCache(count);
    for (let i = 0; i < count; i++) {
      const ball = balls[i];
      if (!ball || !ball.active || ball === cueBallRef) continue;
      const pos = ball.pos;
      if (!pos) continue;
      const x = Number.isFinite(pos.x) ? pos.x * worldScale : 0;
      const z = Number.isFinite(pos.y) ? pos.y * worldScale : 0;
      const store = this.ballPositions[this.ballCount];
      store.set(x, this.ballCenterY, z);
      this.ballCount++;
    }
  }

  private intersectFirst(origin: THREE.Vector3, direction: THREE.Vector3, ballRadius: number) {
    TMP_VEC_A.copy(direction);
    TMP_VEC_A.y = 0;
    if (TMP_VEC_A.lengthSq() < 1e-8) {
      TMP_VEC_A.set(0, 0, -1);
    } else {
      TMP_VEC_A.normalize();
    }

    let closest = Infinity;
    const halfW = this.tableWidth * 0.5;
    const halfH = this.tableHeight * 0.5;

    if (halfW > 1e-6) {
      if (TMP_VEC_A.x < -1e-6) {
        const t = (-halfW - origin.x) / TMP_VEC_A.x;
        if (t >= 0 && t < closest) closest = t;
      }
      if (TMP_VEC_A.x > 1e-6) {
        const t = (halfW - origin.x) / TMP_VEC_A.x;
        if (t >= 0 && t < closest) closest = t;
      }
    }
    if (halfH > 1e-6) {
      if (TMP_VEC_A.z < -1e-6) {
        const t = (-halfH - origin.z) / TMP_VEC_A.z;
        if (t >= 0 && t < closest) closest = t;
      }
      if (TMP_VEC_A.z > 1e-6) {
        const t = (halfH - origin.z) / TMP_VEC_A.z;
        if (t >= 0 && t < closest) closest = t;
      }
    }

    const diam = ballRadius * 2;
    const diam2 = diam * diam;
    for (let i = 0; i < this.ballCount; i++) {
      const pos = this.ballPositions[i];
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const proj = dx * TMP_VEC_A.x + dz * TMP_VEC_A.z;
      if (proj <= 0) continue;
      const perp2 = dx * dx + dz * dz - proj * proj;
      if (perp2 > diam2) continue;
      const thc = Math.sqrt(Math.max(diam2 - perp2, 0));
      const t = proj - thc;
      if (t >= 0 && t < closest) closest = t;
    }

    let distance = Number.isFinite(closest) ? closest : FALLBACK_DISTANCE;
    if (!(distance > 1e-6)) distance = FALLBACK_DISTANCE;
    distance = Math.min(distance, FALLBACK_DISTANCE);
    this.focusPoint.copy(origin).addScaledVector(TMP_VEC_A, distance);
    return this.focusPoint;
  }

  private applyAnchorConstraints(anchor: THREE.Vector3) {
    const halfW = this.tableWidth * 0.5 + TABLE_SOFT_MARGIN;
    const halfH = this.tableHeight * 0.5 + TABLE_SOFT_MARGIN;
    if (halfW > 0) anchor.x = THREE.MathUtils.clamp(anchor.x, -halfW, halfW);
    if (halfH > 0) anchor.z = THREE.MathUtils.clamp(anchor.z, -halfH, halfH);
    const floor = Math.max(this.tableSurfaceY + HEIGHT_PAD, this.railTopY + HEIGHT_PAD * 0.5);
    if (anchor.y < floor) anchor.y = floor;
  }

  private applyLookAt(focus: THREE.Vector3) {
    this.camera.lookAt(focus);
    TMP_FORWARD.copy(focus).sub(this.camera.position);
    if (TMP_FORWARD.lengthSq() < 1e-8) TMP_FORWARD.set(0, 0, -1);
    else TMP_FORWARD.normalize();
    TMP_RIGHT.crossVectors(WORLD_UP, TMP_FORWARD);
    if (TMP_RIGHT.lengthSq() < 1e-8) TMP_RIGHT.set(1, 0, 0);
    else TMP_RIGHT.normalize();
    TMP_UP.crossVectors(TMP_FORWARD, TMP_RIGHT).normalize();
    TMP_MAT.makeBasis(TMP_RIGHT, TMP_UP, TMP_FORWARD);
    this.camera.quaternion.setFromRotationMatrix(TMP_MAT);
    this.camera.up.copy(WORLD_UP);
    this.camera.updateMatrixWorld(true);
  }

  private segmentFitsWithPad(tip: THREE.Vector3, focus: THREE.Vector3) {
    this.ndcTip.copy(tip).project(this.camera);
    this.ndcFocus.copy(focus).project(this.camera);
    return (
      Math.abs(this.ndcTip.x) <= PAD_LIMIT &&
      Math.abs(this.ndcTip.y) <= PAD_LIMIT &&
      Math.abs(this.ndcFocus.x) <= PAD_LIMIT &&
      Math.abs(this.ndcFocus.y) <= PAD_LIMIT
    );
  }

  private segmentDeepInside() {
    return (
      Math.abs(this.ndcTip.x) < INSIDE_LIMIT &&
      Math.abs(this.ndcTip.y) < INSIDE_LIMIT &&
      Math.abs(this.ndcFocus.x) < INSIDE_LIMIT &&
      Math.abs(this.ndcFocus.y) < INSIDE_LIMIT
    );
  }

  private isTightFraming() {
    return (
      Math.abs(this.ndcTip.x) > TIGHT_LIMIT ||
      Math.abs(this.ndcTip.y) > TIGHT_LIMIT ||
      Math.abs(this.ndcFocus.x) > TIGHT_LIMIT ||
      Math.abs(this.ndcFocus.y) > TIGHT_LIMIT
    );
  }

  private shouldFlipSide(cueRight: THREE.Vector3) {
    TMP_CAMERA_RIGHT.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const dot = cueRight.dot(TMP_CAMERA_RIGHT);
    if (!Number.isFinite(dot)) return false;
    if (this.side >= 0 && dot < -SIDE_FLIP_THRESHOLD) return true;
    if (this.side <= 0 && dot > SIDE_FLIP_THRESHOLD) return true;
    return false;
  }

  private applyOffsets(
    tip: THREE.Vector3,
    dir: THREE.Vector3,
    cueRight: THREE.Vector3,
    back: number,
    h: number,
    side: number
  ) {
    this.anchor
      .copy(tip)
      .addScaledVector(dir, -back)
      .addScaledVector(WORLD_UP, h)
      .addScaledVector(cueRight, side);
    this.applyAnchorConstraints(this.anchor);
    this.camera.position.copy(this.anchor);
  }

  private computeSmoothing(dt: number) {
    const safeDt = Math.max(0, Math.min(dt, MAX_DT));
    return safeDt <= 0 ? 0.18 : 1 - Math.exp(-safeDt / SMOOTH_TAU);
  }

  private applyNearPlaneGuard(tip: THREE.Vector3) {
    const minDistance = Math.max(NEAR_GUARD, this.camera.near * 2);
    const dist = this.camera.position.distanceTo(tip);
    if (dist < minDistance) {
      this.backTarget = Math.min(BACK_MAX, this.back + (minDistance - dist));
    }
  }

  private applyHeightGuard(anchor: THREE.Vector3) {
    const minY = Math.max(this.tableSurfaceY + HEIGHT_PAD, this.railTopY + HEIGHT_PAD * 0.5);
    if (anchor.y < minY) {
      this.hTarget = Math.min(H_MAX, this.hTarget + (minY - anchor.y));
    }
  }

  update(now: number, input: any = null) {
    const dtMs = now - this.lastUpdate;
    this.lastUpdate = now;
    const dt = Math.max(0, dtMs) / 1000;

    const valid =
      input &&
      input.tip &&
      input.cueDirection &&
      input.cueRight &&
      input.cueBall &&
      Number.isFinite(input.ballRadiusWorld) &&
      Number.isFinite(input.worldScale);

    if (valid) {
      const tip: THREE.Vector3 = input.tip;
      const cueDir: THREE.Vector3 = input.cueDirection;
      const cueRight: THREE.Vector3 = input.cueRight;
      const cueBall: THREE.Vector3 = input.cueBall;
      const ballRadius: number = input.ballRadiusWorld;
      this.prepareBalls(input.balls, input.cueBallRef, input.worldScale, input.ballCenterYWorld);

      const focus = this.intersectFirst(cueBall, cueDir, ballRadius);
      this.applyOffsets(tip, cueDir, cueRight, this.back, this.h, this.side);
      this.applyLookAt(focus);

      const fits = this.segmentFitsWithPad(tip, focus);
      const deepInside = this.segmentDeepInside();
      if (!fits) {
        this.backTarget = Math.min(this.back + 0.02, BACK_MAX);
      } else if (deepInside) {
        this.backTarget = Math.max(BACK_MIN, this.back - 0.02);
      }

      this.applyNearPlaneGuard(tip);
      this.applyHeightGuard(this.anchor);

      if (this.shouldFlipSide(cueRight)) {
        const magnitude = Math.max(Math.abs(this.sideTarget), SIDE_BASE);
        this.sideTarget = -Math.sign(this.side || 1) * magnitude;
      }

      const smooth = this.computeSmoothing(dt);
      this.back += (THREE.MathUtils.clamp(this.backTarget, BACK_MIN, BACK_MAX) - this.back) * smooth;
      this.h += (THREE.MathUtils.clamp(this.hTarget, H_MIN, H_MAX) - this.h) * smooth;
      this.side += (THREE.MathUtils.clamp(this.sideTarget, SIDE_MIN, SIDE_MAX) - this.side) * smooth;

      this.applyOffsets(tip, cueDir, cueRight, this.back, this.h, this.side);
      this.applyLookAt(focus);
      this.segmentFitsWithPad(tip, focus);

      if (this.isTightFraming()) {
        this.fovTarget = Math.min(FOV_MAX, this.fovTarget + FOV_STEP);
      } else {
        this.fovTarget = Math.max(FOV_MIN, this.fovTarget - FOV_STEP);
      }
    } else {
      const smooth = this.computeSmoothing(dt);
      this.back += (BACK_BASE - this.back) * smooth;
      this.h += (H_BASE - this.h) * smooth;
      this.side += (SIDE_BASE - this.side) * smooth;
      this.fovTarget = THREE.MathUtils.clamp(this.fovTarget - FOV_STEP, FOV_MIN, FOV_MAX);
      this.anchor.set(0, this.tableSurfaceY + 0.5, this.back + 0.5);
      this.applyAnchorConstraints(this.anchor);
      this.camera.position.copy(this.anchor);
      this.focusPoint.set(0, this.tableSurfaceY, 0);
      this.applyLookAt(this.focusPoint);
    }

    const fovDelta = THREE.MathUtils.clamp(this.fovTarget, FOV_MIN, FOV_MAX) - this.vFovDeg;
    if (Math.abs(fovDelta) > 1e-3) {
      this.vFovDeg += fovDelta * 0.18;
      this.camera.fov = this.vFovDeg;
      this.camera.updateProjectionMatrix();
    }

    TMP_FORWARD.copy(this.focusPoint).sub(this.camera.position);
    if (TMP_FORWARD.lengthSq() > 1e-6) {
      TMP_FORWARD.normalize();
      this.theta = Math.asin(THREE.MathUtils.clamp(TMP_FORWARD.y, -1, 1));
      this.phi = Math.atan2(TMP_FORWARD.x, TMP_FORWARD.z);
      this.radius = this.camera.position.distanceTo(this.focusPoint);
      this.radiusTarget = this.radius;
    }
  }

  getState() {
    return {
      theta: this.theta,
      phi: this.phi,
      radius: this.radius,
      radiusTarget: this.radiusTarget
    };
  }
}

export function alignCueRollToUp(
  object: THREE.Object3D,
  worldUp: THREE.Vector3,
  lerp: number
) {
  if (!object) return;
  const t = clamp(lerp ?? 0.2, 0, 1);
  tmpForward.copy(cueLocalForward).applyQuaternion(object.quaternion).normalize();
  tmpUp.copy(cueLocalUp).applyQuaternion(object.quaternion).normalize();
  tmpDesiredUp.copy(tmpForward).cross(worldUp).cross(tmpForward).normalize();
  if (tmpDesiredUp.lengthSq() < 1e-6) return;
  const dot = clamp(tmpUp.dot(tmpDesiredUp), -1, 1);
  const angle = Math.acos(dot);
  if (angle < 1e-4) return;
  tmpCross.copy(tmpUp).cross(tmpDesiredUp);
  const sign = tmpCross.dot(tmpForward) < 0 ? -1 : 1;
  tmpAxis.copy(tmpForward).multiplyScalar(sign).normalize();
  tmpQuat.setFromAxisAngle(tmpAxis, angle * t);
  object.quaternion.multiply(tmpQuat).normalize();
}

type CueSpinArgs = {
  cue: THREE.Object3D | null;
  cueBallPosition: THREE.Vector3;
  cueBallRadius: number;
  spinX: number;
  spinY: number;
  cueLength: number;
};

const clampSpin = (value: number) => clamp(value, -1, 1);

export function updateCueFromSpin({
  cue,
  cueBallPosition,
  cueBallRadius,
  spinX,
  spinY,
  cueLength
}: CueSpinArgs) {
  if (!cue) return;
  const k = 0.6;
  const sx = clampSpin(spinX) * k * cueBallRadius;
  const sy = clampSpin(spinY) * k * cueBallRadius;
  const cap = Math.max(0, cueBallRadius * cueBallRadius - (sx * sx + sy * sy));
  const nz = -Math.sqrt(cap);
  cueTipOffset.set(sx, 0, sy);
  cueContact.copy(cueBallPosition).add(cueTipOffset);
  cueContact.y += nz;

  cueDirection.copy(cueContact).sub(cueBallPosition);
  if (cueDirection.lengthSq() < 1e-8) {
    cueDirection.set(0, 0, -1);
  } else {
    cueDirection.normalize();
  }
  tmpQuat.setFromUnitVectors(cueLocalForward, cueDirection);
  cue.quaternion.copy(tmpQuat);
  alignCueRollToUp(cue, sharedUp, 0.2);

  cueButt.copy(cueContact).addScaledVector(cueDirection, -cueLength);
  cue.position.copy(cueButt);
}

export function rad(value: number) {
  return value * DEG2RAD;
}
