import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  STEP,
  RACE_LIMIT,
  KARTS,
  normalizeKart,
  equipKart,
  COLORS,
  makeTrack,
  createRacer,
  stepRace,
  stepRacer,
  standings,
  wrapAngle
} from './simulation.mjs';
import type { Input, Racer, Track } from './simulation.mjs';
import { TiranaScenery } from './tiranaScenery';
import { Supporters } from './supporters';
import { prepareHuman } from './supporterHuman';
import { RaceEffects } from './raceEffects';
import { segmentFrame } from './trackEdges.mjs';
import type { FoodKind } from './foodFlight.mjs';
export type CameraMode = 'driver' | 'chase';
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
  health: number;
  shield: number;
  ammunition: number;
  impactId: number;
  impact: number;
  retired: boolean;
  foodHitId: number;
  foodKind: FoodKind;
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
  boost: false,
  shield: false,
  fire: false
});
interface KartRig {
  body: T.Object3D;
  steeringWheel?: T.Object3D;
  wheels: T.Object3D[];
  front: T.Object3D[];
  spin: number;
  smoke: T.Mesh;
  chassisScale: T.Vector3;
  bodyPosition: T.Vector3;
  bodyRotation: T.Euler;
  lastImpact: number;
  crashAge: number;
  kickPitch: number;
  kickRoll: number;
  kickSize: number;
  driverParts: T.Object3D[];
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
  private kartModels = new Map<string, T.Group>();
  private kartId = 'apex';
  private flagTexture: T.Texture | null = null;
  private scenery: TiranaScenery | null = null;
  private supporters: Supporters | null = null;
  private humanTemplates: T.Group[] = [];
  private effects: RaceEffects | null = null;
  private cameraMode: CameraMode = 'driver';
  private motionTime = 0;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    .matches;
  private textures = new Set<T.Texture>();
  private roadMaps: T.Texture[] = [];
  private rigs = new WeakMap<T.Object3D, KartRig>();
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
    this.scene.add(
      this.shadow,
      this.shadow.target,
      this.world,
      this.garage,
      this.camera
    );
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
      textures.loadAsync('/assets/kart-royale/albania.svg'),
      textures.loadAsync('/assets/kart-royale/asphalt-diff.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-nor_gl.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-rough.jpg'),
      ...KARTS.slice(1).map((k) =>
        loader.loadAsync(`/assets/kart-royale/kenney-${k.id}.glb`)
      ),
      loader.loadAsync('/assets/table-tennis/athlete-male.glb'),
      loader.loadAsync('/assets/table-tennis/athlete-female.glb')
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
    this.flagTexture = (results[2] as PromiseFulfilledResult<T.Texture>).value;
    this.flagTexture.colorSpace = T.SRGBColorSpace;
    this.textures.add(this.flagTexture);
    KARTS.slice(1).forEach((k, i) => {
      const scene = (
        results[i + 6] as PromiseFulfilledResult<
          import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
        >
      ).value.scene;
      // Keep creator geometry and texture; normalize to the shared physical kart size.
      const bounds = new T.Box3().setFromObject(scene),
        size = bounds.getSize(new T.Vector3());
      scene.scale.setScalar(2.7 / size.z);
      scene.updateMatrixWorld(true);
      const floor = new T.Box3().setFromObject(scene);
      scene.position.y = -floor.min.y;
      this.kartModels.set(k.id, scene);
      this.collectTextures(scene);
    });
    this.humanTemplates = results.slice(5 + KARTS.length).map((result, i) => {
      const source = (
        result as PromiseFulfilledResult<
          import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
        >
      ).value.scene;
      this.collectTextures(source);
      return prepareHuman(source, i === 1);
    });
    this.roadMaps = results
      .slice(3, 6)
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
    for (const group of [this.full, this.low]) this.collectTextures(group);
    this.showroom.add(this.cloneKart(0, false, this.kartId));
    this.setColor(this.color);
  }
  private cloneKart(slot: number, low = false, kartId = 'apex') {
    const source =
      kartId === 'apex'
        ? low
          ? this.low
          : this.full
        : this.kartModels.get(kartId);
    const model = new T.Group();
    if (source) model.add(source.clone(true));
    model.userData.kartId = kartId;
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
      body: model.getObjectByName('body') || model.children[0] || model,
      steeringWheel: model.getObjectByName('steering_wheel'),
      wheels: [],
      front: [],
      spin: 0,
      chassisScale: new T.Vector3(1, 1, 1),
      bodyPosition: new T.Vector3(),
      bodyRotation: new T.Euler(),
      lastImpact: 0,
      crashAge: 10,
      kickPitch: 0,
      kickRoll: 0,
      kickSize: 0,
      driverParts: [],
      smoke: new T.Mesh(
        new T.IcosahedronGeometry(0.24, 1),
        new T.MeshBasicMaterial({
          color: '#545a59',
          transparent: true,
          opacity: 0.3,
          depthWrite: false
        })
      )
    };
    rig.smoke.geometry.userData.kartOwned = true;
    rig.chassisScale.copy(rig.body.scale);
    rig.bodyPosition.copy(rig.body.position);
    rig.bodyRotation.copy(rig.body.rotation);
    rig.smoke.position.set(0.45, 0.8, -0.8);
    rig.smoke.visible = false;
    model.add(rig.smoke);
    model.traverse((o) => {
      if (/^(character|body_suit|body_visor)$/.test(o.name))
        rig.driverParts.push(o);
      if (/^wheel_[fr][lr]$/.test(o.name) || o.name.startsWith('wheel-'))
        rig.wheels.push(o);
      if (/^steer_f[lr]$/.test(o.name)) rig.front.push(o);
    });
    if (kartId !== 'apex') {
      for (const wheel of rig.wheels.filter((w) => w.name.includes('front'))) {
        const pivot = new T.Group();
        pivot.position.copy(wheel.position);
        wheel.parent?.add(pivot);
        pivot.add(wheel);
        wheel.position.set(0, 0, 0);
        rig.front.push(pivot);
      }
      // Distinct CC0 chassis adaptations; every choice keeps identical physics.
      const index = KARTS.findIndex((k) => k.id === kartId),
        paint = new T.MeshStandardMaterial({
          name: 'paint',
          color: COLORS[slot % 6],
          metalness: 0.2,
          roughness: 0.4
        });
      const panel = new T.Mesh(
        new T.BoxGeometry(
          index === 3 ? 1.5 : 1.0,
          0.22,
          index === 2 ? 0.65 : 0.35
        ),
        paint
      );
      panel.geometry.userData.kartOwned = true;
      panel.position.set(0, 0.45, index === 4 ? -1.08 : 0.92);
      model.add(panel);
      if (index === 4) {
        panel.position.y = 0.95;
        const post = new T.Mesh(new T.BoxGeometry(0.16, 0.65, 0.14), paint);
        post.geometry.userData.kartOwned = true;
        post.position.set(0, 0.62, -1.08);
        model.add(post);
      }
    }
    this.rigs.set(model, rig);
    return model;
  }
  setKart(id: string) {
    this.kartId = normalizeKart(id);
    if (!this.full) return;
    for (const child of [...this.showroom.children]) {
      this.release(child, false);
      this.showroom.remove(child);
    }
    this.showroom.add(this.cloneKart(0, false, this.kartId));
    this.setColor(this.color);
  }
  setColor(color: string) {
    this.color = color;
    this.showroom.traverse((o) => {
      if (o instanceof T.Mesh && (o.material as T.Material).name === 'paint')
        (o.material as T.MeshStandardMaterial).color.set(color);
    });
  }
  setCameraMode(mode: CameraMode) {
    this.cameraMode = mode === 'chase' ? 'chase' : 'driver';
    if (this.state !== 'garage') this.snapCamera();
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
    this.effects?.clear();
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
    this.scenery = null;
    this.supporters?.dispose();
    this.supporters = null;
    this.effects?.dispose();
    this.effects = null;
    this.motionTime = 0;
    this.skidPrevious.clear();
    this.skidIndex = 0;
    this.cityAt = this.skidAt = 0;
    this.release(this.world, true);
    this.world.clear();
    const ground = new T.Mesh(
      new T.PlaneGeometry(4000, 4000),
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
        color: '#858b8d',
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
        new T.BoxGeometry(0.55, 0.14, 1),
        new T.MeshStandardMaterial({ roughness: 0.7 }),
        720
      ),
      tireGeometry = new T.TorusGeometry(0.43, 0.14, 8, 16),
      tires = new T.InstancedMesh(
        tireGeometry,
        new T.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02 }),
        960
      ),
      tireTreads = new T.InstancedMesh(
        new T.TorusGeometry(0.4, 0.105, 8, 16),
        new T.MeshStandardMaterial({ color: '#17191a', roughness: 0.98 }),
        960
      ),
      marks = new T.InstancedMesh(
        new T.BoxGeometry(0.12, 0.01, 1.8),
        new T.MeshBasicMaterial({ color: '#e2e7d8' }),
        90
      );
    for (let i = 0; i < 360; i++) {
      const p = track.points[i],
        q = track.points[(i + 1) % 360],
        edge = segmentFrame(p,q,track.width/2);
      [-1, 1].forEach((side, s) => {
        const curbPoint=edge.side(side,-0.1);
        m.position.set(
          curbPoint.x,
          0.1,
          curbPoint.z
        );
        m.rotation.set(0, edge.yaw, 0);
        m.scale.set(1, 1, edge.length + 0.4);
        m.updateMatrix();
        curb.setMatrixAt(i * 2 + s, m.matrix);
        curb.setColorAt(
          i * 2 + s,
          new T.Color(i % 6 < 3 ? track.accent : '#e7e6d9')
        );
        const tirePoint = edge.side(side, 0.72),
          n = i * 2 + s;
        m.position.set(tirePoint.x, 0.18, tirePoint.z);
        m.rotation.set(Math.PI / 2, edge.yaw, 0);
        m.scale.set(1, 1, 1);
        m.updateMatrix();
        tires.setMatrixAt(n, m.matrix);
        tires.setColorAt(
          n,
          new T.Color(i % 2 === 0 ? '#c82424' : '#eeeae0')
        );
        tireTreads.setMatrixAt(n, m.matrix);
        if (i % 3 === 0) {
          const upper = 720 + (i / 3) * 2 + s;
          m.position.y = 0.49;
          m.updateMatrix();
          tires.setMatrixAt(upper, m.matrix);
          tires.setColorAt(
            upper,
            new T.Color(i % 2 === 0 ? '#eeeae0' : '#c82424')
          );
          tireTreads.setMatrixAt(upper, m.matrix);
        }
      });
      m.scale.set(1, 1, 1);
      if (i % 4 === 0) {
        m.position.set(p.x, 0.061, p.z);
        m.rotation.set(0, p.yaw, 0);
        m.updateMatrix();
        marks.setMatrixAt(i / 4, m.matrix);
      }
    }
    tires.count = tireTreads.count = 960;
    tires.receiveShadow = tireTreads.receiveShadow = true;
    this.world.add(curb, tires, tireTreads, marks);
    const start = track.points[0],
      checker = new T.InstancedMesh(
        new T.BoxGeometry(track.width / 15, 0.02, 1.2),
        new T.MeshStandardMaterial({ roughness: 0.7 }),
        30
      );
    for (let i = 0; i < 30; i++) {
      const lane = ((i % 15) - 7) * (track.width / 15),
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
      ctx.fillText('TIRANA · RACING ROYAL', 512, 92);
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
    this.scenery = new TiranaScenery(track);
    this.world.add(this.scenery.group);
    if (this.flagTexture) {
      this.supporters = new Supporters(
        track,
        this.flagTexture,
        this.humanTemplates
      );
      this.world.add(this.supporters.group);
    }
    this.effects = new RaceEffects(this.camera);
    this.world.add(this.effects.group);
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
    const driver =
      this.cameraMode === 'driver' &&
      r.id === this.me &&
      this.state !== 'garage';
    rig.driverParts.forEach((part) => (part.visible = !driver));
    if ((r.impactId || 0) > rig.lastImpact) {
      rig.lastImpact = r.impactId;
      rig.crashAge = 0;
      rig.kickSize = r.impact;
      rig.kickPitch =
        (Math.sin(r.yaw) * r.impactNx + Math.cos(r.yaw) * r.impactNz) *
        r.impact *
        0.15;
      rig.kickRoll =
        (Math.cos(r.yaw) * r.impactNx - Math.sin(r.yaw) * r.impactNz) *
        r.impact *
        0.18;
      this.effects?.crash(r);
    }
    rig.crashAge += dt;
    const spring = Math.sin(rig.crashAge * 23) * Math.exp(-rig.crashAge * 7);
    const bounce =
      Math.sin(Math.min(Math.PI, rig.crashAge * 16)) *
      Math.exp(-rig.crashAge * 7);
    rig.body.rotation.z =
      rig.bodyRotation.z +
      T.MathUtils.clamp(yawRate * r.speed * 0.0018, -0.055, 0.055) +
      spring * rig.kickRoll;
    rig.body.rotation.x =
      rig.bodyRotation.x +
      T.MathUtils.clamp(-(r.acceleration || 0) * 0.0017, -0.035, 0.055) +
      spring * rig.kickPitch;
    rig.body.position.copy(rig.bodyPosition);
    rig.body.position.y +=
      bounce * rig.kickSize * 0.1 +
      (r.speed > 1 ? Math.sin(this.motionTime * 28 + r.slot) * 0.005 : 0);
    rig.body.position.x += spring * rig.kickRoll * 0.3;
    rig.smoke.visible = r.health < 25 && !r.retired;
    if (rig.smoke.visible) {
      rig.smoke.position.y = 0.8 + ((this.motionTime * 0.8) % 1.1);
      rig.smoke.scale.setScalar(1 + ((this.motionTime * 0.8) % 1.1) * 1.5);
    }
    rig.body.scale.set(
      rig.chassisScale.x * (1 - (r.damageSide || 0) * 0.00035),
      rig.chassisScale.y,
      rig.chassisScale.z *
        (1 - ((r.damageFront || 0) + (r.damageRear || 0)) * 0.00045)
    );
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
      const v = this.cloneKart(
        r.slot,
        r.id !== this.me,
        r.kartId ||
          (r.id === this.me ? this.kartId : KARTS[r.slot % KARTS.length].id)
      );
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
    equipKart(this.racers[0], this.kartId);
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
    const driver = this.cameraMode === 'driver';
    this.camera.position.set(
      r.x - Math.sin(r.yaw) * (driver ? 0.1 : 10),
      driver ? 1.16 : 6,
      r.z - Math.cos(r.yaw) * (driver ? 0.1 : 10)
    );
    this.lookTarget.set(
      r.x + Math.sin(r.yaw) * 24,
      driver ? 1.0 : 1.25,
      r.z + Math.cos(r.yaw) * 24
    );
    this.camera.lookAt(this.lookTarget);
    this.camera.fov = this.raceFov(r.speed);
    this.camera.updateProjectionMatrix();
  }
  private raceFov(speed: number) {
    if (this.cameraMode === 'chase') return 57 + speed * 0.18;
    // Preserve useful horizontal sight in portrait without rotating the screen.
    return (
      T.MathUtils.clamp(
        T.MathUtils.radToDeg(
          2 * Math.atan(Math.tan(T.MathUtils.degToRad(28)) / this.camera.aspect)
        ),
        68,
        96
      ) + Math.min(3, speed * 0.065)
    );
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
      if (!this.paused && this.state !== 'finished') this.motionTime += dt;
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
            (this.racers.find((r) => r.id === this.me)?.finished ||
              this.racers.find((r) => r.id === this.me)?.retired ||
              this.time >= RACE_LIMIT)
          ) {
            this.state = 'finished';
            this.finish();
          }
        }
      }
      for (const r of this.racers) {
        let v = this.visuals.get(r.id);
        if (!v) continue;
        if (v.userData.kartId !== r.kartId && r.kartId) {
          const old = v;
          v = this.cloneKart(r.slot, r.id !== this.me, r.kartId);
          v.traverse((o) => {
            if (
              o instanceof T.Mesh &&
              (o.material as T.Material).name === 'paint'
            )
              (o.material as T.MeshStandardMaterial).color.set(
                r.id === this.me ? this.color : r.color
              );
          });
          v.position.copy(old.position);
          v.rotation.copy(old.rotation);
          this.world.remove(old);
          this.release(old, false);
          this.world.add(v);
          this.visuals.set(r.id, v);
        }
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
          this.scenery?.update(me.x, me.z, this.quality === 'performance');
        }
        const running = this.state === 'racing' && !this.paused;
        this.supporters?.update(
          this.time,
          me,
          this.racers,
          this.quality === 'performance',
          running,
          (origin, target, kind, seed) =>
            this.effects?.launch(origin, target, kind, seed)
        );
        if (now - this.skidAt > 65) {
          this.skidAt = now;
          this.updateSkids();
        }
        const driver = this.cameraMode === 'driver';
        if (driver) {
          const rig = this.rigs.get(v);
          const spring =
            rig && !this.reducedMotion
              ? Math.sin(rig.crashAge * 24) * Math.exp(-rig.crashAge * 8)
              : 0;
          const steerYaw = v.rotation.y;
          const bob = this.reducedMotion
            ? 0
            : Math.sin(this.motionTime * 27) *
              Math.min(0.004, me.speed * 0.0002);
          // Fixed head mount prevents camera lag from leaving the seat in turns.
          this.camera.position.set(
            v.position.x - Math.sin(steerYaw) * 0.1,
            1.16 + bob + spring * 0.028,
            v.position.z - Math.cos(steerYaw) * 0.1
          );
          this.lookTarget.set(
            v.position.x + Math.sin(steerYaw) * 24,
            1.0 + spring * (rig?.kickPitch || 0) * 3,
            v.position.z + Math.cos(steerYaw) * 24
          );
          this.camera.lookAt(this.lookTarget);
          this.camera.rotateZ(spring * (rig?.kickRoll || 0) * 0.18);
        } else {
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
        }
        this.camera.fov +=
          (this.raceFov(me.speed) - this.camera.fov) * (1 - Math.exp(-dt * 5));
        this.camera.updateProjectionMatrix();
        this.effects?.update(
          running ? dt : 0,
          this.racers,
          this.visuals,
          this.me,
          driver
        );
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
            drawCalls: this.renderer.info.render.calls,
            health: me.health ?? 100,
            shield: me.shield ?? 0,
            ammunition: me.ammunition ?? 0,
            impactId: me.impactId ?? 0,
            impact: me.impact ?? 0,
            retired: me.retired ?? false,
            foodHitId: this.effects?.foodHitId ?? 0,
            foodKind: this.effects?.lastFoodKind ?? 'egg'
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
        if (geometry || o.geometry.userData.kartOwned) geos.add(o.geometry);
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
    this.supporters?.dispose();
    this.effects?.dispose();
    this.release(this.scene, true);
    this.humanTemplates.forEach((model) => this.release(model, true));
    if (this.full) this.release(this.full, true);
    if (this.low) this.release(this.low, true);
    this.kartModels.forEach((model) => this.release(model, true));
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
