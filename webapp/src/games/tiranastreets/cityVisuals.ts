import * as THREE from "three";
import {VisibilityIndex,selectVisibilityBands} from './shared/visibilityIndex.mjs';
import {AGED_HOUSING_IDS} from '../tirana-city-source/housingRegistry.mjs';
import { WORLD, insidePolygon, type Point } from "./shared/engine.mjs";
import { nativeReplacementIds } from "../tirana-landmarks/nativeLocations.mjs";
import {ROCK_REPLACEMENT_IDS} from '../tirana-landmarks/skanderbegBuilding.mjs';

import { INSTITUTION_BUILDING_IDS } from '../tirana-city-source/registry.mjs';
import {REAL_STOREFRONT_BUILDING_IDS,FUEL_CANOPY_IDS} from '../tirana-street-life/registry.mjs';
const replacedLandmarkIds = nativeReplacementIds(WORLD);
type Placement = {
  id: string; x: number; z: number; width: number; depth: number;
  height: number; variant: number; yaw: number;
};
export const CITY_DETAILS: Placement[] = WORLD.buildings.flatMap((b, i) => {
  if(AGED_HOUSING_IDS.has(String(b.id))||ROCK_REPLACEMENT_IDS.has(String(b.id)))return [];
  if(b.neighbourhood)return []; // Source shells/Blender assets own these footprints.
  if (INSTITUTION_BUILDING_IDS.has(String(b.id)) || REAL_STOREFRONT_BUILDING_IDS.has(String(b.id)) || FUEL_CANOPY_IDS.has(String(b.id)) || replacedLandmarkIds.has(String(b.id)) || b.special || b.h < 6 || b.h > 60) return [];
  let longest = 0, angle = 0;
  for (let j = 0; j < b.p.length; j++) {
    const a = b.p[j], c = b.p[(j + 1) % b.p.length], d = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (d > longest) { longest = d; angle = Math.atan2(c[1] - a[1], c[0] - a[0]); }
  }
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const local = b.p.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos]);
  const xs = local.map((p) => p[0]), zs = local.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs);
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, mz = (Math.max(...zs) + Math.min(...zs)) / 2;
  const x = mx * cos - mz * sin, z = mx * sin + mz * cos;
  if (w < 8 || d < 8 || w > 85 || d > 85) return [];
  for (const factor of [0.94, 0.8, 0.64]) {
    const width = w * factor, depth = d * factor;
    if (width < 7 || depth < 7) continue;
    if ([-1, 1].every((dx) => [-1, 1].every((dz) => insidePolygon(
      x + dx * width * 0.5 * cos - dz * depth * 0.5 * sin,
      z + dx * width * 0.5 * sin + dz * depth * 0.5 * cos, b.p
    )))) return [{ id: b.id, x, z, width, depth, height: b.h + 0.3, variant: i % 2, yaw: -angle }];
  }
  return [];
});
export const DETAIL_IDS = new Set(CITY_DETAILS.map((b) => b.id));
const detailIndex = new VisibilityIndex(CITY_DETAILS);
// Preserve the existing 35/100-building limit. Distant silhouettes receive the
// cheap authored LOD; expensive near detail still has ten slots per variant.
export const FACADE_VISIBILITY = {
  battery: [{radius:180,count:25},{radius:400,count:6},{radius:640,count:4}],
  high: [{radius:340,count:75},{radius:750,count:15},{radius:1100,count:10}]
} as const;
type Batch = {mesh: THREE.InstancedMesh; local: THREE.Matrix4; variant: number; lod: boolean; size: THREE.Vector3; min: THREE.Vector3;};
export class CityFacades {
  group = new THREE.Group();
  private batches: Batch[] = [];
  private time = 0;
  private matrix = new THREE.Matrix4();
  private object = new THREE.Object3D();
  private viewer = new THREE.Vector3(Infinity, 0, Infinity);
  private direction = new THREE.Vector3();
  private lastDirection = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3(Infinity,Infinity,Infinity);
  private projectionWidth = 0;
  private projectionHeight = 0;
  private battery?: boolean;
  private frustum = new THREE.Frustum();
  private projection = new THREE.Matrix4();
  private sphere = new THREE.Sphere();
  constructor(source: THREE.Group) {
    const names = ["brick_block", "corner_block"];
    for (const [variant, name] of names.entries()) for (const lod of [false, true]) {
      const template = source.children.find((o) => o.name === name + (lod ? "_lod" : ""));
      if (!template) continue;
      template.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(template), size = box.getSize(new THREE.Vector3());
      template.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          for(const material of Array.isArray(o.material)?o.material:[o.material])if(material instanceof THREE.MeshStandardMaterial&&/glass|window|glazing/i.test(material.name))material.userData.environmentWindow=true;
          const mesh = new THREE.InstancedMesh(o.geometry, o.material, lod ? 120 : 10);
          mesh.count = 0;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.castShadow = !lod;
          mesh.receiveShadow = true;
          // Recompute the aggregate bounds whenever active matrices change.
          mesh.frustumCulled = true;
          this.group.add(mesh);
          this.batches.push({mesh, local: o.matrixWorld.clone(), variant, lod, size, min: box.min.clone()});
        }
      });
    }
  }
  update(target: Point, dt: number, battery: boolean, camera?: THREE.PerspectiveCamera) {
    this.time -= dt;
    if(camera) camera.getWorldDirection(this.direction);
    const changed = this.battery !== battery || (target.x-this.viewer.x)**2+(target.z-this.viewer.z)**2 > 4 ||
      !!camera && (this.direction.distanceToSquared(this.lastDirection) > .0025 ||
        camera.position.distanceToSquared(this.cameraPosition)>4 || camera.projectionMatrix.elements[0]!==this.projectionWidth || camera.projectionMatrix.elements[5]!==this.projectionHeight);
    if (!changed || this.time > 0) return;
    this.time = .15;
    this.viewer.set(target.x, 0, target.z);this.battery=battery;this.lastDirection.copy(this.direction);
    if(camera){this.cameraPosition.copy(camera.position);this.projectionWidth=camera.projectionMatrix.elements[0];this.projectionHeight=camera.projectionMatrix.elements[5];camera.updateMatrixWorld();this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);}
    const bands=FACADE_VISIBILITY[battery?'battery':'high'];
    const near=selectVisibilityBands(detailIndex.query(target,bands[bands.length-1].radius,p=>{
      if(!camera)return true;
      this.sphere.center.set(p.x,p.height/2,p.z);this.sphere.radius=Math.hypot(p.width,p.depth,p.height)/2;
      return this.frustum.intersectsSphere(this.sphere);
    }),bands);
    // A crowded near band must overflow into the available LOD slots, rather
    // than silently disappearing when its full-detail batch reaches capacity.
    const fullIds=new Set<string>(),fullCounts=[0,0];
    for(const {item:p,distanceSq} of near)if(!battery&&distanceSq<70**2&&fullCounts[p.variant]<10){fullIds.add(p.id);fullCounts[p.variant]++;}
    for (const batch of this.batches) {
      let count = 0;
      for (const { item:p } of near) {
        const full = fullIds.has(p.id);
        if (p.variant !== batch.variant || batch.lod === full || count >= batch.mesh.instanceMatrix.count) continue;
        this.object.scale.set(p.width / batch.size.x, p.height / batch.size.y, p.depth / batch.size.z);
        this.object.rotation.set(0, p.yaw, 0);
        const cx = (batch.min.x + batch.size.x / 2) * this.object.scale.x;
        const cz = (batch.min.z + batch.size.z / 2) * this.object.scale.z;
        this.object.position.set(p.x - cx * Math.cos(p.yaw) - cz * Math.sin(p.yaw),
          0.03 - batch.min.y * this.object.scale.y, p.z + cx * Math.sin(p.yaw) - cz * Math.cos(p.yaw));
        this.object.updateMatrix();
        this.matrix.multiplyMatrices(this.object.matrix, batch.local);
        batch.mesh.setMatrixAt(count++, this.matrix);
      }
      batch.mesh.count = count;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
      batch.mesh.visible=count>0;
    }
    this.group.userData.visibleBuildings=near.length;
    this.group.userData.detailRadius=bands[bands.length-1].radius;
  }
}
