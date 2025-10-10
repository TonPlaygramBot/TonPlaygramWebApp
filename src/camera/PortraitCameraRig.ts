import * as THREE from 'three';

export interface CameraRigConfig {
  camera: THREE.PerspectiveCamera;
  tableWidth: number;
  tableHeight: number;
  padding?: number;
  verticalFovDeg?: number;
  minPitchDeg?: number;
  maxPitchDeg?: number;
  minRadius?: number;
  maxRadius?: number;
  smoothingTime?: number;
  target?: THREE.Vector3;
}

export interface SpinVector {
  x: number;
  y: number;
}

export interface CueRigConfig {
  cueLength: number;
  cueTipClearance: number;
  ballRadius: number;
  maxOffsetRatio?: number;
}

export interface CueTransform {
  buttPosition: THREE.Vector3;
  tipPosition: THREE.Vector3;
  direction: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

const DEFAULT_PADDING = 0.05;
const DEFAULT_V_FOV = 50;
const DEFAULT_MIN_PITCH = THREE.MathUtils.degToRad(20);
const DEFAULT_MAX_PITCH = THREE.MathUtils.degToRad(65);
const DEFAULT_SMOOTH_TIME = 0.12;
const SAFETY_RADIUS_SCALE = 1.02;

export function computeFitRadius(options: {
  tableWidth: number;
  tableHeight: number;
  padding?: number;
  verticalFovDeg?: number;
  aspect: number;
  pitchRad: number;
}): number {
  const {
    tableWidth,
    tableHeight,
    aspect,
    padding = DEFAULT_PADDING,
    verticalFovDeg = DEFAULT_V_FOV,
    pitchRad
  } = options;
  const halfWidth = (tableWidth * 0.5) * (1 + padding);
  const halfHeight = (tableHeight * 0.5) * (1 + padding);
  const vFov = THREE.MathUtils.degToRad(verticalFovDeg);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (1 / aspect));
  const rWidth = halfWidth / Math.tan(hFov / 2);
  const denom = Math.tan(vFov / 2);
  const safePitch = THREE.MathUtils.clamp(pitchRad, 1e-3, Math.PI / 2 - 1e-3);
  const verticalExtent = halfHeight / Math.cos(safePitch);
  const rHeight = verticalExtent / denom;
  return Math.max(rWidth, rHeight) * SAFETY_RADIUS_SCALE;
}

interface SmoothDampState {
  current: number;
  velocity: number;
}

