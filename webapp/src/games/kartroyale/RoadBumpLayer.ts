import * as T from 'three';
import type { Track } from './simulation.mjs';
import { roadBumps, roadHeight, ROAD_SURFACE_Y } from './roadFeel.mjs';

/** One mesh, with the exact same height profile used by the four tyres. */
export function createRoadBumpLayer(track: Track) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const yellow = new T.Color('#edbb36'), dark = new T.Color('#292e32');
  for (const bump of roadBumps(track)) {
    const s = Math.sin(bump.yaw), c = Math.cos(bump.yaw);
    for (let along = 0; along < 20; along++) for (let across = 0; across < 16; across++) {
      const base = positions.length / 3, color = (across + Math.floor(along / 4)) % 4 < 2 ? yellow : dark;
      for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const u = ((along + du) / 20 - .5) * bump.length;
        const v = ((across + dv) / 16 - .5) * bump.width;
        const x = bump.x + s * u + c * v, z = bump.z + c * u - s * v;
        positions.push(x, ROAD_SURFACE_Y + .006 + roadHeight([bump], x, z), z);
        colors.push(color.r, color.g, color.b);
      }
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: .92, side: T.DoubleSide }));
  mesh.name = 'Striped road humps'; mesh.receiveShadow = true;
  return mesh;
}
