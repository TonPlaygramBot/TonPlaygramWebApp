import * as THREE from 'three';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { RIVER_TREES } from '../tiranastreets/shared/landscape.mjs';
import { onCarriageway } from '../tiranastreets/shared/streetLayout.mjs';
import {STREET_LIFE} from '../tirana-street-life/registry.mjs';

type Point = { x: number; z: number };
type Site = Point & { yaw: number; district: number };

const hash = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function buildingContains(x: number, z: number) {
  return WORLD.buildings.some((building) => {
    let inside = false;
    for (let i = 0, j = building.p.length - 1; i < building.p.length; j = i++) {
      const a = building.p[i], b = building.p[j];
      if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  });
}

function amenitySites(): Site[] {
  const sites: Site[] = [], occupied: Point[] = [];
  const roads = WORLD.roads.filter((road) => !road.walk && !road.bridge && road.w >= 5.5);
  roads.forEach((road, index) => {
    const dx = road.b[0] - road.a[0], dz = road.b[1] - road.a[1], length = Math.hypot(dx, dz);
    if (length < 34 || index % 9) return;
    const ux = dx / length, uz = dz / length, side = index % 2 ? -1 : 1;
    const x = road.a[0] + dx * (0.35 + hash(index) * 0.3) + uz * side * (road.w / 2 + 3.3);
    const z = road.a[1] + dz * (0.35 + hash(index) * 0.3) - ux * side * (road.w / 2 + 3.3);
    if (onCarriageway(x, z, 0.8) || buildingContains(x, z) || occupied.some((p) => Math.hypot(p.x - x, p.z - z) < 42) || [...STREET_LIFE.storefronts,...STREET_LIFE.stops,...STREET_LIFE.advertising].some(p=>Math.hypot(p.x-x,p.z-z)<12)) return;
    occupied.push({ x, z });
    sites.push({ x, z, yaw: Math.atan2(dx, dz), district: index % 5 });
  });
  return sites.slice(0, 38);
}

/** Batched street life for the full shared city. All decorative objects remain
 * outside the authoritative simulation and are culled by district on phones. */
export class UrbanLifeLayer {
  readonly group = new THREE.Group();
  private districts: THREE.Group[] = [];
  private districtCenters: Point[] = [];
  private signs: THREE.MeshStandardMaterial[] = [];
  private textures: THREE.Texture[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private disposed = false;

  constructor() {
    this.group.name = 'Tirana:batched-urban-life';
    for (let i = 0; i < 5; i++) { const district = new THREE.Group(); district.name = `urban-life-district-${i}`; this.districts.push(district); this.group.add(district); }
    const sites = amenitySites();
    this.districtCenters = this.districts.map((_, district) => {
      const members = sites.filter((site) => site.district === district);
      return members.length ? { x: members.reduce((sum, site) => sum + site.x, 0) / members.length, z: members.reduce((sum, site) => sum + site.z, 0) / members.length } : { x: 0, z: 0 };
    });
    const metal = this.material(0x263238, 0.48, 0.65), wood = this.material(0x7a4b2d, 0.76), stone = this.material(0x8d9290, 0.9);
    const tableTop = this.geometry(new THREE.CylinderGeometry(0.64, 0.64, 0.07, 20));
    const pole = this.geometry(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 8));
    const chair = this.geometry(new THREE.BoxGeometry(0.58, 0.07, 0.54));
    const bin = this.geometry(new THREE.CylinderGeometry(0.31, 0.27, 0.88, 14));
    const planter = this.geometry(new THREE.CylinderGeometry(0.54, 0.46, 0.55, 14));
    const dummy = new THREE.Object3D();
    const batches = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => {
      const meshes = this.districts.map(() => new THREE.InstancedMesh(geometry, material, count));
      meshes.forEach((mesh, i) => { mesh.count = 0; mesh.castShadow = i < 2; mesh.receiveShadow = true; this.districts[i].add(mesh); });
      return meshes;
    };
    const tops = batches(tableTop, wood, sites.length), legs = batches(pole, metal, sites.length * 5), seats = batches(chair, wood, sites.length * 4);
    const bins = batches(bin, metal, sites.length), planters = batches(planter, stone, sites.length * 2);
    const put = (mesh: THREE.InstancedMesh, x: number, y: number, z: number, yaw = 0, sx = 1, sy = 1, sz = 1) => {
      dummy.position.set(x, y, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(mesh.count++, dummy.matrix);
    };
    sites.forEach((site) => {
      const d = site.district, c = Math.cos(site.yaw), s = Math.sin(site.yaw);
      put(tops[d], site.x, 0.76, site.z); put(legs[d], site.x, 0.38, site.z);
      for (let chairIndex = 0; chairIndex < 4; chairIndex++) {
        const a = chairIndex * Math.PI / 2, x = site.x + Math.sin(a) * 1.08, z = site.z + Math.cos(a) * 1.08;
        put(seats[d], x, 0.48, z, a); put(legs[d], x, 0.24, z, a, 0.8, 0.62, 0.8);
      }
      put(bins[d], site.x + c * 2.35, 0.45, site.z - s * 2.35);
      for (const side of [-1, 1]) put(planters[d], site.x + c * 2.9 + s * side * 1.6, 0.28, site.z - s * 2.9 + c * side * 1.6);
    });
    // Extra small bins follow the river-tree rhythm instead of arbitrary grids.
    RIVER_TREES.filter((_, i) => i % 11 === 0).slice(0, 55).forEach((p, i) => put(bins[i % 5], p.x + 1.7, 0.45, p.z - 1.7, i));
    [...tops, ...legs, ...seats, ...bins, ...planters].forEach((mesh) => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); });
  }

  private geometry<T extends THREE.BufferGeometry>(geometry: T) { this.geometries.push(geometry); return geometry; }
  private material(color: number, roughness: number, metalness = 0) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.push(material); return material;
  }
  update(seconds: number, viewer?: Point, battery = false) {
    if (this.disposed) return;
    this.signs.forEach((material, i) => { material.emissiveIntensity = 0.12 + Math.max(0, Math.sin(seconds * 0.75 + i)) * 0.08; });
    this.districts.forEach((district, index) => {
      if (!viewer) { district.visible = true; return; }
      const center = this.districtCenters[index];
      district.visible = Math.hypot(center.x - viewer.x, center.z - viewer.z) < (battery ? 260 : 520);
    });
  }
  retire() { this.disposed = true; }
  dispose() {
    this.disposed = true; this.group.removeFromParent(); this.group.clear();
    this.geometries.forEach((geometry) => geometry.dispose()); this.materials.forEach((material) => material.dispose()); this.textures.forEach((texture) => texture.dispose());
  }
}
