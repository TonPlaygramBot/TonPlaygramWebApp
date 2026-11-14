import * as T from 'three';

const UNITS = new Set(['shqiponja_officer', 'fnsh_officer', 'renea_officer']);

/** Correct the service-uniform markings on the original authored meshes.
 * Run before building force LODs so the new colour attribute is shared by both
 * resolutions. Positions, indices, UVs, fabric maps and skinning stay intact.
 * See docs/tirana-uniform-markings.md for the photographed uniform variants. */
export function prepareForceUniform(root: T.Object3D, id: string) {
  if (!UNITS.has(id) || root.userData.forceUniformMarkings === 1) return;
  root.userData.forceUniformMarkings = 1;
  const materials = new Set<T.MeshStandardMaterial>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (material instanceof T.MeshStandardMaterial) materials.add(material);
  });
  const navy = [...materials].find(material => material.name === 'Woven navy uniform');
  const originals = new Map([...materials].map(material => [material, material.color.clone()]));

  for (const material of materials) {
    // These slots are lettering and its backing on the people only. They were
    // exported as metallic vehicle paint, which made the name strips glint.
    if (material.name === 'Pearl white paint') {
      material.metalness = 0;
      material.roughness = .9;
    } else if (material.name === 'Graphite') {
      material.metalness = 0;
      material.roughness = .88;
    }
    if (id === 'shqiponja_officer' && navy && material.name === 'Reflective marking') {
      // The pack's broad horizontal shin bands are not the narrow longitudinal
      // motorcycle panels. Use the plain-trouser red/navy service variant.
      material.color.copy(navy.color);
      material.metalness = navy.metalness;
      material.roughness = navy.roughness;
      material.normalMap = navy.normalMap;
      material.normalScale.copy(navy.normalScale);
      material.roughnessMap = navy.roughnessMap;
      material.metalnessMap = navy.metalnessMap;
    }
    material.needsUpdate = true;
  }

  if (id !== 'shqiponja_officer' || !navy) return;
  root.traverse(object => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const material = object.material as T.MeshStandardMaterial;
    if (material.name !== 'Shqiponjat red fabric') return;
    const positions = object.geometry.getAttribute('position');
    if (!positions) return;
    const red = originals.get(material);
    if (!red) return;
    const colours = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      // Pack bind-pose coordinates are metres and Y-up. The red upper garment
      // starts above 1 m; only incorrectly coloured lower legs are corrected.
      const colour = positions.getY(i) < .8 ? navy.color : red;
      colour.toArray(colours, i * 3);
    }
    object.geometry.setAttribute('color', new T.BufferAttribute(colours, 3));
    material.color.setRGB(1, 1, 1);
    material.vertexColors = true;
    material.needsUpdate = true;
  });
}
