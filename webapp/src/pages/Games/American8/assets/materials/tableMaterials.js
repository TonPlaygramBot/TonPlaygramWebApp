import * as THREE from 'three';

export function createTableMaterials({ clothColor, railColor, frameColor, metalColor }) {
  const cloth = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(clothColor),
    roughness: 0.34,
    metalness: 0.03,
    sheen: 0.48,
    sheenRoughness: 0.26
  });

  const rails = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(railColor),
    roughness: 0.57,
    metalness: 0.12
  });

  const frame = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(frameColor),
    roughness: 0.52,
    metalness: 0.07
  });

  const chrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(metalColor),
    roughness: 0.17,
    metalness: 0.86
  });

  const floor = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#121520'),
    roughness: 0.82,
    metalness: 0.04
  });

  return { cloth, rails, frame, chrome, floor };
}
