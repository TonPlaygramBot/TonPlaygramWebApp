import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { disposeWeaponResources } from '../weaponModelResources';
import type { AccessSite } from '../shared/buildingAccess.mjs';

export type ResidentialKind = 'house' | 'villa' | 'apartment';
export const RESIDENTIAL_MODELS = {
  house: { url: '/assets/tirana-streets/residential/house.gltf', width: 9, height: 3.75, depth: 6 },
  villa: { url: '/assets/tirana-streets/residential/villa.gltf', width: 9, height: 6.75, depth: 9 },
  apartment: { url: '/assets/tirana-streets/residential/apartment.gltf', width: 9, height: 12.75, depth: 6 },
} as const;

type Source = { promise: Promise<T.Group>; root?: T.Group; users: number };
type SourceKind = ResidentialKind | 'facade-kit';
const sources = new Map<SourceKind, Source>();
const instances = new WeakMap<T.Group, { kind: SourceKind; released: boolean; ownedGeometries?: T.BufferGeometry[]; ownedMaterials?: T.Material[] }>();

/** Batch artist meshes by original material. This preserves UVs/PBR maps while
 * reducing a four-floor apartment from 100+ mesh draws to a few material draws.
 * The entry door stays independent so gameplay can open it.
 */
function batchResidence(root: T.Group, disposeSource = true): T.Group {
  root.updateMatrixWorld(true);
  const batched = new T.Group();
  const door = root.getObjectByName('residential_entry_door');
  const doorGeometries = new Set<T.BufferGeometry>();
  if (door) {
    const copy = door.clone(true);
    copy.applyMatrix4(door.parent?.matrixWorld ?? new T.Matrix4());
    batched.add(copy);
    copy.traverse(object => { if (object instanceof T.Mesh) doorGeometries.add(object.geometry); });
  }
  const batches = new Map<string, { material: T.Material; geometries: T.BufferGeometry[] }>();
  const sourceGeometries = new Set<T.BufferGeometry>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    sourceGeometries.add(object.geometry);
    let ancestor: T.Object3D | null = object;
    while (ancestor) { if (ancestor === door) return; ancestor = ancestor.parent; }
    // GLTFLoader emits one mesh per primitive for this reviewed kit.
    if (Array.isArray(object.material)) throw new Error('Unexpected residence primitive material array');
    const key = object.material.uuid + ':' + Object.keys(object.geometry.attributes).sort().join(',');
    let batch = batches.get(key);
    if (!batch) { batch = { material: object.material, geometries: [] }; batches.set(key, batch); }
    batch.geometries.push(object.geometry.clone().applyMatrix4(object.matrixWorld));
  });
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach(part => part.dispose());
    if (!geometry) throw new Error('Could not batch residential facade');
    const mesh = new T.Mesh(geometry, batch.material);
    mesh.name = `residential_facade_${batch.material.name}`;
    batched.add(mesh);
  }
  if (disposeSource) for (const geometry of sourceGeometries) if (!doorGeometries.has(geometry)) geometry.dispose();
  return batched;
}

function sourceFor(kind: SourceKind): Source {
  const cached = sources.get(kind);
  if (cached) return cached;
  const entry = { users: 0 } as Source;
  const url = kind === 'facade-kit' ? '/assets/tirana-streets/residential/facade-kit.gltf' : RESIDENTIAL_MODELS[kind].url;
  entry.promise = new GLTFLoader().loadAsync(url).then(gltf => {
    const root = kind === 'facade-kit' ? gltf.scene : batchResidence(gltf.scene);
    entry.root = root;
    root.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      // The artist's original PBR maps, colours and UV coordinates are retained.
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof T.MeshStandardMaterial) {
          for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
            if (texture) texture.anisotropy = 4;
          }
        }
      }
    });
    return root;
  }).catch(error => {
    if (sources.get(kind) === entry) sources.delete(kind);
    throw error;
  });
  sources.set(kind, entry);
  return entry;
}

/** A complete four-sided building assembled from licensed original GLTF meshes.
 * Floor is y=0, footprint is centred, and its entrance faces local +Z.
 * Call releaseResidentialBuilding on teardown; cloned instances share resources.
 * Existing mapped shells must only be hidden AFTER this promise has resolved.
 */
