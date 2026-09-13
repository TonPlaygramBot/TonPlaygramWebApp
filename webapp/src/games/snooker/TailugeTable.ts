/*! @license GPL-3.0-only — Tailuge snooker table; see vendor/tailuge/NOTICE.md. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  configureTailuge,
  tailugePockets,
  type TableSize
} from './TailugePhysics';
import { PocketGeometry } from './vendor/tailuge/view/pocketgeometry';
import { TableGeometry } from './vendor/tailuge/view/tablegeometry';

/** Stretch the upstream table at its straight rail sections, keeping pockets round.
 * The model uses radius 0.5 and noses at X=22, Y=11. Its Z axis is up.
 */
export function mapTailugeTableVertex(
  p: THREE.Vector3,
  size: TableSize,
  centerY: number
) {
  const unit = 2 * size.radius;
  const dx = size.length / (2 * unit) - 22;
  const dy = size.width / (2 * unit) - 11;
  const x = p.x + (Math.abs(p.x) > 5 ? Math.sign(p.x) * dx : 0);
  const y = p.y + (Math.abs(p.y) > 7 ? Math.sign(p.y) * dy : 0);
  return new THREE.Vector3(y * unit, p.z * unit + centerY, x * unit);
}

export function createTailugeTable(
  parent: THREE.Group,
  options: TableSize & {
    centerY: number;
    tableY: number;
    baulkZ: number;
    dRadius: number;
    spots: Record<string, number[]>;
    isDisposed: () => boolean;
    onReady?: (table: THREE.Group) => void;
  }
) {
  const scale = configureTailuge(options);
  const group = new THREE.Group();
  group.name = 'Tailuge snooker table';
  group.position.y = options.tableY;
  const clothMat = new THREE.MeshStandardMaterial({
    color: '#166b43',
    roughness: 0.85
  });
  const cushionMat = clothMat.clone();
  const wood = new THREE.MeshStandardMaterial({
    color: '#382019',
    roughness: 0.5
  });
  const parts = {
    frameMeshes: [] as THREE.Mesh[],
    railMeshes: [] as THREE.Mesh[],
    legMeshes: [] as THREE.Mesh[],
    trimMeshes: [],
    pocketJawMeshes: [],
    pocketRimMeshes: [],
    brandPlates: [],
    underlayMeshes: [],
    woodSurfaces: { frame: null, rail: null }
  };
  group.userData.finish = { parts, clothMat, cushionMat };
  const pockets = tailugePockets(options);
  const clothY = options.centerY - options.radius;
  // Geometry-derived fallback is playable immediately and remains if the local asset fails.
  const fallback = new THREE.Group();
  group.add(fallback);
  const shape = new THREE.Shape();
  shape.moveTo(-options.width / 2, -options.length / 2);
  shape.lineTo(options.width / 2, -options.length / 2);
  shape.lineTo(options.width / 2, options.length / 2);
  shape.lineTo(-options.width / 2, options.length / 2);
  shape.closePath();
  for (const p of pockets) {
    const hole = new THREE.Path();
    hole.absarc(p.pos.x, -p.pos.y, p.radius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const bed = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), clothMat);
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = clothY;
  bed.receiveShadow = true;
  fallback.add(bed);
  const addBox = (
    width: number,
    length: number,
    x: number,
    z: number,
    material: THREE.Material,
    y = clothY
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, options.radius * 1.5, length),
      material
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    fallback.add(mesh);
    return mesh;
  };
  const X = TableGeometry.X * scale,
    Y = TableGeometry.Y * scale,
    r = options.radius;
  const k = PocketGeometry;
  const endLength = 2 * (TableGeometry.Y - k.knuckleInset) * scale;
  const sideLength =
    (TableGeometry.X - k.knuckleInset - k.middleKnuckleInset) * scale;
  for (const sign of [-1, 1]) {
    addBox(endLength, 2 * r, 0, sign * (X + r), cushionMat);
    for (const end of [-1, 1])
      addBox(
        2 * r,
        sideLength,
        sign * (Y + r),
        end * (k.middleKnuckleInset * scale + sideLength / 2),
        cushionMat
      );
  }
  for (const knuckle of PocketGeometry.knuckles) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        knuckle.radius * scale,
        knuckle.radius * scale,
        r * 1.5,
        20
      ),
      cushionMat
    );
    mesh.position.set(knuckle.pos.y * scale, clothY, knuckle.pos.x * scale);
    fallback.add(mesh);
  }
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(options.width + 8 * r, r * 5, options.length + 8 * r),
    wood
  );
  body.position.y = clothY - r * 5;
  group.add(body);
  parts.frameMeshes.push(body);
  for (const x of [-1, 1])
    for (const z of [-0.75, 0, 0.75]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 2.5, r * 1.7, r * 14, 16),
        wood
      );
      leg.position.set(x * (Y - r * 2), clothY - r * 13, z * X);
      group.add(leg);
      parts.legMeshes.push(leg);
    }
  const markingMat = new THREE.LineBasicMaterial({
    color: '#dad6b6',
    transparent: true,
    opacity: 0.65
  });
  const line = (points: THREE.Vector3[]) => {
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      markingMat
    );
    group.add(l);
    return l;
  };
  const markY = clothY + r * 0.02;
  line([
    new THREE.Vector3(-Y, markY, options.baulkZ),
    new THREE.Vector3(Y, markY, options.baulkZ)
  ]);
  const dArc = line(
    Array.from({ length: 65 }, (_, i) => {
      const a = (i * Math.PI) / 64;
      return new THREE.Vector3(
        Math.cos(a) * options.dRadius,
        markY,
        options.baulkZ - Math.sin(a) * options.dRadius
      );
    })
  );
  const spots = Object.values(options.spots).map(([x, z]) => {
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.12, 16),
      new THREE.MeshBasicMaterial({ color: '#ddd5bc' })
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(x, markY, z);
    group.add(spot);
    return spot;
  });
  group.userData.markings = { dArc, spots };
  group.userData.cushions = [];
  group.userData.pockets = [];
  group.userData.clothPlaneLocal = clothY;
  group.userData.cushionTopWorld = options.tableY + clothY + r * 0.75;
  parent.add(group);
  new GLTFLoader().load(
    '/assets/snooker-tailuge/snooker.min.gltf',
    (gltf) => {
      if (options.isDisposed()) {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const ms = Array.isArray(child.material)
              ? child.material
              : [child.material];
            ms.forEach((m) => m.dispose());
          }
        });
        return;
      }
      gltf.scene.updateMatrixWorld(true);
      const model = new THREE.Group();
      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const geometry = child.geometry.clone();
        const a = geometry.getAttribute('position');
        const vertices: number[] = [];
        const uvs: number[] = [];
        for (let i = 0; i < a.count; i++) {
          const p = mapTailugeTableVertex(
            new THREE.Vector3()
              .fromBufferAttribute(a, i)
              .applyMatrix4(child.matrixWorld),
            options,
            options.centerY
          );
          vertices.push(p.x, p.y, p.z);
          uvs.push(p.x / options.width + 0.5, p.z / options.length + 0.5);
        }
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const original = child.material as THREE.Material;
        const name = original.name.toLowerCase();
        const material = name.startsWith('cloth')
          ? clothMat
          : name.includes('cushion')
            ? cushionMat
            : original.clone();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        model.add(mesh);
        if (name === 'wood' || name === 'material.001')
          parts.railMeshes.push(mesh);
        child.geometry.dispose();
        original.dispose();
      });
      fallback.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      group.remove(fallback);
      group.add(model);
      group.userData.modelLoaded = true;
      options.onReady?.(group);
    },
    undefined,
    (error) => {
      if (!options.isDisposed())
        console.warn(
          'Snooker table asset unavailable; using engine geometry',
          error
        );
    }
  );
  return {
    group,
    centers: pockets.map((p) => p.pos),
    baulkZ: options.baulkZ,
    clothMat,
    cushionMat,
    railMarkers: null,
    setBaseVariant: null
  };
}
