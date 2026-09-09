import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export type CueReachProfile = {
  needsExtension: boolean;
  rearRailDistance: number;
  normalReach: number;
  longAxisAlignment: number;
  farSideThreshold: number;
  extensionLength: number;
};

export type CueReachEquipment = {
  group: THREE.Group;
  extension: THREE.Group;
  rest: THREE.Group;
  extensionShaft: THREE.Mesh;
  extensionFrontCollar: THREE.Mesh;
  extensionRearCollar: THREE.Mesh;
  extensionCap: THREE.Mesh;
  restPole: THREE.Mesh;
  restCrossbar: THREE.Mesh;
  restProngs: THREE.Mesh[];
};

export type CueReachPose = {
  restGrip: THREE.Vector3;
  restDirection: THREE.Vector3;
};

const finitePositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * Distance from the cue ball to the short rail behind the shot direction.
 *
 * A mechanical rest is reached from an end of the table, never from whichever
 * side cushion a ray happens to intersect first. Returning zero for a shot
 * perpendicular to the long axis also prevents the extension appearing during
 * ordinary side-rail shots.
 */
export function distanceToRearRail(
  cueBall: THREE.Vector3,
  aimForward: THREE.Vector3,
  tableW: number,
  tableL: number
) {
  const width = finitePositive(tableW, 1);
  const length = finitePositive(tableL, 1);
  const forward = aimForward.clone().setY(0);
  if (!Number.isFinite(forward.lengthSq()) || forward.lengthSq() < 1e-8) return 0;
  forward.normalize();
  const longSideIsX = width > length;
  const component = longSideIsX ? forward.x : forward.z;
  if (Math.abs(component) < 1e-8) return 0;
  const coordinate = longSideIsX ? cueBall.x : cueBall.z;
  const longSide = longSideIsX ? width : length;
  // The player stands behind -forward, so a positive aim component uses the
  // negative short rail and vice versa.
  return component > 0
    ? THREE.MathUtils.clamp(coordinate + longSide / 2, 0, longSide)
    : THREE.MathUtils.clamp(longSide / 2 - coordinate, 0, longSide);
}

/** Select reach equipment from table geometry, independent of camera or input. */
export function resolveCueReachProfile({
  cueBall,
  aimForward,
  tableW,
  tableL
}: {
  cueBall: THREE.Vector3;
  aimForward: THREE.Vector3;
  tableW: number;
  tableL: number;
}): CueReachProfile {
  const width = finitePositive(tableW, 1);
  const length = finitePositive(tableL, 1);
  const shortSide = Math.min(width, length);
  const longSide = Math.max(width, length);
  const forward = aimForward.clone().setY(0);
  const validAim = Number.isFinite(forward.lengthSq()) && forward.lengthSq() >= 1e-8;
  if (validAim) forward.normalize();
  const longAxisAlignment = validAim
    ? Math.abs(width > length ? forward.x : forward.z)
    : 0;
  const rearRailDistance = distanceToRearRail(cueBall, aimForward, tableW, tableL);
  // An adult can bridge roughly three quarters of the table width from an end
  // rail. Requiring the cue ball to be beyond the table midpoint models the
  // explicit short-rail-to-opposite-half situation requested by the game.
  const normalReach = shortSide * 0.74;
  const farSideThreshold = Math.max(normalReach, longSide * 0.55);
  const overreach = Math.max(0, rearRailDistance - normalReach);
  const needsExtension = longAxisAlignment >= 0.72 && rearRailDistance > farSideThreshold;
  const extensionLength = needsExtension
    ? THREE.MathUtils.clamp(overreach * 0.55, shortSide * 0.14, shortSide * 0.34)
    : 0;
  return {
    needsExtension,
    rearRailDistance,
    normalReach,
    longAxisAlignment,
    farSideThreshold,
    extensionLength
  };
}

function segment(mesh: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3, radius: number) {
  const direction = end.clone().sub(start);
  const length = Math.max(direction.length(), 1e-5);
  mesh.position.copy(start).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.scale.set(radius, length, radius);
}

