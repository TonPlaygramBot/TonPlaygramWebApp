import * as T from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from './shared/world.mjs';
import { buildingProfile, polygonContains } from './shared/architecture.mjs';
import { onCarriageway, SIGNALS } from './shared/streetLayout.mjs';
import { StreetVisuals } from './streetVisuals';
import { LandscapeVisuals } from './landscapeVisuals';
import { NativeLandmarkLayer } from '../tirana-landmarks/NativeLandmarkLayer';
import { resolveNativeLandmarks } from '../tirana-landmarks/nativeLocations.mjs';

type Batch = {
  geometry: T.BufferGeometry;
  material: T.Material;
  matrices: T.Matrix4[];
  x: number;
  z: number;
};
type Cell = { object: T.Object3D; x: number; z: number; detail: boolean };
const BASE = '/assets/tirana-streets/';

/** A city layer, not a second game or renderer. Every static coordinate is in
 * Tirana WORLD metres; the FPS adapter translates this group exactly once. */
export class FpsCity {
  readonly group = new T.Group();
  readonly landmarks = new NativeLandmarkLayer(
    resolveNativeLandmarks(WORLD).landmarks
  );
  private cells: Cell[] = [];
  private batches = new Map<string, Batch>();
  private materials = new Map<string, T.MeshStandardMaterial>();
  private textures = new Set<T.Texture>();
  private box = new T.BoxGeometry(1, 1, 1);
  private dummy = new T.Object3D();
  private streets?: StreetVisuals;
  private landscape?: LandscapeVisuals;
  private disposed = false;
  private draco?: DRACOLoader;
  private fallbackPavements = new T.Group();
  private trees: { x: number; z: number }[] = [];
  readonly ready: Promise<void>;

  constructor(
    private loadAssets = true,
    private world = WORLD
  ) {
    this.group.name = 'Tirana mapped city';
    this.group.userData = {
      source: this.world.source,
      attribution: this.world.attribution,
      buildings: this.world.buildings.length,
      roads: this.world.roads.length,
      assetErrors: [] as string[]
    };
    this.surfaces(loadAssets);
    this.buildings();
    this.square();
    this.flush();
    this.group.add(this.landmarks.group);
    this.ready = loadAssets ? this.loadFixtures() : Promise.resolve();
  }

