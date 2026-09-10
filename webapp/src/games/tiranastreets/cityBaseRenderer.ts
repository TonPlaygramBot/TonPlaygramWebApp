import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CityFacades, DETAIL_IDS } from "./cityVisuals";
import { LivingVisuals } from "./livingVisuals";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  WORLD,
  SPAWN,
  insidePolygon,
  cameraDistance,
  type State,
  type Point,
} from "./shared/engine.mjs";

import { ReferenceFacades } from '../tirana-city-source/ReferenceFacades';
import { REFERENCE_BUILDINGS } from '../tirana-city-source/profiles.mjs';
import { LANDMARK_REPLACED_IDS } from '../tirana-city-source/landmarkCatalog.mjs';
import { MAPPED_TREES } from '../tirana-city-source/registry.mjs';

const ASSETS = "/assets/tirana-streets/";
const Y = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Object3D();
const smoothAngle = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
type Actor = {
  group: THREE.Group;
  mixer?: THREE.AnimationMixer;
  idle?: THREE.AnimationAction;
  run?: THREE.AnimationAction;
  moving?: boolean;
  wheels: THREE.Object3D[];
  model: string;
  walk?: THREE.AnimationAction;
};

export class CityRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1, 0.15, 1800);
  yaw = 0;
  pitch = 0.32;
  firstPerson = false;
  fps = 60;
  quality: "auto" | "high" | "battery" = "auto";
  ready = false;
  disposed = false;
  private root: HTMLDivElement;
  private clock = 0;
  private sampleTime = 0;
  private sampleStamp = performance.now();
  private frames = 0;
  private dpr = 1.5;
  private observer: ResizeObserver;
  private models = new Map<string, THREE.Group>();
  private actors = new Map<string, Actor>();
  private animations: THREE.AnimationClip[] = [];
  private sunlight = new THREE.DirectionalLight(0xffe3a4, 3.4);
  private routeLine: THREE.Line | null = null;
  private beacon = new THREE.Group();
  private cityChunks: THREE.Group[] = [];
  private shellMaterials: THREE.MeshStandardMaterial[] = [];
  private facades: CityFacades | null = null;
  private living: LivingVisuals;
  private worldTextures = new Set<THREE.Texture>();
  private manualUntil = 0;
  private lastTarget = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
  private landmarkText: THREE.Sprite[] = [];
  readonly referenceFacades = new ReferenceFacades();
  private treePoints: Point[] = [];
  private mappedTreeCells: {group: THREE.Group; x:number; z:number}[] = [];
  constructor(root: HTMLDivElement) {
    this.root = root;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.65);
    this.renderer.setPixelRatio(this.dpr);
    root.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color("#b8d0d1");
    this.scene.fog = new THREE.FogExp2("#b8c6bf", 0.00085);
    this.scene.add(new THREE.HemisphereLight(0xc8e6f5, 0x8a7e60, 2.1));
    this.sunlight.position.set(-100, 160, -90);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sunlight.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 420,
    });
    this.sunlight.shadow.bias = -0.0007;
    this.sunlight.shadow.normalBias = 0.08;
    this.scene.add(this.sunlight, this.sunlight.target);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3800, 3800),
      new THREE.MeshStandardMaterial({ color: 0xaeb5a1, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const environment = new RoomEnvironment(this.renderer);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.worldTextures.add(this.scene.environment);
    environment.dispose();
    pmrem.dispose();
    this.living = new LivingVisuals();
    this.scene.add(this.living.group);
    this.buildStreets();
    this.buildBlocks();
    this.scene.add(this.referenceFacades.group);
    this.buildLandmarks();
    this.buildBeacon();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(root);
    this.resize();
  }
  private material(
    color: number | string,
    options: THREE.MeshStandardMaterialParameters = {},
  ) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      ...options,
    });
  }
  private box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    group: THREE.Object3D = this.scene,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  private polygon(
    points: number[][],
    height: number,
    color: number,
    y = 0.035,
  ) {
    if (points.length < 3) return;
    const shape = new THREE.Shape(
      points.map((p) => new THREE.Vector2(p[0], -p[1])),
    );
    const geo = height
      ? new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
          steps: 1,
        })
      : new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y, 0);
    const mesh = new THREE.Mesh(geo, this.material(color));
    mesh.receiveShadow = true;
    mesh.castShadow = !!height;
    this.scene.add(mesh);
    return mesh;
  }
  private strip(a: number[], b: number[], w: number, y: number) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    const g = new THREE.PlaneGeometry(w, length + 0.2);
    g.rotateX(-Math.PI / 2);
    g.rotateY(Math.atan2(dx, dz));
    g.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
    const positions = g.getAttribute("position"),
      uv = g.getAttribute("uv");
    for (let i = 0; i < positions.count; i++)
      uv.setXY(i, positions.getX(i) / 8, positions.getZ(i) / 8);
    return g;
  }
  private merged(
    geos: THREE.BufferGeometry[],
    mat: THREE.Material,
    group: THREE.Object3D = this.scene,
  ) {
    if (!geos.length) return;
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  private buildStreets() {
    for (const p of WORLD.parks) this.polygon(p, 0, 0x6e8754, 0.04);
    for (const p of WORLD.areas) this.polygon(p, 0, 0xc7b8a0, 0.06);
    const paving = this.material(0xb8aea0),
      asphalt = this.material(0x555d5c),
      foot = this.material(0xc3b9a1),
      white = this.material(0xe9e3c7);
    const roadGeo: THREE.BufferGeometry[] = [],
      walkGeo: THREE.BufferGeometry[] = [],
      sideGeo: THREE.BufferGeometry[] = [],
      paintGeo: THREE.BufferGeometry[] = [];
    for (const r of WORLD.roads) {
      const len = Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1]);
      (r.walk ? walkGeo : roadGeo).push(
        this.strip(r.a, r.b, r.w, r.bridge ? 0.16 : 0.09),
      );
      if (!r.walk) {
        sideGeo.push(this.strip(r.a, r.b, r.w + 3.8, 0.07));
        if (r.w > 5 && len > 5)
          for (let d = 1; d < len - 2; d += 8) {
            const n = Math.min(d + 3, len),
              a = r.a.map((v, i) => v + ((r.b[i] - v) * d) / len),
              b = r.a.map((v, i) => v + ((r.b[i] - v) * n) / len);
            paintGeo.push(this.strip(a, b, 0.13, 0.18));
          }
      }
    }
    this.merged(sideGeo, paving);
    this.merged(roadGeo, asphalt);
    this.merged(walkGeo, foot);
    this.merged(paintGeo, white);
    const loader = new THREE.TextureLoader();
    // Local PBR road textures are shared by all road segments; no runtime asset CDN.
    loader.load(ASSETS + "asphalt-diff.jpg", (t) => {
      if (this.disposed) {
        t.dispose();
        return;
      }
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      asphalt.map = t;
      asphalt.color.set(0xa6a6a6);
      asphalt.needsUpdate = true;
      this.worldTextures.add(t);
    });
    for (const [file, key] of [
      ["asphalt-nor_gl.jpg", "normalMap"],
      ["asphalt-rough.jpg", "roughnessMap"],
    ] as const)
      loader.load(ASSETS + file, (t) => {
        if (this.disposed) {
          t.dispose();
          return;
        }
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        asphalt[key] = t;
        asphalt.normalScale.set(0.3, 0.3);
        asphalt.needsUpdate = true;
        this.worldTextures.add(t);
      });
    for (const water of WORLD.water) {
      if (Array.isArray(water)) this.polygon(water, 0, 0x507f83, 0.075);
      else {
        const geos = water.line
          .slice(1)
          .map((b, i) => this.strip(water.line[i], b, water.width, 0.075));
        this.merged(
          geos,
          this.material(0x497a7e, { metalness: 0.3, roughness: 0.25 }),
        );
      }
    }
    // Far mountains give the basin a horizon, outside the playable OSM district.
    const mountainMat = this.material(0x7e9b9c);
    for (let i = 0; i < 13; i++) {
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(260 + (i % 3) * 50, 160 + (i % 4) * 45, 6),
        mountainMat,
      );
      mountain.position.set(1600 + (i % 2) * 180, 30, -1200 + i * 240);
      mountain.rotation.y = i;
      this.scene.add(mountain);
    }
  }
  private buildBlocks() {
    const colors = [
      0xc9bda7, 0xaebbaf, 0xdfbd9d, 0xe1d2b7, 0x909a96, 0xdab48e, 0xbfa9a6,
      0xcdd3c6,
    ];
    const buckets = new Map<
      string,
      { geos: THREE.BufferGeometry[][]; group: THREE.Group }
    >();
    const windowGeos: THREE.BufferGeometry[] = [];
    for (const b of WORLD.buildings) {
      if (b.special || REFERENCE_BUILDINGS[b.id] || LANDMARK_REPLACED_IDS.has(String(b.id))) continue;
      const cx = b.p.reduce((s, p) => s + p[0], 0) / b.p.length,
        cz = b.p.reduce((s, p) => s + p[1], 0) / b.p.length;
      // Eight city shell draws are cheaper on phones than hundreds of tiny chunks.
      const key = "city";
      if (!buckets.has(key)) {
        const group = new THREE.Group();
        group.userData.center = { x: cx, z: cz };
        this.scene.add(group);
        this.cityChunks.push(group);
        buckets.set(key, { geos: colors.map(() => []), group });
      }
      const shape = new THREE.Shape(
        b.p.map(
          (p) =>
            new THREE.Vector2(
              DETAIL_IDS.has(b.id) ? cx + (p[0] - cx) * 0.73 : p[0],
              -(DETAIL_IDS.has(b.id) ? cz + (p[1] - cz) * 0.73 : p[1]),
            ),
        ),
      );
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: b.h,
        bevelEnabled: false,
        steps: 1,
      });
      geo.rotateX(-Math.PI / 2);
      const pos = geo.getAttribute("position"),
        normal = geo.getAttribute("normal"),
        uv = geo.getAttribute("uv");
      for (let i = 0; i < pos.count; i++)
        uv.setXY(
          i,
          (Math.abs(normal.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i)) / 5,
          Math.abs(normal.getY(i)) > 0.5 ? pos.getZ(i) / 5 : pos.getY(i) / 5,
        );
      buckets.get(key)!.geos[Number(b.id) % colors.length].push(geo);
      if (DETAIL_IDS.has(b.id)) continue;
      // Window ribbons follow actual facades; geometry is merged, not thousands of draw calls.
      for (let i = 0; i < b.p.length; i++) {
        const a = b.p[i],
          c = b.p[(i + 1) % b.p.length],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          length = Math.hypot(dx, dz);
        if (length < 6 || length > 120) continue;
        for (let y = 4; y < b.h - 1; y += 3.3) {
          const g = new THREE.BoxGeometry(Math.max(1, length - 2), 1.25, 0.16);
          g.rotateY(-Math.atan2(dz, dx));
          g.translate((a[0] + c[0]) / 2, y, (a[1] + c[1]) / 2);
          windowGeos.push(g);
        }
      }
    }
    for (const bucket of buckets.values())
      bucket.geos.forEach((geos, i) => {
        const material = this.material(colors[i]);
        this.shellMaterials.push(material);
        const mesh = this.merged(geos, material, bucket.group);
        if (mesh) mesh.castShadow = true;
      });
    this.merged(
      windowGeos,
      this.material(0x506971, { metalness: 0.45, roughness: 0.27 }),
    );
    this.treePoints = MAPPED_TREES;
  }
  private streetLabel(text: string, parent: THREE.Object3D) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 112;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#14569a";
    ctx.fillRect(0, 0, 512, 112);
    ctx.strokeStyle = "#f4f5e9";
    ctx.lineWidth = 9;
    ctx.strokeRect(5, 5, 502, 102);
    ctx.fillStyle = "white";
    ctx.font = "700 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text.replace(/^Rruga /, "Rr. ").slice(0, 22), 256, 71);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.worldTextures.add(texture);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sign.position.set(0, 2.38, 0.07);
    sign.scale.set(1.75, 0.38, 1);
    parent.add(sign);
  }
  private async loadStreetFurniture(loader: GLTFLoader) {
    const gltf = await loader.loadAsync(ASSETS + "street-furniture.glb");
    const template = (name: string) => gltf.scene.getObjectByName(name);
    const place = (name: string, x: number, z: number, yaw = 0, scale = 1) => {
      const source = template(name);
      if (!source) return;
      const item = source.clone(true);
      item.position.set(x, 0.12, z);
      item.rotation.y = yaw;
      item.scale.setScalar(scale);
      item.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.scene.add(item);
      return item;
    };
    if (this.disposed) { this.disposeObject(gltf.scene); return; }
    const tree = template("tree");
    if (tree) {
      tree.updateWorldMatrix(true, true);
      const cells = new Map<string, Point[]>();
      for (const point of this.treePoints) {
        const key = `${Math.floor(point.x / 100)}:${Math.floor(point.z / 100)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(point);
      }
      for (const points of cells.values()) {
        const group = new THREE.Group();
        const x = Math.floor(points[0].x / 100) * 100 + 50;
        const z = Math.floor(points[0].z / 100) * 100 + 50;
        tree.traverse(o => {
          if (!(o instanceof THREE.Mesh)) return;
          const mesh = new THREE.InstancedMesh(o.geometry, o.material, points.length);
          points.forEach((point, i) => {
            const matrix = new THREE.Matrix4().makeTranslation(point.x, .12, point.z).multiply(o.matrixWorld);
            mesh.setMatrixAt(i, matrix);
          });
          mesh.computeBoundingSphere(); mesh.receiveShadow = true; group.add(mesh);
        });
        group.visible = false;
        this.scene.add(group); this.mappedTreeCells.push({group,x,z});
      }
    }
    const streets = WORLD.roads.filter((r, i) => !r.walk && r.name && i % 55 === 0);
    streets.forEach((r, i) => {
      const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], d = Math.hypot(dx, dz) || 1;
      const x = r.a[0] + (dz / d) * (r.w / 2 + 1.5), z = r.a[1] - (dx / d) * (r.w / 2 + 1.5);
      const sign = place("street_sign", x, z, Math.atan2(dx, dz));
      if (sign) this.streetLabel(r.name, sign);
      if (i % 3 === 0) place("traffic_light", r.a[0], r.a[1], Math.atan2(dx, dz));
      if (i % 4 === 0) place("road_sign", x + dz / d * 2, z - dx / d * 2, Math.atan2(dx, dz));
      if (i % 2 === 0) place("park_bench", x + dz / d * 3.2, z - dx / d * 3.2, Math.atan2(dx, dz));
    });
    // GLTF pavement samples add modeled curb depth near the starting district.
    WORLD.roads.filter((r) => !r.walk && Math.hypot(r.a[0] - SPAWN.x, r.a[1] - SPAWN.z) < 150)
      .slice(0, 42).forEach((r) => place("pavement_tile", r.a[0] + r.w / 2 + 1.8, r.a[1], 0, 1));
  }
  private label(text: string, x: number, y: number, z: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(7,25,30,.8)";
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#ddf67d";
    ctx.font = "600 30px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 59);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.worldTextures.add(texture);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: true,
        transparent: true,
      }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(40, 7.5, 1);
    this.scene.add(sprite);
    this.landmarkText.push(sprite);
  }
  private buildLandmarks() {
    const stone = this.material(0xd8cfba),
      roof = this.material(0x7f9593, { metalness: 0.15 }),
      cream = this.material(0xe7d9b9),
      glass = this.material(0x497a84, { metalness: 0.5, roughness: 0.18 });
    const get = (id: string) => WORLD.landmarks.find((p) => p.id === id)!;
    // Original meshes inspired by the named landmarks; footprints and positions come from OSM.
    const mosque = get("mosque");
    const g = new THREE.Group();
    g.position.set(mosque.x, 0, mosque.z);
    this.scene.add(g);
    this.box(15, 7, 15, 0, 3.5, 0, cream, g);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(7.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      roof,
    );
    dome.position.y = 7;
    dome.castShadow = true;
    g.add(dome);
    for (let i = 0; i < 5; i++)
      this.box(0.55, 5, 0.55, -7 + i * 3.5, 2.5, 11, cream, g);
    this.box(17, 0.6, 6, 0, 5.4, 10, stone, g);
    const minaret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 26, 12),
      cream,
    );
    minaret.position.set(-10, 13, -5);
    minaret.castShadow = true;
    g.add(minaret);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 12), roof);
    spire.position.set(-10, 28, -5);
    g.add(spire);
    const clock = get("clock");
    const cg = new THREE.Group();
    cg.position.set(clock.x, 0, clock.z);
    this.scene.add(cg);
    this.box(6, 27, 6, 0, 13.5, 0, stone, cg);
    this.box(7.5, 4, 7.5, 0, 29, 0, cream, cg);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.6, 5, 4), roof);
    cap.position.y = 33;
    cap.rotation.y = Math.PI / 4;
    cg.add(cap);
    for (let a = 0; a < 4; a++) {
      const face = new THREE.Group();
      face.rotation.y = (a * Math.PI) / 2;
      face.position.set(
        Math.sin((a * Math.PI) / 2) * 3.79,
        29,
        Math.cos((a * Math.PI) / 2) * 3.79,
      );
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.25, 24),
        new THREE.MeshBasicMaterial({ color: 0xf4ebd3 }),
      );
      face.add(disc);
      this.box(0.08, 0.95, 0.04, 0, 0.25, 0.03, this.material(0x1a3033), face);
      this.box(0.8, 0.08, 0.04, 0.28, 0, 0.04, this.material(0x1a3033), face);
      cg.add(face);
    }
    const pyramid = get("pyramid"),
      pg = new THREE.Group();
    pg.position.set(pyramid.x, 0, pyramid.z);
    pg.rotation.y = 0.19;
    this.scene.add(pg);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(37, 19, 4), stone);
    cone.position.y = 9.5;
    cone.rotation.y = Math.PI / 4;
    cone.castShadow = true;
    pg.add(cone);
    // Wide stair runs and the colored pavilions of the 2023 transformation.
    for (let side = 0; side < 4; side++) {
      const stairs = new THREE.Group();
      stairs.rotation.y = (side * Math.PI) / 2;
      pg.add(stairs);
      for (let n = 0; n < 27; n++)
        this.box(
          9,
          0.7,
          1.45,
          0,
          n * 0.68 + 0.35,
          35 - n * 1.17,
          stone,
          stairs,
        );
    }
    const accents = [0xea815b, 0xdea2bc, 0x98c4ce, 0xe5c962];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.399;
      const x = Math.cos(a) * 43,
        z = Math.sin(a) * 39;
      this.box(8, 4.8, 7, x, 2.4, z, this.material(accents[i % 4]), pg);
      this.box(5.5, 3.3, 0.16, x, 2.2, z + 3.6, glass, pg);
    }
    // A civic plinth in the square is kept abstract; no borrowed commercial game IP.
    this.box(6, 4, 6, -48, 2, 33, this.material(0x8e8f85));
    const monument = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.4, 5, 6),
      this.material(0x526354, { metalness: 0.65 }),
    );
    monument.position.set(-48, 6.5, 33);
    this.scene.add(monument);
    for (const l of WORLD.landmarks) {
      if (l.id === "lana" || l.id === "blloku") continue;
      this.label(
        l.name.toUpperCase(),
        l.x,
        l.id === "pyramid" ? 34 : l.id === "clock" ? 47 : 24,
        l.z,
      );
    }
    const mother = get("mother");
    this.box(
      110,
      19,
      25,
      mother.x,
      9.5,
      mother.z + 72,
      this.material(0xceaf86),
    );
    for (let i = 0; i < 14; i++)
      this.box(1.8, 13, 4, mother.x - 48 + i * 7.5, 9, mother.z + 57, cream);
  }
  private buildBeacon() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(9, 0.18, 6, 48),
      new THREE.MeshBasicMaterial({ color: 0xddf67d }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    this.beacon.add(ring);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 2.5, 4),
      new THREE.MeshBasicMaterial({ color: 0xddf67d }),
    );
    cone.rotation.z = Math.PI;
    cone.position.y = 6;
    this.beacon.add(cone);
    this.scene.add(this.beacon);
    this.beacon.visible = false;
  }
  async load(onProgress?: (message: string) => void) {
    const loader = new GLTFLoader();
    const files = [
      "character",
      "sedan",
      "sedan-sports",
      "taxi",
      "police",
      "city-car",
      "motorbike",
      "military-suv",
    ];
    await Promise.all(
      files.map(async (name) => {
        const file =
          name === "character"
            ? "living/human"
            : ["city-car", "motorbike", "military-suv"].includes(name)
              ? "living/" + name
              : name;
        const gltf = await loader.loadAsync(ASSETS + file + ".glb");
        if (this.disposed) {
          this.disposeObject(gltf.scene);
          return;
        }
        if (name === "city-car") this.mergeCarSurfaces(gltf.scene);
        if (name === "motorbike") gltf.scene.rotation.y = -Math.PI / 2;
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene),
          size = box.getSize(new THREE.Vector3()),
          center = box.getCenter(new THREE.Vector3());
        const scale =
          name === "character"
            ? 1.78 / size.y
            : name === "motorbike"
              ? 2.1 / Math.max(size.x, size.z)
              : 4.25 / size.z;
        const wrapper = new THREE.Group();
        gltf.scene.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale,
        );
        gltf.scene.scale.setScalar(scale);
        wrapper.add(gltf.scene);
        wrapper.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) {
                if (!["character", "city-car"].includes(name)) {
                  m.roughness = 0.45;
                  m.metalness = 0.25;
                }
                if (
                  name === "military-suv" &&
                  !/wheel|tire|glass/i.test(o.name)
                )
                  m.color.multiply(new THREE.Color("#77885c"));
              }
            });
          }
        });
        this.models.set(name, wrapper);
        if (name === "character") this.animations = gltf.animations;
        onProgress?.(
          name === "character"
            ? "Your character is ready"
            : "Loading city vehicles",
        );
      }),
    );
    if (this.disposed) return;
    onProgress?.("Adding textured city facades");
    const city = await loader.loadAsync(ASSETS + "city.glb");
    if (this.disposed) {
      this.disposeObject(city.scene);
      return;
    }
    this.facades = new CityFacades(city.scene);
    this.scene.add(this.facades.group);
    const surfaces: THREE.MeshStandardMaterial[] = [];
    city.scene.traverse((o) => {
      if (o instanceof THREE.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (
            m instanceof THREE.MeshStandardMaterial &&
            /RedBrick|Concrete/.test(m.name) &&
            !surfaces.includes(m)
          )
            surfaces.push(m);
    });
    this.shellMaterials.forEach((material, i) => {
      const surface = surfaces[i % surfaces.length];
      if (!surface) return;
      for (const key of ["map", "normalMap", "roughnessMap"] as const) {
        const original = surface[key];
        if (!original) continue;
        const texture = original.clone();
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.anisotropy = 2;
        texture.needsUpdate = true;
        material[key] = texture;
        this.worldTextures.add(texture);
      }
      material.normalScale.set(0.45, 0.45);
      material.roughness = 0.85;
      material.needsUpdate = true;
    });
    // Keep the shared GLB source attached invisibly so all geometries/textures are disposed.
    city.scene.visible = false;
    this.scene.add(city.scene);

    onProgress?.("Placing GLTF pavements, trees and traffic signs");
    await this.loadStreetFurniture(loader);

    this.ready = true;
    onProgress?.("City ready");
  }
  private actor(model: string, id: string): Actor {
    const existing = this.actors.get(id);
    if (existing && existing.model === model) return existing;
    if (existing) {
      existing.mixer?.stopAllAction();
      existing.group.removeFromParent();
      this.actors.delete(id);
    }
    const template = this.models.get(model);
    const group = (
      template
        ? model === "character"
          ? clone(template)
          : template.clone(true)
        : new THREE.Group()
    ) as THREE.Group;
    const actor: Actor = { group, wheels: [], model };
    group.traverse((o) => {
      if (o.name.toLowerCase().includes("wheel")) actor.wheels.push(o);
    });
    if (model === "character" && this.animations.length) {
      actor.mixer = new THREE.AnimationMixer(group);
      actor.idle = actor.mixer.clipAction(
        this.animations.find((a) => a.name.toLowerCase() === "idle") ||
          this.animations[0],
      );
      actor.run = actor.mixer.clipAction(
        this.animations.find((a) =>
          ["sprint", "run"].includes(a.name.toLowerCase()),
        ) || this.animations[0],
      );
      const walk = this.animations.find((a) => a.name.toLowerCase() === "walk");
      if (walk) actor.walk = actor.mixer.clipAction(walk);
      actor.idle.play();
    }
    this.scene.add(group);
    this.actors.set(id, actor);
    return actor;
  }
  setRoute(points: Point[]) {
    if (this.routeLine) {
      this.scene.remove(this.routeLine);
      this.routeLine.geometry.dispose();
      (this.routeLine.material as THREE.Material).dispose();
      this.routeLine = null;
    }
    if (points.length < 2) return;
    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, 0.24, p.z)),
      ),
      new THREE.LineBasicMaterial({
        color: 0xddf67d,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.scene.add(this.routeLine);
  }
  orbit(dx: number, dy: number) {
    this.yaw -= dx * 0.006;
    this.pitch = this.firstPerson ? THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.05, 1.05) : THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 0.85);
    this.manualUntil = this.clock + 2.8;
  }
  setFirstPerson(enabled: boolean) { this.firstPerson = enabled; this.pitch = enabled ? 0 : 0.32; }
  setQuality(quality: "auto" | "high" | "battery") {
    this.quality = quality;
    this.dpr = Math.min(
      window.devicePixelRatio || 1,
      quality === "high" ? 2 : quality === "battery" ? 1 : 1.65,
    );
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.shadowMap.enabled = quality !== "battery";
    this.resize();
  }
  private resize() {
    const w = this.root.clientWidth || 390,
      h = this.root.clientHeight || 800;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  render(state: State | null, playerId: string, dt: number, lobby: boolean) {
    if (this.disposed) return;
    this.clock += dt;
    const stamp = performance.now();
    this.sampleTime += Math.max(0, (stamp - this.sampleStamp) / 1000);
    this.sampleStamp = stamp;
    this.frames++;
    if (this.sampleTime >= 2) {
      this.fps = Math.round(this.frames / this.sampleTime);
      if (this.quality === "auto") {
        const next =
          this.fps < 42
            ? Math.max(0.85, this.dpr - 0.15)
            : this.fps > 56
              ? Math.min(1.65, window.devicePixelRatio || 1, this.dpr + 0.05)
              : this.dpr;
        if (Math.abs(next - this.dpr) > 0.01) {
          this.dpr = next;
          this.renderer.setPixelRatio(next);
          this.resize();
        }
      }
      this.frames = 0;
      this.sampleTime = 0;
    }
    let target = new THREE.Vector3(SPAWN.x, 1, SPAWN.z);
    const p = state?.players[playerId];
    if (this.ready && state) {
      const active = new Set<string>();
      for (const car of [
        ...state.cars,
        ...state.traffic,
        ...state.units,
        ...(state.rival ? [state.rival] : []),
      ]) {
        const close = !p || Math.hypot(car.x - p.x, car.z - p.z) < 45;
        const detail =
          close && car.id.startsWith("car-") ? "city-car" : car.model;
        const a = this.actor(detail, car.id);
        active.add(car.id);
        a.group.visible =
          !p ||
          Math.hypot(car.x - p.x, car.z - p.z) <
            (this.quality === "battery" ? 180 : 350);
        if (!a.group.userData.placed) {
          a.group.position.set(car.x, 0, car.z);
          a.group.rotation.y = car.heading + Math.PI;
          a.group.userData.placed = true;
        }
        a.group.position.lerp(
          new THREE.Vector3(car.x, 0.03, car.z),
          Math.min(1, dt * 18),
        );
        a.group.rotation.y = smoothAngle(
          a.group.rotation.y,
          car.heading + Math.PI,
          Math.min(1, dt * 14),
        );
        a.group.rotation.z = THREE.MathUtils.lerp(
          a.group.rotation.z,
          -car.steering * car.speed * 0.0018,
          Math.min(1, dt * 6),
        );
        for (const w of a.wheels) {
          w.rotation.x += car.speed * dt * 2;
          if (w.name.includes("front")) w.rotation.y = -car.steering * 0.32;
        }
      }
      for (const pl of Object.values(state.players)) {
        const a = this.actor("character", `player-${pl.id}`);
        active.add(`player-${pl.id}`);
        a.group.visible = !pl.carId && !(this.firstPerson && pl.id === id);
        a.group.rotation.x = pl.health <= 0 ? -Math.PI / 2 : 0;
        a.group.position.lerp(
          new THREE.Vector3(pl.x, 0.08, pl.z),
          a.group.userData.placed ? Math.min(1, dt * 20) : 1,
        );
        a.group.userData.placed = true;
        a.group.scale.setScalar(1);
        a.group.rotation.y = smoothAngle(
          a.group.rotation.y,
          pl.heading + Math.PI,
          Math.min(1, dt * 15),
        );
        const moving = pl.speed > 0.2 && !pl.carId;
        if (a.moving !== moving) {
          const next = moving ? a.run : a.idle,
            prev = moving ? a.idle : a.run;
          next?.reset().fadeIn(0.15).play();
          prev?.fadeOut(0.15);
          a.moving = moving;
        }
        a.mixer?.update(dt * (moving ? Math.max(0.45, pl.speed / 6) : 1));
        this.living.pose(`player-${pl.id}`, a.group, pl, state.elapsed);
      }
      const citizens = [...state.npcs].sort(
        (a, b) =>
          Math.hypot(a.x - (p?.x || 0), a.z - (p?.z || 0)) -
          Math.hypot(b.x - (p?.x || 0), b.z - (p?.z || 0)),
      );
      let rendered = 0;
      for (const n of citizens) {
        const role = (n as NPC & { role?: string }).role;
        if (
          n.motion === "drive" ||
          Math.hypot(n.x - (p?.x || 0), n.z - (p?.z || 0)) >
            (this.quality === "battery" ? 85 : 180) ||
          rendered++ > (this.quality === "battery" ? 14 : 32)
        )
          continue;
        const id = `npc-${n.id}`,
          a = this.actor("character", id);
        active.add(id);
        a.group.visible = true;
        a.group.position.lerp(
          new THREE.Vector3(n.x, n.motion === "cycle" ? -0.18 : 0.06, n.z),
          a.group.userData.placed ? Math.min(1, dt * 12) : 1,
        );
        a.group.userData.placed = true;
        a.group.rotation.set(
          n.health <= 0 ? -Math.PI / 2 : 0,
          n.heading + Math.PI,
          0,
        );
        const moving = n.speed > 0.15 && n.health > 0;
        if (a.moving !== moving) {
          (moving ? a.walk || a.run : a.idle)?.reset().fadeIn(0.2).play();
          (moving ? a.idle : a.walk || a.run)?.fadeOut(0.2);
          a.moving = moving;
        }
        a.mixer?.update(dt * (n.anim === "run" ? 1.8 : 1));
        this.living.pose(id, a.group, n, state.elapsed);
        if (role === "dog-walker") {
          const dogId = `dog-${n.id}`,
            dog = this.actor("character", dogId);
          active.add(dogId);
          dog.group.visible = true;
          dog.group.scale.set(.42, .28, .58);
          dog.group.position.set(n.x + Math.cos(n.heading) * 1.15, .02, n.z - Math.sin(n.heading) * 1.15);
          dog.group.rotation.y = n.heading + Math.PI;
          dog.mixer?.update(dt * 1.6);
        }
        if (n.motion === "cycle" && n.health > 0) {
          const bikeId = `bike-${n.id}`,
            bike = this.actor("motorbike", bikeId);
          active.add(bikeId);
          bike.group.visible = true;
          bike.group.position.copy(a.group.position);
          bike.group.position.y = 0;
          bike.group.rotation.y = n.heading + Math.PI;
          this.seated(a.group, state.elapsed, true);
        }
      }
      // Visible drivers give nearby moving traffic a human occupant.
      for (const car of state.traffic) {
        if (!p || Math.hypot(car.x - p.x, car.z - p.z) > 40) continue;
        const id = `driver-${car.id}`,
          a = this.actor("character", id);
        active.add(id);
        a.group.visible = true;
        a.group.position.set(car.x, -0.25, car.z);
        a.group.rotation.set(0, car.heading + Math.PI, 0);
        a.mixer?.update(dt);
        this.seated(a.group, state.elapsed, false);
        a.group.scale.setScalar(0.83);
      }
      for (const [id, a] of this.actors) {
        if (active.has(id)) {
          a.group.userData.lastSeen = this.clock;
          continue;
        }
        a.group.visible = false;
        if (this.clock - (a.group.userData.lastSeen || 0) > 5) {
          a.mixer?.stopAllAction();
          a.mixer?.uncacheRoot(a.group);
          a.group.removeFromParent();
          a.group.traverse((o) => {
            if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
          });
          this.living.forget(id);
          this.actors.delete(id);
        }
      }
      this.living.update(state, p);
      if (p) {
        target.set(p.x, p.carId ? 1.1 : 1.3, p.z);
        if (p.carId && this.clock > this.manualUntil)
          this.yaw = smoothAngle(this.yaw, p.heading, Math.min(1, dt * 3));
      }
    }
    if (lobby) {
      const pyramid = WORLD.landmarks.find((p) => p.id === "pyramid")!;
      // The initial view shows the recognizable Pyramid and its boulevard.
      const a = -0.65 + Math.sin(this.clock * 0.025) * 0.12;
      this.camera.position.set(
        pyramid.x + Math.sin(a) * 125,
        66,
        pyramid.z + Math.cos(a) * 125,
      );
      this.camera.lookAt(pyramid.x, 5, pyramid.z);
      target.set(pyramid.x, 0, pyramid.z);
    } else if (this.firstPerson && p) {
      this.lastTarget.set(p.x, p.carId ? 1.28 : 1.68, p.z);
      if (p.carId && this.clock > this.manualUntil) this.yaw = smoothAngle(this.yaw, p.heading, Math.min(1, dt * 4));
      this.camera.position.lerp(this.lastTarget, Math.min(1, dt * 14));
      const direction = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      this.camera.lookAt(this.camera.position.clone().add(direction));
      this.camera.fov = 74 + (p.carId ? Math.min(8, Math.abs(p.speed) * .2) : 0);
      this.camera.updateProjectionMatrix();
    } else {
      this.lastTarget.lerp(target, Math.min(1, dt * 9));
      const wanted = p?.carId
        ? 9.5 + Math.min(4, Math.abs(p.speed) * 0.11)
        : 4.25;
      const d = cameraDistance(
        this.lastTarget.x,
        this.lastTarget.z,
        this.lastTarget.y,
        this.yaw,
        wanted,
        this.pitch,
      );
      const pos = this.lastTarget
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(this.yaw) * d,
            (p?.carId ? 2.4 : 1.65) + this.pitch * d,
            Math.cos(this.yaw) * d,
          ),
        );
      this.camera.position.lerp(pos, Math.min(1, dt * 10));
      this.camera.lookAt(
        this.lastTarget.clone().add(new THREE.Vector3(0, 0.7, 0)),
      );
      this.camera.fov = 52 + (p?.carId ? Math.abs(p.speed) * 0.28 : 0);
      this.camera.updateProjectionMatrix();
    }
    this.facades?.update(target, dt, this.quality === "battery");
    this.sunlight.position.set(target.x - 85, 145, target.z - 75);
    this.sunlight.target.position.copy(target);
    for (const chunk of this.cityChunks) chunk.visible = true;
    for (const label of this.landmarkText)
      label.visible = label.position.distanceTo(this.camera.position) < 300;
    this.beacon.visible =
      !lobby &&
      !!state &&
      state.phase === "active" &&
      state.missionId !== "free-roam";
    if (this.beacon.visible && p && state) {
      const mission = state.missionId;
      const end = this.routeLine?.geometry.getAttribute("position");
      if (end?.count) {
        this.beacon.position.set(
          end.getX(end.count - 1),
          0,
          end.getZ(end.count - 1),
        );
        this.beacon.children[1].position.y = 6 + Math.sin(this.clock * 2) * 0.7;
        this.beacon.children[1].rotation.y = this.clock;
      }
    }
    this.referenceFacades.update(this.camera.position, this.quality === "battery");
    for (const cell of this.mappedTreeCells) cell.group.visible =
      Math.hypot(cell.x - this.camera.position.x, cell.z - this.camera.position.z) <
      (this.quality === "battery" ? 140 : 260);
    this.renderer.render(this.scene, this.camera);
  }
  private mergeCarSurfaces(root: THREE.Group) {
    root.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>(),
      remove: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      let parent: THREE.Object3D | null = o,
        wheel = false;
      while (parent) {
        if (/wheel|tire|rim/i.test(parent.name)) wheel = true;
        parent = parent.parent;
      }
      if (wheel) return;
      const source = o.geometry.clone(),
        geometry = source.applyMatrix4(o.matrixWorld).toNonIndexed();
      if (geometry !== source) source.dispose();
      for (const key of Object.keys(geometry.attributes))
        if (!["position", "normal", "uv"].includes(key))
          geometry.deleteAttribute(key);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      if (!geometry.getAttribute("uv"))
        geometry.setAttribute(
          "uv",
          new THREE.BufferAttribute(
            new Float32Array(geometry.getAttribute("position").count * 2),
            2,
          ),
        );
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches.get(o.material)!.push(geometry);
      remove.push(o);
    });
    for (const mesh of remove) mesh.removeFromParent();
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach((g) => g.dispose());
      if (geometry) root.add(new THREE.Mesh(geometry, material));
    }
    // Original meshes can share buffers with retained tires. Dispose only buffers no longer referenced.
    const retained = new Set<THREE.BufferGeometry>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) retained.add(o.geometry);
    });
    for (const mesh of remove)
      if (!retained.has(mesh.geometry)) mesh.geometry.dispose();
  }
  private seated(group: THREE.Group, time: number, riding: boolean) {
    group.traverse((o) => {
      if (/LeftUpLeg|RightUpLeg/.test(o.name))
        o.rotation.x =
          -1.25 +
          (riding
            ? Math.sin(time * 5 + (/Left/.test(o.name) ? 0 : Math.PI)) * 0.17
            : 0);
      if (/LeftLeg$|RightLeg$/.test(o.name)) o.rotation.x = 1.65;
      if (/LeftArm$|RightArm$/.test(o.name)) o.rotation.x = -1.1;
    });
  }
  private disposeObject(root: THREE.Object3D) {
    const geos = new Set<THREE.BufferGeometry>(),
      mats = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Sprite ||
        o instanceof THREE.Line
      ) {
        if ("geometry" in o) geos.add(o.geometry);
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          mats.add(m);
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) textures.add(v);
          });
        });
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  }
  destroy() {
    this.disposed = true;
    this.referenceFacades.dispose();
    this.living.dispose();
    this.observer.disconnect();
    for (const a of this.actors.values()) a.mixer?.stopAllAction();
    this.disposeObject(this.scene);
    this.models.forEach((m) => this.disposeObject(m));
    this.worldTextures.forEach((t) => t.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
