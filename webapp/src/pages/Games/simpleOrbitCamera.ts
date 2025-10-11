// @ts-nocheck
import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;
const MIN_THETA = 30 * DEG2RAD;
const MAX_THETA = 55 * DEG2RAD;
const DEFAULT_THETA = 35 * DEG2RAD;
const MAX_SMOOTH_STEP = 1 / 30;

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
  const hx = 0.5 * tableWidth * 1.05;
  const hz = 0.5 * tableHeight * 1.05;
  const rW = hx / Math.tan(hFov / 2);
  const cosTheta = Math.max(Math.cos(thetaRad), 1e-4);
  const rH = (hz / cosTheta) / Math.tan(vFov / 2);
  return Math.max(rW, rH) * 1.02;
}

type CameraOptions = {
  target?: THREE.Vector3;
  theta?: number;
  phi?: number;
  radius?: number;
};

export class MobilePortraitCameraRig {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Vector3;
  private theta: number;
  private phi: number;
  private radius: number;
  private thetaTarget: number;
  private phiTarget: number;
  private radiusTarget: number;
  private viewWidth: number;
  private viewHeight: number;
  private tableWidth: number;
  private tableHeight: number;
  private lastUpdate = performance.now();

  constructor(camera: THREE.PerspectiveCamera, options: CameraOptions = {}) {
    this.camera = camera;
    this.camera.fov = 50;
    this.camera.near = 0.05;
    this.camera.far = 1000;
    this.target = options.target ? options.target.clone() : new THREE.Vector3();
    this.theta = options.theta ?? DEFAULT_THETA;
    this.phi = options.phi ?? Math.PI;
    this.radius = options.radius ?? 6;
    this.thetaTarget = this.theta;
    this.phiTarget = this.phi;
    this.radiusTarget = this.radius;
    this.viewWidth = 1;
    this.viewHeight = 1;
    this.tableWidth = 3.6;
    this.tableHeight = 7.2;
    this.camera.up.copy(sharedUp);
    this.camera.lookAt(this.target);
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

  setTableDimensions(width: number, height: number) {
    if (width > 0) this.tableWidth = width;
    if (height > 0) this.tableHeight = height;
  }

  orbit(deltaPhi: number, deltaTheta: number) {
    this.phiTarget += deltaPhi;
    this.thetaTarget = clamp(this.thetaTarget + deltaTheta, MIN_THETA, MAX_THETA);
  }

  setPhiTarget(value: number) {
    if (!Number.isFinite(value)) return;
    this.phiTarget = value;
  }

  zoomBy(scale: number) {
    if (!Number.isFinite(scale) || scale === 0) return;
    const clamped = clamp(scale, 0.5, 2);
    this.radiusTarget *= 1 / clamped;
  }

  setRadiusTarget(value: number) {
    if (!Number.isFinite(value)) return;
    this.radiusTarget = value;
  }

  update(now: number) {
    const dtMs = Math.min(now - this.lastUpdate, MAX_SMOOTH_STEP * 1000);
    this.lastUpdate = now;
    const dt = dtMs / 1000;

    const fit = computeRFit(
      this.viewHeight,
      this.viewWidth,
      this.tableWidth,
      this.tableHeight,
      this.thetaTarget
    );
    const minRadius = fit;
    const maxRadius = fit * 1.5;
    if (!Number.isFinite(this.radiusTarget)) {
      this.radiusTarget = minRadius;
    }
    this.radiusTarget = clamp(this.radiusTarget, minRadius, maxRadius);
    if (this.radius < 1e-3) this.radius = this.radiusTarget;

    const smooth = 1 - Math.pow(1 - 0.18, Math.max(dt * 60, 1));
    this.theta += (clamp(this.thetaTarget, MIN_THETA, MAX_THETA) - this.theta) * smooth;
    this.phi += angleDelta(this.phiTarget, this.phi) * smooth;
    this.radius += (this.radiusTarget - this.radius) * smooth;

    const cosTheta = Math.cos(this.theta);
    const sinTheta = Math.sin(this.theta);
    const x = this.radius * cosTheta * Math.sin(this.phi);
    const y = this.radius * sinTheta;
    const z = this.radius * cosTheta * Math.cos(this.phi);
    this.camera.position.set(x + this.target.x, y + this.target.y, z + this.target.z);
    this.camera.up.copy(sharedUp);
    this.camera.lookAt(this.target);
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
