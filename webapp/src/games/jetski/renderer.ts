import * as T from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createRider, poseRider } from './rider';
import {
  CRAFTS,
  sample,
  waterHeight,
  wrapAngle,
  type Track,
  type Racer
} from './simulation.mjs';

export type Quality = 'auto' | 'high' | 'balanced' | 'battery';
type Visual = {
  root: T.Group;
  rider: ReturnType<typeof createRider>;
  handle: T.Group;
  initialized: boolean;
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
  private buoyBatches: {
    mesh: T.InstancedMesh;
    points: { x: number; z: number }[];
    height: number;
  }[] = [];
  private rings: T.Mesh[] = [];
  private gateMarker: T.Group = new T.Group();
  private spray: T.Points;
  private sprayPositions = new Float32Array(540 * 3);
  private sprayLife = new Float32Array(540);
  private sprayVelocity = new Float32Array(540 * 3);
  private particle = 0;
  private wake: T.InstancedMesh;
  private wakeData: {
    x: number;
    z: number;
    angle: number;
    life: number;
    scale: number;
  }[] = [];
  private wakeHead = 0;
  private dummy = new T.Object3D();
  private draco: DRACOLoader;
  private ktx: KTX2Loader;
  private disposed = false;
  private observer: ResizeObserver;
  private cameraSet = false;
  private frames = 0;
  private timeSum = 0;
  private pixelRatio = 1;
  private cameraMode = 'chase';
  private quality: Quality;
  private target = new T.Vector3();
  private desired = new T.Vector3();
  private focus = new T.Vector3();
  private sun: T.DirectionalLight;
  private day: 'day' | 'sunset';
  private reflectionTick = 0;
  private onWaterRender: any;
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
    const geo = new T.BufferGeometry();
    geo.setAttribute(
      'position',
      new T.BufferAttribute(this.sprayPositions, 3).setUsage(T.DynamicDrawUsage)
    );
    this.sprayPositions.fill(-999);
    this.spray = new T.Points(
      geo,
      new T.PointsMaterial({
        color: 0xe4fbff,
        size: 0.13,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      })
    );
    this.spray.frustumCulled = false;
    this.scene.add(this.spray);
    this.wake = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        color: 0xc8f5f2,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: T.DoubleSide
      }),
      300
    );
    this.wake.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.wake.frustumCulled = false;
    this.scene.add(this.wake);
    for (let i = 0; i < 300; i++) {
      this.wakeData.push({ x: 0, z: 0, angle: 0, life: 0, scale: 0 });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.wake.setMatrixAt(i, this.dummy.matrix);
    }
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
  setCamera(mode: string) {
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
    onProgress('Preparing watercraft, rider and coastline…');
    const settled = await Promise.allSettled([
      loader.loadAsync('/assets/jetski-royal/watercraft.glb'),
      loader.loadAsync('/assets/table-tennis/athlete-male.glb'),
      loader.loadAsync('/assets/jetski-royal/rock/rock.gltf'),
      new T.TextureLoader().loadAsync('/assets/jetski-royal/waternormals.jpg')
    ]);
    for (const r of settled)
      if (r.status === 'fulfilled' && 'scene' in r.value)
        this.assets.push(r.value.scene);
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
      rock = (settled[2] as PromiseFulfilledResult<GLTF>).value;
    this.craft = craft.scene;
    this.human = human.scene;
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
        o.castShadow = true;
        o.receiveShadow = true;
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
    normals.wrapS = normals.wrapT = T.RepeatWrapping;
    this.water = new Water(new T.PlaneGeometry(2000, 2000, 192, 192), {
      textureWidth: this.quality === 'high' ? 768 : 512,
      textureHeight: this.quality === 'high' ? 768 : 512,
      waterNormals: normals,
      sunDirection: new T.Vector3(
        0.35,
        this.day === 'day' ? 0.48 : 0.12,
        -0.7
      ).normalize(),
      sunColor: this.day === 'day' ? 0xfff6e5 : 0xffba82,
      waterColor: 0x087b83,
      distortionScale: 2.5,
      fog: true
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.material.uniforms.size.value = 5;
    const mat = this.water.material as T.ShaderMaterial;
    mat.uniforms.waveAmplitude = { value: this.track.wave };
    mat.vertexShader = mat.vertexShader
      .replace(
        'uniform float time;',
        'uniform float time;\nuniform float waveAmplitude;'
      )
      .replace(
        'void main() {',
        `void main() {
      vec3 displaced = position;
      displaced.z += waveAmplitude * (sin(position.x*.075 + time*1.9)*.6 + sin(-position.y*.12-time*1.45)*.3 + sin((position.x-position.y)*.19+time*2.6)*.1);
    `
      )
      .replaceAll('vec4( position, 1.0 )', 'vec4( displaced, 1.0 )');
    this.scene.add(this.water);
    this.onWaterRender = this.water.onBeforeRender.bind(this.water);
    this.water.onBeforeRender = (...args: any[]) => {
      if (this.quality !== 'battery' || this.reflectionTick++ % 3 === 0)
        this.onWaterRender(...args);
    };
    this.buildScenery(rock.scene);
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
    for (let i = 0; i < 240; i += 5) {
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
      if (i === 0) {
        const g = new T.Group();
        for (const side of [-1, 1])
          g.add(
            mesh(
              new T.CylinderGeometry(0.4, 0.55, 7.5, 12),
              teal,
              side * (this.track.width - 1),
              3.6
            )
          );
        g.add(
          mesh(new T.BoxGeometry(this.track.width * 2, 1.3, 0.65), dark, 0, 7)
        );
        const sign = label('JET SKI  /  ROYAL', '#d2fff7', 1024, 128);
        sign.position.y = 7;
        sign.scale.set(19, 2.375, 1);
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
    arrow.position.y = 5.5;
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
    const rider = createRider(this.human);
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
    const visual = { root, rider, handle, name, initialized: false };
    this.visuals.set(r.id, visual);
    return visual;
  }
  update(
    racers: Racer[],
    playerId: string,
    time: number,
    dt: number,
    mode: string,
    preview = false
  ) {
    if (this.disposed || !this.water) return;
    this.setCamera(mode);
    this.water.material.uniforms.time.value = time;
    const local = racers.find((r) => r.id === playerId) || racers[0];
    if (!local) return;
    for (const r of racers) {
      const item = this.visuals.get(r.id) || this.addRacer(r);
      if (!item) continue;
      const root = item.root,
        wave = waterHeight(r.x, r.z, time, this.track.wave);
      const targetY = wave + r.height - 0.16;
      if (!item.initialized) {
        root.position.set(r.x, targetY, r.z);
        root.rotation.y = r.heading;
        item.initialized = true;
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
      if (r.id === playerId || this.frames % 2 === 0)
        poseRider(item.rider, root, r.steer, r.speed, time, r.airborne);
      item.name.visible = r.id !== playerId;
      item.rider.root.visible = mode !== 'eyes' || r.id !== playerId || preview;
      if (r.speed > 3 && !r.airborne && dt > 0) {
        for (let j = 0; j < (this.quality === 'battery' ? 1 : 3); j++) {
          const k = this.particle++ % 540,
            ix = k * 3,
            side = j % 2 ? 1 : -1,
            back = 1.5 + Math.random();
          this.sprayPositions[ix] =
            r.x - Math.sin(r.heading) * back + Math.cos(r.heading) * side * 0.4;
          this.sprayPositions[ix + 1] = wave + 0.04;
          this.sprayPositions[ix + 2] =
            r.z - Math.cos(r.heading) * back - Math.sin(r.heading) * side * 0.4;
          this.sprayVelocity[ix] =
            -Math.sin(r.heading) * r.speed * 0.12 +
            Math.cos(r.heading) * side * (1 + Math.random() * 2);
          this.sprayVelocity[ix + 1] = 1.2 + Math.random() * r.speed * 0.1;
          this.sprayVelocity[ix + 2] =
            -Math.cos(r.heading) * r.speed * 0.12 -
            Math.sin(r.heading) * side * (1 + Math.random() * 2);
          this.sprayLife[k] = 0.7;
        }
        if (this.frames % 3 === 0) {
          const w = this.wakeData[this.wakeHead++ % 300];
          w.x = r.x - Math.sin(r.heading) * 2;
          w.z = r.z - Math.cos(r.heading) * 2;
          w.angle = r.heading;
          w.life = 2;
          w.scale = 1 + r.speed * 0.035;
        }
      }
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
    const gate = this.track.gates[local.nextGate];
    this.gateMarker.position.set(gate.x, Math.sin(time * 3) * 0.35, gate.z);
    this.gateMarker.visible = !preview && !local.finished;
    for (let i = 0; i < 540; i++) {
      if (this.sprayLife[i] <= 0) continue;
      const k = i * 3;
      this.sprayLife[i] -= dt;
      this.sprayPositions[k] += this.sprayVelocity[k] * dt;
      this.sprayPositions[k + 1] += this.sprayVelocity[k + 1] * dt;
      this.sprayPositions[k + 2] += this.sprayVelocity[k + 2] * dt;
      this.sprayVelocity[k + 1] -= 8 * dt;
      if (this.sprayLife[i] <= 0) this.sprayPositions[k + 1] = -999;
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
    this.wakeData.forEach((w, i) => {
      w.life = Math.max(0, w.life - dt);
      this.dummy.position.set(
        w.x,
        waterHeight(w.x, w.z, time, this.track.wave) + 0.055,
        w.z
      );
      this.dummy.rotation.set(-Math.PI / 2, 0, -w.angle);
      const age = 2 - w.life;
      this.dummy.scale.set(
        w.life > 0 ? w.scale + age * 1.7 : 0,
        w.life > 0 ? 0.75 + age * 0.8 : 0,
        1
      );
      this.dummy.updateMatrix();
      this.wake.setMatrixAt(i, this.dummy.matrix);
    });
    this.wake.instanceMatrix.needsUpdate = true;
    const ship = this.visuals.get(local.id)!.root;
    if (preview) {
      const a = time * 0.09 + 2.35;
      this.desired.set(
        local.x + Math.sin(a) * 7,
        3.1,
        local.z + Math.cos(a) * 7
      );
      this.focus.set(local.x, 0.85, local.z);
    } else if (mode === 'eyes') {
      this.desired.set(0, 1.43, 0.28).applyMatrix4(ship.matrixWorld);
      this.focus.set(
        local.x + Math.sin(local.heading) * 28,
        1.2 + local.height,
        local.z + Math.cos(local.heading) * 28
      );
    } else {
      const distance = this.camera.aspect < 0.8 ? 9 : 10.8;
      this.desired.set(
        local.x - Math.sin(local.heading) * distance,
        4.2 + local.height * 0.55,
        local.z - Math.cos(local.heading) * distance
      );
      this.focus.set(
        local.x + Math.sin(local.heading) * 10,
        1.0 + local.height * 0.35,
        local.z + Math.cos(local.heading) * 10
      );
    }
    if (!this.cameraSet) {
      this.camera.position.copy(this.desired);
      this.target.copy(this.focus);
      this.cameraSet = true;
    }
    this.camera.position.lerp(
      this.desired,
      1 - Math.exp(-dt * (mode === 'eyes' ? 30 : 7))
    );
    this.target.lerp(this.focus, 1 - Math.exp(-dt * 9));
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
    const fov =
      (mode === 'eyes' ? 68 : 57) + (local.boosting && !preview ? 6 : 0);
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
