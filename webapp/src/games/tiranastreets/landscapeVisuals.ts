import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from './shared/world.mjs';
import { polygonContains as insidePolygon } from './shared/architecture.mjs';
type Point = { x: number; z: number };
import {
  RIVER_PATHS,
  offsetPath,
  riverOutline,
  freeLandscape,
  onFootpath,
  nearBridge
} from './shared/landscape.mjs';

const BASE = '/assets/tirana-streets/materials/';
/** A recessed river channel, shared PBR ground surfaces and nearby instanced grass. */
export class LandscapeVisuals {
  group = new T.Group();
  private textures: T.Texture[] = [];
  private disposed = false;
  private time = { value: 0 };
  private cells: { mesh: T.InstancedMesh; x: number; z: number }[] = [];
  private grass: T.MeshStandardMaterial;
  constructor() {
    this.group.name = 'Lana banks, meadow grass and terrain';
    this.grass = this.material('grass_path_2', 0x92ac78);
    this.grass.normalScale.set(0.45, 0.45);
    const stone = this.material('plastered_wall_02', 0x929382);
    const land = new T.Shape([
      new T.Vector2(-1900, -1900),
      new T.Vector2(1900, -1900),
      new T.Vector2(1900, 1900),
      new T.Vector2(-1900, 1900)
    ]);
    for (const r of RIVER_PATHS.filter((r) => r.width >= 8)) {
      const outline = riverOutline(r.line, r.width / 2 + 6.8);
      land.holes.push(
        new T.Path(outline.map((p) => new T.Vector2(p[0], -p[1])))
      );
    }
    const ground = new T.ShapeGeometry(land);
    ground.rotateX(-Math.PI / 2);
    this.mesh(
      ground,
      new T.MeshStandardMaterial({ color: 0xaeb5a1, roughness: 1 })
    );
    const water = new T.MeshPhysicalMaterial({
      color: 0x416664,
      roughness: 0.22,
      metalness: 0.2,
      transparent: true,
      opacity: 0.91,
      envMapIntensity: 0.8,
      clearcoat: 0.55,
      clearcoatRoughness: 0.2
    });
    water.onBeforeCompile = (shader) => {
      shader.uniforms.riverTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec3 riverPosition;'
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nriverPosition = position;'
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float riverTime; varying vec3 riverPosition;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float rippleA=sin(riverPosition.x*3.4+riverPosition.z*1.1-riverTime*1.8);
        float rippleB=cos(riverPosition.x*1.5-riverPosition.z*4.8+riverTime*1.2);
        normal=normalize(normal+vec3(rippleA*.055,rippleB*.045,0.));`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float flow=sin(riverPosition.x*.9+riverPosition.z*3.2-riverTime*1.1)*sin(riverPosition.x*2.1-riverPosition.z*.4+riverTime*.7);
        diffuseColor.rgb*=.92+flow*.08;`
      );
    };
    for (const r of RIVER_PATHS.filter((r) => r.width >= 8)) {
      const outline = riverOutline(r.line, r.width / 2);
      const geo = this.polygon(outline, -1.12);
      this.mesh(geo, water);
      this.mesh(
        this.polygon(riverOutline(r.line, r.width / 2 + 0.3), -1.5),
        new T.MeshStandardMaterial({ color: 0x535348, roughness: 1 })
      );
      for (const side of [-1, 1]) {
        this.bank(
          r.line,
          side * (r.width / 2),
          -1.2,
          side * (r.width / 2 + 2.6),
          -0.55,
          stone
        );
        this.bank(
          r.line,
          side * (r.width / 2 + 2.6),
          -0.55,
          side * (r.width / 2 + 6.8),
          0.025,
          this.grass
        );
        this.bank(
          r.line,
          side * (r.width / 2 + 6.6),
          0.035,
          side * (r.width / 2 + 10.4),
          0.035,
          this.grass,
          true
        );
      }
    }
    for (const road of WORLD.roads.filter((r) => r.bridge)) {
      const dx = road.b[0] - road.a[0],
        dz = road.b[1] - road.a[1],
        length = Math.hypot(dx, dz);
      if (length < 4) continue;
      const deck = new T.BoxGeometry(road.w + 4.8, 0.36, length + 0.12);
      deck.rotateY(Math.atan2(dx, dz));
      deck.translate(
        (road.a[0] + road.b[0]) / 2,
        -0.025,
        (road.a[1] + road.b[1]) / 2
      );
      this.mesh(deck, stone);
    }
    for (const park of WORLD.parks)
      this.mesh(this.polygon(park, 0.043), this.grass);
    this.grassTufts();
  }
  private material(asset: string, color: number) {
    const material = new T.MeshStandardMaterial({ color, roughness: 0.96 });
    const loader = new T.TextureLoader();
    for (const [channel, key] of [
      ['diff', 'map'],
      ['nor_gl', 'normalMap'],
      ['rough', 'roughnessMap']
    ] as const) {
      loader.load(BASE + asset + '-' + channel + '.jpg', (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.anisotropy = 4;
        if (key === 'map') texture.colorSpace = T.SRGBColorSpace;
        material[key] = texture;
        material.needsUpdate = true;
        this.textures.push(texture);
      });
    }
    return material;
  }
  private mesh(geometry: T.BufferGeometry, material: T.Material) {
    const mesh = new T.Mesh(geometry, material);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  private polygon(points: number[][], y: number) {
    const g = new T.ShapeGeometry(
      new T.Shape(points.map((p) => new T.Vector2(p[0], -p[1])))
    );
    g.rotateX(-Math.PI / 2);
    g.translate(0, y, 0);
    this.uv(g);
    return g;
  }
  private uv(g: T.BufferGeometry) {
    const p = g.getAttribute('position'),
      uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, p.getX(i) / 2.2, p.getZ(i) / 2.2);
  }
  private bank(
    line: number[][],
    inner: number,
    y1: number,
    outer: number,
    y2: number,
    mat: T.Material,
    cutRoads = false
  ) {
    const a = offsetPath(line, inner),
      b = offsetPath(line, outer),
      parts: T.BufferGeometry[] = [];
    for (let i = 1; i < line.length; i++) {
      const len = Math.hypot(
          line[i][0] - line[i - 1][0],
          line[i][1] - line[i - 1][1]
        ),
        n = Math.max(1, Math.ceil(len / 4));
      for (let j = 0; j < n; j++) {
        const t = j / n,
          u = (j + 1) / n,
          mix = (p: number[], q: number[], v: number) =>
            p.map((x, k) => x + (q[k] - x) * v);
        const p = mix(a[i - 1], a[i], t),
          q = mix(a[i - 1], a[i], u),
          r = mix(b[i - 1], b[i], t),
          s = mix(b[i - 1], b[i], u);
        if (cutRoads && !freeLandscape((r[0] + s[0]) / 2, (r[1] + s[1]) / 2))
          continue;
        const g = new T.BufferGeometry();
        g.setAttribute(
          'position',
          new T.Float32BufferAttribute(
            [
              p[0],
              y1,
              p[1],
              r[0],
              y2,
              r[1],
              q[0],
              y1,
              q[1],
              q[0],
              y1,
              q[1],
              r[0],
              y2,
              r[1],
              s[0],
              y2,
              s[1]
            ],
            3
          )
        );
        // Both bank directions need upward-facing triangles.
        const pos = g.getAttribute('position');
        if (
          new T.Vector3()
            .subVectors(
              new T.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1)),
              new T.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0))
            )
            .cross(
              new T.Vector3().subVectors(
                new T.Vector3(pos.getX(2), pos.getY(2), pos.getZ(2)),
                new T.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0))
              )
            ).y < 0
        ) {
          for (let v = 0; v < 6; v += 3) {
            const x = pos.getX(v + 1),
              y = pos.getY(v + 1),
              z = pos.getZ(v + 1);
            pos.setXYZ(
              v + 1,
              pos.getX(v + 2),
              pos.getY(v + 2),
              pos.getZ(v + 2)
            );
            pos.setXYZ(v + 2, x, y, z);
          }
        }
        g.setAttribute(
          'uv',
          new T.Float32BufferAttribute(new Float32Array(12), 2)
        );
        this.uv(g);
        g.computeVertexNormals();
        parts.push(g);
      }
    }
    if (parts.length) {
      const merged = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      if (merged) this.mesh(merged, mat);
    }
  }
  private grassTufts() {
    let seed = 9841;
    const rand = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const vertices: number[] = [],
      colors: number[] = [];
    for (let i = 0; i < 14; i++) {
      const angle = rand() * Math.PI * 2,
        x = (rand() - 0.5) * 0.7,
        z = (rand() - 0.5) * 0.7,
        h = 0.16 + rand() * 0.3,
        w = 0.025 + rand() * 0.035;
      const dx = Math.cos(angle) * w,
        dz = Math.sin(angle) * w;
      vertices.push(
        x - dx,
        0,
        z - dz,
        x + dx,
        0,
        z + dz,
        x + Math.cos(angle) * 0.11,
        h,
        z + Math.sin(angle) * 0.11
      );
      colors.push(0.25, 0.35, 0.11, 0.28, 0.4, 0.13, 0.52, 0.62, 0.27);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: T.DoubleSide
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.grassTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float grassTime;'
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
       transformed.x+=sin(grassTime*1.1+instanceMatrix[3].x*.7+instanceMatrix[3].z*.3)*position.y*position.y*.18;`
        );
    };
    const points = new Map<string, { x: number; z: number; y: number }[]>();
    let total = 0;
    const add = (x: number, z: number, y = 0.05) => {
      if (
        total >= 48000 ||
        !freeLandscape(x, z) ||
        onFootpath(x, z) ||
        nearBridge(x, z, 0.8)
      )
        return;
      const key = `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
      if (!points.has(key)) points.set(key, []);
      points.get(key)!.push({ x, z, y });
      total++;
    };
    for (const park of WORLD.parks) {
      const xs = park.map((p) => p[0]),
        zs = park.map((p) => p[1]);
      for (let x = Math.min(...xs); x < Math.max(...xs); x += 2.3)
        for (let z = Math.min(...zs); z < Math.max(...zs); z += 2.3) {
          const px = x + rand() * 1.5,
            pz = z + rand() * 1.5;
          if (insidePolygon(px, pz, park)) add(px, pz);
        }
    }
    for (const r of RIVER_PATHS.filter((r) => r.width >= 8))
      for (const side of [-1, 1]) {
        for (let i = 1; i < r.line.length; i++) {
          const a = r.line[i - 1],
            b = r.line[i],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            len = Math.hypot(dx, dz);
          for (let d = 0; d < len; d += 1.6)
            for (let lane = 0; lane < 2; lane++) {
              const off = (r.width / 2 + 4.5 + lane * 1.2) * side,
                x = a[0] + (dx * d) / len + (dz / len) * off,
                z = a[1] + (dz * d) / len - (dx / len) * off;
              add(
                x,
                z,
                -0.55 + ((Math.abs(off) - r.width / 2 - 2.6) / 4.2) * 0.575
              );
            }
        }
      }
    const object = new T.Object3D();
    for (const [key, list] of points) {
      const mesh = new T.InstancedMesh(geometry, material, list.length);
      list.forEach((p, i) => {
        object.position.set(p.x, p.y, p.z);
        object.rotation.y = rand() * Math.PI * 2;
        object.scale.setScalar(0.7 + rand() * 0.7);
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);
      });
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
      const [x, z] = key.split(',').map(Number);
      this.cells.push({ mesh, x: x * 40 + 20, z: z * 40 + 20 });
    }
  }
  update(target: Point, time: number, battery: boolean) {
    this.time.value = time;
    for (const cell of this.cells)
      cell.mesh.visible =
        Math.hypot(cell.x - target.x, cell.z - target.z) < (battery ? 45 : 105);
  }
  dispose() {
    this.disposed = true;
    this.textures.forEach((t) => t.dispose());
  }
}
