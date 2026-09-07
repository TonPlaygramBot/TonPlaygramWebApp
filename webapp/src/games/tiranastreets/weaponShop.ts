import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHOP, insideShop } from './shared/streetLayout.mjs';
import type { Player } from './shared/engine.mjs';

export const SHOP_DISPLAYS = [
  { model: 'ak47', x: -2.95, y: 2.05, z: -3.72, scale: 1.5 },
  { model: 'q-shotgun', x: -0.9, y: 2.05, z: -3.72, scale: 1.5 },
  { model: 'q-smg', x: 1.1, y: 2.05, z: -3.72, scale: 1.15 },
  { model: 'mosin', x: 3.1, y: 2.05, z: -3.72, scale: 1.6 },
  { model: 'sigsauer', x: -2.35, y: 1.14, z: -2.2, scale: 0.72 },
  { model: 'smith', x: -0.6, y: 1.14, z: -2.2, scale: 0.78 },
  { model: 'uzi', x: 1.45, y: 1.14, z: -2.2, scale: 0.88 }
];
export class WeaponShop {
  group = new T.Group();
  private roof: T.Mesh;
  private door = new T.Group();
  private displays = new Set<number>();
  private textures: T.Texture[] = [];
  private lights: T.PointLight[] = [];
  constructor() {
    this.group.name = 'Arben Arsenal · walk-in shop';
    this.group.position.set(SHOP.x, 0, SHOP.z);
    const metal = new T.MeshStandardMaterial({
      color: 0x23302e,
      roughness: 0.44,
      metalness: 0.55
    });
    const wall = new T.MeshStandardMaterial({
      color: 0xb5b4a7,
      roughness: 0.94
    });
    const timber = new T.MeshStandardMaterial({
      color: 0x725440,
      roughness: 0.75
    });
    const glass = new T.MeshPhysicalMaterial({
      color: 0xc4e0df,
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0.2,
      depthWrite: false,
      side: T.DoubleSide
    });
    const box = (
      m: T.Material,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      parent: T.Object3D = this.group
    ) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = true;
      o.receiveShadow = true;
      parent.add(o);
      return o;
    };
    box(wall, 10, 0.23, 8.4, 0, 0.115, 0);
    const floorTiles = [0x9eaaa6, 0xaeb6ae].map(
      (color) => new T.MeshStandardMaterial({ color, roughness: 0.9 })
    );
    for (let x = -4.5; x < 5; x++)
      for (let z = -3.5; z < 4; z++) {
        const tile = floorTiles[Math.abs(Math.round(x + z)) % 2];
        box(tile, 0.98, 0.012, 0.98, x, 0.238, z);
      }
    box(wall, 0.28, 3.6, 8.4, -4.86, 2.03, 0);
    box(wall, 0.28, 3.6, 8.4, 4.86, 2.03, 0);
    box(wall, 10, 3.6, 0.28, 0, 2.03, -4.06);
    this.roof = box(metal, 10.4, 0.2, 8.8, 0, 3.92, 0);
    for (const side of [-1, 1]) {
      box(metal, 3.75, 0.52, 0.28, side * 3.125, 0.49, 4.06);
      box(glass, 3.48, 2.46, 0.04, side * 3.125, 1.99, 4.07);
      for (const x of [side * 1.3, side * 4.9])
        box(metal, 0.09, 3.15, 0.15, x, 1.83, 4.08);
      box(metal, 3.75, 0.07, 0.12, side * 3.125, 0.76, 4.09);
      box(metal, 3.75, 0.07, 0.12, side * 3.125, 3.23, 4.09);
      box(timber, 0.75, 0.84, 3.5, side * 4.17, 0.65, 0.85);
      box(glass, 0.75, 0.55, 3.5, side * 4.17, 1.345, 0.85);
      for (let z = -0.45; z < 2.5; z += 0.7)
        box(metal, 0.38, 0.21, 0.43, side * 4.17, 1.13, z);
    }
    box(metal, 10, 0.58, 0.32, 0, 3.54, 4.1);
    const sign = this.label(
      'ARBEN  /  ARSENAL',
      8.6,
      0.44,
      '#1b2926',
      '#e2e8d6'
    );
    sign.position.set(0, 3.54, 4.27);
    this.group.add(sign);
    const open = this.label('HAPUR · OPEN', 1.28, 0.3, '#243931', '#b8e9ba');
    open.position.set(3.1, 2.55, 4.11);
    this.group.add(open);
    const interior = this.label(
      'ARMË  ·  MUNICION  ·  PAJISJE',
      6.5,
      0.28,
      '#34403c',
      '#e1e1d3'
    );
    interior.position.set(0, 3.3, -3.87);
    this.group.add(interior);
    // Door opens inward at approach. The collision doorway is the same 2.5 m gap.
    this.door.position.set(-1.2, 0.23, 4.06);
    this.group.add(this.door);
    box(glass, 2.35, 2.82, 0.05, 1.175, 1.41, 0, this.door);
    for (const x of [0, 2.35])
      box(metal, 0.07, 2.89, 0.085, x, 1.445, 0, this.door);
    for (const y of [0, 2.87])
      box(metal, 2.42, 0.06, 0.08, 1.175, y, 0, this.door);
    box(metal, 0.035, 0.4, 0.045, 2.17, 1.35, 0.075, this.door);
    // Counter and pegboard are both visible from the street through the glass.
    box(timber, 6.9, 0.68, 0.85, -0.35, 0.57, -2.225);
    box(metal, 6.94, 0.06, 0.88, -0.35, 0.94, -2.225);
    box(glass, 6.9, 0.4, 0.84, -0.35, 1.16, -2.225);
    box(glass, 6.9, 0.035, 0.84, -0.35, 1.375, -2.225);
    box(metal, 8.9, 1.62, 0.1, 0, 2.27, -3.87);
    for (const x of [-3, -1, 1, 3]) {
      for (const y of [1.9, 2.65]) box(timber, 1.5, 0.045, 0.15, x, y, -3.75);
      const tag = this.label(
        ['AK · RIFLE', 'SHOTGUN', 'SMG', 'MARKSMAN'][(x + 3) / 2],
        1.48,
        0.17,
        '#26312e',
        '#dad9c4'
      );
      tag.position.set(x, 1.57, -3.79);
      this.group.add(tag);
    }
    const terminal = box(metal, 0.3, 0.3, 0.22, 2.85, 1.56, -2.25);
    terminal.rotation.x = -0.18;
    const floorMat = this.label('ARBEN', 1.6, 0.52, '#283732', '#b6c7b6');
    floorMat.rotation.x = -Math.PI / 2;
    floorMat.position.set(0, 0.25, 2.95);
    this.group.add(floorMat);
    const glow = new T.MeshStandardMaterial({
      color: 0xffeed2,
      emissive: 0xffdbad,
      emissiveIntensity: 1.7
    });
    for (const x of [-2.6, 2.6]) {
      box(glow, 2.6, 0.03, 0.11, x, 3.68, -1.1);
      const light = new T.PointLight(0xffe7c4, 11, 8, 2);
      light.position.set(x, 3.1, -1);
      this.group.add(light);
      this.lights.push(light);
    }
    // Threshold/ramp meets the sidewalk without an invisible step.
    const ramp = new T.BufferGeometry();
    ramp.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        [
          -1.25, 0.24, 4.2, 1.25, 0.24, 4.2, -1.25, 0.08, 5.1, 1.25, 0.24, 4.2,
          1.25, 0.08, 5.1, -1.25, 0.08, 5.1
        ],
        3
      )
    );
    ramp.setAttribute(
      'uv',
      new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1], 2)
    );
    ramp.computeVertexNormals();
    const entrance = new T.Mesh(ramp, wall);
    entrance.receiveShadow = true;
    this.group.add(entrance);
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    for (const o of [...this.group.children]) {
      if (
        !(o instanceof T.Mesh) ||
        o === this.roof ||
        Array.isArray(o.material) ||
        o.material.transparent
      )
        continue;
      o.updateMatrix();
      const geometry = o.geometry.clone().applyMatrix4(o.matrix).toNonIndexed();
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches.get(o.material)!.push(geometry);
      o.geometry.dispose();
      this.group.remove(o);
    }
    for (const [material, geos] of batches) {
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (geo) {
        const mesh = new T.Mesh(geo, material);
        mesh.castShadow = mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
  }
  private label(text: string, w: number, h: number, bg: string, color: string) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = bg;
    x.fillRect(0, 0, 1024, 128);
    x.fillStyle = color;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '600 70px Arial';
    x.fillText(text, 512, 67, 960);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    this.textures.push(t);
    return new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ map: t, roughness: 0.6, side: T.DoubleSide })
    );
  }
  update(target: Player | undefined, models: Map<string, T.Group>) {
    const near =
      !!target && Math.hypot(target.x - SHOP.x, target.z - SHOP.z - 4) < 6;
    this.door.rotation.y = T.MathUtils.lerp(
      this.door.rotation.y,
      near || (!!target && insideShop(target)) ? Math.PI / 2 : 0,
      0.13
    );
    this.roof.visible = !target || !insideShop(target);
    this.lights.forEach(
      (l) =>
        (l.visible =
          !!target && Math.hypot(target.x - SHOP.x, target.z - SHOP.z) < 30)
    );
    SHOP_DISPLAYS.forEach((s, i) => {
      if (this.displays.has(i) || !models.has(s.model)) return;
      const g = models.get(s.model)!.clone(true);
      g.scale.setScalar(s.scale);
      g.rotation.set(i < 4 ? 0 : Math.PI / 2, Math.PI / 2, 0);
      g.position.set(s.x, s.y, s.z);
      this.group.add(g);
      this.displays.add(i);
    });
  }
  dispose() {
    this.textures.forEach((t) => t.dispose());
  }
}