  private material(color: number, glass = false) {
    const key = `${color}:${glass}`;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: glass ? 0.27 : 0.87,
          metalness: glass ? 0.45 : 0
        })
      );
    return this.materials.get(key)!;
  }
  private mesh(
    geometry: T.BufferGeometry,
    material: T.Material,
    parent: T.Object3D = this.group
  ) {
    const mesh = new T.Mesh(geometry, material);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private polygon(points: number[][], height: number, y: number) {
    const shape = new T.Shape(points.map((p) => new T.Vector2(p[0], -p[1])));
    const geo = height
      ? new T.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
          steps: 1
        })
      : new T.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y, 0);
    const pos = geo.getAttribute('position'),
      uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, pos.getX(i) / 5, pos.getZ(i) / 5);
    return geo;
  }
  private strip(a: number[], b: number[], w: number, y: number) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const geo = new T.PlaneGeometry(w, Math.hypot(dx, dz) + 0.1);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(Math.atan2(dx, dz));
    geo.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
    const p = geo.getAttribute('position'),
      uv = geo.getAttribute('uv');
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 6, p.getZ(i) / 6);
    return geo;
  }
  private merge(
    parts: T.BufferGeometry[],
    material: T.Material,
    parent: T.Object3D = this.group
  ) {
    if (!parts.length) return;
    const geo = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    if (geo) return this.mesh(geo, material, parent);
  }
  private instance(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: T.Material,
    yaw = 0,
    detail = true
  ) {
    const cx = Math.floor(x / 100) * 100 + 50,
      cz = Math.floor(z / 100) * 100 + 50;
    const key = `${cx}:${cz}:${material.uuid}:${detail}`;
    if (!this.batches.has(key))
      this.batches.set(key, {
        geometry: this.box,
        material,
        matrices: [],
        x: cx,
        z: cz
      });
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, yaw, 0);
    this.dummy.scale.set(w, h, d);
    this.dummy.updateMatrix();
    this.batches.get(key)!.matrices.push(this.dummy.matrix.clone());
  }
  private flush() {
    for (const [key, b] of this.batches) {
      const mesh = new T.InstancedMesh(
        b.geometry,
        b.material,
        b.matrices.length
      );
      b.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      this.cells.push({
        object: mesh,
        x: b.x,
        z: b.z,
        detail: key.endsWith('true')
      });
    }
    this.batches.clear();
  }
  private surfaces(loadAssets: boolean) {
    const [x0, z0, x1, z1] = this.world.bounds;
    const ground = new T.PlaneGeometry(x1 - x0 + 100, z1 - z0 + 100);
    ground.rotateX(-Math.PI / 2);
    ground.translate((x0 + x1) / 2, -0.04, (z0 + z1) / 2);
    this.mesh(ground, this.material(0xaaa996));
    for (const p of this.world.areas)
      this.mesh(this.polygon(p, 0, 0.045), this.material(0xbdb7a7));
    for (const p of this.world.parks)
      this.mesh(this.polygon(p, 0, 0.05), this.material(0x63784a));
    const asphalt = this.material(0x666965),
      paving = this.material(0xbab5a6),
      paint = this.material(0xe5e2d4);
    const roads: T.BufferGeometry[] = [],
      walks: T.BufferGeometry[] = [],
      shoulders: T.BufferGeometry[] = [],
      regionalShoulders: T.BufferGeometry[] = [],
      markings: T.BufferGeometry[] = [];
    for (const r of this.world.roads) {
      const dx = r.b[0] - r.a[0],
        dz = r.b[1] - r.a[1],
        length = Math.hypot(dx, dz);
      if (length < 0.05) continue;
      (r.walk ? walks : roads).push(
        this.strip(r.a, r.b, r.w, r.bridge ? 0.16 : 0.09)
      );
      if (r.walk) continue;
      const regional =
        r.a[0] > WORLD.bounds[2] ||
        r.a[1] > WORLD.bounds[3] ||
        r.a[0] < WORLD.bounds[0] ||
        r.a[1] < WORLD.bounds[1];
      (regional ? regionalShoulders : shoulders).push(
        this.strip(r.a, r.b, r.w + 4.8, 0.06)
      );
      if (r.w >= 6)
        for (let d = 4; d < length - 4; d += 7) {
          const x = r.a[0] + (dx * d) / length,
            z = r.a[1] + (dz * d) / length;
          // Keep paint out of intersections and pedestrian crossing approaches.
          if (SIGNALS.some((s) => Math.hypot(s.x - x, s.z - z) < 7)) continue;
          markings.push(
            this.strip(
              [x, z],
              [x + (dx * 2.5) / length, z + (dz * 2.5) / length],
              0.12,
              0.102
            )
          );
        }
    }
    this.group.add(this.fallbackPavements);
    this.merge(shoulders, paving, this.fallbackPavements);
    this.merge(regionalShoulders, paving);
    this.merge(roads, asphalt);
    this.merge(walks, paving);
    this.merge(markings, paint);
    if (loadAssets)
      for (const [file, key] of [
        ['asphalt-diff.jpg', 'map'],
        ['asphalt-nor_gl.jpg', 'normalMap'],
        ['asphalt-rough.jpg', 'roughnessMap']
      ] as const) {
        new T.TextureLoader().load(
          BASE + file,
          (t) => {
            if (this.disposed) {
              t.dispose();
              return;
            }
            t.wrapS = t.wrapT = T.RepeatWrapping;
            t.anisotropy = 4;
            if (key === 'map') t.colorSpace = T.SRGBColorSpace;
            asphalt[key] = t;
            asphalt.normalScale.set(0.3, 0.3);
            asphalt.needsUpdate = true;
            this.textures.add(t);
          },
          undefined,
          () => {
            this.group.userData.assetErrors.push(file);
          }
        );
      }
    // The river remains below road level; the retained landscape kit adds banks.
    for (const water of this.world.water) {
      if (Array.isArray(water))
        this.mesh(this.polygon(water, 0, -0.1), this.material(0x557a70));
      else
        this.merge(
          water.line
            .slice(1)
            .map((p, i) => this.strip(water.line[i], p, water.width, -1.13)),
          this.material(0x557a70)
        );
    }
    let seed = 173;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const park of this.world.parks) {
      const xs = park.map((p) => p[0]),
        zs = park.map((p) => p[1]);
      const x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs);
      for (let i = 0; i < Math.min(80, ((x1 - x0) * (z1 - z0)) / 130); i++) {
        const x = x0 + random() * (x1 - x0),
          z = z0 + random() * (z1 - z0);
        if (polygonContains(x, z, park)) this.trees.push({ x, z });
      }
    }
  }
  private buildings() {
    const replaced = new Set(
      resolveNativeLandmarks(WORLD).landmarks.map((l) => l.buildingId)
    );
    const shells = new Map<
      string,
      { parts: T.BufferGeometry[]; material: T.Material; x: number; z: number }
    >();
    const glass = this.material(0x355560, true),
      dark = this.material(0x4e514b),
      shutters = this.material(0x64776a);
    for (const b of this.world.buildings) {
      if (replaced.has(String(b.id))) continue;
      const p = buildingProfile(b),
        height = p.height ?? b.h;
      const cx = b.p.reduce((s, v) => s + v[0], 0) / b.p.length,
        cz = b.p.reduce((s, v) => s + v[1], 0) / b.p.length;
      const key = `${Math.floor(cx / 140)}:${Math.floor(cz / 140)}:${p.color}`;
      if (!shells.has(key))
        shells.set(key, {
          parts: [],
          material: this.material(p.color),
          x: cx,
          z: cz
        });
      shells.get(key)!.parts.push(this.polygon(b.p, height, 0));
      const trim = this.material(p.trim);
      for (let i = 0; i < b.p.length; i++) {
        const a = b.p[i],
          c = b.p[(i + 1) % b.p.length],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          length = Math.hypot(dx, dz);
        if (length < 2.5) continue;
        const yaw = -Math.atan2(dz, dx),
          ux = dx / length,
          uz = dz / length;
        let nx = -uz,
          nz = ux;
        const mx = (a[0] + c[0]) / 2,
          mz = (a[1] + c[1]) / 2;
        if (polygonContains(mx + nx * 0.3, mz + nz * 0.3, b.p)) {
          nx *= -1;
          nz *= -1;
        }
        this.instance(
          mx + nx * 0.05,
          height + 0.12,
          mz + nz * 0.05,
          length,
          0.24,
          0.35,
          trim,
          yaw,
          false
        );
        const ribbon = p.style === 'hotel' || p.style === 'tower';
        for (let y = p.floor; y < height - 0.8; y += p.floor) {
          if (ribbon) {
            this.instance(
              mx + nx * 0.1,
              y,
              mz + nz * 0.1,
              length - 0.6,
              1.45,
              0.14,
              glass,
              yaw
            );
            for (let d = 1.2; d < length; d += 2)
              this.instance(
                a[0] + ux * d + nx * 0.2,
                y,
                a[1] + uz * d + nz * 0.2,
                0.09,
                1.6,
                0.14,
                trim,
                yaw
              );
            continue;
          }
          const columns = Math.max(
            1,
            Math.floor(length / (p.style === 'bank' ? 4.2 : 3.4))
          );
          for (let j = 0; j < columns; j++) {
            const d = ((j + 0.5) * length) / columns,
              x = a[0] + ux * d,
              z = a[1] + uz * d;
            const w = Math.min(p.window, length / columns - 0.7),
              h = p.style === 'bank' ? 2.7 : 1.55;
            this.instance(
              x + nx * 0.08,
              y,
              z + nz * 0.08,
              w + 0.25,
              h + 0.3,
              0.17,
              trim,
              yaw
            );
            this.instance(
              x + nx * 0.18,
              y,
              z + nz * 0.18,
              w,
              h,
              0.12,
              glass,
              yaw
            );
            this.instance(
              x + nx * 0.28,
              y - h / 2 - 0.15,
              z + nz * 0.28,
              w + 0.4,
              0.12,
              0.52,
              trim,
              yaw
            );
            if (p.style === 'residential' && j % 3 === 1 && y < 23) {
              // Open metal balcony rails and localized air conditioners.
              this.instance(
                x + nx * 0.55,
                y - 0.94,
                z + nz * 0.55,
                w + 0.6,
                0.13,
                1,
                trim,
                yaw
              );
              this.instance(
                x + nx,
                y - 0.45,
                z + nz,
                w + 0.6,
                0.045,
                0.045,
                dark,
                yaw
              );
              for (let k = -2; k <= 2; k++)
                this.instance(
                  x + nx + ux * k * 0.3,
                  y - 0.65,
                  z + nz + uz * k * 0.3,
                  0.04,
                  0.52,
                  0.04,
                  dark,
                  yaw
                );
              this.instance(
                x + ux * 1.1 + nx * 0.35,
                y - 0.4,
                z + uz * 1.1 + nz * 0.35,
                0.62,
                0.48,
                0.5,
                shutters,
                yaw
              );
            }
          }
        }
        // Shopfronts follow each mapped wall; they do not square off courtyards.
        if (height > 8 && length > 9 && p.style === 'residential') {
          this.instance(
            mx + nx * 0.15,
            1.35,
            mz + nz * 0.15,
            Math.min(6, length - 2),
            2.4,
            0.15,
            glass,
            yaw
          );
          this.instance(
            mx + nx * 0.65,
            2.8,
            mz + nz * 0.65,
            Math.min(7, length - 1),
            0.17,
            1.2,
            shutters,
            yaw
          );
        }
        if (p.style === 'culture' && nx < -0.8 && length > 40) {
          for (let d = 2; d < length - 1; d += 5) {
            const x = a[0] + ux * d + nx * 1.2,
              z = a[1] + uz * d + nz * 1.2;
            this.instance(x, 6, z, 0.65, 12, 0.8, trim, yaw, false);
          }
          this.instance(
            mx + nx,
            12.5,
            mz + nz,
            length,
            1.1,
            3,
            trim,
            yaw,
            false
          );
        }
      }
      if (p.style === 'residential' && height < 45) {
        this.instance(cx, height + 0.7, cz, 2.5, 1.4, 2, dark, 0);
      }
    }
    for (const b of shells.values()) {
      const mesh = this.merge(b.parts, b.material);
      if (mesh) {
        mesh.castShadow = true;
        this.cells.push({ object: mesh, x: b.x, z: b.z, detail: false });
      }
    }
  }
  private square() {
    // Architect's renovated pedestrian plaza. Reuse the mapped area outline;
    // do not overlay a road or invent a rectangular collision boundary.
    const plaza = this.world.areas.filter((p) => polygonContains(-35, -100, p));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const colors = [
      '#b9b4a7',
      '#d2cbb9',
      '#b7b9b0',
      '#c4b8a5',
      '#b1aca3',
      '#c8c7bd'
    ];
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = colors[(x * 7 + y * 11) % colors.length];
        ctx.fillRect(x * 32, y * 32, 32, 32);
        ctx.strokeStyle = '#99978d';
        ctx.lineWidth = 0.65;
        ctx.strokeRect(x * 32, y * 32, 32, 32);
      }
    const texture = new T.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.colorSpace = T.SRGBColorSpace;
    this.textures.add(texture);
    const material = new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.83
    });
    for (const p of plaza) this.mesh(this.polygon(p, 0, 0.098), material);
    const iron = this.material(0x272e2a),
      stone = this.material(0xc3beb0);
    // Furniture on the north pedestrian edge, outside buildings and roads.
    for (let x = -100; x <= -30; x += 10) {
      const z = -225;
      if (
        onCarriageway(x, z, 0.7) ||
        this.world.buildings.some((b) => polygonContains(x, z, b.p))
      )
        continue;
      this.instance(x, 0.5, z, 0.15, 1, 0.15, iron);
      if (x % 20 === 0) {
        this.instance(x, 0.42, z + 5, 3.2, 0.2, 0.8, stone);
        this.instance(x - 1, 0.2, z + 5, 0.4, 0.4, 0.65, stone);
        this.instance(x + 1, 0.2, z + 5, 0.4, 0.4, 0.65, stone);
        this.instance(x, 3.2, z - 3, 0.12, 6.4, 0.12, iron);
        for (let i = 0; i < 3; i++)
          this.instance(
            x + 0.35 * (i % 2 ? -1 : 1),
            5 + i * 0.6,
            z - 3,
            0.65,
            0.12,
            0.2,
            stone
          );
      }
    }
  }
  private async loadFixtures() {
    this.draco = new DRACOLoader()
      .setDecoderPath(BASE + 'draco/')
      .setWorkerLimit(1);
    const loader = new GLTFLoader().setDRACOLoader(this.draco);
    const results = await Promise.allSettled(
      ['street-furniture', 'street-kit'].map((name) =>
        loader.loadAsync(BASE + name + '.glb')
      )
    );
    if (this.disposed || results.some((r) => r.status === 'rejected')) {
      for (const r of results)
        if (r.status === 'fulfilled') disposeObject(r.value.scene);
      if (!this.disposed)
        this.group.userData.assetErrors.push('street fixtures');
      return;
    }
    const [furniture, kit] = results.map(
      (r) =>
        (
          r as PromiseFulfilledResult<
            Awaited<ReturnType<GLTFLoader['loadAsync']>>
          >
        ).value
    );
    furniture.scene.add(kit.scene);
    this.streets = new StreetVisuals(furniture.scene, this.trees);
    this.group.add(this.streets.group);
    this.fallbackPavements.visible = false;
  }
  update(camera: T.Vector3, time: number, battery: boolean) {
    if (this.loadAssets && !this.landscape && camera.z > 350) {
      this.landscape = new LandscapeVisuals();
      this.group.add(this.landscape.group);
    }
    for (const cell of this.cells) {
      const d = Math.hypot(camera.x - cell.x, camera.z - cell.z);
      cell.object.visible =
        d < (cell.detail ? (battery ? 120 : 240) : battery ? 500 : 1000);
      if (cell.object instanceof T.Mesh)
        cell.object.castShadow = !battery && d < 95;
    }
    this.streets?.update(camera, time, battery ? 'battery' : 'high');
    this.landscape?.update(camera, time, battery);
    this.landmarks.setBatteryMode(battery);
  }
  dispose() {
    this.disposed = true;
    this.draco?.dispose();
    this.streets?.dispose();
    this.landscape?.dispose();
    this.landmarks.dispose();
    disposeObject(this.group);
    this.textures.forEach((t) => t.dispose());
    this.box.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}

export function disposeObject(group: T.Object3D) {
  const geometry = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
      geometry.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  for (const m of materials)
    for (const v of Object.values(m))
      if (v instanceof T.Texture) textures.add(v);
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
}
