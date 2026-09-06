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
    const [full, low] = await Promise.all([
      loader.loadAsync('/assets/kart-royale/apex.glb'),
      loader.loadAsync('/assets/kart-royale/apex-lod.glb')
    ]);
    if (this.disposed) {
      this.release(full.scene, true);
      this.release(low.scene, true);
      return;
    }
    this.full = full.scene;
    this.low = low.scene;
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
      normals: number[] = [];
    for (let i = 0; i <= 360; i++) {
      const p = track.points[i % 360];
      for (const side of [-1, 1]) {
        positions.push(
          p.x - Math.cos(p.yaw) * track.width * 0.5 * side,
          0.045,
          p.z + Math.sin(p.yaw) * track.width * 0.5 * side
        );
        normals.push(0, 1, 0);
      }
      if (i < 360) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    const road = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({
        color: track.id === 'neon' ? '#303447' : '#393f41',
        roughness: 0.78,
        metalness: 0.12,
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
      tex.colorSpace = T.SRGBColorSpace;
      const sign = new T.Mesh(
        new T.PlaneGeometry(track.width, 1),
        new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })
      );
      sign.position.set(0, 5.65, -0.36);
      arch.add(sign);
    }
    this.world.add(arch);
    const buildings = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshStandardMaterial({ roughness: 0.86, metalness: 0.1 }),
      72
    );
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2,
        r = 1.55 + (i % 3) * 0.2,
        h = track.id === 'canyon' ? 9 + (i % 7) * 4 : 12 + (i % 9) * 6;
      m.position.set(
        Math.cos(a) * track.x * r,
        h / 2 - 0.1,
        Math.sin(a) * track.z * r
      );
      m.rotation.set(
        0,
        track.id === 'canyon' ? a : 0.1 * (i % 4),
        track.id === 'canyon' ? 0.12 : 0
      );
      m.scale.set(10 + (i % 3) * 5, h, 10 + (i % 4) * 4);
      m.updateMatrix();
      buildings.setMatrixAt(i, m.matrix);
      buildings.setColorAt(
        i,
        new T.Color(
          track.id === 'canyon'
            ? ['#bd8557', '#b4734c', '#d69a68'][i % 3]
            : ['#4b555b', '#646d71', '#424d55', '#717b7e'][i % 4]
        )
      );
    }
    this.world.add(buildings);
    m.scale.set(1, 1, 1);
    if (track.id !== 'canyon') {
      const containers = new T.InstancedMesh(
        new T.BoxGeometry(14, 4, 5),
        new T.MeshStandardMaterial({ metalness: 0.2, roughness: 0.75 }),
        18
      );
      for (let i = 0; i < 18; i++) {
        m.position.set(
          ((i % 6) - 2.5) * 16,
          2 + Math.floor(i / 6) * 4.02,
          -20 + Math.floor(i / 6) * 6
        );
        m.rotation.set(0, 0, 0);
        m.updateMatrix();
        containers.setMatrixAt(i, m.matrix);
        containers.setColorAt(
          i,
          new T.Color(['#536566', '#ce7850', '#3c546c'][i % 3])
        );
      }
      this.world.add(containers);
      const windows = new T.InstancedMesh(
        new T.BoxGeometry(0.08, 1.2, 1.7),
        new T.MeshBasicMaterial({
          color: track.id === 'neon' ? '#ffe1ac' : '#9aaead'
        }),
        480
      );
      let n = 0;
      for (let i = 0; i < 24; i++) {
        const a = (i / 72) * Math.PI * 2,
          rad = 1.55 + (i % 3) * 0.2;
        for (let row = 0; row < 5; row++)
          for (let col = 0; col < 4; col++) {
            m.position.set(
              Math.cos(a) * track.x * rad - (10 + (i % 3) * 5) / 2 - 0.09,
              3 + row * 3.2,
              Math.sin(a) * track.z * rad + (col - 1.5) * 2.5
            );
            m.updateMatrix();
            windows.setMatrixAt(n++, m.matrix);
          }
      }
      this.world.add(windows);
    }
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
        v.rotation.z = r.drifting ? Math.sin(now * 0.04) * 0.012 : 0;
      }
      const me = this.racers.find((r) => r.id === this.me);
      if (me) {
        const v = this.visuals.get(me.id)!,
          yaw = v.rotation.y;
        this.cameraTarget.set(
          v.position.x - Math.sin(yaw) * 9.5,
          5.2 + me.speed * 0.012,
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
        this.camera.fov = 58 + me.speed * 0.2;
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
      (m as T.MeshStandardMaterial).map?.dispose();
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
    this.environment.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
