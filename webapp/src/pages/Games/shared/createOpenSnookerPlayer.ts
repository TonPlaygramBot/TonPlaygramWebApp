// SPDX-License-Identifier: MIT
// Original source-generated snooker characters. No downloaded model or likeness.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getPoolRoyalPlayer } from '../../../config/poolRoyalPlayers.js';

/** An original articulated humanoid with 17 body joints and 40 finger joints.
 * Geometry is batched by material and bound once; both seats own their skeleton. */
export function createOpenSnookerPlayer(profileId = 'alex'): THREE.Group {
  const profile = getPoolRoyalPlayer(profileId);
  const root = new THREE.Group();
  root.name = `OpenSnookerPlayer_${profile.id}`;
  root.userData = {
    license: 'MIT',
    author: 'TonPlaygram contributors',
    profileId: profile.id
  };
  const bones: THREE.Bone[] = [];
  const parts = new Map<string, THREE.BufferGeometry[]>();
  const material = {
    skin: new THREE.MeshStandardMaterial({
      color: profile.skin,
      roughness: 0.7
    }),
    face: new THREE.MeshStandardMaterial({
      color: profile.skin,
      roughness: 0.7
    }),
    shirt: new THREE.MeshStandardMaterial({ color: 0xeee9db, roughness: 0.8 }),
    vest: new THREE.MeshStandardMaterial({
      color: profile.waistcoat,
      roughness: 0.78
    }),
    trousers: new THREE.MeshStandardMaterial({
      color: 0x191e24,
      roughness: 0.82
    }),
    hair: new THREE.MeshStandardMaterial({
      color: profile.hair,
      roughness: 0.9
    }),
    eyes: new THREE.MeshStandardMaterial({ color: 0x292c2c, roughness: 0.3 }),
    buttons: new THREE.MeshStandardMaterial({
      color: 0xc9b780,
      metalness: 0.55,
      roughness: 0.3
    })
  };
  const joint = (
    name: string,
    parent: THREE.Object3D,
    x: number,
    y: number,
    z = 0
  ) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    bones.push(bone);
    return bone;
  };
  const hips = joint('Hips', root, 0, 0.94);
  const spine = joint('Spine', hips, 0, 0.13);
  const chest = joint('Spine2', spine, 0, 0.22);
  const neck = joint('Neck', chest, 0, 0.2);
  const head = joint('Head', neck, 0, 0.095);
  joint('LeftEye', head, -0.034, 0.075, 0.089);
  joint('RightEye', head, 0.034, 0.075, 0.089);
  const limbs: {
    bone: THREE.Bone;
    child: THREE.Bone;
    radius: number;
    key: string;
  }[] = [];
  const hands: THREE.Bone[] = [];
  for (const [prefix, sign] of [
    ['Left', 1],
    ['Right', -1]
  ] as const) {
    const arm = joint(`${prefix}Arm`, chest, sign * 0.205, 0.145);
    const forearm = joint(`${prefix}ForeArm`, arm, sign * 0.275, -0.035);
    const hand = joint(`${prefix}Hand`, forearm, sign * 0.25, -0.025);
    hand.rotation.z = (-sign * Math.PI) / 2;
    hands.push(hand);
    limbs.push(
      { bone: arm, child: forearm, radius: 0.046, key: 'shirt' },
      { bone: forearm, child: hand, radius: 0.035, key: 'shirt' }
    );
    for (const [index, digit] of [
      'Thumb',
      'Index',
      'Middle',
      'Ring',
      'Pinky'
    ].entries()) {
      const digitX = (index - 2) * 0.017;
      let parent = hand;
      for (let segment = 1; segment <= 4; segment++) {
        const finger = joint(
          `${prefix}Hand${digit}${segment}`,
          parent,
          segment === 1 ? digitX : 0,
          segment === 1 ? 0.073 - Math.abs(index - 2) * 0.012 : 0.022,
          segment === 1 ? 0.005 : 0
        );
        if (segment > 1)
          limbs.push({
            bone: parent,
            child: finger,
            radius: 0.008 - segment * 0.0006,
            key: 'skin'
          });
        parent = finger;
      }
    }
    const thigh = joint(`${prefix}UpLeg`, hips, sign * 0.09, -0.04);
    const calf = joint(`${prefix}Leg`, thigh, 0, -0.42);
    const foot = joint(`${prefix}Foot`, calf, 0, -0.4);
    const toe = joint(`${prefix}ToeBase`, foot, 0, -0.015, 0.12);
    limbs.push(
      { bone: thigh, child: calf, radius: 0.073, key: 'trousers' },
      { bone: calf, child: foot, radius: 0.048, key: 'trousers' },
      { bone: foot, child: toe, radius: 0.047, key: 'trousers' }
    );
  }
  root.updateMatrixWorld(true);
  const bind = (
    geometry: THREE.BufferGeometry,
    bone: THREE.Bone,
    key: string
  ) => {
    geometry.applyMatrix4(bone.matrixWorld);
    const count = geometry.attributes.position.count;
    const indices = new Uint16Array(count * 4),
      weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      indices[i * 4] = bones.indexOf(bone);
      weights[i * 4] = 1;
    }
    geometry.setAttribute(
      'skinIndex',
      new THREE.Uint16BufferAttribute(indices, 4)
    );
    geometry.setAttribute(
      'skinWeight',
      new THREE.Float32BufferAttribute(weights, 4)
    );
    if (!parts.has(key)) parts.set(key, []);
    parts.get(key)!.push(geometry);
  };
  const oval = (
    bone: THREE.Bone,
    key: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number
  ) => {
    const geometry = new THREE.SphereGeometry(1, 16, 12);
    geometry.scale(sx, sy, sz).translate(x, y, z);
    bind(geometry, bone, key);
  };
  for (const { bone, child, radius, key } of limbs) {
    const end = child.position.clone();
    const geometry = new THREE.CapsuleGeometry(
      radius,
      Math.max(0.001, end.length() - radius * 1.4),
      4,
      12
    );
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.clone().normalize()
      )
    );
    geometry.translate(end.x / 2, end.y / 2, end.z / 2);
    bind(geometry, bone, key);
  }
  oval(hips, 'trousers', 0, 0.005, 0, 0.16, 0.13, 0.105);
  oval(spine, 'shirt', 0, 0.07, 0, 0.173, 0.22, 0.105);
  oval(chest, 'shirt', 0, 0.085, 0, 0.205, 0.14, 0.107);
  oval(spine, 'vest', 0, 0.07, 0.025, 0.176, 0.225, 0.105);
  oval(chest, 'vest', 0, 0.025, 0.025, 0.19, 0.105, 0.106);
  oval(neck, 'skin', 0, 0.025, 0, 0.047, 0.07, 0.048);
  oval(head, 'face', 0, 0.06, 0, 0.087, 0.122, 0.095);
  oval(head, 'hair', 0, 0.135, -0.015, 0.089, 0.055, 0.09);
  oval(head, 'face', -0.087, 0.055, 0, 0.015, 0.029, 0.018);
  oval(head, 'face', 0.087, 0.055, 0, 0.015, 0.029, 0.018);
  oval(head, 'face', 0, 0.055, 0.088, 0.019, 0.027, 0.021);
  for (const x of [-0.034, 0.034])
    oval(head, 'eyes', x, 0.08, 0.089, 0.012, 0.009, 0.006);
  for (const x of [-0.027, 0.027])
    oval(neck, 'trousers', x, -0.027, 0.058, 0.03, 0.021, 0.012);
  for (const y of [-0.07, 0.015, 0.1])
    oval(spine, 'buttons', 0, y, 0.13, 0.007, 0.007, 0.004);
  for (const hand of hands)
    oval(hand, 'skin', 0, 0.035, 0, 0.042, 0.053, 0.016);
  const skeleton = new THREE.Skeleton(bones);
  for (const [key, geometries] of parts) {
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach((part) => part.dispose());
    const mesh = new THREE.SkinnedMesh(
      geometry,
      material[key as keyof typeof material]
    );
    mesh.name = ['face', 'hair', 'eyes'].includes(key)
      ? `OpenSnookerHead_${key}`
      : `OpenSnooker_${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton);
  }
  return root;
}
