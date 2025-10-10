import * as THREE from 'three';
import {
  computeFitRadius,
  computeCueTransform,
  PortraitCameraRig
} from '../../src/camera/PortraitCameraRig';

describe('computeFitRadius', () => {
  it('matches reference framing for portrait aspect', () => {
    const tableWidth = 3.569;
    const tableHeight = 1.778;
    const aspect = 1600 / 720;
    const pitch = THREE.MathUtils.degToRad(45);
    const radius = computeFitRadius({
      tableWidth,
      tableHeight,
      aspect,
      pitchRad: pitch,
      padding: 0.05,
      verticalFovDeg: 50
    });
    const expected = 9.107956787165353;
    expect(radius).toBeCloseTo(expected, 6);
  });
});

describe('PortraitCameraRig', () => {
  it('maintains no-crop invariant when zooming', () => {
    const camera = new THREE.PerspectiveCamera(50, 0.45, 0.05, 1000);
    const rig = new PortraitCameraRig({
      camera,
      tableWidth: 3.569,
      tableHeight: 1.778,
      minRadius: 1,
      maxRadius: 6,
      padding: 0.05,
      verticalFovDeg: 50
    });
    rig.setViewport(720, 1600);
    rig.zoom(0.2);
    rig.update(1 / 60);
    const radiusAfter = camera.position.length();
    const fit = rig.computeFitRadius();
    expect(radiusAfter).toBeGreaterThanOrEqual(fit - 1e-5);
  });
});

describe('computeCueTransform', () => {
  it('maps spin extremes to valid contact points', () => {
    const cueConfig = {
      cueLength: 1.4,
      cueTipClearance: 0.05,
      ballRadius: 0.0285,
      maxOffsetRatio: 0.6
    };
    const camera = new THREE.PerspectiveCamera();
    const ballPos = new THREE.Vector3();
    const cueDir = new THREE.Vector3(0, 0, -1);
    const spin = { x: 1, y: 1 };
    const result = computeCueTransform(cueConfig, camera, ballPos, cueDir, spin);
    const tipDistance = result.tipPosition.distanceTo(ballPos);
    expect(tipDistance).toBeCloseTo(cueConfig.ballRadius, 3);
    const forward = result.direction.clone().normalize();
    expect(forward.z).toBeLessThan(0);
    const buttDistance = result.buttPosition.distanceTo(result.tipPosition);
    expect(buttDistance).toBeCloseTo(cueConfig.cueLength + cueConfig.cueTipClearance, 3);
  });
});