export async function createResidentialBuilding(
  kind: ResidentialKind,
  width: number,
  height: number,
  depth: number,
): Promise<T.Group> {
  if (!(kind in RESIDENTIAL_MODELS) || [width, height, depth].some(n => !Number.isFinite(n) || n <= 0)) {
    throw new Error('Invalid residential building dimensions');
  }
  const source = sourceFor(kind);
  source.users++;
  let model: T.Group;
  try {
    model = (await source.promise).clone(true);
  } catch (error) {
    source.users--;
    throw error;
  }
  const native = RESIDENTIAL_MODELS[kind];
  model.name = `Tirana:residence:${kind}`;
  model.scale.set(width / native.width, height / native.height, depth / native.depth);
  model.userData.residentialKind = kind;
  model.userData.residentialDoor = {
    x: 0, y: 0, z: depth / 2,
    width: 2.08 * width / native.width,
    height: 2.81 * height / native.height,
  };
  model.userData.assetSource = 'https://polyhaven.com/a/modular_urban_apartments_facade';
  model.userData.assetLicense = 'CC0-1.0';
  model.userData.residentialDoorOpen = false;
  instances.set(model, { kind, released: false });
  return model;
}

/** Original 3m GLTF modules follow every mapped edge. Windows/doors retain their
 * human scale; the visual footprint and portal match the collision footprint.
 * The group already has its world position and buildingId. Do not rotate it.
 */
