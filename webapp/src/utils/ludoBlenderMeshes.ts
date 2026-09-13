import * as THREE from 'three';
import data from '../assets/ludo-presentation.json';

// Blender-authored, material-batched geometry. No network or async work when firing.
const templates = new Map<string, THREE.Group>();
export function createLudoBlenderModel(key: string): THREE.Group {
  let template = templates.get(key);
  if (!template) {
    const parts = data.models[key];
    if (!parts) throw new Error(`Missing Blender Ludo model: ${key}`);
    template = new THREE.Group();
    for (const [name, part] of Object.entries(parts) as [string, {positions: number[]; normals: number[]; indices: number[]}][]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      geometry.setIndex(part.indices);
      geometry.computeBoundingSphere();
      const palette = data.materials[name];
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setRGB(...palette.color as [number, number, number]),
        metalness: palette.metalness, roughness: palette.roughness
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${key}-${name}`;mesh.castShadow = true;mesh.receiveShadow = true;
      template.add(mesh);
    }
    templates.set(key, template);
  }
  const model = template.clone(true);
  model.name = `blender-${key}`;
  model.userData.source = 'assets-source/ludo-presentation.blend';
  model.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) { mesh.geometry = mesh.geometry.clone(); mesh.material = (mesh.material as THREE.Material).clone(); }
  });
  model.userData.dispose = () => model.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => material.dispose());
  });
  return model;
}