function smoothDamp(
  state: SmoothDampState,
  target: number,
  dt: number,
  smoothTime: number,
  maxSpeed = Infinity
): number {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = state.current - target;
  const originalTo = target;
  const maxChange = maxSpeed * smoothTime;
  change = THREE.MathUtils.clamp(change, -maxChange, maxChange);
  target = state.current - change;
  const temp = (state.velocity + omega * change) * dt;
  state.velocity = (state.velocity - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if ((originalTo - state.current > 0) === (output > originalTo)) {
    output = originalTo;
    state.velocity = (output - originalTo) / dt;
  }
  state.current = output;
  return output;
}

function smoothDampAngle(
  state: SmoothDampState,
  target: number,
  dt: number,
  smoothTime: number
): number {
  const delta = Math.atan2(Math.sin(target - state.current), Math.cos(target - state.current));
  const newTarget = state.current + delta;
  return smoothDamp(state, newTarget, dt, smoothTime);
}

export class PortraitCameraRig {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly target: THREE.Vector3;
  private readonly smoothingTime: number;
  private readonly minPitch: number;
  private readonly maxPitch: number;
  private readonly minRadius: number;
  private readonly maxRadius: number;
  private readonly padding: number;
  private readonly verticalFovDeg: number;

  private pitchState: SmoothDampState;
  private yawState: SmoothDampState;
  private radiusState: SmoothDampState;
  private targetState: {
    current: THREE.Vector3;
    velocity: THREE.Vector3;
  };

  private viewportAspect = 16 / 9;
  private tableWidth: number;
  private tableHeight: number;

  constructor(config: CameraRigConfig) {
    const {
      camera,
      tableWidth,
      tableHeight,
      padding = DEFAULT_PADDING,
      verticalFovDeg = DEFAULT_V_FOV,
      minPitchDeg = 20,
      maxPitchDeg = 65,
      minRadius,
      maxRadius,
      smoothingTime = DEFAULT_SMOOTH_TIME,
      target
    } = config;
    this.camera = camera;
    this.tableWidth = tableWidth;
    this.tableHeight = tableHeight;
    this.padding = padding;
    this.verticalFovDeg = verticalFovDeg;
    this.smoothingTime = smoothingTime;
    this.minPitch = THREE.MathUtils.degToRad(minPitchDeg);
    this.maxPitch = THREE.MathUtils.degToRad(maxPitchDeg);
    this.minRadius = Math.max(0.1, minRadius ?? 0.1);
    this.maxRadius = Math.max(this.minRadius, maxRadius ?? this.minRadius * 1.8);
    this.target = target ? target.clone() : new THREE.Vector3();

    this.pitchState = { current: (this.minPitch + this.maxPitch) * 0.5, velocity: 0 };
    this.yawState = { current: 0, velocity: 0 };
    const initialRadius = this.computeFitRadius();
    const clampedRadius = THREE.MathUtils.clamp(initialRadius, this.minRadius, this.maxRadius);
    this.radiusState = { current: clampedRadius, velocity: 0 };
    this.targetState = {
      current: this.target.clone(),
      velocity: new THREE.Vector3()
    };
    this.camera.up.set(0, 1, 0);
    this.camera.near = Math.max(0.01, this.camera.near);
  }

  setViewport(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.viewportAspect = height / width;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setTableDimensions(width: number, height: number): void {
    if (width > 0) this.tableWidth = width;
    if (height > 0) this.tableHeight = height;
  }

  setPitchTarget(pitchRad: number): void {
    const clamped = THREE.MathUtils.clamp(pitchRad, this.minPitch, this.maxPitch);
    this.pitchState.current = clamped;
  }

  setYawTarget(yawRad: number): void {
    this.yawState.current = yawRad;
  }

  setRadiusTarget(radius: number): void {
    const fit = this.computeFitRadius();
    const min = Math.max(fit, this.minRadius);
    const max = Math.max(min, this.maxRadius);
    const clamped = THREE.MathUtils.clamp(radius, min, max);
    this.radiusState.current = clamped;
  }

  setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
    this.targetState.current.copy(target);
  }

  pan(delta: THREE.Vector3): void {
    const next = this.target.clone().add(delta);
    this.target.copy(next);
  }

  rotate(deltaYaw: number, deltaPitch: number): void {
    const nextYaw = this.yawState.current + deltaYaw;
    const nextPitch = THREE.MathUtils.clamp(
      this.pitchState.current + deltaPitch,
      this.minPitch,
      this.maxPitch
    );
    this.yawState.current = nextYaw;
    this.pitchState.current = nextPitch;
  }

  zoom(multiplier: number): void {
    const fit = this.computeFitRadius();
    const current = this.radiusState.current;
    const target = THREE.MathUtils.clamp(
      current * multiplier,
      Math.max(fit, this.minRadius),
      Math.max(fit, this.maxRadius)
    );
    this.radiusState.current = target;
  }

  computeFitRadius(pitchRad = this.pitchState.current): number {
    return computeFitRadius({
      tableWidth: this.tableWidth,
      tableHeight: this.tableHeight,
      padding: this.padding,
      verticalFovDeg: this.verticalFovDeg,
      aspect: this.viewportAspect,
      pitchRad
    });
  }

  update(dt: number): void {
    const smoothTime = this.smoothingTime;
    const fit = this.computeFitRadius();
    const minRadius = Math.max(fit, this.minRadius);
    const maxRadius = Math.max(minRadius, this.maxRadius);

    this.radiusState.current = THREE.MathUtils.clamp(this.radiusState.current, minRadius, maxRadius);
    this.pitchState.current = THREE.MathUtils.clamp(this.pitchState.current, this.minPitch, this.maxPitch);

    this.radiusState.velocity = this.radiusState.velocity || 0;
    this.pitchState.velocity = this.pitchState.velocity || 0;
    this.yawState.velocity = this.yawState.velocity || 0;

    const targetYaw = this.yawState.current;
    const targetPitch = this.pitchState.current;
    const targetRadius = THREE.MathUtils.clamp(this.radiusState.current, minRadius, maxRadius);

    const pitch = smoothDamp(
      this.pitchState,
      targetPitch,
      dt,
      smoothTime
    );
    const yaw = smoothDampAngle(
      this.yawState,
      targetYaw,
      dt,
      smoothTime
    );
    const radius = smoothDamp(
      this.radiusState,
      targetRadius,
      dt,
      smoothTime
    );

    const offset = new THREE.Vector3(
      radius * Math.cos(pitch) * Math.sin(yaw),
      radius * Math.sin(pitch),
      radius * Math.cos(pitch) * Math.cos(yaw)
    );

    const targetPos = this.target.clone();
    const targetState = this.targetState;
    const spring = THREE.MathUtils.clamp(dt / Math.max(smoothTime, 1e-3), 0, 1);
    targetState.current.lerp(targetPos, spring);

    const position = targetState.current.clone().add(offset);
    this.camera.position.copy(position);
    this.camera.lookAt(targetState.current);
    this.camera.up.set(0, 1, 0);
  }
}

export function computeCueTransform(
  cueConfig: CueRigConfig,
  camera: THREE.Camera,
  cueBallPosition: THREE.Vector3,
  cueDirection: THREE.Vector3,
  spin: SpinVector
): CueTransform {
  const { cueLength, cueTipClearance, ballRadius, maxOffsetRatio = 0.6 } = cueConfig;
  const sx = THREE.MathUtils.clamp(spin.x, -1, 1);
  const sy = THREE.MathUtils.clamp(spin.y, -1, 1);
  const offsetScale = Math.min(Math.max(maxOffsetRatio, 0), 0.7) * ballRadius;
  const offsetX = sx * offsetScale;
  const offsetY = sy * offsetScale;
  const radiusSq = ballRadius * ballRadius;
  const planarSq = offsetX * offsetX + offsetY * offsetY;
  const nz = -Math.sqrt(Math.max(0, radiusSq - planarSq));

  const tangentX = new THREE.Vector3(1, 0, 0);
  const tangentZ = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3(0, 1, 0);

  const contactPoint = cueBallPosition
    .clone()
    .addScaledVector(tangentX, offsetX)
    .addScaledVector(tangentZ, offsetY)
    .addScaledVector(normal, nz);

  const aimDir = cueDirection.clone().normalize();
  const tipPosition = contactPoint.clone();
  const buttPosition = tipPosition.clone().addScaledVector(aimDir, -(cueLength + cueTipClearance));
  const forward = aimDir.clone();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().crossVectors(up, forward);
  if (side.lengthSq() < 1e-6) {
    side.set(1, 0, 0);
  }
  side.normalize();
  up.copy(new THREE.Vector3().crossVectors(forward, side)).normalize();
  const forwardForBasis = forward.clone().negate();
  const matrix = new THREE.Matrix4().makeBasis(side, up, forwardForBasis);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);

  return {
    buttPosition,
    tipPosition,
    direction: forward,
    quaternion
  };
}
