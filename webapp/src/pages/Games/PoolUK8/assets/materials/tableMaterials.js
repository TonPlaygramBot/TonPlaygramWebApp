import * as THREE from 'three';

export function createTableMaterials({ clothColor, railColor, frameColor, metalColor }) {
  const cloth = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(clothColor),
    roughness: 0.35,
    metalness: 0.0,
    sheen: 0.5,
    sheenRoughness: 0.3
  });

  const rails = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(railColor),
    roughness: 0.6,
    metalness: 0.1
  });

  const frame = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(frameColor),
    roughness: 0.55,
    metalness: 0.05
  });

  const chrome = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(metalColor),
    roughness: 0.18,
    metalness: 0.85
  });

  const floor = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#10131c'),
    roughness: 0.8,
    metalness: 0.0
  });

  return { cloth, rails, frame, chrome, floor };
}
