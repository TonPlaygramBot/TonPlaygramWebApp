// @vitest-environment node
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { fitSnakeTableModel } from './snakeTableFit';

it('sizes a narrow playing surface independently from flared feet', () => {
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 0.6));
  top.position.y = 1;
  const feet = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1));
  feet.position.y = 0.05;
  table.add(top, feet);
  const original = Array.from(top.geometry.attributes.position.array);
  const clone = table.clone(true);
  const fitted = fitSnakeTableModel(clone, {
    radius: 2,
    surfaceY: 0.8,
    groundY: -0.7
  });
  const topBox = new THREE.Box3().setFromObject(clone.children[0]);
  expect(topBox.getSize(new THREE.Vector3()).x).toBeCloseTo(4, 5);
  expect(topBox.getSize(new THREE.Vector3()).z).toBeGreaterThan(3.5);
  expect(topBox.max.y).toBeCloseTo(0.8, 5);
  expect(new THREE.Box3().setFromObject(clone).min.y).toBeCloseTo(-0.7, 5);
  expect(fitted.getOuterRadius(new THREE.Vector3(0, 0, 1))).toBeGreaterThan(
    1.75
  );
  expect(Array.from(top.geometry.attributes.position.array)).toEqual(original);
});

it('creates real overhang on long cabinet faces while preserving the tabletop and floor', () => {
  const table = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  const cabinet = new THREE.Mesh(geometry);
  table.add(cabinet);
  fitSnakeTableModel(table, {
    radius: 2,
    surfaceY: 0.8,
    groundY: -0.7,
    assetId: 'modern_coffee_table_02'
  });
  const positions = cabinet.geometry.attributes.position;
  const points = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i)
  );
  expect(
    points.some((p) => Math.abs(p.y - 0.715) < 1e-5 && Math.abs(p.x) > 1.99)
  ).toBe(true);
  expect(
    points
      .filter((p) => p.y < 0.65)
      .every((p) => Math.abs(p.x) <= 1.201 && Math.abs(p.z) <= 1.201)
  ).toBe(true);
  expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(0.8, 5);
  expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(-0.7, 5);
  expect(
    Array.from(cabinet.geometry.attributes.normal.array).every(Number.isFinite)
  ).toBe(true);
  expect(cabinet.geometry.attributes.uv.count).toBe(positions.count);
});

it('rejects empty models before changing their transforms', () => {
  const table = new THREE.Group();
  table.position.set(3, 4, 5);
  expect(() =>
    fitSnakeTableModel(table, { radius: 2, surfaceY: 1, groundY: 0 })
  ).toThrow('no measurable footprint');
  expect(table.position.toArray()).toEqual([3, 4, 5]);
});
