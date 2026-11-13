import { BufferGeometry, Float32BufferAttribute } from 'three';
import { offsetRiver } from '../tirana-environment/riverShapeCore.mjs';
import { LANA_CHANNEL } from './lanaCourse.mjs';

/** Tessellate the mapped banks in Water's local XY plane for animated waves. */
export function makeLanaWaterGeometry() {
  const line: number[][] = [LANA_CHANNEL.line[0]];
  for (let i = 1; i < LANA_CHANNEL.line.length; i++) {
    const [ax, az] = LANA_CHANNEL.line[i - 1];
    const [bx, bz] = LANA_CHANNEL.line[i];
    const sections = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
    for (let j = 1; j <= sections; j++)
      line.push([
        ax + (bx - ax) * (j / sections),
        az + (bz - az) * (j / sections)
      ]);
  }
  const half = LANA_CHANNEL.width / 2 + 0.04;
  const left = offsetRiver(line, -half),
    right = offsetRiver(line, half);
  const positions: number[] = [],
    indices: number[] = [];
  for (let i = 0; i < line.length; i++) {
    for (let j = 0; j <= 4; j++) {
      const t = j / 4;
      positions.push(
        left[i][0] + (right[i][0] - left[i][0]) * t,
        -(left[i][1] + (right[i][1] - left[i][1]) * t),
        0
      );
      if (i === 0 || j === 0) continue;
      const k = i * 5 + j;
      indices.push(k - 6, k, k - 5, k - 6, k - 1, k);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
