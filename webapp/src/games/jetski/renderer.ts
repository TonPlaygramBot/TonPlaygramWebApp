import * as T from 'three';
import type { Water } from 'three/examples/jsm/objects/Water.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import {
  GLTFLoader,
  type GLTF
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createRider, poseRider, poseFallingRider } from './rider';
import { TURI_MODEL_URL } from '../../config/playerCharacter.js';
import { nearestLana } from './lanaCourse.mjs';
import { makeLanaWaterGeometry } from './lanaWater';
import { createRaceWater } from './water';
import { WaterEffects } from './waterEffects';
import {
  CRAFTS,
  sample,
  waterHeight,
  wrapAngle,
  type Track,
  type Racer
} from './simulation.mjs';

export type CameraMode = 'chase' | 'eyes';
export type Quality = 'auto' | 'high' | 'balanced' | 'battery';
type Visual = {
  root: T.Group;
  rider: ReturnType<typeof createRider>;
  handle: T.Group;
  initialized: boolean;
  ejected: boolean;
  name: T.Sprite;
};
const UP = new T.Vector3(0, 1, 0);
const PALETTE = [
  '#32e2d1',
  '#ffab62',
  '#c6b4ff',
  '#f2e477',
  '#64aeff',
  '#ff779b'
];
function label(text: string, color = '#ffffff', width = 512, height = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, width, height);
  c.fillStyle = 'rgba(4,24,33,.82)';
  c.beginPath();
  c.roundRect(0, 0, width, height, 18);
  c.fill();
  c.font = `700 ${height * 0.46}px system-ui`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, width / 2, height / 2, width - 24);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.Sprite(
    new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  );
}
function mesh(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class JetskiRenderer {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(57, 1, 0.12, 1600);
  private water: Water | null = null;
  private env: T.WebGLRenderTarget | null = null;
  private assets: T.Object3D[] = [];
  private visuals = new Map<string, Visual>();
  private craft: T.Group | null = null;
  private human: T.Group | null = null;
  private turi: T.Group | null = null;
  private buoyBatches: {
    mesh: T.InstancedMesh;
    points: { x: number; z: number }[];
    height: number;
  }[] = [];
  private rings: T.Mesh[] = [];
  private gateMarker: T.Group = new T.Group();
  private waterEffects: WaterEffects;
  private dummy = new T.Object3D();
  private draco: DRACOLoader;
  private ktx: KTX2Loader;
  private disposed = false;
  private observer: ResizeObserver;
  private cameraSet = false;
  private frames = 0;
  private timeSum = 0;
  private pixelRatio = 1;
  private cameraMode: CameraMode = 'chase';
  private cameraOnRider = false;
  private cameraRoll = 0;
  private quality: Quality;
  private target = new T.Vector3();
  private desired = new T.Vector3();
  private focus = new T.Vector3();
  private viewOffset = new T.Vector3();
  private sun: T.DirectionalLight;
  private day: 'day' | 'sunset';
  constructor(
    private container: HTMLElement,
    readonly track: Track,
    quality: Quality,
    day: 'day' | 'sunset' = 'day'
  ) {
    this.quality = quality;
    this.day = day;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = day === 'day' ? 1.0 : 0.92;
    this.renderer.shadowMap.enabled = quality !== 'battery';
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setClearColor(day === 'day' ? 0xaadbe1 : 0xeabca6);
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Jet Ski Royal 3D race'
    );
    this.pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      quality === 'high' ? 1.75 : quality === 'battery' ? 1 : 1.35
    );
    this.renderer.setPixelRatio(this.pixelRatio);
    this.scene.fog = new T.FogExp2(day === 'day' ? 0xb3d9df : 0xd3b2a4, 0.0018);
    const sky = new Sky();
    sky.scale.setScalar(10000);
    const sunDirection = new T.Vector3(
      0.35,
      day === 'day' ? 0.48 : 0.12,
      -0.7
    ).normalize();
    sky.material.uniforms.turbidity.value = day === 'day' ? 2.4 : 5;
    sky.material.uniforms.rayleigh.value = day === 'day' ? 1.8 : 2.7;
    sky.material.uniforms.mieCoefficient.value = 0.004;
    sky.material.uniforms.mieDirectionalG.value = 0.82;
    sky.material.uniforms.sunPosition.value.copy(sunDirection);
    this.scene.add(
      sky,
      new T.HemisphereLight(day === 'day' ? 0xb3eaff : 0xd2c3db, 0x36504a, 2.1)
    );
    const pmrem = new T.PMREMGenerator(this.renderer);
    const envScene = new T.Scene();
    envScene.add(sky.clone());
    this.env = pmrem.fromScene(envScene, 0.03, 0.1, 20000);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    this.sun = new T.DirectionalLight(day === 'day' ? 0xfff2da : 0xffc297, 3.1);
    this.sun.position.copy(sunDirection).multiplyScalar(70);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -32;
    this.sun.shadow.camera.right = 32;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.camera.far = 170;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.draco = new DRACOLoader().setDecoderPath(
      '/vendor/three/examples/jsm/libs/draco/gltf/'
    );
    this.ktx = new KTX2Loader()
      .setTranscoderPath('/vendor/three/examples/jsm/libs/basis/')
      .detectSupport(this.renderer);
    this.waterEffects = new WaterEffects(
      this.scene,
      track,
      quality === 'battery'
    );
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }
  private resize() {
    if (this.disposed) return;
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  setCamera(mode: CameraMode) {
    if (mode !== this.cameraMode) {
      this.cameraMode = mode;
      this.cameraSet = false;
    }
  }
  async load(onProgress: (text: string) => void) {
    const loader = new GLTFLoader()
      .setDRACOLoader(this.draco)
      .setKTX2Loader(this.ktx)
      .setMeshoptDecoder(MeshoptDecoder);
    const river = this.track.pointToPoint;
    onProgress(
      river
        ? 'Loading the Lana River and Tirana…'
        : 'Preparing watercraft, rider and coastline…'
    );
    const settled = await Promise.allSettled([
      loader.loadAsync('/assets/jetski-royal/watercraft.glb'),
      loader.loadAsync('/assets/table-tennis/athlete-male.glb'),
      river
        ? import('./lanaScenery').then(({ buildLanaScenery }) =>
            buildLanaScenery(loader)
          )
        : loader
            .loadAsync('/assets/jetski-royal/rock/rock.gltf')
            .then((asset) => asset.scene),
      new T.TextureLoader().loadAsync('/assets/jetski-royal/waternormals.jpg'),
      loader.loadAsync(TURI_MODEL_URL)
    ]);
    for (const r of settled)
      if (r.status === 'fulfilled') {
        if (r.value instanceof T.Group) this.assets.push(r.value);
        else if ('scene' in r.value) this.assets.push(r.value.scene);
      }
    if (this.disposed) {
      this.disposeAssets();
      for (const r of settled)
        if (r.status === 'fulfilled' && r.value instanceof T.Texture)
          r.value.dispose();
      return;
    }
    const failure = settled.find((r) => r.status === 'rejected');
    if (failure)
      throw Error(
        'A race asset could not load. Check your connection and retry.'
      );
    const craft = (settled[0] as PromiseFulfilledResult<GLTF>).value,
      human = (settled[1] as PromiseFulfilledResult<GLTF>).value,
      scenery = (settled[2] as PromiseFulfilledResult<T.Group>).value;
    this.craft = craft.scene;
    this.human = human.scene;
    this.turi = (settled[4] as PromiseFulfilledResult<GLTF>).value.scene;
    // Batch rigid parts by original material (and preserve the steering assembly).
    this.craft.updateMatrixWorld(true);
    const groups = new Map<T.Material, T.Mesh[]>();
    this.craft.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        !Array.isArray(o.material) &&
        !/handlebar|handgrip|trigger/i.test(o.name)
      ) {
        groups.set(o.material, [...(groups.get(o.material) || []), o]);
      }
    });
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const copies = meshes.map((m) => {
        const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
        return g.index ? g.toNonIndexed() : g;
      });
      const merged = mergeGeometries(copies, false);
      copies.forEach((g) => g.dispose());
      if (merged) {
        meshes.forEach((m) => m.removeFromParent());
        const m = new T.Mesh(merged, material);
        this.craft.add(m);
      }
    }
    for (const root of this.assets)
      root.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        if (root !== scenery || !river) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of materials)
          for (const value of Object.values(mat))
            if (value instanceof T.Texture)
              value.anisotropy = Math.min(
                8,
                this.renderer.capabilities.getMaxAnisotropy()
              );
      });
    const normals = (settled[3] as PromiseFulfilledResult<T.Texture>).value;
    this.water = createRaceWater(
      this.track,
      normals,
      this.quality,
      this.day,
      river ? makeLanaWaterGeometry() : undefined
    );
    this.scene.add(this.water);
    if (river) this.scene.add(scenery);
    else this.buildScenery(scenery);
    this.buildCourse();
    onProgress('Ready');
  }
  private buildScenery(rock: T.Group) {
    const parts: T.Mesh[] = [];
    rock.updateMatrixWorld(true);
    rock.traverse((o) => {
      if (o instanceof T.Mesh) parts.push(o);
    });
    for (const part of parts) {
      const geo = part.geometry.clone();
      geo.applyMatrix4(part.matrixWorld);
      geo.computeBoundingBox();
      const size = geo.boundingBox!.getSize(new T.Vector3());
      const normalization = 1 / Math.max(size.x, size.z, size.y);
      geo.translate(
        -geo.boundingBox!.getCenter(new T.Vector3()).x,
        -geo.boundingBox!.min.y,
        -geo.boundingBox!.getCenter(new T.Vector3()).z
      );
      geo.scale(normalization, normalization, normalization);
      const count = 48;
      const cliffs = new T.InstancedMesh(geo, part.material, count);
      for (let i = 0; i < count; i++) {
        const a = i * 0.93,
          outer = i >= 24,
          r = outer ? 230 + (i % 4) * 28 : 24 + (i % 5) * 5;
        const s = outer ? 85 + (i % 4) * 20 : 23 + (i % 4) * 5;
        this.dummy.position.set(Math.sin(a) * r, -2, Math.cos(a) * r);
        this.dummy.rotation.set(0, a + Math.PI, 0);
        this.dummy.scale.set(s, s * (outer ? 0.6 : 0.65), s * 0.85);
        this.dummy.updateMatrix();
        cliffs.setMatrixAt(i, this.dummy.matrix);
      }
      cliffs.castShadow = false;
      cliffs.receiveShadow = true;
      this.scene.add(cliffs);
    }
  }
  private buildCourse() {
    const white = new T.MeshStandardMaterial({
        color: 0xf3f1e9,
        roughness: 0.45
      }),
      orange = new T.MeshStandardMaterial({ color: 0xff6a33, roughness: 0.35 }),
      teal = new T.MeshStandardMaterial({ color: 0x14c7c1, roughness: 0.3 });
    const dark = new T.MeshStandardMaterial({
      color: 0x0b2730,
      roughness: 0.55,
      metalness: 0.25
    });
    const cone = new T.ConeGeometry(0.65, 1.45, 12),
      base = new T.CylinderGeometry(0.72, 0.88, 0.2, 16);
    const left: { x: number; z: number }[] = [],
      right: { x: number; z: number }[] = [];
    for (
      let i = 0;
      i < this.track.points.length;
      i += this.track.pointToPoint ? 10 : 5
    ) {
      left.push(sample(this.track, i, -(this.track.width - 1)));
      right.push(sample(this.track, i, this.track.width - 1));
    }
    for (const batch of [
      {
        geometry: base,
        material: dark,
        points: [...left, ...right],
        height: 0.04
      },
      { geometry: cone, material: orange, points: left, height: 0.75 },
      { geometry: cone, material: white, points: right, height: 0.75 }
    ]) {
      const instanced = new T.InstancedMesh(
        batch.geometry,
        batch.material,
        batch.points.length
      );
      instanced.instanceMatrix.setUsage(T.DynamicDrawUsage);
      instanced.frustumCulled = false;
      this.buoyBatches.push({
        mesh: instanced,
        points: batch.points,
        height: batch.height
      });
      this.scene.add(instanced);
    }
    this.track.gates.forEach((p, i) => {
      const finish =
        this.track.pointToPoint && i === this.track.gates.length - 1;
      if (i === 0 || finish) {
        const g = new T.Group();
        const height = this.track.pointToPoint ? 3.4 : 7;
        const width = this.track.width * 2;
        for (const side of [-1, 1])
          g.add(
            mesh(
              new T.CylinderGeometry(0.22, 0.32, height, 12),
              teal,
              side * (this.track.width - 0.4),
              height * 0.5
            )
          );
        g.add(
          mesh(new T.BoxGeometry(width, height * 0.18, 0.65), dark, 0, height)
        );
        const sign = label(
          finish ? 'FINISH' : 'JET SKI  /  ROYAL',
          '#d2fff7',
          1024,
          128
        );
        sign.position.y = height;
        const signWidth = Math.min(19, width * 0.85);
        sign.scale.set(signWidth, signWidth / 8, 1);
        g.add(sign);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.heading;
        this.scene.add(g);
      }
    });
    const arrow = new T.Mesh(
      new T.ConeGeometry(1, 1.8, 3),
      new T.MeshBasicMaterial({
        color: 0xb8ff65,
        transparent: true,
        opacity: 0.8
      })
    );
    arrow.rotation.z = Math.PI;
    arrow.position.y = this.track.pointToPoint ? 2.35 : 5.5;
    if (this.track.pointToPoint) arrow.scale.setScalar(0.56);
    this.gateMarker.add(arrow);
    this.scene.add(this.gateMarker);
    for (const p of this.track.ramps) {
      const g = new T.Group(),
        geom = new T.BoxGeometry(6, 0.35, 7);
      const top = mesh(geom, dark, 0, 0.9, 0);
      top.rotation.x = -0.2;
      g.add(top);
      for (const x of [-2, 0, 2]) {
        const stripe = mesh(
          new T.BoxGeometry(0.3, 0.02, 6.6),
          teal,
          x,
          1.09,
          0
        );
        stripe.rotation.x = -0.2;
        g.add(stripe);
      }
      const sign = label('AIRTIME', '#b8ff65', 256, 64);
      sign.position.set(0, 2.9, 0);
      sign.scale.set(4, 1, 1);
      g.add(sign);
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.heading;
      this.scene.add(g);
    }
    for (const p of this.track.pickups) {
      const ring = mesh(
        new T.TorusGeometry(1.35, 0.14, 8, 32),
        new T.MeshStandardMaterial({
          color: 0xbaff69,
          emissive: 0x70cf2a,
          emissiveIntensity: 1.3,
          roughness: 0.3
        }),
        p.x,
        1.8,
        p.z
      );
      ring.rotation.y = p.heading;
      this.rings.push(ring);
      this.scene.add(ring);
    }
  }
  private addRacer(r: Racer) {
    if (!this.craft || !this.human) return;
    const root = new T.Group(),
      model = this.craft.clone(true);
    model.rotation.y = -Math.PI / 2;
    const handle = new T.Group();
    handle.position.set(0, 1.035, 0.42);
    // Keep the original textures. Team-colour markers identify racers without repainting the asset.
    const marker = mesh(
      new T.BoxGeometry(0.045, 0.045, 0.8),
      new T.MeshStandardMaterial({
        color: PALETTE[r.slot % 6],
        emissive: PALETTE[r.slot % 6],
        emissiveIntensity: 0.35
      }),
      -0.59,
      0.51,
      -0.65
    );
    root.add(model, marker, handle);
    root.updateMatrixWorld(true);
    const steeringParts: T.Object3D[] = [];
    model.traverse((o) => {
      if (o instanceof T.Mesh && /handlebar|handgrip|trigger/i.test(o.name))
        steeringParts.push(o);
    });
    steeringParts.forEach((o) => handle.attach(o));
    const useTuri = !r.ai && !!this.turi;
    const rider = createRider(useTuri ? this.turi! : this.human, useTuri);
    root.add(rider.root);
    const name = label(
      `${r.ai ? 'AI · ' : ''}${r.name}`,
      PALETTE[r.slot % 6],
      256,
      64
    );
    name.scale.set(3.2, 0.8, 1);
    name.position.y = 2.5;
    root.add(name);
    this.scene.add(root);
    const visual = {
      root,
      rider,
      handle,
      name,
      initialized: false,
      ejected: false
    };
    this.visuals.set(r.id, visual);
    return visual;
  }
  update(
    racers: Racer[],
    playerId: string,
    time: number,
    dt: number,
    mode: CameraMode,
    preview = false
  ) {
    if (this.disposed || !this.water) return;
    this.setCamera(mode);
    this.water.material.uniforms.time.value = time;
    const local = racers.find((r) => r.id === playerId) || racers[0];
    if (!local) return;
    const onRider = mode === 'eyes' && !preview && !local.crash;
    if (onRider !== this.cameraOnRider) {
      this.cameraOnRider = onRider;
      this.cameraSet = false;
    }
    for (const r of racers) {
      const item = this.visuals.get(r.id) || this.addRacer(r);
      if (!item) continue;
      const root = item.root,
        wave = waterHeight(r.x, r.z, time, this.track.wave);
      const targetY = wave + r.height - 0.16;
      if (
        !item.initialized ||
        (item.ejected && !r.crash) ||
        Math.hypot(root.position.x - r.x, root.position.z - r.z) > 14
      ) {
        root.position.set(r.x, targetY, r.z);
        root.rotation.y = r.heading;
        item.initialized = true;
        if (r.id === local.id) this.cameraSet = false;
      }
      const smoothing = 1 - Math.exp(-dt * 22);
      root.position.lerp(this.desired.set(r.x, targetY, r.z), smoothing);
      root.rotation.y += wrapAngle(r.heading - root.rotation.y) * smoothing;
      root.rotation.z = T.MathUtils.lerp(
        root.rotation.z,
        r.steer * Math.min(0.32, r.speed * 0.012),
        smoothing
      );
      root.rotation.x = T.MathUtils.lerp(
        root.rotation.x,
        r.airborne
          ? -r.verticalSpeed * 0.025
          : -0.025 -
              r.speed * 0.0015 +
              Math.sin(time * 4 + r.slot) * this.track.wave * 0.1,
        smoothing
      );
      item.handle.rotation.y = -r.steer * 0.216;
      const rider = item.rider.root;
      if (r.crash) {
        const { x, z, height, heading, age } = r.crash;
        if (!item.ejected) this.scene.add(rider);
        rider.position.set(
          x,
          waterHeight(x, z, time, this.track.wave) + height - 0.12,
          z
        );
        const turn = T.MathUtils.smoothstep(age, 0, 0.65);
        rider.rotation.set(-Math.PI * 0.49 * turn, heading, 0.3 * turn, 'YXZ');
        poseFallingRider(item.rider, age, height > 0.02);
      } else {
        if (item.ejected) {
          root.add(rider);
          rider.position.set(0, -0.08, -0.05);
          rider.rotation.set(0, 0, 0);
        }
        if (r.id === local.id || item.ejected || this.frames % 2 === 0)
          poseRider(item.rider, root, r.steer, r.speed, time, r.airborne);
      }
      item.ejected = Boolean(r.crash);
      item.name.visible = r.id !== playerId;
      rider.visible = !onRider || r.id !== local.id;
    }
    for (const batch of this.buoyBatches) {
      batch.points.forEach((p, i) => {
        this.dummy.position.set(
          p.x,
          batch.height + waterHeight(p.x, p.z, time, this.track.wave),
          p.z
        );
        this.dummy.rotation.set(0, 0, Math.sin(time * 1.5 + p.x) * 0.045);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.rings.forEach((ring, i) => {
      ring.position.y = 1.8 + Math.sin(time * 2 + i) * 0.25;
      ring.rotation.y += dt * 0.65;
      ring.visible = time - (local.pickupAt[i] ?? -99) > 18;
    });
    const gate = this.track.gates[local.nextGate] ?? this.track.gates[0];
    this.gateMarker.position.set(gate.x, Math.sin(time * 3) * 0.35, gate.z);
    this.gateMarker.visible = !preview && !local.finished;
    this.waterEffects.update(racers, time);
    const player = this.visuals.get(local.id);
    if (!player) return;
    const ship = player.root;
    const heading = ship.rotation.y;
    if (preview) {
      const river = this.track.pointToPoint;
      const a = river
        ? heading + Math.PI + Math.sin(time * 0.23) * 0.45
        : time * 0.09 + 2.35;
      const distance = river ? 4.8 : 7;
      this.desired.set(
        local.x + Math.sin(a) * distance,
        river ? 2.25 : 3.1,
        local.z + Math.cos(a) * distance
      );
      this.focus.set(local.x, 0.85, local.z);
    } else if (onRider) {
      player.rider.eye.getWorldPosition(this.desired);
      player.rider.eye.getWorldDirection(this.viewOffset);
      // Keep the console in frame on tall screens while looking down the course.
      const portrait = this.camera.aspect < 0.8;
      if (portrait) this.desired.addScaledVector(this.viewOffset, -0.23);
      this.viewOffset.y = T.MathUtils.clamp(
        this.viewOffset.y - (portrait ? 0.24 : 0),
        portrait ? -0.49 : -0.26,
        portrait ? -0.41 : -0.12
      );
      this.focus.copy(this.desired).addScaledVector(this.viewOffset, 26);
    } else {
      const river = this.track.pointToPoint;
      const distance = river ? 5.4 : this.camera.aspect < 0.8 ? 9 : 10.8;
      const crash = local.crash;
      const x = crash?.x ?? ship.position.x,
        z = crash?.z ?? ship.position.z;
      const y = waterHeight(x, z, time, this.track.wave);
      this.desired.set(
        x - Math.sin(heading) * distance,
        y + (river ? 2.7 : 4.2) + local.height * 0.55,
        z - Math.cos(heading) * distance
      );
      this.focus.set(
        x + Math.sin(heading) * (crash ? 0.8 : 9),
        y + (crash ? Math.max(0.38, crash.height) : 1 + local.height * 0.35),
        z + Math.cos(heading) * (crash ? 0.8 : 9)
      );
    }
    if (!this.cameraSet) {
      this.camera.position.copy(this.desired);
      this.target.copy(this.focus);
      this.cameraSet = true;
    }
    this.camera.position.lerp(
      this.desired,
      1 - Math.exp(-dt * (onRider ? 40 : 8))
    );
    this.target.lerp(this.focus, 1 - Math.exp(-dt * (onRider ? 30 : 9)));
    if (this.track.pointToPoint && !onRider) {
      const p = this.camera.position;
      const bank = nearestLana(p.x, p.z);
      const limit = this.track.width - 0.35;
      if (bank.distance > limit) {
        const ratio = limit / bank.distance;
        p.x = bank.x + (p.x - bank.x) * ratio;
        p.z = bank.z + (p.z - bank.z) * ratio;
      }
    }
    this.camera.position.y = Math.max(
      this.camera.position.y,
      waterHeight(
        this.camera.position.x,
        this.camera.position.z,
        time,
        this.track.wave
      ) + 0.7
    );
    this.camera.up.copy(UP);
    this.camera.lookAt(this.target);
    this.cameraRoll = T.MathUtils.lerp(
      this.cameraRoll,
      onRider ? ship.rotation.z * 0.28 : 0,
      1 - Math.exp(-dt * 9)
    );
    this.camera.rotateZ(this.cameraRoll);
    const fov =
      (onRider ? (this.camera.aspect < 0.8 ? 75 : 66) : 57) +
      (local.boosting && !preview ? 4 : 0);
    this.camera.fov = T.MathUtils.lerp(
      this.camera.fov,
      fov,
      1 - Math.exp(-dt * 5)
    );
    this.camera.updateProjectionMatrix();
    const sunOffset = new T.Vector3(0.35, this.day === 'day' ? 0.48 : 0.3, -0.7)
      .normalize()
      .multiplyScalar(70);
    this.sun.position.copy(ship.position).add(sunOffset);
    this.sun.target.position.copy(ship.position);
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.timeSum += dt;
    if (this.quality === 'auto' && this.frames % 180 === 0) {
      const average = this.timeSum / 180;
      if (average > 0.025 && this.pixelRatio > 0.85) {
        this.pixelRatio = Math.max(0.85, this.pixelRatio - 0.15);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
      this.timeSum = 0;
    }
  }
  private disposeAssets() {
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    for (const root of [this.scene, ...this.assets])
      root.traverse((o) => {
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
        if (
          o instanceof T.Mesh ||
          o instanceof T.Points ||
          o instanceof T.Sprite
        ) {
          if ('geometry' in o) geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
    for (const m of materials) {
      for (const val of Object.values(m))
        if (val instanceof T.Texture) textures.add(val);
      if (m instanceof T.ShaderMaterial)
        for (const u of Object.values(m.uniforms))
          if (u.value instanceof T.Texture) textures.add(u.value);
      m.dispose();
    }
    geometries.forEach((g) => g.dispose());
    textures.forEach((t) => t.dispose());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.disposeAssets();
    this.env?.dispose();
    // Water's reflection texture owns a WebGL framebuffer internally; release the context on unmount.
    this.draco.dispose();
    this.ktx.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
