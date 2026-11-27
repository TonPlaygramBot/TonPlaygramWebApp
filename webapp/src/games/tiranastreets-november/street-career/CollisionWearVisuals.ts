import * as T from 'three';
import type { Car, Effect } from '../shared/engine.mjs';

// Authored exterior surfaces only. Unknown imports fall back to their original
// materials rather than accidentally hiding a window, tire, passenger or light.
const paintByCar: Readonly<Record<string, readonly string[]>> = {
  'golf-gti': ['Rojo_Kings_wyf5mjqd'],
  range: ['Car_Paint'],
  bmw: ['Car_Paint'],
  ford: ['Car_Paint'],
  fiat: ['gt_body'],
  jaguar: ['Body', 'Body_blue', 'Body_noir'],
  ferrari: ['Body_Color'],
  bugatti: ['Bugatti_LaVoitureNoire_2019Paint_Material'],
  benz: ['Meshesmiutubonnetok0051Mtl'],
};
const bikeAssets = new Set(['city-bicycle', 'mountain-bike', 'delivery-ebike', 'city-scooter', 'street-motorcycle']);
const levelScalars = [0, 0.26, 0.53, 0.83, 1] as const;
const maxTracked = 24, maxVisible = 6, maxMaterialsPerActor = 8;

type MeshMaterials = T.Material | T.Material[];
type RenderPatch = {
  root: T.Object3D;
  meshes: { mesh: T.Mesh; source: MeshMaterials; replacement: MeshMaterials }[];
  copies: Map<T.MeshStandardMaterial, T.MeshStandardMaterial>;
  level: number;
};
type Wear = { score: number; render?: RenderPatch; checkedRoot?: T.Object3D };
type CarVisualState = Pick<Car, 'id' | 'health' | 'destroyed'>;

export class CollisionWearVisuals {
  private records = new Map<string, Wear>();
  private sequence = 0;
  private sweepAt = -Infinity;

  update(effects: readonly Effect[], elapsed: number, carState: (id: string) => CarVisualState | undefined,
    visual: (id: string) => T.Object3D | undefined, locked: (mesh: T.Mesh) => boolean) {
    let changed = false;
    for (const e of effects) {
      if (e.id <= this.sequence) continue;
      this.sequence = e.id;
      if (e.kind !== 'crash' || !e.roadWear || elapsed - e.at > 2) continue;
      for (const {id, delta} of e.roadWear) {
        if (!Number.isFinite(delta) || delta < 2.5 || !carState(id)) continue;
        const wear = this.records.get(id) ?? { score: 0 };
        wear.score = Math.min(4, wear.score + Math.min(3, Math.max(0.4, (delta - 2) / 5)));
        this.records.delete(id);
        this.records.set(id, wear);
        changed = true;
      }
    }
    while (this.records.size > maxTracked) {
      const first = this.records.keys().next().value!;
      this.release(this.records.get(first)!);
      this.records.delete(first);
    }
    if (!this.records.size || (!changed && elapsed >= this.sweepAt && elapsed - this.sweepAt < 0.1)) return;
    this.sweepAt = elapsed;
    let count = 0;
    // Latest impacts take priority. Enamel wear yields to the existing
    // mechanical wreck treatment before that layer clones any materials.
    for (const [id, wear] of [...this.records].reverse()) {
      const root = count < maxVisible ? visual(id) : undefined;
      if (wear.render && wear.render.root !== root) this.release(wear);
      if (!root || !root.visible) { this.release(wear); continue; }
      const car = carState(id);
      if (!car) { this.release(wear); this.records.delete(id); continue; }
      if (car.destroyed || (car.health ?? 140) < 110) { this.release(wear); continue; }
      if (!wear.render && wear.checkedRoot !== root) {
        wear.render = this.patch(root, locked);
        // A previous wreck tint may be awaiting cleanup this frame.
        if (wear.render || !this.hasLocked(root, locked)) wear.checkedRoot = root;
      }
      if (wear.render) {
        count++;
        this.shade(wear.render, Math.min(4, Math.ceil(wear.score)));
      }
    }
  }

  private hasLocked(root: T.Object3D, locked: (mesh: T.Mesh) => boolean) {
    let result = false;
    root.traverse(o => { if (o instanceof T.Mesh && locked(o)) result = true; });
    return result;
  }

  private patch(root: T.Object3D, locked: (mesh: T.Mesh) => boolean): RenderPatch | undefined {
    const carPaint = paintByCar[root.userData.collectionVehicle as string];
    const bike = bikeAssets.has(root.userData.bikeAsset as string);
    if (!bike && !carPaint) return;
    const patch: RenderPatch = { root, meshes: [], copies: new Map(), level: 0 };
    root.traverse(o => {
      if (!(o instanceof T.Mesh) || o instanceof T.SkinnedMesh || locked(o)) return;
      if (bike && o.name !== 'Frame') return;
      for (let parent: T.Object3D | null = o; parent && parent !== root; parent = parent.parent) {
        if (parent.userData.rollingWheel || /steering-wheel|npc-driver/i.test(parent.name)) return;
      }
      const source = o.material;
      const replace = (m: T.Material) => {
        if (!(m instanceof T.MeshStandardMaterial) || m.transparent || m.alphaTest > 0 ||
            (bike ? m.name !== 'Enamel' : !carPaint?.includes(m.name))) return m;
        let copy = patch.copies.get(m);
        if (!copy && patch.copies.size < maxMaterialsPerActor) {
          copy = m.clone();
          patch.copies.set(m, copy);
        }
        return copy ?? m;
      };
      const replacement = Array.isArray(source) ? source.map(replace) : replace(source);
      if (replacement === source || (Array.isArray(source) && Array.isArray(replacement) &&
          source.every((m, i) => m === replacement[i]))) return;
      patch.meshes.push({ mesh: o, source, replacement });
      o.material = replacement;
    });
    return patch.meshes.length ? patch : undefined;
  }

  private shade(patch: RenderPatch, level: number) {
    if (patch.level === level) return;
    patch.level = level;
    const mix = levelScalars[level];
    for (const [source, copy] of patch.copies) {
      copy.color.copy(source.color).multiplyScalar(1 - mix * 0.16);
      copy.roughness = T.MathUtils.lerp(source.roughness, Math.max(source.roughness, 0.86), mix * 0.72);
      if (source instanceof T.MeshPhysicalMaterial && copy instanceof T.MeshPhysicalMaterial) {
        // Keep the authored shader feature enabled; only its contribution drops.
        copy.clearcoat = source.clearcoat * (1 - mix * 0.7);
        copy.clearcoatRoughness = T.MathUtils.lerp(source.clearcoatRoughness, Math.max(source.clearcoatRoughness, 0.72), mix);
      }
    }
  }

  private release(wear: Wear) {
    const patch = wear.render;
    if (!patch) return;
    for (const { mesh, source, replacement } of patch.meshes) if (mesh.material === replacement) mesh.material = source;
    for (const copy of patch.copies.values()) copy.dispose();
    wear.render = undefined;
    wear.checkedRoot = undefined;
  }

  reset() {
    for (const wear of this.records.values()) this.release(wear);
    this.records.clear();
    this.sequence = 0;
    this.sweepAt = -Infinity;
  }
}
