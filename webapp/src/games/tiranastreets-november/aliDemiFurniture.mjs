import {Group, InstancedMesh, Matrix4, Mesh} from 'three';

// Art-directed seating on the grassy side of the mapped Ali Demi skate deck.
// The park and deck footprints are OSM features, not the furniture locations.
export const ALI_DEMI_FURNITURE = [
  {name: 'park_bench', x: 1429.61, z: -19.82, yaw: 2.678},
  {name: 'litter_bin', x: 1432.18, z: -18.54, yaw: 2.678},
  {name: 'park_bench', x: 1445.09, z: -12.03, yaw: 2.635},
  {name: 'park_bench', x: 1463.04, z: 15.09, yaw: 1.631},
  {name: 'litter_bin', x: 1463.41, z: 21.35, yaw: 1.631},
  {name: 'park_bench', x: 1485.33, z: 41.10, yaw: 2.569},
  {name: 'litter_bin', x: 1489.74, z: 43.95, yaw: 2.569},
];

const parkSurfaceY = .061;

/** Borrow resources from the already loaded GLB; the renderer owns disposal. */
export function buildAliDemiFurniture(source) {
  const group = new Group();
  group.name = 'Tirana:Ali Demi skate park furnishings (authored)';
  group.visible = false;
  for (const name of ['park_bench', 'litter_bin']) {
    const template = source.getObjectByName(name);
    if (!template) continue;
    template.updateWorldMatrix(true, true);
    const placements = ALI_DEMI_FURNITURE.filter(p => p.name === name);
    template.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const instance = new InstancedMesh(node.geometry, node.material, placements.length);
      placements.forEach(({x, z, yaw}, i) => {
        const model = new Matrix4().makeRotationY(yaw).setPosition(x, parkSurfaceY, z);
        instance.setMatrixAt(i, model.multiply(node.matrixWorld));
      });
      instance.instanceMatrix.needsUpdate = true;
      instance.computeBoundingSphere();
      instance.receiveShadow = true;
      group.add(instance);
    });
  }
  return group;
}

export function aliDemiFurnitureVisible(x, z, battery) {
  return Math.hypot(x - 1460, z - 13) < (battery ? 75 : 115);
}
