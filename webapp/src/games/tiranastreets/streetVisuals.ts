import { STREET_PROPS } from './shared/streetDressing.mjs';
import { RAILINGS, RIVER_TREES } from './shared/landscape.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from './shared/world.mjs';
import { polygonContains as insidePolygon } from './shared/architecture.mjs';
type Point = { x: number; z: number };
import {
  pavementHeight,
  SIGNALS,
  SHOP,
  onCarriageway,
  signalPhase,
  pedestrianGreen
} from './shared/streetLayout.mjs';

type Placement = Point & { yaw: number; scale: number; length?: number };
/** Static surfaces are merged; repeated GLTF fixtures are instanced in city cells. */
export class StreetVisuals {
  group = new T.Group();
  private tiles: { group: T.Group; x: number; z: number; lod: number }[] = [];
  private lights: {
    signal: (typeof SIGNALS)[number];
    lens: T.Mesh;
    walk: T.Mesh;
    baseY: number;
  }[] = [];
  private textures: T.Texture[] = [];
  private wind = { value: 0 };
  private phases = ['red', 'amber', 'green'] as const;
  private phaseMaterials = [0xff3e26, 0xffb326, 0x66e490].map(
    (color) =>
      new T.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 1.5,
        roughness: 0.35
      })
  );
  private off = new T.MeshStandardMaterial({ color: 0x172122, roughness: 0.4 });
  constructor(
    private source: T.Group,
    points: Point[]
  ) {
    this.group.name = 'Tirana streets and local GLTF fixtures';
    this.surfaceMaterials();
    this.pavements();
    const placements = new Map<string, Placement[]>();
    const add = (name: string, x: number, z: number, yaw = 0, scale = 1) => {
      if (!placements.has(name)) placements.set(name, []);
      placements.get(name)!.push({ x, z, yaw, scale });
    };
    const free = (x: number, z: number) =>
      !onCarriageway(x, z, 0.35) &&
      Math.abs(x - SHOP.x) + Math.abs(z - SHOP.z) > 13 &&
      !WORLD.buildings.some((b) => insidePolygon(x, z, b.p));
    [...points, ...RIVER_TREES]
      .filter(
        (p) =>
          free(p.x, p.z) &&
          !STREET_PROPS.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 2.5)
      )
      .forEach((p, i) =>
        add(
          ['tree_plane', 'tree_linden', 'tree_cypress'][i % 3],
          p.x,
          p.z,
          i * 2.399,
          0.82 + (i % 7) * 0.065
        )
      );
    const roads = WORLD.roads.filter(
      (r) =>
        !r.walk &&
        !r.bridge &&
        Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) > 24
    );
    const occupied: Point[] = [];
    roads.forEach((r, i) => {
      const dx = r.b[0] - r.a[0],
        dz = r.b[1] - r.a[1],
        length = Math.hypot(dx, dz),
        yaw = Math.atan2(dx, dz),
        rx = dz / length,
        rz = -dx / length;
      const d = Math.min(length * 0.5, 18),
        x = r.a[0] + (dx / length) * d + rx * (r.w / 2 + 1.65),
        z = r.a[1] + (dz / length) * d + rz * (r.w / 2 + 1.65);
      if (
        !free(x, z) ||
        occupied.some((p) => Math.hypot(p.x - x, p.z - z) < 22)
      )
        return;
      occupied.push({ x, z });
      add('street_lamp', x, z, yaw - Math.PI / 2);
      if (i % 3 === 0) {
        add(
          'park_bench',
          x + (dx / length) * 3,
          z + (dz / length) * 3,
          yaw - Math.PI / 2
        );
        add('litter_bin', x + (dx / length) * 5, z + (dz / length) * 5);
      }
      if (i % 2 === 0) {
        const tx = x - (dx / length) * 6,
          tz = z - (dz / length) * 6;
        if (
          free(tx, tz) &&
          !STREET_PROPS.some((q) => Math.hypot(q.x - tx, q.z - tz) < 2.5)
        ) {
          add('tree_linden', tx, tz, yaw, 0.83 + (i % 4) * 0.08);
          add('tree_grate', tx, tz, yaw);
        }
      }
      if (i % 3 === 0) {
        const x2 = r.a[0] + dx * 0.5 + rx * (r.w / 2 - 0.28),
          z2 = r.a[1] + dz * 0.5 + rz * (r.w / 2 - 0.28);
        add('drain', x2, z2, yaw);
      }
      if (r.name && i % 5 === 0) {
        add('street_sign', x, z, yaw);
        const face = this.textFace(
          r.name.replace(/^Rruga /, 'Rr. '),
          2.35,
          0.46,
          '#165591',
          '#f4f5ed'
        );
        face.position.set(x, 2.485 + pavementHeight(x, z), z);
        face.rotation.y = yaw;
        face.translateZ(0.044);
        this.group.add(face);
      }
      // Sparse, deterministic social terraces and roadside advertising add
      // recognizable activity without blocking lanes or flooding mobile GPUs.
      if (i % 17 === 0) {
        const ax = x + (dx / length) * 8,
          az = z + (dz / length) * 8;
        if (free(ax, az)) {
          add('cafe_terrace', ax, az, yaw - Math.PI / 2, 0.92);
          add('litter_bin', ax + (dx / length) * 2.4, az + (dz / length) * 2.4);
        }
      }
      if (i % 31 === 0) {
        const bx = x - (dx / length) * 9,
          bz = z - (dz / length) * 9;
        if (free(bx, bz)) {
          add('city_billboard', bx, bz, yaw - Math.PI / 2, 0.88);
          const advert = this.textFace('TIRANA · JETO QYTETIN', 3.62, 1.58, '#ebd7ad', '#9f242d');
          advert.position.set(bx, 3.55 + pavementHeight(bx, bz), bz);
          advert.rotation.y = yaw - Math.PI / 2;
          advert.translateZ(0.1);
          this.group.add(advert);
        }
      }
    });
    for (const s of SIGNALS) {
      const rx = Math.cos(s.yaw),
        rz = -Math.sin(s.yaw),
        x = s.x + rx * (s.width / 2 + 0.48),
        z = s.z + rz * (s.width / 2 + 0.48);
      if (!free(x, z)) continue;
      add('traffic_light', x, z, s.yaw);
      const baseY = pavementHeight(x, z) + 0.005;
      const lens = new T.Mesh(
        new T.CircleGeometry(0.118, 16),
        this.phaseMaterials[0]
      );
      lens.position.set(x, 3.83 + baseY, z);
      lens.rotation.y = s.yaw;
      lens.translateZ(0.181);
      this.group.add(lens);
      const walk = new T.Mesh(new T.PlaneGeometry(0.19, 0.26), this.off);
      walk.position.set(x, 1.85 + baseY, z);
      walk.rotation.y = s.yaw;
      walk.translateZ(0.09);
      this.group.add(walk);
      this.lights.push({ signal: s, lens, walk, baseY });
      add('road_sign', x + Math.sin(s.yaw) * 3, z + Math.cos(s.yaw) * 3, s.yaw);
      const speed = this.textFace('30', 0.58, 0.58, '#e2e4df', '#182128');
      speed.position.set(
        x + Math.sin(s.yaw) * 3,
        2.225 +
          pavementHeight(x + Math.sin(s.yaw) * 3, z + Math.cos(s.yaw) * 3),
        z + Math.cos(s.yaw) * 3
      );
      speed.rotation.y = s.yaw;
      speed.translateZ(0.049);
      this.group.add(speed);
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++)
          add(
            'bollard',
            s.x +
              rx * (s.width / 2 + 0.4) * side +
              Math.sin(s.yaw) * (k * 1.5 - 2),
            s.z +
              rz * (s.width / 2 + 0.4) * side +
              Math.cos(s.yaw) * (k * 1.5 - 2)
          );
      }
    }
    this.instance(
      'iron_railing',
      RAILINGS.map((r) => ({
        x: r.x,
        z: r.z,
        yaw: r.yaw,
        scale: 1,
        length: r.length
      }))
    );
    for (const p of STREET_PROPS) add(p.name, p.x, p.z, p.yaw);
    for (const [name, items] of placements) {
      this.instance(name, items);
      if (['tree_plane', 'tree_linden', 'tree_cypress'].includes(name))
        this.instance(name + '_lod', items);
    }
    source.visible = false;
    this.group.add(source);
  }
  private surfaceMaterials() {
    const loader = new T.TextureLoader();
    const texture = (name: string, color = false) => {
      const tex = loader.load('/assets/tirana-streets/materials/' + name);
      if (color) tex.colorSpace = T.SRGBColorSpace;
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.anisotropy = 4;
      this.textures.push(tex);
      return tex;
    };
    const barkColor = texture('bark_brown_02-diff.jpg', true),
      barkNormal = texture('bark_brown_02-nor_gl.jpg'),
      barkRough = texture('bark_brown_02-rough.jpg'),
      paverAO = texture('pavement_02-ao.jpg');
    const seen = new Set<T.Material>();
    this.source.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!(m instanceof T.MeshStandardMaterial) || seen.has(m)) continue;
        seen.add(m);
        if (m.name === 'Weathered bark') {
          m.color.set(0xffffff);
          m.map = barkColor;
          m.normalMap = barkNormal;
          m.normalScale.set(0.65, 0.65);
          m.roughnessMap = barkRough;
        }
        if (
          m.name === 'Scanned_concrete_pavers' ||
          m.name === 'Scanned concrete pavers'
        ) {
          m.aoMap = paverAO;
          m.aoMapIntensity = 0.6;
          for (const tex of [m.map, m.normalMap, m.roughnessMap])
            if (tex) {
              tex.wrapS = tex.wrapT = T.RepeatWrapping;
              tex.anisotropy = 4;
            }
        }
        if (m.name.startsWith('Foliage')) {
          m.envMapIntensity = 0.65;
          m.onBeforeCompile = (shader) => {
            shader.uniforms.streetWind = this.wind;
            shader.vertexShader =
              'uniform float streetWind;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `
              #include <begin_vertex>
              #ifdef USE_INSTANCING
                float gust = sin(streetWind * 1.6 + instanceMatrix[3].x * .17 + instanceMatrix[3].z * .11 + position.y);
                transformed.x += gust * .055 * clamp(position.y / 5., 0., 1.);
                transformed.z += sin(streetWind + position.x * 2.3) * .025;
              #endif
            `
            );
          };
          m.customProgramCacheKey = () => 'tirana-leaf-breeze-v1';
        }
        m.needsUpdate = true;
      }
    });
  }
  private textFace(
    text: string,
    w: number,
    h: number,
    background: string,
    color: string
  ) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = color;
    ctx.font = `600 ${text.length > 24 ? 25 : 34}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 67, 476);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    this.textures.push(tex);
    return new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({
        map: tex,
        roughness: 0.55,
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1
      })
    );
  }
  private instance(name: string, items: Placement[]) {
    const template = this.source.getObjectByName(name);
    if (!template) return;
    template.updateMatrixWorld(true);
    const cells = new Map<string, Placement[]>();
    for (const p of items) {
      const k = `${Math.floor(p.x / 90)},${Math.floor(p.z / 90)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k)!.push(p);
    }
    for (const [key, list] of cells) {
      const group = new T.Group(),
        [cx, cz] = key.split(',').map(Number),
        m = new T.Object3D();
      template.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        const instances = new T.InstancedMesh(
          o.geometry,
          o.material,
          list.length
        );
        instances.castShadow =
          name.startsWith('tree') ||
          [
            'street_lamp',
            'bus_shelter',
            'utility_cabinet',
            'stone_planter'
          ].includes(name);
        instances.receiveShadow = true;
        list.forEach((p, i) => {
          m.position.set(p.x, pavementHeight(p.x, p.z) + 0.005, p.z);
          m.rotation.set(0, p.yaw, 0);
          m.scale.set(p.scale, p.scale, p.length ? p.length / 2.6 : p.scale);
          m.updateMatrix();
          instances.setMatrixAt(
            i,
            new T.Matrix4().multiplyMatrices(m.matrix, o.matrixWorld)
          );
        });
        instances.computeBoundingSphere();
        group.add(instances);
      });
      this.group.add(group);
      this.tiles.push({
        group,
        x: cx * 90 + 45,
        z: cz * 90 + 45,
        lod: name.endsWith('_lod')
          ? 2
          : ['tree_plane', 'tree_linden', 'tree_cypress'].includes(name)
            ? 1
            : 0
      });
    }
  }
  private pavements() {
    const pavement = this.source.getObjectByName('pavement_network');
    if (pavement) {
      pavement.updateMatrixWorld(true);
      for (const source of pavement.children) {
        if (!(source instanceof T.Mesh)) continue;
        const mesh = source.clone();
        mesh.applyMatrix4(pavement.matrixWorld);
        mesh.receiveShadow = true;
        const group = new T.Group();
        group.add(mesh);
        this.group.add(group);
        const box = new T.Box3().setFromObject(mesh),
          center = box.getCenter(new T.Vector3());
        this.tiles.push({ group, x: center.x, z: center.z, lod: 0 });
      }
    }
    const paint: T.BufferGeometry[] = [];
    for (const s of SIGNALS) {
      const rx = Math.cos(s.yaw),
        rz = -Math.sin(s.yaw),
        ux = Math.sin(s.yaw),
        uz = Math.cos(s.yaw);
      for (let d = -s.width / 2 + 0.4; d < s.width / 2 - 0.2; d += 0.95) {
        const g = new T.PlaneGeometry(0.48, 2.6);
        g.rotateX(-Math.PI / 2);
        g.rotateY(s.yaw);
        g.translate(s.x + rx * d - ux * 2.1, 0.105, s.z + rz * d - uz * 2.1);
        paint.push(g);
      }
      const stop = new T.PlaneGeometry(s.width / 2 - 0.3, 0.28);
      stop.rotateX(-Math.PI / 2);
      stop.rotateY(s.yaw);
      stop.translate(
        s.x + rx * s.width * 0.25 + ux * 0.75,
        0.109,
        s.z + rz * s.width * 0.25 + uz * 0.75
      );
      paint.push(stop);
    }
    const merge = (geos: T.BufferGeometry[], material: T.Material) => {
      if (!geos.length) return;
      const g = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (g) {
        const m = new T.Mesh(g, material);
        m.receiveShadow = true;
        this.group.add(m);
      }
    };
    merge(
      paint,
      new T.MeshStandardMaterial({
        color: 0xe5e4d8,
        roughness: 0.87,
        polygonOffset: true,
        polygonOffsetFactor: -2
      })
    );
  }
  update(camera: T.Vector3, time: number, quality: string) {
    const radius = quality === 'battery' ? 160 : 330;
    this.wind.value = time;
    const detailDistance = quality === 'battery' ? 65 : 115;
    for (const cell of this.tiles) {
      const distance = Math.hypot(camera.x - cell.x, camera.z - cell.z);
      cell.group.visible =
        distance < radius &&
        (cell.lod === 0 ||
          (cell.lod === 1
            ? distance < detailDistance
            : distance >= detailDistance));
    }
    for (const { signal, lens, walk, baseY } of this.lights) {
      const phase = signalPhase(signal, time),
        index = this.phases.indexOf(phase);
      lens.material = this.phaseMaterials[index];
      lens.position.y = baseY + [3.83, 3.45, 3.07][index];
      walk.material = pedestrianGreen(signal, time)
        ? this.phaseMaterials[2]
        : this.phaseMaterials[0];
      lens.visible = walk.visible =
        Math.hypot(camera.x - signal.x, camera.z - signal.z) < radius;
    }
  }
  dispose() {
    this.textures.forEach((t) => t.dispose());
    this.phaseMaterials.forEach((m) => m.dispose());
    this.off.dispose();
  }
}
