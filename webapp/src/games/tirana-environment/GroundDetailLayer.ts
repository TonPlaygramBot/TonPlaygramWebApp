import * as T from 'three';
import { insideRing, PAVING_REFERENCES } from './surfaceCore.mjs';
import { clipParkGround } from './parkGroundCore.mjs';
import { RacingVegetation } from '../kartroyale/RacingVegetation';
import type { StreetDetailOptions } from '../tirana-street-detail/StreetDetailLayer';
type Polygon = number[][][];
/** Add detail only inside recorded green/paved polygons. Trees are authored
 * infill within those boundaries, NOT claimed satellite-detected tree centres. */
export class GroundDetailLayer {
  readonly group = new T.Group();
  private dead = false;
  private disposed = false;
  private textures = new Set<T.Texture>();
  private vegetation?: RacingVegetation;
  constructor(
    world: any,
    options: StreetDetailOptions = {},
    errors: string[] = []
  ) {
    this.group.name = 'Tirana:mapped-park-ground-and-stone-paving';
    this.group.userData = {
      references: PAVING_REFERENCES,
      accuracy:
        'Existing OSM area boundaries; authored textures and vegetation infill'
    };
    const parks = clipParkGround(world, options.track, errors);
    const make = (polygon: Polygon, y: number) => {
      const shape = new T.Shape(
        polygon[0].map((p) => new T.Vector2(p[0], -p[1]))
      );
      for (const h of polygon.slice(1))
        shape.holes.push(new T.Path(h.map((p) => new T.Vector2(p[0], -p[1]))));
      const geo = new T.ShapeGeometry(shape)
          .rotateX(-Math.PI / 2)
          .translate(0, y, 0),
        pos = geo.getAttribute('position'),
        uv = geo.getAttribute('uv');
      for (let i = 0; i < pos.count; i++)
        uv.setXY(i, pos.getX(i) / 6, pos.getZ(i) / 6);
      return geo;
    };
    const add = (polygons: Polygon[], y: number, material: T.Material) => {
      for (const p of polygons) {
        const geo = make(p, y),
          mesh = new T.Mesh(geo, material);
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    };
    const grass = new T.MeshStandardMaterial({
      color: '#83916c',
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
    add(parks, options.profile === 'racing' ? 0.02 : 0.061, grass);
    const loader = new T.TextureLoader();
    for (const [file, key] of [
      ['grass_path_2-diff.jpg', 'map'],
      ['grass_path_2-nor_gl.jpg', 'normalMap'],
      ['grass_path_2-rough.jpg', 'roughnessMap']
    ] as const) {
      const t = loader.load(
        '/assets/tirana-streets/materials/' + file,
        (tex) => {
          if (this.dead) {
            tex.dispose();
            return;
          }
          tex.wrapS = tex.wrapT = T.RepeatWrapping;
          if (key === 'map') tex.colorSpace = T.SRGBColorSpace;
          grass[key] = tex;
          grass.normalScale.set(0.22, 0.22);
          grass.needsUpdate = true;
        },
        undefined,
        () => {
          if (!this.dead) errors.push(`Ground texture: ${file}`);
        }
      );
      this.textures.add(t);
    }
    const square = world.landmarks?.find((p: any) => p.id === 'square');
    // Change only mapped pedestrian areas containing the documented square anchor.
    if (square && !options.track) {
      const area = (world.areas || []).filter((p: number[][]) =>
        insideRing([square.x, square.z], p)
      );
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2048;
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#817b70';
      c.fillRect(0, 0, 2048, 2048);
      const palette = [
        '#b5aa98',
        '#a69a88',
        '#c5baaa',
        '#d6c9b8',
        '#94877b',
        '#b6a093'
      ];
      let seed = 34;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          c.fillStyle = palette[seed % palette.length];
          c.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
        }
      const tex = new T.CanvasTexture(canvas);
      tex.colorSpace = T.SRGBColorSpace;
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      this.textures.add(tex);
      const material = new T.MeshStandardMaterial({
        map: tex,
        roughness: 0.82,
        polygonOffset: true,
        polygonOffsetFactor: -2
      });
      add(
        area.map((p: number[][]) => [p]),
        0.072,
        material
      );
    }
    if (options.profile === 'racing' && options.track) {
      this.vegetation = new RacingVegetation(parks, options.track, errors);
      this.group.add(this.vegetation.group);
    }
  }
  update(viewer?: { x: number; z: number }, battery = false) {
    if (this.dead) return;
    this.vegetation?.update(viewer, battery);
  }
  retire() {
    this.dead = true;
    this.vegetation?.retire();
  }
  private release(root: T.Object3D) {
    const g = new Set<T.BufferGeometry>(),
      m = new Set<T.Material>(),
      t = new Set<T.Texture>();
    root.traverse((o) => {
      if (o instanceof T.Mesh) {
        g.add(o.geometry);
        for (const mat of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          m.add(mat);
          for (const v of Object.values(mat))
            if (v instanceof T.Texture) t.add(v);
        }
      }
    });
    g.forEach((x) => x.dispose());
    m.forEach((x) => x.dispose());
    t.forEach((x) => x.dispose());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.retire();
    this.vegetation?.dispose();
    this.release(this.group);
    for (const t of this.textures) t.dispose();
    this.group.removeFromParent();
  }
}
