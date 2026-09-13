import * as THREE from 'three';

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
    support: [profile.supportX * size.x, profile.pistol ? grip.y : box.min.y + size.y * 0.5, profile.pistol ? size.z * 0.55 : 0],
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
  return { grip, muzzle, stock, support: point('support'), up, pistol: !!meta.pistol };
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
