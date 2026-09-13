import * as THREE from 'three';

// Measurements in the shipped Poly models' authored frame (before centering).
// These assets have a single mesh split by material, not named grip sockets.
const POLY_CONTACTS: Record<string, { min: number[]; max: number[]; grip: number[]; support: number[]; muzzle: number[]; trigger: number[] }> = {
  polyAssaultRifle01Attack: { min: [-1.605,-0.742,-0.098], max: [3.817,0.86,0.098], grip: [-0.03,0.02,0], support: [1.65,0.47,0], muzzle: [3.817,0.6,0], trigger: [0.42,0.19,0] },
  polyPistol01Attack: { min: [-0.34,-0.408,-0.162], max: [1.48,0.754,0.162], grip: [-0.04,-0.08,0], support: [-0.08,-0.13,0.19], muzzle: [1.48,0.53,0], trigger: [0.37,0.18,0] },
  polyShotgun01Attack: { min: [-1.435,-0.568,-0.123], max: [4.35,0.381,0.123], grip: [0.12,-0.1,0], support: [1.25,0.02,0], muzzle: [4.35,0.22,0], trigger: [0.49,-0.22,0] }
};

export function snakeWeaponProfile(id: string) {
  const handheld = !/tank|robot|dynamite|molotov|handgrenade/i.test(id);
  const pistol = /pistol|glock|revolver|sidearm|smith|sigsauer/i.test(id);
  const smg = /smg|uzi|krsv/i.test(id);
  const long = /sniper|mosin|marksman|shotgun|sawed/i.test(id);
  // Overall lengths relative to the seated character's shoulder-to-wrist length.
  return { handheld, pistol, lengthInArms: pistol ? 0.38 : smg ? 0.8 : long ? 1.48 : 1.22,
    gripX: pistol ? -0.2 : -0.16, supportX: pistol ? -0.16 : long ? 0 : 0.06 };
}

/** Preserve the imported model's scale. Its wrapper owns the presentation size. */
export function prepareSnakeFirearm(model: THREE.Object3D, id: string, length: number, reversed = false) {
  const bakedHands: THREE.Object3D[] = [];
  model.traverse(object => {
    if ((object as THREE.Mesh).isMesh && /(^|[_ .])(arms?|hands?|sleeves?|gloves?)([_ .]|$)/i.test(object.name)) bakedHands.push(object);
  });
  bakedHands.forEach(object => object.removeFromParent());
  const root = new THREE.Group(); root.add(model);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  if (size.z > size.x && size.z > size.y) root.rotation.y = Math.PI / 2;
  else if (size.y > size.x && size.y > size.z) root.rotation.z = -Math.PI / 2;
  if (reversed) root.rotateY(Math.PI);
  // Bake alignment into an inner wrapper, leaving the public frame +X muzzle, +Y up.
  const canonical = new THREE.Group(); canonical.add(root);
  canonical.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(canonical); size = box.getSize(new THREE.Vector3());
  canonical.scale.setScalar(length / Math.max(size.x, 0.001));
  canonical.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(canonical);
  const center = box.getCenter(new THREE.Vector3());
  // Center via a parent so existing model transforms remain intact.
  const presentation = new THREE.Group(); presentation.add(canonical);
  canonical.position.sub(center);
  presentation.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(presentation); size = box.getSize(new THREE.Vector3());
  const profile = snakeWeaponProfile(id);
  const muzzle = new THREE.Vector3(box.max.x, box.min.y + size.y * 0.78, 0);
  const grip = new THREE.Vector3(profile.gripX * size.x, box.min.y + size.y * 0.3, 0);
  const authoredName = { polyAssaultRifle01Attack: 'AssaultRifle_2', polyPistol01Attack: 'Pistol_1', polyShotgun01Attack: 'Shotgun_2' }[id];
  const measured = authoredName && model.getObjectByName(authoredName) ? POLY_CONTACTS[id] : null;
  const measuredPoint = (key: 'grip' | 'support' | 'muzzle' | 'trigger') => {
    const center = new THREE.Vector3().fromArray(measured.min).add(new THREE.Vector3().fromArray(measured.max)).multiplyScalar(0.5);
    return new THREE.Vector3().fromArray(measured[key]).sub(center).multiplyScalar(size.x / (measured.max[0] - measured.min[0]));
  };
  const support = new THREE.Vector3(profile.supportX * size.x, profile.pistol ? grip.y : box.min.y + size.y * 0.5, profile.pistol ? size.z * 0.55 : 0);
  const trigger = grip.clone().add(new THREE.Vector3(size.x * (profile.pistol ? 0.17 : 0.08), size.y * 0.18, 0));
  if (measured) { grip.copy(measuredPoint('grip')); support.copy(measuredPoint('support')); muzzle.copy(measuredPoint('muzzle')); trigger.copy(measuredPoint('trigger')); }
  // Prefer explicit authored sockets. Mesh origins often sit at (0,0,0), so only
  // named sockets or measured grip meshes are usable contact evidence.
  presentation.traverse(object => {
    const name = object.name.toLowerCase();
    if (/muzzle(socket|point|tip)|barrel_end/.test(name)) muzzle.copy(presentation.worldToLocal(object.getWorldPosition(new THREE.Vector3())));
    if (/^(grip|pistol_grip|trigger_grip|handle)$|trigger.?handle|pistol.?grip/.test(name) && (object as THREE.Mesh).isMesh) {
      const point = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
      grip.copy(presentation.worldToLocal(point));
    }
  });
  presentation.userData.snakeGrip = {
    grip: grip.toArray(), muzzle: muzzle.toArray(),
    support: support.toArray(), trigger: trigger.toArray(), gripRadius: size.z * 0.5,
    stock: [box.min.x + size.x * 0.04, muzzle.y, 0],
    up: [0, 1, 0], pistol: profile.pistol, length: size.x
  };
  return presentation;
}

export function readSnakeWeaponContacts(object: THREE.Object3D) {
  let node: THREE.Object3D | null = null;
  object.traverse(child => { if (child.userData.snakeGrip && !node) node = child; });
  if (!node) return null;
  const source = node as THREE.Object3D;
  const meta = source.userData.snakeGrip;
  const point = (key: string) => source.localToWorld(new THREE.Vector3().fromArray(meta[key]));
  const grip = point('grip'), muzzle = point('muzzle'), stock = point('stock');
  const up = new THREE.Vector3().fromArray(meta.up).transformDirection(source.matrixWorld);
  return { grip, muzzle, stock, support: point('support'), trigger: meta.trigger ? point('trigger') : grip.clone(), gripRadius: (meta.gripRadius ?? 0.03) * source.getWorldScale(new THREE.Vector3()).z, up, pistol: !!meta.pistol };
}

export function snakeAimQuaternion(origin: THREE.Vector3, target: THREE.Vector3, boreOffset: number) {
  const delta = target.clone().sub(origin);
  const yaw = Math.atan2(delta.z, delta.x);
  const pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z)) -
    Math.asin(THREE.MathUtils.clamp(boreOffset / Math.max(delta.length(), 0.001), -0.95, 0.95));
  const x = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  const z = new THREE.Vector3().crossVectors(x, new THREE.Vector3(0, 1, 0)).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, z.clone().cross(x), z));
}
