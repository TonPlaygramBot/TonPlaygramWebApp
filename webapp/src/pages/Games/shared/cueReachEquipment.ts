import * as THREE from 'three';
import meshData from './cueReachMeshes.ts';

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
  extensionInner: THREE.Mesh;
  extensionLock: THREE.Mesh;
  extensionFrontCollar: THREE.Mesh;
  extensionRearCollar: THREE.Mesh;
  extensionCap: THREE.Mesh;
  restPole: THREE.Mesh;
  restHead: THREE.Mesh;
  restSocket: THREE.Mesh;
  restFeet: THREE.Mesh[];
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

type PartName = keyof typeof meshData.meshes;

function blenderPart(name: PartName, material: THREE.Material): THREE.Mesh {
  const data = meshData.meshes[name];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
  geometry.setIndex(data.index);
  const uv: number[] = [];
  for (let i = 0; i < data.position.length; i += 3) {
    uv.push(Math.atan2(data.position[i + 2], data.position[i]) / (2 * Math.PI) + .5,
      data.position[i + 1] + .5);
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `BlenderCueReach_${name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Small deterministic grain/weave maps; no network assets or large textures. */
function surfaceTexture(wood: boolean): THREE.DataTexture {
  const width = 64, height = 256;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    const grain = Math.sin(x * 1.8 + Math.sin(y * .028) * 1.6);
    const weave = ((Math.floor(x / 4) + Math.floor(y / 8)) % 2) * 8 +
      Math.sin((x + y) * 1.5) * 2;
    const rgb = wood ? [181 + grain * 15, 133 + grain * 14, 78 + grain * 10]
      : [20 + weave, 23 + weave, 26 + weave];
    data.set([...rgb.map(Math.round), 255], i);
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Blender-authored, bevelled telescopic extension and cast cross-head rest. */
export function createCueReachEquipment(): CueReachEquipment {
  const group = new THREE.Group();
  group.name = 'CueReachEquipment';
  const extension = new THREE.Group();
  extension.name = 'TelescopicCueExtension';
  const rest = new THREE.Group();
  rest.name = 'MechanicalCueRest';
  group.add(extension, rest);
  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: surfaceTexture(false), roughness: .34, metalness: .16,
    clearcoat: .36, clearcoatRoughness: .28
  });
  const anodised = new THREE.MeshPhysicalMaterial({
    color: 0x30343a, roughness: .32, metalness: .65, clearcoat: .2
  });
  const brass = new THREE.MeshPhysicalMaterial({
    color: 0xcba458, roughness: .26, metalness: .82, clearcoat: .24
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x191b1c, roughness: .94 });
  const ash = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: surfaceTexture(true), roughness: .43, clearcoat: .25
  });
  const extensionShaft = blenderPart('tube', carbon);
  const extensionInner = blenderPart('inner', anodised);
  const extensionLock = blenderPart('lock', rubber);
  const extensionFrontCollar = blenderPart('collar', brass);
  const extensionRearCollar = blenderPart('collar', anodised);
  const extensionCap = blenderPart('cap', rubber);
  extension.add(extensionShaft, extensionInner, extensionLock,
    extensionFrontCollar, extensionRearCollar, extensionCap);
  const restPole = blenderPart('handle', ash);
  const restHead = blenderPart('head', brass);
  const restSocket = blenderPart('collar', brass);
  const restFeet = [blenderPart('foot', rubber), blenderPart('foot', rubber)];
  rest.add(restPole, restHead, restSocket, ...restFeet);
  group.visible = false;
  return { group, extension, rest, extensionShaft, extensionInner, extensionLock,
    extensionFrontCollar, extensionRearCollar, extensionCap,
    restPole, restHead, restSocket, restFeet };
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

  const extensionRear = cueBack.clone().addScaledVector(cueAxis, -profile.extensionLength);
  const sleeveEnd = extensionRear.clone().addScaledVector(cueAxis, profile.extensionLength * .60);
  const axisSegment = (mesh: THREE.Mesh, center: THREE.Vector3, length: number, radius: number) =>
    segment(mesh, center.clone().addScaledVector(cueAxis, -length / 2),
      center.clone().addScaledVector(cueAxis, length / 2), radius);
  segment(equipment.extensionShaft, extensionRear, sleeveEnd, .018 * unitScale);
  segment(equipment.extensionInner,
    sleeveEnd.clone().addScaledVector(cueAxis, -.035 * unitScale), cueBack, .0135 * unitScale);
  axisSegment(equipment.extensionLock, sleeveEnd, .034 * unitScale, .0205 * unitScale);
  axisSegment(equipment.extensionFrontCollar, cueBack, .022 * unitScale, .019 * unitScale);
  axisSegment(equipment.extensionRearCollar, extensionRear, .014 * unitScale, .0185 * unitScale);
  axisSegment(equipment.extensionCap,
    extensionRear.clone().addScaledVector(cueAxis, -.010 * unitScale),
    .012 * unitScale, .018 * unitScale);

  // The rest stays on the cloth while the cue slides along its actual axis.
  const support = cueBall.clone().addScaledVector(forward, -.24 * unitScale);
  const horizontalAxisSq = cueAxis.x * cueAxis.x + cueAxis.z * cueAxis.z;
  const along = ((support.x - cueTip.x) * cueAxis.x +
    (support.z - cueTip.z) * cueAxis.z) / Math.max(horizontalAxisSq, 1e-8);
  const shaftY = cueTip.y + cueAxis.y * along;
  const footHeight = .006 * unitScale;
  const shaftRadius = .007 * unitScale;
  const headScale = Math.max(.15 * unitScale,
    (shaftY - shaftRadius - clothY - footHeight) / (meshData.head.cradleY - meshData.head.footY));
  const headCenter = support.clone();
  headCenter.y = clothY + footHeight - meshData.head.footY * headScale;
  equipment.restHead.position.copy(headCenter);
  equipment.restHead.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, UP, forward));
  equipment.restHead.scale.setScalar(headScale);
  equipment.restFeet.forEach((foot, index) => {
    foot.position.copy(headCenter).addScaledVector(side, (index === 0 ? -1 : 1) * .052 * headScale);
    foot.position.y = clothY + footHeight / 2;
    foot.quaternion.identity();
    foot.scale.set(.012 * headScale, footHeight, .011 * headScale);
  });
  const socket = headCenter.clone();
  socket.y += meshData.head.socketY * headScale;
  const restHandle = rootTarget.clone().addScaledVector(forward, .2 * unitScale)
    .addScaledVector(side, -.08 * unitScale);
  restHandle.y = clothY + .16 * unitScale;
  const restDirection = socket.clone().sub(restHandle).normalize();
  segment(equipment.restPole, restHandle, socket, .011 * unitScale);
  segment(equipment.restSocket, socket.clone().addScaledVector(restDirection, -.040 * unitScale),
    socket, .012 * unitScale);
  // Solve the hand directly on the tapered handle, rather than beside it.
  const restGrip = restHandle.clone().lerp(socket, Math.min(.32 * unitScale / restHandle.distanceTo(socket), .4));

  return { restGrip, restDirection };
}

export function hideCueReachEquipment(equipment: CueReachEquipment) {
  equipment.group.visible = false;
}
