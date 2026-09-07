import * as THREE from 'three';
import { WORLD, insidePolygon, type Point } from './shared/engine.mjs';

type Placement = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  variant: number;
  yaw: number;
};
export const CITY_DETAILS: Placement[] = WORLD.buildings.flatMap((b, i) => {
  if (b.special || b.h < 6 || b.h > 60) return [];
  let longest = 0,
    angle = 0;
  for (let j = 0; j < b.p.length; j++) {
    const a = b.p[j],
      c = b.p[(j + 1) % b.p.length],
      d = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (d > longest) {
      longest = d;
      angle = Math.atan2(c[1] - a[1], c[0] - a[0]);
    }
  }
  const cos = Math.cos(angle),
    sin = Math.sin(angle),
    local = b.p.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]),
    xs = local.map((p) => p[0]),
    zs = local.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs),
    d = Math.max(...zs) - Math.min(...zs),
    mx = (Math.max(...xs) + Math.min(...xs)) / 2,
    mz = (Math.max(...zs) + Math.min(...zs)) / 2,
    x = mx * cos - mz * sin,
    z = mx * sin + mz * cos;
  if (w < 8 || d < 8 || w > 85 || d > 85) return [];
  for (const factor of [0.94, 0.8, 0.64]) {
    const width = w * factor,
      depth = d * factor;
    if (width < 7 || depth < 7) continue;
    if (
      [-1, 1].every((dx) =>
        [-1, 1].every((dz) =>
          insidePolygon(
            x + dx * width * 0.5 * cos - dz * depth * 0.5 * sin,
            z + dx * width * 0.5 * sin + dz * depth * 0.5 * cos,
            b.p
          )
        )
      )
    )
      return [
        {
          id: b.id,
          x,
          z,
          width,
          depth,
          height: b.h + 0.3,
          variant: b.h < 12 ? 1 : b.h > 29 ? 2 : i % 2 ? 0 : 3,
          yaw: -angle
        }
      ];
  }
  return [];
});
export const DETAIL_IDS = new Set(CITY_DETAILS.map((b) => b.id));
type Batch = {
  mesh: THREE.InstancedMesh;
  local: THREE.Matrix4;
  variant: number;
  lod: boolean;
  size: THREE.Vector3;
  min: THREE.Vector3;
};
export class CityFacades {
  group = new THREE.Group();
  private batches: Batch[] = [];
  private time = 0;
  private matrix = new THREE.Matrix4();
  private object = new THREE.Object3D();
  constructor(source: THREE.Group) {
    const names = [
      'tirana_apartment',
      'tirana_lowrise',
      'tirana_modern',
      'tirana_courtyard'
    ];
    for (const [variant, name] of names.entries())
      for (const lod of [false, true]) {
        const template = source.children.find(
          (o) => o.name === name + (lod ? '_lod' : '')
        );
        if (!template) continue;
        template.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(template),
          size = box.getSize(new THREE.Vector3());
        template.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const mesh = new THREE.InstancedMesh(
              o.geometry,
              Array.isArray(o.material)
                ? o.material
                : (() => {
                    const material = o.material.clone();
                    if (
                      material instanceof THREE.MeshStandardMaterial &&
                      /Tirana_PBR_Plaster/.test(material.name)
                    ) {
                      material.color.set(
                        [0xd6cdb9, 0xe3dac5, 0xb9c6c3, 0xd8b69b][variant]
                      );
                      material.normalScale.set(0.35, 0.35);
                    }
                    return material;
                  })(),
              lod ? 300 : 28
            );
            mesh.count = 0;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.castShadow = !lod;
            mesh.receiveShadow = true;
            // Active matrices change each update, so a source-centered bound would cull the city incorrectly.
            mesh.frustumCulled = false;
            this.group.add(mesh);
            this.batches.push({
              mesh,
              local: o.matrixWorld.clone(),
              variant,
              lod,
              size,
              min: box.min.clone()
            });
          }
        });
      }
  }
  update(target: Point, dt: number, battery: boolean) {
    this.time -= dt;
    if (this.time > 0) return;
    this.time = 0.4;
    const near = CITY_DETAILS.map((p) => ({
      p,
      d: Math.hypot(p.x - target.x, p.z - target.z)
    }))
      .filter((v) => v.d < (battery ? 180 : 340))
      .sort((a, b) => a.d - b.d)
      .slice(0, battery ? 35 : 100);
    const modules = near.flatMap(({ p, d }) => {
      const nx = Math.max(1, Math.ceil(p.width / 28)),
        nz = Math.max(1, Math.ceil(p.depth / 24));
      const result: { p: Placement; d: number }[] = [];
      for (let x = 0; x < nx; x++)
        for (let z = 0; z < nz; z++) {
          const dx = ((x + 0.5 - nx / 2) * p.width) / nx,
            dz = ((z + 0.5 - nz / 2) * p.depth) / nz;
          result.push({
            d,
            p: {
              ...p,
              width: p.width / nx,
              depth: p.depth / nz,
              x: p.x + dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw),
              z: p.z - dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw)
            }
          });
        }
      return result;
    });
    for (const batch of this.batches) {
      let count = 0;
      for (const { p, d } of modules) {
        const full = !battery && d < 70;
        if (
          p.variant !== batch.variant ||
          batch.lod === full ||
          count >= batch.mesh.instanceMatrix.count
        )
          continue;
        this.object.scale.set(
          p.width / batch.size.x,
          p.height / batch.size.y,
          p.depth / batch.size.z
        );
        this.object.rotation.set(0, p.yaw, 0);
        const cx = (batch.min.x + batch.size.x / 2) * this.object.scale.x,
          cz = (batch.min.z + batch.size.z / 2) * this.object.scale.z;
        this.object.position.set(
          p.x - cx * Math.cos(p.yaw) - cz * Math.sin(p.yaw),
          0.03 - batch.min.y * this.object.scale.y,
          p.z + cx * Math.sin(p.yaw) - cz * Math.cos(p.yaw)
        );
        this.object.updateMatrix();
        this.matrix.multiplyMatrices(this.object.matrix, batch.local);
        batch.mesh.setMatrixAt(count++, this.matrix);
      }
      batch.mesh.count = count;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