function unitCylinder(material: THREE.Material, radialSegments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, radialSegments, 1), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Original procedural model: telescopic butt extension plus brass cross-head rest. */
export function createCueReachEquipment(): CueReachEquipment {
  const group = new THREE.Group();
  group.name = 'CueReachEquipment';
  const extension = new THREE.Group();
  extension.name = 'TelescopicCueExtension';
  const rest = new THREE.Group();
  rest.name = 'MechanicalCueRest';
  group.add(extension, rest);

  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.28,
    metalness: 0.35,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18
  });
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xc99a35,
    roughness: 0.2,
    metalness: 0.92,
    clearcoat: 0.35
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.88 });
  const ash = new THREE.MeshPhysicalMaterial({
    color: 0xc79862,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.3
  });

  const extensionShaft = unitCylinder(carbon, 32);
  const extensionFrontCollar = unitCylinder(brass, 32);
  const extensionRearCollar = unitCylinder(brass, 32);
  const extensionCap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), rubber);
  extensionCap.castShadow = true;
  extension.add(extensionShaft, extensionFrontCollar, extensionRearCollar, extensionCap);

  const restPole = unitCylinder(ash, 24);
  const restCrossbar = unitCylinder(brass, 28);
  const restProngs = Array.from({ length: 4 }, () => unitCylinder(brass, 20));
  rest.add(restPole, restCrossbar, ...restProngs);
  group.visible = false;
  return {
    group,
    extension,
    rest,
    extensionShaft,
    extensionFrontCollar,
    extensionRearCollar,
    extensionCap,
    restPole,
    restCrossbar,
    restProngs
  };
}

export function poseCueReachEquipment(
  equipment: CueReachEquipment,
  {
    cueBack,
    cueTip,
    cueBall,
    aimForward,
    rootTarget,
    clothY,
    profile,
    scale
  }: {
    cueBack: THREE.Vector3;
    cueTip: THREE.Vector3;
    cueBall: THREE.Vector3;
    aimForward: THREE.Vector3;
    rootTarget: THREE.Vector3;
    clothY: number;
    profile: CueReachProfile;
    scale: number;
  }
): CueReachPose | null {
  equipment.group.visible = profile.needsExtension;
  if (!profile.needsExtension) return null;

  const cueAxis = cueTip.clone().sub(cueBack);
  if (!Number.isFinite(cueAxis.lengthSq()) || cueAxis.lengthSq() < 1e-8) {
    equipment.group.visible = false;
    return null;
  }
  cueAxis.normalize();
  const forward = aimForward.clone().setY(0).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const unitScale = finitePositive(scale, 1);

  const extensionFront = cueBack.clone().addScaledVector(cueAxis, 0.018 * unitScale);
  const extensionRear = cueBack.clone().addScaledVector(cueAxis, -profile.extensionLength);
  segment(equipment.extensionShaft, extensionRear, extensionFront, 0.019 * unitScale);
  segment(
    equipment.extensionFrontCollar,
    cueBack.clone().addScaledVector(cueAxis, -0.035 * unitScale),
    cueBack.clone().addScaledVector(cueAxis, 0.025 * unitScale),
    0.026 * unitScale
  );
  segment(
    equipment.extensionRearCollar,
    extensionRear.clone().addScaledVector(cueAxis, -0.012 * unitScale),
    extensionRear.clone().addScaledVector(cueAxis, 0.045 * unitScale),
    0.023 * unitScale
  );
  equipment.extensionCap.position.copy(extensionRear).addScaledVector(cueAxis, -0.014 * unitScale);
  equipment.extensionCap.scale.set(0.023, 0.023, 0.023).multiplyScalar(unitScale);

  const restHead = cueBall.clone().addScaledVector(cueAxis, -0.24 * unitScale);
  restHead.y = Math.max(clothY + 0.038 * unitScale, cueTip.y - 0.052 * unitScale);
  const restGrip = rootTarget.clone().addScaledVector(forward, 0.52 * unitScale)
    .addScaledVector(side, -0.08 * unitScale);
  restGrip.y = clothY + 0.13 * unitScale;
  const restHandle = rootTarget.clone().addScaledVector(forward, 0.2 * unitScale)
    .addScaledVector(side, -0.08 * unitScale);
  restHandle.y = clothY + 0.115 * unitScale;
  segment(equipment.restPole, restHandle, restHead, 0.011 * unitScale);

  const crossHalf = 0.095 * unitScale;
  segment(
    equipment.restCrossbar,
    restHead.clone().addScaledVector(side, -crossHalf),
    restHead.clone().addScaledVector(side, crossHalf),
    0.012 * unitScale
  );
  const prongOffsets = [-0.085, -0.035, 0.035, 0.085];
  equipment.restProngs.forEach((prong, index) => {
    const base = restHead.clone().addScaledVector(side, prongOffsets[index] * unitScale);
    const outward = Math.sign(prongOffsets[index]) || (index < 2 ? -1 : 1);
    const top = base.clone()
      .addScaledVector(UP, 0.075 * unitScale)
      .addScaledVector(side, outward * 0.016 * unitScale);
    segment(prong, base, top, 0.009 * unitScale);
  });

  const restDirection = restHead.clone().sub(restHandle).normalize();
  return { restGrip, restDirection };
}

export function hideCueReachEquipment(equipment: CueReachEquipment) {
  equipment.group.visible = false;
}
