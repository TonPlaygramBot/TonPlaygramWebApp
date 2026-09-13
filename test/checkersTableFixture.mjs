import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { createMurlanStyleTable, TABLE_SHAPE_OPTIONS } from '../webapp/src/utils/murlanTable.js';
import { createCheckersHumanActor } from '../webapp/src/games/checkers/checkersHumanActors.ts';
import { loadCheckersHumanTemplate } from './checkersHumanFixture.mjs';

export const scale = 0.48 * 0.68, modelScale = 0.75 * scale, stoolScale = 1.02 * scale;
export const radius = 2.6 * modelScale;
export const tableY = 0.98 * modelScale - 0.09 * modelScale * stoolScale * 0.85 - 0.4 * modelScale + 0.09 * modelScale * stoolScale + 0.05 * modelScale;
export const tile = ((8 * 4.2 + 3 * 2) * 0.049 * scale * 0.62) / 8;

// Only texture painting/networking is stubbed. Table geometry comes directly
// from the production factory, and leg positions come from the real skinned GLB.
const gradient = { addColorStop() {} };
const context = new Proxy({
  createLinearGradient: () => gradient,
  createRadialGradient: () => gradient,
  createPattern: () => null,
  measureText: value => ({ width: value.length * 8 }),
  getImageData: (_x, _y, width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
  createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height })
}, { get: (target, key) => key in target ? target[key] : () => {} });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => context }) };
globalThis.fetch = async () => ({ ok: false });
THREE.TextureLoader.prototype.load = function (_url, onLoad) {
  const texture = new THREE.Texture();
  queueMicrotask(() => onLoad?.(texture));
  return texture;
};

export function createTable(tableId) {
  const shapeId = tableId === 'murlan-default' ? 'classicOctagon' : tableId;
  return createMurlanStyleTable({
    arena: new THREE.Group(), tableRadius: radius, tableHeight: tableY,
    pedestalHeightScale: 1.14,
    shapeOption: TABLE_SHAPE_OPTIONS.find(shape => shape.id === shapeId)
  });
}

export async function createHumans() {
  const template = await loadCheckersHumanTemplate();
  return ['bottom', 'top'].map(seat => createCheckersHumanActor(template, {
    seat, distance: radius + 0.56 * scale - 0.075 + (seat === 'bottom' ? 0.025 : 0),
    seatY: tableY - 0.12, height: radius * 2.4
  }));
}

export function legPoints(actor) {
  actor.root.updateMatrixWorld(true);
  const points = [];
  actor.actor.traverse(mesh => {
    if (!mesh.isSkinnedMesh || mesh.name.includes('first-person')) return;
    mesh.skeleton.update();
    const indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight');
    for (let i = 0; i < indices.count; i++) {
      let weight = 0;
      for (let j = 0; j < indices.itemSize; j++) {
        const bone = mesh.skeleton.bones[indices.getComponent(i, j)];
        if (/leg|thigh|foot|toe|calf/i.test(bone?.name || '')) weight += weights.getComponent(i, j);
      }
      if (weight < 0.4) continue;
      points.push(mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
    }
  });
  return points;
}

export function countLegIntersections(model, points, clearance = 0.008) {
  model.updateMatrixWorld(true);
  const parts = [];
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
    const triangles = [];
    for (let i = 0; i + 2 < (indices?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j).applyMatrix4(mesh.matrixWorld));
      const triangle = new THREE.Triangle(...vertices);
      if (triangle.getArea() > 1e-12) triangles.push(triangle);
    }
    parts.push({ bounds: new THREE.Box3().setFromObject(mesh).expandByScalar(clearance), triangles });
  });
  const closest = new THREE.Vector3(), hit = new THREE.Vector3();
  const direction = new THREE.Vector3(1, 0.013, 0.007).normalize();
  let intersections = 0;
  for (const point of points) {
    let collided = false;
    for (const part of parts) {
      if (!part.bounds.containsPoint(point)) continue;
      const distances = [];
      const ray = new THREE.Ray(point, direction);
      for (const triangle of part.triangles) {
        if (triangle.closestPointToPoint(point, closest).distanceTo(point) < clearance) { collided = true; break; }
        if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) distances.push(hit.distanceTo(point));
      }
      if (collided) break;
      distances.sort((a, b) => a - b);
      const crossings = distances.filter((distance, i) => i === 0 || distance - distances[i - 1] > 1e-6);
      if (crossings.length % 2) { collided = true; break; }
    }
    if (collided) intersections++;
  }
  return intersections;
}
