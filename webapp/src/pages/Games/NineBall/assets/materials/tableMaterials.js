import * as THREE from 'three';

export function createTableMaterials({ clothColor, railColor, frameColor, metalColor }) {
  const cloth = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(clothColor),
    roughness: 0.32,
    metalness: 0.02,
    sheen: 0.45,
    sheenRoughness: 0.28
  });

  const rails = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(railColor),
    roughness: 0.58,
    metalness: 0.08
  });

  const frame = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(frameColor),
    roughness: 0.5,
    metalness: 0.06
  });

  const chrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(metalColor),
    roughness: 0.16,
    metalness: 0.88
  });

  const floor = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0c101c'),
    roughness: 0.78,
    metalness: 0.02
  });

  return { cloth, rails, frame, chrome, floor };
}
