import * as T from 'three';
import { KartDriver } from './KartDriver';
import { KartMotion } from './KartMotion';
import { RacingCockpit } from './RacingCockpit';
import { createWebGLRenderer } from '../tiranastreets/createWebGLRenderer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { isMilitaryVehicle } from './militaryVehicleCatalog.mjs';
import { KART_ASSETS, vehicleAssetUrl, cockpitStyle, COCKPIT_URL } from './vehicleAssetConfig.mjs';
import { prepareVehicleAsset } from './vehicleAssetAdapter';
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
import { createRaceSurfaceGeometry } from './RaceSurface';
import { createBoostPadLayer } from './BoostPadLayer';
import { createRoadBumpLayer } from './RoadBumpLayer';
import { createTyreBarrierLayer } from './TyreBarrierLayer';
import { courseClearance } from './raceCourse.mjs';
import { createKerbLayer } from './KerbLayer';
import { createJumpRampLayer } from './JumpRampLayer';
import { surfaceHeight, surfaceColor } from './racingSurface.mjs';
import { freeRoamWorld } from './freeRoam.mjs';
import type { DrivingWorld } from './freeRoamCore.mjs';
export type CameraMode = 'driver' | 'chase';
export type Quality = 'auto' | 'high' | 'performance';
export interface Frame {
  freeRoam:boolean;
  reversing:boolean;
  speed: number;
  lapTime: number;
  bestLap: number;
  throttle: number;
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
  turbo: number;
  boostEvent: number;
  slipstream: number;
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
  throttle: false,
  brake: false,
  recover: false,
  reverse: false,
  drift: false,
  boost: false,
  shield: false,
  fire: false
});
interface KartRig {
  motion: KartMotion;
  body: T.Object3D;
  steeringWheel?: T.Object3D;
  wheels: T.Object3D[];
  front: T.Object3D[];
  wheelHeights: Map<T.Object3D, number>;
  spin: number;
  wheelRadius: number;
  driverEye?: T.Vector3;
  cockpit?: RacingCockpit;
  driver?: KartDriver;
  aero?: T.Object3D;
  lights: T.MeshStandardMaterial[];
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
  private kartLowModels = new Map<string, T.Group>();
  private cockpitModels = new Map<string,T.Group>();
  private cockpitForward = new T.Vector3();
  private kartId = 'apex';
  private flagTexture: T.Texture | null = null;
  private scenery: TiranaScenery | null = null;
  private supporters: Supporters | null = null;
  private humanTemplates: T.Group[] = [];
  private driverModels: T.Group[] = [];
  private effects: RaceEffects | null = null;
  private cameraMode: CameraMode = 'chase';
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
  private freeDriving:DrivingWorld|null = null;
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
    this.renderer = createWebGLRenderer();
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
    const draco = new DRACOLoader()
      .setWorkerLimit(1)
      .setDecoderPath('/assets/tirana-streets/imported/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const textures = new T.TextureLoader();
    const cockpitStyles = ['kart'];
    const results = await Promise.allSettled([
      loader.loadAsync(vehicleAssetUrl('apex')),
      loader.loadAsync(vehicleAssetUrl('apex', true)),
      textures.loadAsync('/assets/kart-royale/albania.svg'),
      textures.loadAsync('/assets/kart-royale/asphalt-diff.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-nor_gl.jpg'),
      textures.loadAsync('/assets/kart-royale/asphalt-rough.jpg'),
      ...KARTS.slice(1).map((k) => loader.loadAsync(vehicleAssetUrl(k.id))),
      loader.loadAsync('/assets/table-tennis/athlete-male.glb'),
      loader.loadAsync('/assets/table-tennis/athlete-female.glb'),
      ...KARTS.filter((k) => k.id !== 'apex').map((k) =>
        loader.loadAsync(vehicleAssetUrl(k.id, true))
      ),
      ...cockpitStyles.map(style => loader.loadAsync(COCKPIT_URL + style + '.glb')),
      loader.loadAsync('/assets/kart-royale/karts/race-driver.glb'),
      loader.loadAsync('/assets/kart-royale/karts/race-driver-lod.glb')
    ]);
    draco.dispose();
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
    prepareVehicleAsset(this.full, 'apex');
    prepareVehicleAsset(this.low, 'apex', this.full.userData.vehicleFit);
    this.flagTexture = (results[2] as PromiseFulfilledResult<T.Texture>).value;
    this.flagTexture.colorSpace = T.SRGBColorSpace;
    this.textures.add(this.flagTexture);
    KARTS.slice(1).forEach((k, i) => {
      const scene = (
        results[i + 6] as PromiseFulfilledResult<
          import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
        >
      ).value.scene;
      // One adapter owns fitting, seat mounts and wheel radii for imported cars.
      prepareVehicleAsset(scene, k.id);
      this.kartModels.set(k.id, scene);
      this.collectTextures(scene);
    });
    this.humanTemplates = results
      .slice(5 + KARTS.length, 7 + KARTS.length)
      .map((result, i) => {
        const source = (
          result as PromiseFulfilledResult<
            import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
          >
        ).value.scene;
        this.collectTextures(source);
        return prepareHuman(source, i === 1);
      });
    KARTS.filter((k) => k.id !== 'apex').forEach((k, i) => {
      const scene = (
        results[7 + KARTS.length + i] as PromiseFulfilledResult<
          import('three/examples/jsm/loaders/GLTFLoader.js').GLTF
        >
      ).value.scene;
      prepareVehicleAsset(
        scene,
        k.id,
        this.kartModels.get(k.id)!.userData.vehicleFit
      );
      this.kartLowModels.set(k.id, scene);
      this.collectTextures(scene);
    });
    cockpitStyles.forEach((style,i) => {
      const model = (results[results.length-2-cockpitStyles.length+i] as PromiseFulfilledResult<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>).value.scene;
      this.cockpitModels.set(style,model);this.collectTextures(model);
    });
    this.driverModels = results.slice(-2).map(r => (r as PromiseFulfilledResult<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>).value.scene);
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
        : (low ? this.kartLowModels.get(kartId) : undefined) ||
          this.kartModels.get(kartId);
    const model = new T.Group();
    if (source) model.add(source.clone(true));
    // Apex is authored at the old scale; imported vehicles are fitted to the
    // same final length by vehicleAssetAdapter.

    model.userData.kartId = kartId;
    model.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = (o.material as T.MeshStandardMaterial).clone();
        if (m.name === 'paint') {
          const finish = new T.MeshPhysicalMaterial(); T.MeshStandardMaterial.prototype.copy.call(finish, m); finish.color.set(COLORS[slot % 6]);
          finish.clearcoat = 1; finish.clearcoatRoughness = .22; finish.roughness = .32; finish.metalness = .28;
          m.dispose(); o.material = finish; return;
        }
        o.material = m;
      }
    });
    const rig: KartRig = {
      motion: new KartMotion(),
      body: model.getObjectByName('body') || model.children[0] || model,
      steeringWheel: model.getObjectByName('steering_wheel'),
      wheels: [],
      front: [],
      wheelHeights: new Map(),
      spin: 0,
      wheelRadius: source?.userData.wheelRadius || 0.28,
      driverEye: source?.userData.driverEye
        ? new T.Vector3(
            ...(source.userData.driverEye as [number, number, number])
          )
        : undefined,
      chassisScale: new T.Vector3(1, 1, 1),
      bodyPosition: new T.Vector3(),
      bodyRotation: new T.Euler(),
      lastImpact: 0,
      crashAge: 10,
      kickPitch: 0,
      kickRoll: 0,
      kickSize: 0,
      driverParts: [],
      aero: model.getObjectByName('aero_wing'),
      lights: [],
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
      if (/^(character|body_suit|body_visor)$/.test(o.name)) o.visible = false;
      if (o instanceof T.Mesh && ['energy','brake_light'].includes(o.material.name)) rig.lights.push(o.material as T.MeshStandardMaterial);
      if (/^wheel_[fr][lr]$/.test(o.name) || o.name.startsWith('wheel-'))
        rig.wheels.push(o);
      if (/^steer_f[lr]$/.test(o.name)) rig.front.push(o);
    });
    if (
      kartId !== 'apex' &&
      !isMilitaryVehicle(kartId) &&
      !KART_ASSETS[kartId] &&
      !this.kartModels.get(kartId)?.userData.factoryFinish &&
      !['ferrari', 'buggy'].includes(kartId)
    ) {
      for (const wheel of rig.wheels.filter((w) => w.name.includes('front'))) {
        const pivot = new T.Group();
        pivot.position.copy(wheel.position);
        wheel.parent?.add(pivot);
        pivot.add(wheel);
        wheel.position.set(0, 0, 0);
        rig.front.push(pivot);
      }
      // Keep the original CC0 kart adaptations off the authored vehicle bodies.
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
    const driverModel = this.driverModels[low ? 1 : 0];
    if (driverModel) { rig.driver = new KartDriver(driverModel, COLORS[slot % 6], kartId === 'oopi'); rig.body.add(rig.driver.root); }
    const cabin=this.cockpitModels.get(cockpitStyle(kartId));
    if(!rig.driver && !low && cabin && rig.driverEye)rig.cockpit=new RacingCockpit(cabin,model,rig.body,rig.driverEye);
    this.rigs.set(model, rig);
    return model;
  }
  setKart(id: string, slideDirection = 0) {
    this.kartId = normalizeKart(id);
    if (!this.full) return;
    for (const child of [...this.showroom.children]) {
      this.release(child, false);
      this.showroom.remove(child);
    }
    const model = this.cloneKart(0, false, this.kartId);
    this.showroom.add(model);
    if (
      slideDirection &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.camera.updateMatrixWorld();
      this.showroom.updateMatrixWorld();
      model.position
        .setFromMatrixColumn(this.camera.matrixWorld, 0)
        .transformDirection(this.showroom.matrixWorld.clone().invert())
        .multiplyScalar(slideDirection * 0.6);
    }
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
    this.freeDriving=null;
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
    this.scenery?.dispose();
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
    const sampleCount = track.points.length;
    const m = new T.Object3D();
    if(!this.freeDriving){
    const geo = createRaceSurfaceGeometry(track);
    const surface = new T.Mesh(geo, new T.MeshStandardMaterial({color:surfaceColor(track),map:this.roadMaps[0],normalMap:this.roadMaps[1],roughnessMap:this.roadMaps[2],roughness:.96}));
    surface.name = 'Rounded closed-event race surface'; surface.receiveShadow = true;
    this.world.add(surface);
    this.world.add(createKerbLayer(track), createTyreBarrierLayer(track, (x,z)=>courseClearance(track,x,z)));
    const start = track.points[0],
      startWidth = start.width ?? track.width,
      checker = new T.InstancedMesh(
        new T.BoxGeometry(startWidth / 15, 0.02, 1.2),
        new T.MeshStandardMaterial({ roughness: 0.7 }),
        30
      );
    for (let i = 0; i < 30; i++) {
      const lane = ((i % 15) - 7) * (startWidth / 15),
        d = Math.floor(i / 15) * 1.2;
      m.position.set(
        start.x - Math.cos(start.yaw) * lane + Math.sin(start.yaw) * d,
        0.14 + surfaceHeight(track,start.x,start.z),
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
    arch.position.set(start.x, surfaceHeight(track,start.x,start.z), start.z);
    arch.rotation.y = start.yaw;
    const metal = new T.MeshStandardMaterial({
      color: '#232c31',
      metalness: 0.55,
      roughness: 0.5
    });
    for (const s of [-1, 1]) {
      const pole = new T.Mesh(new T.BoxGeometry(0.5, 6, 0.6), metal);
      pole.position.set(s * (startWidth / 2 + 1), 3, 0);
      arch.add(pole);
    }
    const beam = new T.Mesh(
      new T.BoxGeometry(startWidth + 2.5, 1.1, 0.7),
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
        new T.PlaneGeometry(startWidth, 1),
        new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })
      );
      sign.position.set(0, 5.65, -0.36);
      arch.add(sign);
    }
    this.world.add(arch);
    }
    this.world.add(createBoostPadLayer(track),createRoadBumpLayer(track),createJumpRampLayer(track));
    this.scenery = new TiranaScenery(track,!!this.freeDriving);
    this.world.add(this.scenery.group);
    if (this.flagTexture && !this.freeDriving && !track.terrainMode) {
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
    if(!this.freeDriving){
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
      const p = track.points[Math.floor(i * sampleCount / 24)],
        o = track.width / 2 + 3;
      m.position.set(p.x - Math.cos(p.yaw) * o, 3+surfaceHeight(track,p.x,p.z), p.z + Math.sin(p.yaw) * o);
      m.rotation.set(0, p.yaw, 0);
      m.updateMatrix();
      posts.setMatrixAt(i, m.matrix);
      m.position.y += 3;
      m.updateMatrix();
      lamps.setMatrixAt(i, m.matrix);
    }
    this.world.add(posts, lamps);
    }
    this.scene.background = new T.Color(track.sky);
    this.scene.fog = new T.FogExp2('#c5d2cc', .0017);
    this.camera.far = 2800;
    this.garage.visible = false;
    this.world.visible = true;
  }
  private animateKart(v: T.Group, r: Racer, dt: number, now: number) {
    const rig = this.rigs.get(v);
    if (!rig) return;
    const smooth = 1 - Math.exp(-dt * 10);
    const steer = Number.isFinite(r.steering) ? r.steering : 0;
    const yawRate = r.yawRate || 0;
    rig.motion.update(r,dt,rig.wheelRadius,this.reducedMotion);
    rig.spin = rig.motion.wheelSpin;
    for (const wheel of rig.wheels) {
      wheel.rotation.x = rig.spin;
      const index = ['fl','fr','rl','rr'].findIndex(suffix => wheel.name.endsWith(suffix));
      if (index >= 0) {
        if (!rig.wheelHeights.has(wheel)) rig.wheelHeights.set(wheel, wheel.position.y);
        const contact = this.reducedMotion ? 0 : r.suspension?.wheels[index] || 0;
        wheel.parent?.getWorldScale(this.vector);
        wheel.position.y = rig.wheelHeights.get(wheel)! + contact / Math.max(.01, this.vector.y);
      }
    }
    for (const front of rig.front)
      front.rotation.y += ((front.name.endsWith('fl') ? rig.motion.leftSteer : rig.motion.rightSteer) - front.rotation.y) * smooth;
    if (rig.steeringWheel) rig.steeringWheel.rotation.z = steer * 0.65;
    const driver =
      this.cameraMode === 'driver' &&
      r.id === this.me &&
      this.state !== 'garage';
    rig.cockpit?.update(driver,steer,r.speed);
    rig.driver?.update(r, this.motionTime, driver, this.reducedMotion);
    if (rig.aero) rig.aero.rotation.x += ((r.braking ? .35 : r.turbo > 0 ? -.12 : 0) - rig.aero.rotation.x) * smooth;
    for (const light of rig.lights) light.emissiveIntensity = light.name === 'brake_light' ? (r.braking ? 4 : .3) : .8 + (r.throttle || 0) * 1.5 + (r.turbo > 0 ? 2 : 0);
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
    const spring = this.reducedMotion ? 0 : Math.sin(rig.crashAge * 23) * Math.exp(-rig.crashAge * 7);
    const bounce =
      Math.sin(Math.min(Math.PI, rig.crashAge * 16)) *
      Math.exp(-rig.crashAge * 7);
    rig.body.rotation.z =
      rig.bodyRotation.z +
      (r.rollAngle || 0) +
      rig.motion.roll +
      spring * rig.kickRoll;
    rig.body.rotation.x =
      rig.bodyRotation.x +
      rig.motion.pitch +
      (r.jumpPitch||0) +
      spring * rig.kickPitch;
    rig.body.position.copy(rig.bodyPosition);
    rig.body.position.y +=
      (!this.reducedMotion && (r.hop || 0) > 0 ? Math.sin((1 - r.hop / .24) * Math.PI) * .18 : 0) +
      (this.reducedMotion ? 0 : bounce * rig.kickSize * 0.1) + rig.motion.height;
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
      if (previous && !r.airborne && r.speed > 7 && (r.drifting || r.acceleration < -16)) {
        const length = Math.hypot(x - previous.x, z - previous.z);
        if (length > 0.02 && length < 6)
          for (const side of [-1, 1]) {
            const m = this.transform;
            m.position.set(
              (x + previous.x) / 2 + Math.cos(r.yaw) * side * 0.85,
              0.14+(r.groundY||0),
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
      v.position.set(r.x, 0.13+(r.groundY||0)+(r.jumpHeight||0), r.z);
      v.rotation.y = r.yaw;
      this.world.add(v);
      this.visuals.set(r.id, v);
    }
  }
  startLocal(id: string, difficulty: string, freeRoam=false) {
    this.track = freeRoam?{...makeTrack(id),terrainMode:'regional'}:makeTrack(id);
    this.freeDriving=freeRoam?freeRoamWorld():null;
    this.difficulty = difficulty;
    this.me = 'you';
    this.network = false;
    this.time = 0;
    this.countdown = freeRoam?0:3;
    this.accumulator = 0;
    this.paused = false;
    this.racers = Array.from({ length: freeRoam?1:6 }, (_, i) =>
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
    if(freeRoam){
      const p=this.track.points[0],r=this.racers[0];
      r.x=p.x;r.z=p.z;r.yaw=r.velocityYaw=p.yaw;r.index=0;
      r.groundY=surfaceHeight(this.track,p.x,p.z);r.jumpY=r.groundY;
      r.roamRecovery={x:p.x,z:p.z,yaw:p.yaw};
    }
    this.createWorld(this.track);
    this.addRacers();
    this.state = freeRoam?'racing':'countdown';
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
    this.freeDriving=null;
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
    const visual = this.visuals.get(r.id),
      eye = visual && this.rigs.get(visual)?.driverEye,
      cockpit = visual && this.rigs.get(visual)?.cockpit;
    if(driver && cockpit){
      cockpit.eye(this.camera.position);
      this.lookTarget.copy(this.camera.position).addScaledVector(cockpit.forward(this.cockpitForward),24);
    } else if (driver && eye && visual) {
      visual.updateMatrixWorld(true);
      this.camera.position.copy(eye).applyMatrix4(visual.matrixWorld);
      this.lookTarget.set(
        this.camera.position.x + Math.sin(r.yaw) * 24,
        this.camera.position.y - 0.08,
        this.camera.position.z + Math.cos(r.yaw) * 24
      );
    } else {
      this.camera.position.set(
        r.x - Math.sin(r.yaw) * (driver ? 0.1 : 10),
        (r.groundY||0)+(r.jumpHeight||0)+(driver ? 1.16 : 6),
        r.z - Math.cos(r.yaw) * (driver ? 0.1 : 10)
      );
      this.lookTarget.set(
        r.x + Math.sin(r.yaw) * 24,
        (r.groundY||0)+(r.jumpHeight||0)+(driver ? 1 : 1.25),
        r.z + Math.cos(r.yaw) * 24
      );
    }
    this.camera.near = driver && eye ? 0.04 : 0.15;
    this.camera.lookAt(this.lookTarget);
    this.camera.fov = this.raceFov(r.speed);
    this.camera.updateProjectionMatrix();
  }
  private raceFov(speed: number) {
    if (this.cameraMode === 'chase') return (this.camera.aspect < .85 ? 60 : 55) + (this.reducedMotion ? 0 : speed * .12);
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
      for (const model of this.showroom.children)
        model.position.multiplyScalar(Math.exp(-dt * 14));
      this.showroom.rotation.y = matchMedia('(prefers-reduced-motion: reduce)')
        .matches
        ? -0.48
        : Math.sin(now * 0.00012) * 0.3 - 0.48;
      const fit = Math.max(1, 1.35 / this.camera.aspect);
      this.camera.fov = 38;
      this.camera.position.set(4.3 * fit, 2.9 * fit, 5.5 * fit);
      this.vector.set(0, .62, 0);
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
            if(this.freeDriving){
              if(me)stepRacer(me,this.input,this.track,STEP,this.time,this.difficulty,this.freeDriving);
            } else if (this.network) {
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
            !this.network && !this.freeDriving &&
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
        this.vector.set(r.x, 0.13+(r.groundY||0)+(r.jumpHeight||0), r.z);
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
          this.scenery?.update(me.x, me.z, this.quality === 'performance', this.camera);
        }
        const running = this.state === 'racing' && !this.paused;
        this.supporters?.update(this.motionTime, me, this.quality === 'performance');
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
          // Model-specific head mounts stay inside the left seat through turns.
          if(rig?.cockpit){
            rig.cockpit.eye(this.camera.position);
            this.camera.position.y += bob + spring * .02;
            this.lookTarget.copy(this.camera.position).addScaledVector(rig.cockpit.forward(this.cockpitForward),24);
            this.camera.near=.025;
          } else if (rig?.driverEye) {
            v.updateMatrixWorld(true);
            this.camera.position
              .copy(rig.driverEye)
              .applyMatrix4(v.matrixWorld);
            this.camera.position.y += bob + spring * 0.02;
            this.lookTarget.set(
              this.camera.position.x + Math.sin(steerYaw) * 24,
              this.camera.position.y - 0.08,
              this.camera.position.z + Math.cos(steerYaw) * 24
            );
            this.camera.near = 0.04;
          } else {
            this.camera.position.set(
              v.position.x - Math.sin(steerYaw) * 0.1,
              v.position.y+1.16 + bob + spring * 0.028,
              v.position.z - Math.cos(steerYaw) * 0.1
            );
            this.lookTarget.set(
              v.position.x + Math.sin(steerYaw) * 24,
              v.position.y+1 + spring * (rig?.kickPitch || 0) * 3,
              v.position.z + Math.cos(steerYaw) * 24
            );
            this.camera.near = 0.15;
          }
          this.camera.lookAt(this.lookTarget);
          this.camera.rotateZ(spring * (rig?.kickRoll || 0) * 0.18);
        } else {
          this.camera.near = 0.15;
          const surge=this.reducedMotion?0:(this.rigs.get(v)?.motion.boost||0);
          this.cameraTarget.set(
            v.position.x - Math.sin(yaw) * (7.8+surge*.45),
            v.position.y+3.7 + Math.max(0,me.speed) * 0.009,
            v.position.z - Math.cos(yaw) * (7.8+surge*.45)
          );
          this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-dt * 5.5));
          this.vector.set(
            v.position.x + Math.sin(yaw) * 6,
            v.position.y+1.25,
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
        this.shadow.position.set(me.x + 14, (me.groundY||0)+25, me.z + 12);
        this.shadow.target.position.set(me.x, me.groundY||0, me.z);
        if (now - this.uiAt > 90) {
          this.uiAt = now;
          this.onFrame({
            freeRoam:!!this.freeDriving,
            reversing:!!me.reversing || me.speed<-.1,
            speed: me.speed,
            throttle: me.throttle || 0,
            lapTime: Math.max(0, this.time - (me.lapStartedAt || 0)),
            bestLap: me.lapTimes?.length ? Math.min(...me.lapTimes) : 0,
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
            turbo: me.turbo,
            boostEvent: me.boostEvent || 0,
            slipstream: me.slipstream || 0
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
        if (geometry && o instanceof T.InstancedMesh) o.dispose();
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
    this.scenery?.dispose();
    this.release(this.scene, true);
    this.driverModels.forEach((model) => this.release(model, true));
    this.humanTemplates.forEach((model) => this.release(model, true));
    if (this.full) this.release(this.full, true);
    if (this.low) this.release(this.low, true);
    this.cockpitModels.forEach((model) => this.release(model, true));
    this.kartModels.forEach((model) => this.release(model, true));
    this.kartLowModels.forEach((model) => this.release(model, true));
    this.textures.forEach((t) => t.dispose());
    this.textures.clear();
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
