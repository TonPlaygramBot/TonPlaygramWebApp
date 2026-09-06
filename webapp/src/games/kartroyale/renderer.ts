import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  STEP,
  COLORS,
  makeTrack,
  createRacer,
  stepRace,
  stepRacer,
  standings,
  wrapAngle
} from './simulation.mjs';
import type { Input, Racer, Track } from './simulation.mjs';
export type Quality = 'auto' | 'high' | 'performance';
export interface Frame {
  speed: number;
  boost: number;
  lap: number;
  position: number;
  time: number;
  countdown: number;
  drifting: boolean;
  driftCharge: number;
  fps: number;
  racers: Racer[];
  track: Track;
  drawCalls: number;
}
export interface Result {
  racers: Racer[];
  playerId: string;
  elapsed: number;
  trackId: string;
}
export interface ServerRace {
  trackId: string;
  status: string;
  racers: Racer[];
  elapsed: number;
  startsAt: number;
  serverNow: number;
}
const neutral = (): Input => ({
  steer: 0,
  brake: false,
  drift: false,
  boost: false
});
interface KartRig {
  body: T.Object3D;
  steeringWheel?: T.Object3D;
  wheels: T.Object3D[];
  front: T.Object3D[];
  spin: number;
}
interface CityPlacement {
  kind: string;
  matrix: T.Matrix4;
  x: number;
  z: number;
}
interface CityBatch {
  kind: string;
  lod: boolean;
  meshes: T.InstancedMesh[];
}
export class KartRenderer {
  readonly input = neutral();
  readonly renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(45, 1, 0.15, 700);
  private world = new T.Group();
  private garage = new T.Group();
  private showroom = new T.Group();
  private full: T.Group | null = null;
  private low: T.Group | null = null;
  private city: T.Group | null = null;
  private textures = new Set<T.Texture>();
  private roadMaps: T.Texture[] = [];
  private rigs = new WeakMap<T.Object3D, KartRig>();
  private cityPlacements: CityPlacement[] = [];
  private cityBatches: CityBatch[] = [];
  private cityAt = 0;
  private skidMesh: T.InstancedMesh | null = null;
  private skidIndex = 0;
  private skidAt = 0;
  private skidPrevious = new Map<string, { x: number; z: number }>();
  private transform = new T.Object3D();
  private shadow: T.DirectionalLight;
  private environment: T.WebGLRenderTarget;
  private visuals = new Map<string, T.Group>();
  private track = makeTrack();
  private racers: Racer[] = [];
  private state = 'garage';
  private network = false;
  private me = 'you';
  private difficulty = 'street';
  private time = 0;
  private countdown = 3;
  private paused = false;
  private last = performance.now();
  private accumulator = 0;
  private raf = 0;
  private uiAt = 0;
  private fpsAt = performance.now();
  private frames = 0;
  private fps = 60;
  private quality: Quality = 'auto';
  private ratio = 1.5;
  private disposed = false;
  private observer: ResizeObserver;
  private color = COLORS[0];
  private vector = new T.Vector3();
  private cameraTarget = new T.Vector3();
  private lookTarget = new T.Vector3();
  private visibility = () => {
    this.last = performance.now();
    this.accumulator = 0;
    if (document.hidden) this.clearInput();
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.onError('The 3D view paused. Reload the game to restore graphics.');
  };
  constructor(
    private host: HTMLElement,
    private onFrame: (frame: Frame) => void,
    private onFinish: (r: Result) => void,
    private onError: (s: string) => void
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D kart and racing circuit'
    );
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost
    );
    const pmrem = new T.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.add(new T.HemisphereLight(0xd7eaff, 0x303923, 2.1));
    this.shadow = new T.DirectionalLight(0xffefd2, 4);
    this.shadow.castShadow = true;
    this.shadow.shadow.mapSize.set(1024, 1024);
    Object.assign(this.shadow.shadow.camera, {
      left: -24,
      right: 24,
      top: 24,
      bottom: -24,
      far: 85
    });
    this.shadow.shadow.normalBias = 0.035;
    this.shadow.shadow.bias = -0.0001;
    this.scene.add(this.shadow, this.shadow.target, this.world, this.garage);
    const floor = new T.Mesh(
      new T.PlaneGeometry(300, 300),
      new T.MeshStandardMaterial({
        color: '#14191c',
        roughness: 0.28,
        metalness: 0.45
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.garage.add(floor);
    const pad = new T.Mesh(
      new T.CylinderGeometry(3.5, 3.7, 0.12, 96),
      new T.MeshStandardMaterial({
        color: '#242c30',
        metalness: 0.64,
        roughness: 0.35
      })
    );
    pad.position.y = -0.08;
    pad.receiveShadow = true;
    this.garage.add(pad);
    const ring = new T.Mesh(
      new T.TorusGeometry(3.52, 0.018, 6, 120),
      new T.MeshBasicMaterial({ color: COLORS[0] })
    );
    ring.rotation.x = Math.PI / 2;
    this.garage.add(ring);
    const grid = new T.GridHelper(70, 35, 0x313d39, 0x20292a);
    grid.position.y = -0.005;
    this.garage.add(grid, this.showroom);
    const light = new T.PointLight(0xbaff29, 14, 10, 2);
    light.position.set(-3, 2.5, -2);
    const blue = new T.PointLight(0x72b8ff, 20, 12, 2);
    blue.position.set(3, 3, 0);
    this.garage.add(light, blue);
    this.showGarage();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    document.addEventListener('visibilitychange', this.visibility);
    this.raf = requestAnimationFrame(this.animate);
  }
  async load() {
    const loader = new GLTFLoader();
    const textures = new T.TextureLoader();
    const results = await Promise.allSettled([
      loader.loadAsync('/assets/kart-royale/apex.glb'),
      loader.loadAsync('/assets/kart-royale/apex-lod.glb'),
      loader.loadAsync('/assets/kart-royale/city.glb'),
      textures.loadAsync('/assets/kart-royale/asphalt-diff.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-nor_gl.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-rough.jpg')
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (this.disposed || failed) {
      for (const r of results)
        if (r.status === 'fulfilled') {
          if (r.value instanceof T.Texture) r.value.dispose();
          else {
            this.collectTextures(r.value.scene);
            this.release(r.value.scene, true);
          }
        }
      this.textures.forEach((t) => t.dispose());
      this.textures.clear();
      if (failed && !this.disposed)
        throw new Error(
          'The racing assets could not load. Check your connection and reload.'
        );
      return;
    }
    // The successful branches are checked above; keep asset types distinct.
    this.full = (
      results[0] as PromiseFulfilledResult<
        import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
      >
    ).value.scene;
    this.low = (
      results[1] as PromiseFulfilledResult<
        import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
      >
    ).value.scene;
    this.city = (
      results[2] as PromiseFulfilledResult<
        import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
      >
    ).value.scene;
    this.roadMaps = results
      .slice(3)
      .map((r) => (r as PromiseFulfilledResult<T.Texture>).value);
    this.roadMaps.forEach((texture, i) => {
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = Math.min(
        8,
        this.renderer.capabilities.getMaxAnisotropy()
      );
      if (i === 0) texture.colorSpace = T.SRGBColorSpace;
      this.textures.add(texture);
    });
    for (const group of [this.full, this.low, this.city])
      this.collectTextures(group);
    this.showroom.add(this.cloneKart(0));
    this.setColor(this.color);
  }
  private cloneKart(slot: number, low = false) {
    const model = (low ? this.low : this.full)?.clone(true) || new T.Group();
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = (o.material as T.MeshStandardMaterial).clone();
        if (m.name === 'paint') m.color.set(COLORS[slot % 6]);
        o.material = m;
      }
    });
    const rig: KartRig = {
      body: model.getObjectByName('body') || model,
      steeringWheel: model.getObjectByName('steering_wheel'),
      wheels: [],
      front: [],
      spin: 0
    };
    model.traverse((o) => {
      if (/^wheel_[fr][lr]$/.test(o.name)) rig.wheels.push(o);
      if (/^steer_f[lr]$/.test(o.name)) rig.front.push(o);
    });
    this.rigs.set(model, rig);
    return model;
  }
  setColor(color: string) {
    this.color = color;
    this.showroom.traverse((o) => {
      if (o instanceof T.Mesh && (o.material as T.Material).name === 'paint')
        (o.material as T.MeshStandardMaterial).color.set(color);
    });
  }
  setQuality(q: Quality) {
    this.quality = q;
    this.ratio = Math.min(
      devicePixelRatio || 1,
      q === 'high' ? 2 : q === 'performance' ? 1 : 1.5
    );
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.shadowMap.enabled = q !== 'performance';
    this.cityAt = 0;
    this.resize();
  }
  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  showGarage() {
    this.state = 'garage';
    this.network = false;
    this.paused = false;
    this.clearInput();
    this.world.visible = false;
    this.garage.visible = true;
    this.scene.background = new T.Color('#101619');
    this.scene.fog = new T.Fog('#101619', 13, 55);
    this.shadow.position.set(8, 12, 6);
    this.shadow.target.position.set(0, 0, 0);
  }
  private createWorld(track: Track) {
    for (const v of this.visuals.values()) {
      this.world.remove(v);
      this.release(v, false);
    }
    this.visuals.clear();
    this.cityBatches = [];
    this.cityPlacements = [];
    this.skidPrevious.clear();
    this.skidIndex = 0;
    this.cityAt = this.skidAt = 0;
    this.release(this.world, true);
    this.world.clear();
    const ground = new T.Mesh(
      new T.PlaneGeometry(2000, 2000),
      new T.MeshStandardMaterial({ color: track.ground, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);
    const positions: number[] = [],
      indices: number[] = [],
      normals: number[] = [],
      uvs: number[] = [];
    for (let i = 0; i <= 360; i++) {
      const p = track.points[i % 360];
      for (const side of [-1, 1]) {
        positions.push(
          p.x - Math.cos(p.yaw) * track.width * 0.5 * side,
          0.045,
          p.z + Math.sin(p.yaw) * track.width * 0.5 * side
        );
        normals.push(0, 1, 0);
        const n = positions.length;
        uvs.push(positions[n - 3] / 3, positions[n - 1] / 3);
      }
      if (i < 360) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    const road = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({
        color: '#b0b6b9',
        map: this.roadMaps[0],
        normalMap: this.roadMaps[1],
        normalScale: new T.Vector2(0.48, 0.48),
        roughnessMap: this.roadMaps[2],
        roughness: 0.93,
        metalness: 0.02,
        side: T.DoubleSide
      })
    );
    road.receiveShadow = true;
    this.world.add(road);
    const m = new T.Object3D(),
      curb = new T.InstancedMesh(
        new T.BoxGeometry(0.55, 0.14, 2.1),
        new T.MeshStandardMaterial({ roughness: 0.7 }),
        720
      ),
      walls = new T.InstancedMesh(
        new T.BoxGeometry(0.6, 0.9, 3.6),
        new T.MeshStandardMaterial({ roughness: 0.84 }),
        240
      ),
      marks = new T.InstancedMesh(
        new T.BoxGeometry(0.12, 0.01, 1.8),
        new T.MeshBasicMaterial({ color: '#e2e7d8' }),
        90
      );
    for (let i = 0; i < 360; i++) {
      const p = track.points[i];
      [-1, 1].forEach((side, s) => {
        m.position.set(
          p.x - Math.cos(p.yaw) * (track.width / 2 - 0.1) * side,
          0.1,
          p.z + Math.sin(p.yaw) * (track.width / 2 - 0.1) * side
        );
        m.rotation.set(0, p.yaw, 0);
        m.updateMatrix();
        curb.setMatrixAt(i * 2 + s, m.matrix);
        curb.setColorAt(
          i * 2 + s,
          new T.Color(i % 6 < 3 ? track.accent : '#e7e6d9')
        );
        if (i % 3 === 0) {
          m.position.set(
            p.x - Math.cos(p.yaw) * (track.width / 2 + 1) * side,
            0.48,
            p.z + Math.sin(p.yaw) * (track.width / 2 + 1) * side
          );
          m.updateMatrix();
          const n = (i / 3) * 2 + s;
          walls.setMatrixAt(n, m.matrix);
          walls.setColorAt(
            n,
            new T.Color(i % 12 < 6 ? '#252c30' : track.accent)
          );
        }
      });
      if (i % 4 === 0) {
        m.position.set(p.x, 0.061, p.z);
        m.rotation.set(0, p.yaw, 0);
        m.updateMatrix();
        marks.setMatrixAt(i / 4, m.matrix);
      }
    }
    this.world.add(curb, walls, marks);
    const start = track.points[0],
      checker = new T.InstancedMesh(
        new T.BoxGeometry(1.2, 0.02, 1.2),
        new T.MeshStandardMaterial({ roughness: 0.7 }),
        30
      );
    for (let i = 0; i < 30; i++) {
      const lane = ((i % 15) - 7) * 1.2,
        d = Math.floor(i / 15) * 1.2;
      m.position.set(
        start.x - Math.cos(start.yaw) * lane + Math.sin(start.yaw) * d,
        0.08,
        start.z + Math.sin(start.yaw) * lane + Math.cos(start.yaw) * d
      );
      m.rotation.set(0, start.yaw, 0);
      m.updateMatrix();
      checker.setMatrixAt(i, m.matrix);
      checker.setColorAt(
        i,
        new T.Color((i + Math.floor(i / 15)) % 2 ? '#15191c' : '#f1f0e7')
      );
    }
    this.world.add(checker);
    const arch = new T.Group();
    arch.position.set(start.x, 0, start.z);
    arch.rotation.y = start.yaw;
    const metal = new T.MeshStandardMaterial({
      color: '#232c31',
      metalness: 0.55,
      roughness: 0.5
    });
    for (const s of [-1, 1]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.5, 6, 0.6), metal);
      pole.position.set(s * (track.width / 2 + 1), 3, 0);
      arch.add(pole);
    }
    const beam = new T.Mesh(
      new T.BoxGeometry(track.width + 2.5, 1.1, 0.7),
      metal
    );
    beam.position.y = 5.65;
    arch.add(beam);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = COLORS[0];
      ctx.fillRect(0, 0, 1024, 128);
      ctx.fillStyle = '#172018';
      ctx.font = '900 78px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('KART ROYALE', 512, 92);
      const tex = new T.CanvasTexture(canvas);
      tex.userData.ephemeral = true;
      tex.colorSpace = T.SRGBColorSpace;
      const sign = new T.Mesh(
        new T.PlaneGeometry(track.width, 1),
        new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })
      );
      sign.position.set(0, 5.65, -0.36);
      arch.add(sign);
    }
    this.world.add(arch);
    this.addCity(track);
    this.skidMesh = new T.InstancedMesh(
      new T.PlaneGeometry(0.16, 1).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: '#0b1012',
        transparent: true,
        opacity: 0.38,
        depthWrite: false
      }),
      512
    );
    this.skidMesh.count = 0;
    this.skidMesh.frustumCulled = false;
    this.skidMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.world.add(this.skidMesh);
    m.scale.set(1, 1, 1);
    const posts = new T.InstancedMesh(
        new T.BoxGeometry(0.13, 6, 0.13),
        new T.MeshStandardMaterial({ color: '#444f52', metalness: 0.6 }),
        24
      ),
      lamps = new T.InstancedMesh(
        new T.BoxGeometry(2.6, 0.12, 0.5),
        new T.MeshBasicMaterial({ color: '#e5f5ec' }),
        24
      );
    for (let i = 0; i < 24; i++) {
      const p = track.points[i * 15],
        o = track.width / 2 + 3;
      m.position.set(p.x - Math.cos(p.yaw) * o, 3, p.z + Math.sin(p.yaw) * o);
      m.rotation.set(0, p.yaw, 0);
      m.updateMatrix();
      posts.setMatrixAt(i, m.matrix);
      m.position.y = 6;
      m.updateMatrix();
      lamps.setMatrixAt(i, m.matrix);
    }
    this.world.add(posts, lamps);
    this.scene.background = new T.Color(track.sky);
    this.scene.fog = new T.Fog(track.sky, 80, 390);
    this.garage.visible = false;
    this.world.visible = true;
  }
  private addCity(track: Track) {
    if (track.id === 'canyon') {
      const cliffs = new T.InstancedMesh(
        new T.IcosahedronGeometry(1, 1),
        new T.MeshStandardMaterial({
          roughness: 1,
          color: '#b97f56',
          flatShading: true
        }),
        54
      );
      const m = this.transform;
      for (let i = 0; i < 54; i++) {
        const p = track.points[Math.floor((i / 54) * 360)],
          offset = 30 + (i % 3) * 12;
        m.position.set(
          p.x + Math.cos(p.yaw) * offset,
          7 + (i % 5) * 2,
          p.z - Math.sin(p.yaw) * offset
        );
        m.rotation.set(i * 0.23, i * 1.31, i * 0.07);
        m.scale.set(9 + (i % 3) * 3, 12 + (i % 7) * 3, 10 + (i % 4) * 2);
        m.updateMatrix();
        cliffs.setMatrixAt(i, m.matrix);
        cliffs.setColorAt(
          i,
          new T.Color(['#b88258', '#d19a6e', '#946446'][i % 3])
        );
      }
      this.world.add(cliffs);
      return;
    }
    if (!this.city) return;
    const m = this.transform;
    for (let i = 0; i < 56; i++) {
      const near = i < 30;
      const p =
        track.points[
          Math.floor((near ? i / 30 : (i - 30 + 0.4) / 26) * 360) % 360
        ];
      const offset = track.width / 2 + (near ? 18 : 53 + (i % 3) * 12);
      m.position.set(
        p.x + Math.cos(p.yaw) * offset,
        0,
        p.z - Math.sin(p.yaw) * offset
      );
      m.rotation.set(0, p.yaw - Math.PI / 2, 0);
      const scale = near ? 0.88 + (i % 3) * 0.08 : 1.05 + (i % 3) * 0.22;
      m.scale.setScalar(scale);
      m.updateMatrix();
      this.cityPlacements.push({
        kind: i % 2 ? 'corner_block' : 'brick_block',
        matrix: m.matrix.clone(),
        x: m.position.x,
        z: m.position.z
      });
    }
    this.city.updateMatrixWorld(true);
    for (const kind of ['brick_block', 'corner_block'])
      for (const lod of [false, true]) {
        const template = this.city.getObjectByName(kind + (lod ? '_lod' : ''));
        if (!template) continue;
        const batch: CityBatch = { kind, lod, meshes: [] };
        template.traverse((o) => {
          if (!(o instanceof T.Mesh)) return;
          const mat = (o.material as T.MeshStandardMaterial).clone();
          if (mat.name === 'city_glass' && track.id === 'neon') {
            mat.color.set('#354c60');
            mat.emissive.set('#cf9d5c');
            mat.emissiveIntensity = 0.22;
          }
          const mesh = new T.InstancedMesh(
            o.geometry.clone().applyMatrix4(o.matrixWorld),
            mat,
            56
          );
          mesh.count = 0;
          mesh.castShadow = !lod;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false; // per-placement distance culling below
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          batch.meshes.push(mesh);
          this.world.add(mesh);
        });
        this.cityBatches.push(batch);
      }
  }
  private updateCity(x: number, z: number) {
    const fullRange = this.quality === 'performance' ? 0 : 64;
    const farRange = this.quality === 'performance' ? 180 : 250;
    for (const batch of this.cityBatches) {
      let count = 0;
      for (const p of this.cityPlacements) {
        if (p.kind !== batch.kind) continue;
        const distance = Math.hypot(p.x - x, p.z - z);
        if (distance > farRange || distance > fullRange !== batch.lod) continue;
        for (const mesh of batch.meshes) mesh.setMatrixAt(count, p.matrix);
        count++;
      }
      for (const mesh of batch.meshes) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
  private animateKart(v: T.Group, r: Racer, dt: number, now: number) {
    const rig = this.rigs.get(v);
    if (!rig) return;
    const smooth = 1 - Math.exp(-dt * 10);
    const steer = Number.isFinite(r.steering) ? r.steering : 0;
    const yawRate = r.yawRate || 0;
    rig.spin = (rig.spin + (r.speed / 0.28) * dt) % (Math.PI * 2);
    for (const wheel of rig.wheels) wheel.rotation.x = rig.spin;
    for (const front of rig.front)
      front.rotation.y += (-steer * 0.42 - front.rotation.y) * smooth;
    if (rig.steeringWheel) rig.steeringWheel.rotation.z = steer * 0.65;
    // Small chassis flex/load transfer; the wheels stay on the road.
    rig.body.rotation.z +=
      (T.MathUtils.clamp(yawRate * r.speed * 0.0018, -0.055, 0.055) -
        rig.body.rotation.z) *
      smooth;
    rig.body.rotation.x +=
      (T.MathUtils.clamp(-(r.acceleration || 0) * 0.0017, -0.035, 0.055) -
        rig.body.rotation.x) *
      smooth;
    rig.body.position.y =
      this.state === 'racing' && !this.paused
        ? Math.sin(now * 0.061 + r.slot) * Math.min(0.007, r.speed * 0.0003)
        : 0;
  }
  private updateSkids() {
    if (!this.skidMesh || this.paused || this.state !== 'racing') return;
    let dirty = false;
    for (const r of this.racers) {
      const x = r.x - Math.sin(r.yaw) * 1.135,
        z = r.z - Math.cos(r.yaw) * 1.135;
      const previous = this.skidPrevious.get(r.id);
      if (previous && r.speed > 7 && (r.drifting || r.acceleration < -16)) {
        const length = Math.hypot(x - previous.x, z - previous.z);
        if (length > 0.02 && length < 6)
          for (const side of [-1, 1]) {
            const m = this.transform;
            m.position.set(
              (x + previous.x) / 2 + Math.cos(r.yaw) * side * 0.85,
              0.069,
              (z + previous.z) / 2 - Math.sin(r.yaw) * side * 0.85
            );
            m.rotation.set(0, Math.atan2(x - previous.x, z - previous.z), 0);
            m.scale.set(1, 1, length + 0.04);
            m.updateMatrix();
            this.skidMesh.setMatrixAt(this.skidIndex++ % 512, m.matrix);
            dirty = true;
          }
      }
      this.skidPrevious.set(r.id, { x, z });
    }
    if (dirty) {
      this.skidMesh.count = Math.min(512, this.skidIndex);
      this.skidMesh.instanceMatrix.needsUpdate = true;
    }
  }
  private addRacers() {
    for (const r of this.racers) {
      const v = this.cloneKart(r.slot, r.id !== this.me);
      v.traverse((o) => {
        if (o instanceof T.Mesh && (o.material as T.Material).name === 'paint')
          (o.material as T.MeshStandardMaterial).color.set(
            r.id === this.me ? this.color : r.color
          );
      });
      v.position.set(r.x, 0.08, r.z);
      v.rotation.y = r.yaw;
      this.world.add(v);
      this.visuals.set(r.id, v);
    }
  }
  startLocal(id: string, difficulty: string) {
    this.track = makeTrack(id);
    this.difficulty = difficulty;
    this.me = 'you';
    this.network = false;
    this.time = 0;
    this.countdown = 3;
    this.accumulator = 0;
    this.paused = false;
    this.racers = Array.from({ length: 6 }, (_, i) =>
      createRacer(
        this.track,
        i === 0 ? 'you' : `ai-${i}`,
        ['You', 'Nova', 'Rift', 'Jett', 'Onyx', 'Flux'][i],
        i,
        i > 0
      )
    );
    this.racers[0].color = this.color;
    this.createWorld(this.track);
    this.addRacers();
    this.state = 'countdown';
    this.clearInput();
    this.snapCamera();
  }
  networkState(next: ServerRace, id: string) {
    if (!next.racers.length) return;
    const fresh =
      !this.network ||
      this.me !== id ||
      this.state === 'garage' ||
      (this.state === 'finished' && next.status === 'countdown');
    this.network = true;
    this.me = id;
    this.time = next.elapsed;
    this.countdown = Math.max(0, (next.startsAt - next.serverNow) / 1000);
    this.racers = next.racers.map((r) => ({ ...r }));
    if (fresh) {
      this.track = makeTrack(next.trackId);
      this.createWorld(this.track);
      this.addRacers();
      this.clearInput();
      this.snapCamera();
    }
    if (next.status === 'finished' && this.state !== 'finished') {
      this.state = 'finished';
      this.finish();
    } else if (next.status !== 'finished') this.state = next.status;
  }
  private finish() {
    this.onFinish({
      racers: standings(this.racers),
      playerId: this.me,
      elapsed: this.time,
      trackId: this.track.id
    });
  }
  pause(p: boolean) {
    this.paused = p;
    this.clearInput();
  }
  clearInput() {
    Object.assign(this.input, neutral());
  }
  private snapCamera() {
    const r = this.racers.find((r) => r.id === this.me);
    if (!r) return;
    this.camera.position.set(
      r.x - Math.sin(r.yaw) * 10,
      6,
      r.z - Math.cos(r.yaw) * 10
    );
    this.lookTarget.set(r.x, 1, r.z);
    this.camera.lookAt(this.lookTarget);
  }
  private animate = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (document.hidden) return;
    this.frames++;
    if (now - this.fpsAt >= 1500) {
      this.fps = (this.frames * 1000) / (now - this.fpsAt);
      this.frames = 0;
      this.fpsAt = now;
      if (
        this.quality === 'auto' &&
        this.state !== 'garage' &&
        this.fps < 43 &&
        this.ratio > 1
      ) {
        this.ratio = Math.max(1, this.ratio - 0.15);
        this.renderer.setPixelRatio(this.ratio);
      }
    }
    if (this.state === 'garage') {
      this.showroom.rotation.y = matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? -0.48
        : Math.sin(now * 0.00012) * 0.3 - 0.48;
      const mobile = this.camera.aspect < 0.85;
      this.camera.fov = mobile ? 42 : 38;
      this.camera.position.set(
        mobile ? 4.7 : 5.7,
        mobile ? 3.35 : 3.2,
        mobile ? 6.4 : 6.5
      );
      this.vector.set(
        mobile ? 0 : -1.5,
        mobile ? -0.1 : 0.65,
        mobile ? 0 : 0.8
      );
      this.camera.lookAt(this.vector);
      this.camera.updateProjectionMatrix();
    } else {
      if (!this.paused) {
        if (this.state === 'countdown' && !this.network) {
          this.countdown -= dt;
          if (this.countdown <= 0) this.state = 'racing';
        }
        if (this.state === 'racing') {
          this.accumulator += dt;
          while (this.accumulator >= STEP) {
            this.time += STEP;
            const me = this.racers.find((r) => r.id === this.me);
            if (me) me.input = this.input;
            if (this.network) {
              if (me) stepRacer(me, this.input, this.track, STEP, this.time);
            } else
              stepRace(
                this.racers,
                this.track,
                STEP,
                this.time,
                this.difficulty
              );
            this.accumulator -= STEP;
          }
          if (
            !this.network &&
            this.racers.find((r) => r.id === this.me)?.finished
          ) {
            this.state = 'finished';
            this.finish();
          }
        }
      }
      for (const r of this.racers) {
        const v = this.visuals.get(r.id);
        if (!v) continue;
        v.visible = !r.disconnected;
        const smooth = 1 - Math.exp(-dt * (this.network ? 16 : 22));
        this.vector.set(r.x, 0.08, r.z);
        v.position.lerp(this.vector, smooth);
        v.rotation.y += wrapAngle(r.yaw - v.rotation.y) * smooth;
        this.animateKart(
          v,
          r,
          this.paused || this.state !== 'racing' ? 0 : dt,
          now
        );
      }
      const me = this.racers.find((r) => r.id === this.me);
      if (me) {
        const v = this.visuals.get(me.id)!,
          yaw = v.rotation.y + wrapAngle(me.velocityYaw - v.rotation.y) * 0.22;
        if (now - this.cityAt > 180) {
          this.cityAt = now;
          this.updateCity(me.x, me.z);
        }
        if (now - this.skidAt > 65) {
          this.skidAt = now;
          this.updateSkids();
        }
        this.cameraTarget.set(
          v.position.x - Math.sin(yaw) * 9.5,
          4.4 + me.speed * 0.016,
          v.position.z - Math.cos(yaw) * 9.5
        );
        this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 5.5));
        this.vector.set(
          v.position.x + Math.sin(yaw) * 6,
          1.25,
          v.position.z + Math.cos(yaw) * 6
        );
        this.lookTarget.lerp(this.vector, 1 - Math.exp(-dt * 9));
        this.camera.lookAt(this.lookTarget);
        const targetFov = 57 + me.speed * 0.18;
        this.camera.fov +=
          (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5));
        this.camera.updateProjectionMatrix();
        this.shadow.position.set(me.x + 14, 25, me.z + 12);
        this.shadow.target.position.set(me.x, 0, me.z);
        if (now - this.uiAt > 90) {
          this.uiAt = now;
          this.onFrame({
            speed: me.speed,
            boost: me.boost,
            lap: Math.min(3, Math.max(1, me.lap)),
            position:
              standings(this.racers).findIndex((r) => r.id === this.me) + 1,
            time: this.time,
            countdown:
              this.state === 'countdown' ? Math.ceil(this.countdown) : 0,
            drifting: me.drifting,
            driftCharge: me.driftCharge,
            fps: Math.round(this.fps),
            racers: this.racers.map((r) => ({ ...r })),
            track: this.track,
            drawCalls: this.renderer.info.render.calls
          });
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
  };
  private collectTextures(group: T.Object3D) {
    group.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material])
        for (const value of Object.values(mat))
          if (value instanceof T.Texture) this.textures.add(value);
    });
  }
  private release(group: T.Object3D, geometry: boolean) {
    const mats = new Set<T.Material>(),
      geos = new Set<T.BufferGeometry>();
    group.traverse((o) => {
      if (o instanceof T.Mesh) {
        if (geometry) geos.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          mats.add(m);
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      const texture = (m as T.MeshStandardMaterial).map;
      if (texture?.userData.ephemeral) texture.dispose();
      m.dispose();
    });
  }
  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.visibility);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.contextLost
    );
    this.release(this.scene, true);
    if (this.full) this.release(this.full, true);
    if (this.low) this.release(this.low, true);
    if (this.city) this.release(this.city, true);
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