export async function createResidentialBuildingForSite(site: AccessSite): Promise<T.Group> {
  const points: number[][] = site.building?.p;
  if (!Array.isArray(points) || points.length < 3 || points.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
    throw new Error('Residence requires a valid mapped footprint');
  }
  const source = sourceFor('facade-kit');
  source.users++;
  let kit: T.Group;
  try { kit = await source.promise; } catch (error) { source.users--; throw error; }
  const assembly = new T.Group();
  const ownedMaterials: T.Material[] = [];
  const cx = site.center.x, cz = site.center.z;
  const height = Math.max(3, site.roofY - site.ground);
  const floors = Math.max(1, Math.round(height / 3));
  const floorHeight = height / floors;
  const area = points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const a = area >= 0 ? p : q, b = area >= 0 ? q : p;
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const along = length ? Math.max(0, Math.min(length, ((site.entrance.doorX - a[0]) * dx + (site.entrance.doorZ - a[1]) * dz) / length)) : 0;
    const gap = Math.hypot(site.entrance.doorX - a[0] - dx * along / (length || 1), site.entrance.doorZ - a[1] - dz * along / (length || 1));
    return { a, dx, dz, length, along, gap, yaw: Math.atan2(dz, -dx) };
  }).filter(edge => edge.length > .02);
  const entry = edges.filter(edge => edge.length >= 3).sort((a, b) => a.gap - b.gap)[0];
  if (!entry || entry.gap > .25) { source.users--; throw new Error('Mapped residence entry has no matching facade edge'); }
  const add = (name: string, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, label?: string) => {
    const original = kit.getObjectByName(name);
    if (!original) throw new Error(`Missing original residential module: ${name}`);
    const object = original.clone(true);
    object.position.set(x - cx, y, z - cz); object.rotation.set(0, yaw, 0); object.scale.set(sx, sy, 1);
    if (label) object.name = label;
    assembly.add(object);
    return object;
  };
  const split = (start: number, end: number) => {
    const span = end - start;
    if (span < .01) return [];
    const count = Math.max(1, Math.round(span / 3));
    return Array.from({ length: count }, (_, i) => ({ start: start + i * span / count, width: span / count, entry: false }));
  };
  for (const edge of edges) {
    const { length, a, dx, dz, yaw } = edge;
    const entryStart = Math.max(0, Math.min(length - 3, edge.along - 1.5));
    for (let floor = 0; floor < floors; floor++) {
      const bays = edge === entry && floor === 0
        ? [...split(0, entryStart), { start: entryStart, width: 3, entry: true }, ...split(entryStart + 3, length)]
        : split(0, length);
      for (const bay of bays) {
        const x = a[0] + dx * bay.start / length, z = a[1] + dz * bay.start / length, y = floor * floorHeight;
        add(bay.entry ? 'wall_door_centered_large_01' : 'wall_window_centered_large_01', x, y, z, yaw, bay.width / 3, floorHeight / 3);
        add(bay.entry ? 'door_centered_large_01' : 'window_centered_large_01', x, y, z, yaw, bay.width / 3,
          bay.entry ? 1 : Math.min(1.15, floorHeight / 3), bay.entry ? 'residential_entry_door' : undefined);
        if (floor < floors - 1) add('cornice_standard_standard_01', x, y + floorHeight - .2, z, yaw, bay.width / 3);
      }
    }
    for (const bay of split(0, length)) add('crown_standard_standard_01', a[0] + dx * bay.start / length, height,
      a[1] + dz * bay.start / length, yaw, bay.width / 3);
  }
  // Reuse the original plaster panel as a roof. A polygon clip trims its
  // rectangular source to the surveyed boundary, including concave footprints.
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const roof = add('wall_standard_standard_01', maxX, height, maxZ, 0, (maxX - minX) / 3, (maxZ - minZ) / 3);
  roof.rotation.x = -Math.PI / 2;
  const rayTest = points.map((a, i) => {
    const b = points[(i + 1) % points.length];
    if (Math.abs(b[1] - a[1]) < 1e-8) return '';
    return `if (((${a[1].toFixed(5)} > vResidenceXZ.y) != (${b[1].toFixed(5)} > vResidenceXZ.y)) && (vResidenceXZ.x < (${(b[0]-a[0]).toFixed(5)} * (vResidenceXZ.y - ${a[1].toFixed(5)}) / ${(b[1]-a[1]).toFixed(5)} + ${a[0].toFixed(5)}))) residenceInside = !residenceInside;`;
  }).join('\n');
  roof.traverse(object => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const material = object.material.clone(); ownedMaterials.push(material);
    material.userData.residentialClippedRoof = true;
    material.onBeforeCompile = (shader: Parameters<T.Material['onBeforeCompile']>[0]) => {
      shader.vertexShader = 'varying vec2 vResidenceXZ;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvResidenceXZ=(modelMatrix*vec4(transformed,1.0)).xz;');
      shader.fragmentShader = 'varying vec2 vResidenceXZ;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nbool residenceInside=false;\n${rayTest}\nif(!residenceInside)discard;`);
    };
    material.customProgramCacheKey = () => `residence-roof:${site.buildingId}`;
    object.material = material;
  });
  const model = batchResidence(assembly, false);
  const ownedGeometries: T.BufferGeometry[] = [];
  for (const child of model.children) if (child instanceof T.Mesh && child.name.startsWith('residential_facade_')) ownedGeometries.push(child.geometry);
  model.position.set(cx, site.ground, cz);
  model.name = `Tirana:mapped-residence:${site.buildingId}`;
  model.userData.buildingId = site.buildingId;
  model.userData.residentialKind = site.kind;
  model.userData.residentialDoor = { x: site.entrance.doorX, z: site.entrance.doorZ, width: 2.08, height: 2.81 };
  model.userData.assetSource = 'https://polyhaven.com/a/modular_urban_apartments_facade';
  model.userData.assetLicense = 'CC0-1.0';
  model.userData.residentialMappedFootprint = points.map(p => p.slice());
  model.traverse(object => { if (object instanceof T.Mesh) {
    // Its colour pass clips the source roof panel to the polygon; do not let
    // the un-clipped rectangular depth pass cast a shadow outside the footprint.
    object.castShadow = !(object.material as T.Material).userData.residentialClippedRoof;
    object.receiveShadow = true;
  } });
  instances.set(model, { kind: 'facade-kit', released: false, ownedGeometries, ownedMaterials });
  return model;
}

/** The doorway frame stays part of the building. The separate original door
 * mesh is removed visually while the shared building-access portal is open.
 */
export function setResidentialDoorOpen(model: T.Group, open: boolean): void {
  model.userData.residentialDoorOpen = open;
  const door = model.getObjectByName('residential_entry_door');
  if (door) door.visible = !open;
}

export function releaseResidentialBuilding(model: T.Group): void {
  const instance = instances.get(model);
  model.removeFromParent();
  if (!instance || instance.released) return;
  instance.released = true;
  instance.ownedGeometries?.forEach(geometry => geometry.dispose());
  instance.ownedMaterials?.forEach(material => material.dispose());
  const source = sources.get(instance.kind);
  if (!source) return;
  source.users = Math.max(0, source.users - 1);
  if (source.users === 0) {
    if (source.root) disposeWeaponResources([source.root]);
    sources.delete(instance.kind);
  }
}
