import * as THREE from 'three';
import { createMurlanStyleTable } from '../../webapp/src/utils/murlanTable';
import { SNAKE_SCENE_DIMENSIONS as D } from '../../webapp/src/components/SnakeBoard3D';

const table = createMurlanStyleTable({ arena: new THREE.Group(), tableRadius: D.tableRadius,
  tableHeight: D.tableHeight, topThicknessScale: D.topThicknessScale, includeBase: false, flushPlayingSurface: true, textures: false });
// Geometry is identical to the production fallback table; use simple review colors.
table.materials.topWoodMat.color.set('#694b32');
table.materials.rimWoodMat.color.set('#694b32');
table.materials.surfaceMat.color.set('#395d50');
table.group.traverse(object => {
  const mesh = object as THREE.Mesh;
  // Parametric geometry JSON discards baked rotateX transforms. Preserve vertices.
  if (mesh.geometry) mesh.geometry = new THREE.BufferGeometry().copy(mesh.geometry);
});
export const tableAssets = { table: table.group.toJSON(), tableUnderside: new THREE.Box3().setFromObject(table.group).min.y, tableOutline: Array.from({ length: 128 }, (_, i) => {
  const angle = i / 128 * Math.PI * 2;
  return table.getOuterRadius(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
}) };
