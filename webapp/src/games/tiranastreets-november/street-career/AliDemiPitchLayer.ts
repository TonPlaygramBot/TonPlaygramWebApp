import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {surfaceGeometry} from '../../tirana-environment/riverGeometry';
import {aliDemiSurfaces} from '../shared/aliDemiRecreation.mjs';

const height = 0.085;
const midpoint = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const segment = (a: number[], b: number[]) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], scale = .065 / Math.hypot(dx, dz);
  const x = -dz * scale, z = dx * scale;
  return surfaceGeometry([[[a[0] + x, a[1] + z], [b[0] + x, b[1] + z],
    [b[0] - x, b[1] - z], [a[0] - x, a[1] - z]]], height + .006);
};

/** Measured court footprint; markings are illustrative, not surveyed features. */
export class AliDemiPitchLayer {
  readonly group = new T.Group();
  constructor(scene: T.Scene, origin: readonly number[]) {
    this.group.name = 'Tirana:Ali Demi artificial turf';
    const { pitches, skate } = aliDemiSurfaces(origin);
    const skating = new T.Mesh(surfaceGeometry([skate], height), new T.MeshStandardMaterial({
      color: 0x9e9e98, roughness: .95
    }));
    skating.receiveShadow = true;
    this.group.add(skating);
    const turf = new T.MeshStandardMaterial({color: 0x386441, roughness: .92});
    const chalk = new T.MeshStandardMaterial({color: 0xe3e1ce, roughness: .9});
    const lines: T.BufferGeometry[] = [], fields: T.BufferGeometry[] = [];
    for (const ring of pitches) {
      // The OSM rings have four ordered corners with their closing vertex removed.
      fields.push(surfaceGeometry([ring], height));
      const center = midpoint(midpoint(ring[0], ring[2]), midpoint(ring[1], ring[3]));
      const p = ring.map(corner => lerp(corner, center, .04));
      p.forEach((a, i) => lines.push(segment(a, p[(i + 1) % p.length])));
      const length = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      const longFirst = length(p[0], p[1]) > length(p[1], p[2]);
      const offset = longFirst ? 0 : 1;
      lines.push(segment(midpoint(p[offset], p[(offset+1)%4]), midpoint(p[(offset+2)%4], p[(offset+3)%4])));
      for (let i = 0; i < 20; i++) {
        const point = (j: number) => [center[0] + 2.5 * Math.cos(j * Math.PI / 10), center[1] + 2.5 * Math.sin(j * Math.PI / 10)];
        lines.push(segment(point(i), point(i + 1)));
      }
    }
    const fieldGeometry = mergeGeometries(fields);
    fields.forEach(geometry => geometry.dispose());
    if (fieldGeometry) {
      const field = new T.Mesh(fieldGeometry, turf);
      field.receiveShadow = true;
      this.group.add(field);
    } else turf.dispose();
    const merged = mergeGeometries(lines);
    lines.forEach(geometry => geometry.dispose());
    if (merged) {
      const markings = new T.Mesh(merged, chalk);
      markings.receiveShadow = true;
      this.group.add(markings);
    } else chalk.dispose();
    scene.add(this.group);
  }
  dispose() {
    const materials = new Set<T.Material>();
    this.group.traverse(obj => {
      if (obj instanceof T.Mesh) {
        obj.geometry.dispose();
        for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) materials.add(material);
      }
    });
    materials.forEach(material => material.dispose());
    this.group.removeFromParent();
  }
}
