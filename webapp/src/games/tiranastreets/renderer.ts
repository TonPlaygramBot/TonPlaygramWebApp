import * as THREE from "three";
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
};

export class CityRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1, 0.15, 1800);
  yaw = 0;
  pitch = 0.32;
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
  private pedestrians: { mesh: THREE.Group; path: Point[]; offset: number }[] =
    [];
  private worldTextures = new Set<THREE.Texture>();
  private manualUntil = 0;
  private lastTarget = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
  private landmarkText: THREE.Sprite[] = [];
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
    this.buildStreets();
    this.buildBlocks();
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
    const treePoints: Point[] = [];
    for (const b of WORLD.buildings) {
      if (b.special) continue;
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
        b.p.map((p) => new THREE.Vector2(p[0], -p[1])),
      );
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: b.h,
        bevelEnabled: false,
        steps: 1,
      });
      geo.rotateX(-Math.PI / 2);
      buckets.get(key)!.geos[Number(b.id) % colors.length].push(geo);
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
        const mesh = this.merged(geos, this.material(colors[i]), bucket.group);
        if (mesh) mesh.castShadow = true;
      });
    this.merged(
      windowGeos,
      this.material(0x506971, { metalness: 0.45, roughness: 0.27 }),
    );
    let seed = 6129;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (const park of WORLD.parks) {
      const xs = park.map((p) => p[0]),
        zs = park.map((p) => p[1]);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minZ = Math.min(...zs),
        maxZ = Math.max(...zs);
      const count = Math.min(
        110,
        Math.floor(((maxX - minX) * (maxZ - minZ)) / 110),
      );
      for (let i = 0; i < count; i++) {
        const x = minX + random() * (maxX - minX),
          z = minZ + random() * (maxZ - minZ);
        if (insidePolygon(x, z, park)) treePoints.push({ x, z });
      }
    }
    for (let i = 0; i < WORLD.roads.length; i += 28) {
      const r = WORLD.roads[i];
      if (r.walk) continue;
      const dx = r.b[0] - r.a[0],
        dz = r.b[1] - r.a[1],
        d = Math.hypot(dx, dz);
      const x = r.a[0] + (dz / d) * (r.w / 2 + 2),
        z = r.a[1] - (dx / d) * (r.w / 2 + 2);
      if (!WORLD.buildings.some((b) => insidePolygon(x, z, b.p)))
        treePoints.push({ x, z });
    }
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.19, 0.35, 4, 5),
      this.material(0x70614b),
      treePoints.length,
    );
    const leaves = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(2.8, 1),
      this.material(0x667a41),
      treePoints.length,
    );
    treePoints.forEach((p, i) => {
      const size = 0.75 + random() * 0.7;
      tmp.position.set(p.x, 2, p.z);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      trunks.setMatrixAt(i, tmp.matrix);
      tmp.position.y = 5.2;
      tmp.scale.set(size, size * 1.3, size);
      tmp.rotation.y = random() * 6;
      tmp.updateMatrix();
      leaves.setMatrixAt(i, tmp.matrix);
      leaves.setColorAt(
        i,
        new THREE.Color().setHSL(
          0.21 + random() * 0.06,
          0.26,
          0.27 + random() * 0.12,
        ),
      );
    });
    trunks.castShadow = true;
    leaves.castShadow = true;
    this.scene.add(trunks, leaves);
    const lamps = WORLD.roads.filter((r, i) => !r.walk && i % 36 === 0);
    const poles = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.12, 6, 5),
      this.material(0x45545a, { metalness: 0.6 }),
      lamps.length,
    );
    lamps.forEach((r, i) => {
      tmp.position.set(r.a[0] + r.w / 2 + 1, 3, r.a[1]);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      poles.setMatrixAt(i, tmp.matrix);
    });
    this.scene.add(poles);
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
    const files = ["character", "sedan", "sedan-sports", "taxi", "police"];
    await Promise.all(
      files.map(async (name) => {
        const gltf = await loader.loadAsync(ASSETS + name + ".glb");
        if (this.disposed) {
          this.disposeObject(gltf.scene);
          return;
        }
        const box = new THREE.Box3().setFromObject(gltf.scene),
          size = box.getSize(new THREE.Vector3()),
          center = box.getCenter(new THREE.Vector3());
        const scale = name === "character" ? 1.78 / size.y : 4.25 / size.z;
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
                m.roughness = name === "character" ? 0.8 : 0.37;
                m.metalness = name === "character" ? 0 : 0.25;
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
    // PBR city details sit on selected existing footprints. Distant blocks use the merged OSM shell.
    const detailTemplates = city.scene.children.filter((o) =>
      o.name.endsWith("_lod"),
    );
    const candidates = WORLD.buildings.filter(
      (b) =>
        !b.special &&
        b.h >= 12 &&
        b.h < 35 &&
        Math.hypot(b.p[0][0], b.p[0][1] - 300) < 620,
    );
    const batches = new Map<
      string,
      {
        geometry: THREE.BufferGeometry;
        material: THREE.Material | THREE.Material[];
        matrices: THREE.Matrix4[];
      }
    >();
    let placed = 0;
    for (const b of candidates) {
      if (placed >= 30) break;
      const xs = b.p.map((p) => p[0]),
        zs = b.p.map((p) => p[1]);
      const width = Math.max(...xs) - Math.min(...xs),
        depth = Math.max(...zs) - Math.min(...zs);
      if (width < 12 || width > 30 || depth < 12 || depth > 35) continue;
      const template = detailTemplates[placed % detailTemplates.length];
      if (!template) continue;
      const detail = template.clone(true),
        box = new THREE.Box3().setFromObject(detail),
        size = box.getSize(new THREE.Vector3());
      detail.scale.set(width / size.x, b.h / size.y, depth / size.z);
      detail.position.set(
        Math.min(...xs) - box.min.x * detail.scale.x,
        0.05 - box.min.y * detail.scale.y,
        Math.min(...zs) - box.min.z * detail.scale.z,
      );
      detail.updateMatrixWorld(true);
      detail.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const key =
            o.geometry.uuid +
            JSON.stringify(
              Array.isArray(o.material)
                ? o.material.map((m) => m.uuid)
                : o.material.uuid,
            );
          if (!batches.has(key))
            batches.set(key, {
              geometry: o.geometry,
              material: o.material,
              matrices: [],
            });
          batches.get(key)!.matrices.push(o.matrixWorld.clone());
        }
      });
      placed++;
    }
    for (const batch of batches.values()) {
      const mesh = new THREE.InstancedMesh(
        batch.geometry,
        batch.material,
        batch.matrices.length,
      );
      batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
    }
    // Keep the shared GLB source attached invisibly so all geometries/textures are disposed.
    city.scene.visible = false;
    this.scene.add(city.scene);
    this.addPedestrians();
    this.ready = true;
    onProgress?.("City ready");
  }
  private actor(model: string, id: string): Actor {
    const existing = this.actors.get(id);
    if (existing) return existing;
    const template = this.models.get(model);
    const group = (
      template
        ? model === "character"
          ? clone(template)
          : template.clone(true)
        : new THREE.Group()
    ) as THREE.Group;
    const actor: Actor = { group, wheels: [] };
    group.traverse((o) => {
      if (o.name.includes("wheel")) actor.wheels.push(o);
    });
    if (model === "character" && this.animations.length) {
      actor.mixer = new THREE.AnimationMixer(group);
      actor.idle = actor.mixer.clipAction(
        this.animations.find((a) => a.name === "idle")!,
      );
      actor.run = actor.mixer.clipAction(
        this.animations.find((a) => a.name === "sprint")!,
      );
      actor.idle.play();
    }
    this.scene.add(group);
    this.actors.set(id, actor);
    return actor;
  }
  private addPedestrians() {
    const paths = WORLD.roads.filter(
      (r) =>
        r.walk &&
        Math.hypot(r.a[0], r.a[1] - 250) < 550 &&
        Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1]) > 12,
    );
    for (let i = 0; i < 18 && paths.length; i++) {
      const r = paths[(i * 37) % paths.length],
        a = this.actor("character", `ped-${i}`);
      a.run?.play();
      a.idle?.stop();
      this.pedestrians.push({
        mesh: a.group,
        path: [
          { x: r.a[0], z: r.a[1] },
          { x: r.b[0], z: r.b[1] },
        ],
        offset: i * 0.31,
      });
    }
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
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 0.85);
    this.manualUntil = this.clock + 2.8;
  }
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
        ...(state.rival ? [state.rival] : []),
      ]) {
        const a = this.actor(car.model, car.id);
        active.add(car.id);
        a.group.visible = true;
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
        a.group.visible = !pl.carId;
        a.group.position.lerp(
          new THREE.Vector3(pl.x, 0.08, pl.z),
          a.group.userData.placed ? Math.min(1, dt * 20) : 1,
        );
        a.group.userData.placed = true;
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
      }
      for (const [id, a] of this.actors)
        if (!active.has(id) && !id.startsWith("ped-")) a.group.visible = false;
      if (p) {
        target.set(p.x, p.carId ? 1.1 : 1.3, p.z);
        if (p.carId && this.clock > this.manualUntil)
          this.yaw = smoothAngle(this.yaw, p.heading, Math.min(1, dt * 3));
      }
    }
    this.pedestrians.forEach((p, i) => {
      const a = p.path[0],
        b = p.path[1],
        length = Math.hypot(a.x - b.x, a.z - b.z);
      const phase = ((this.clock * 1.1) / length + p.offset) % 2,
        t = phase < 1 ? phase : 2 - phase;
      p.mesh.position.set(a.x + (b.x - a.x) * t, 0.08, a.z + (b.z - a.z) * t);
      p.mesh.rotation.y =
        Math.atan2(b.x - a.x, b.z - a.z) + (phase < 1 ? 0 : Math.PI);
      this.actors.get(`ped-${i}`)?.mixer?.update(dt * 0.4);
    });
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
    } else {
      this.lastTarget.lerp(target, Math.min(1, dt * 9));
      const wanted = p?.carId
        ? 9.5 + Math.min(4, Math.abs(p.speed) * 0.11)
        : 5.8;
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
            2.4 + this.pitch * d,
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
    this.renderer.render(this.scene, this.camera);
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
