import * as THREE from 'three';
import { SoftwareRenderer } from './software';
import { loadAthlete } from './assetLoader';
import { dressAthlete, poseAthlete, disposeAthlete } from './athlete';
import { buildStadium, courtTexture } from './stadium';
import { BALL_RADIUS, MatchState, Seat, Surface, side } from './engine';

export const decode = (data: string) =>
  Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
type Actor = {
  root: THREE.Group;
  model: THREE.Group | null;
  rig: ReturnType<typeof dressAthlete> | null;
  stride: number;
  lastX: number;
  lastZ: number;
  marker: THREE.Mesh;
  racket: THREE.Group;
};
export class TennisRenderer {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(39, 1, 0.1, 160);
  renderer: THREE.WebGLRenderer | SoftwareRenderer;
  root = new THREE.Group();
  clock = 0;
  actors: Actor[] = [];
  ball: THREE.Mesh;
  ballShadow: THREE.Mesh;
  trail: THREE.Mesh[] = [];
  court: THREE.Mesh;
  surround: THREE.Mesh;
  stadium: ReturnType<typeof buildStadium>;
  surface: Surface | null = null;
  surfaceMaps = new Map<
    Surface,
    [THREE.Texture | null, THREE.Texture | null]
  >();
  resize: ResizeObserver;
  disposed = false;
  loadError = '';
  constructor(
    public mount: HTMLElement,
    public seat: Seat = 0,
    public quality = 'high'
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch {
      this.renderer = new SoftwareRenderer();
    }
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : 1.65)
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Tennis court. Swipe faster for more power and release to hit.'
    );
    this.renderer.domElement.style.cssText =
      'display:block;width:100%;height:100%;touch-action:none';
    mount.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x9bbbc8);
    this.scene.fog = new THREE.Fog(0x9bbbc8, 58, 120);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xd9edfa, 0x526a52, 1.65));
    const sun = new THREE.DirectionalLight(0xffedcf, 2.5);
    sun.position.set(-13, 25, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const cool = new THREE.DirectionalLight(0x87c6ff, 0.8);
    cool.position.set(10, 8, -15);
    this.scene.add(cool);
    const box = (
      w: number,
      h: number,
      d: number,
      color: number,
      x: number,
      y: number,
      z: number
    ) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
      );
      m.position.set(x, y, z);
      m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    this.surround = box(23, 0.22, 38, 0xffffff, 0, -0.15, 0);
    this.court = box(10.97, 0.03, 23.77, 0xffffff, 0, 0, 0);
    this.setSurface('hard');
    this.surround.renderOrder = -100;
    this.court.renderOrder = -99;
    const line = (x: number, z: number, w: number, d: number) => {
      const m = box(w, 0.012, d, 0xf4f4df, x, 0.024, z);
      m.renderOrder = -98;
      return m;
    };
    for (const x of [-5.485, -4.115, 4.115, 5.485]) line(x, 0, 0.048, 23.82);
    for (const z of [-11.885, 11.885]) line(0, z, 10.97, 0.055);
    for (const z of [-6.4, 6.4]) line(0, z, 8.23, 0.045);
    line(0, 0, 0.045, 12.8);
    line(0, 11.73, 0.055, 0.3);
    line(0, -11.73, 0.055, 0.3);
    for (const x of [-5.65, 5.65]) {
      const p = box(0.12, 1.14, 0.12, 0x152129, x, 0.57, 0);
      p.castShadow = true;
    }
    const netPts: number[] = [];
    for (let x = -5.6; x <= 5.6; x += 0.14) {
      const top = 0.92 + 0.13 * Math.pow(Math.abs(x) / 5.6, 2);
      netPts.push(x, 0.08, 0, x, top, 0);
    }
    for (let y = 0.08; y < 1; y += 0.115) netPts.push(-5.6, y, 0, 5.6, y, 0);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
    const net = new THREE.LineSegments(
      ng,
      new THREE.LineBasicMaterial({
        color: 0x162a27,
        transparent: true,
        opacity: 0.8
      })
    );
    this.root.add(net);
    const tape = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.65, 1.05, 0),
      new THREE.Vector3(0, 0.93, 0),
      new THREE.Vector3(5.65, 1.05, 0)
    ]);
    this.root.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(tape, 20, 0.035, 5, false),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      )
    );
    this.stadium = buildStadium(
      this.root,
      quality === 'low' || this.renderer instanceof SoftwareRenderer
    );
    const centreStrap = box(0.045, 0.91, 0.05, 0xf3f1df, 0, 0.46, 0.008);
    centreStrap.castShadow = true;
    const ballMat = new THREE.MeshStandardMaterial({
      color: 0xdcff36,
      roughness: 0.72,
      emissive: 0x7c8a0b,
      emissiveIntensity: 0.18
    });
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 16, 12),
      ballMat
    );
    this.ball.castShadow = true;
    const seam = Array.from({ length: 65 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2,
        bend = Math.sin(t * 2) * 0.7;
      return new THREE.Vector3(
        Math.sin(t),
        Math.cos(t) * Math.cos(bend),
        Math.cos(t) * Math.sin(bend)
      ).multiplyScalar(BALL_RADIUS * 1.005);
    });
    this.ball.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(seam, true),
          64,
          0.006,
          3,
          true
        ),
        new THREE.MeshStandardMaterial({ color: 0xf3f5d7, roughness: 1 })
      )
    );
    this.root.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 20),
      new THREE.MeshBasicMaterial({
        color: 0x061e2a,
        transparent: true,
        opacity: 0.5,
        depthWrite: false
      })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.035;
    this.root.add(this.ballShadow);
    for (let i = 0; i < 6; i++) {
      const t = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshBasicMaterial({
          color: 0xdbff45,
          transparent: true,
          opacity: (1 - i / 6) * 0.35,
          depthWrite: false
        })
      );
      this.root.add(t);
      this.trail.push(t);
    }
    for (const seat of [0, 1] as Seat[]) this.createActor(seat);
    this.resize = new ResizeObserver(() => this.resizeToFit());
    this.resize.observe(mount);
    this.resizeToFit();
  }
  resizeToFit() {
    const w = this.mount.clientWidth,
      h = this.mount.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // The scoreboard and touch HUD make the court canvas wider than the phone.
    // Frame by phone width so players behind the near baseline keep their feet visible.
    const portrait = w <= 600;
    this.camera.fov = portrait ? 42 : 39;
    this.camera.position.set(
      0,
      portrait ? 24 : 22,
      side(this.seat) * (portrait ? 27 : 25)
    );
    this.camera.lookAt(0, 0, 1 * side(this.seat));
    this.camera.updateProjectionMatrix();
  }
  setSurface(surface: Surface) {
    if (this.surface === surface) return;
    this.surface = surface;
    let maps = this.surfaceMaps.get(surface);
    if (!maps) {
      maps = [courtTexture(surface), courtTexture(surface, true)];
      this.surfaceMaps.set(surface, maps);
    }
    [this.court, this.surround].forEach((mesh, i) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(0xffffff);
      material.map = maps![i];
      material.roughness = surface === 'hard' ? 0.91 : 1;
      material.needsUpdate = true;
    });
  }
  async createActor(seat: Seat) {
    const group = new THREE.Group();
    group.rotation.y = seat === 0 ? Math.PI : 0;
    this.root.add(group);
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.49, 0.59, 32),
      new THREE.MeshBasicMaterial({
        color: seat === this.seat ? 0xddff47 : 0xff8772,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.05;
    group.add(marker);
    const racket = new THREE.Group();
    const head = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.028, 7, 22),
      new THREE.MeshStandardMaterial({
        color: seat === this.seat ? 0xdcff47 : 0xff8168,
        metalness: 0.4,
        roughness: 0.3
      })
    );
    head.scale.y = 1.26;
    head.position.y = 0.5;
    racket.add(head);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.033, 0.33, 8),
      new THREE.MeshStandardMaterial({ color: 0xeeeeeb })
    );
    grip.position.y = 0.1;
    racket.add(grip);
    const strings: number[] = [];
    for (let n = -0.16; n <= 0.17; n += 0.055) {
      const len = Math.sqrt(0.22 * 0.22 - n * n);
      strings.push(
        n,
        -len * 1.2,
        0,
        n,
        len * 1.2,
        0,
        -len,
        n * 1.2,
        0,
        len,
        n * 1.2,
        0
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(strings, 3));
    geo.translate(0, 0.5, 0);
    racket.add(
      new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          color: 0xe6eada,
          transparent: true,
          opacity: 0.65
        })
      )
    );
    const actor: Actor = {
      root: group,
      model: null,
      rig: null,
      stride: 0,
      lastX: 0,
      lastZ: 0,
      marker,
      racket
    };
    this.actors[seat] = actor;
    try {
      const model = await loadAthlete(seat);
      if (this.disposed) {
        disposeAthlete(model);
        return;
      }
      actor.rig = dressAthlete(model, seat);
      group.add(model);
      group.add(racket);
      actor.model = model;
    } catch (e) {
      this.loadError = 'Player model could not load. Reload to retry.';
      console.error(e);
    }
  }
  draw(s: MatchState, dt: number, smooth = false) {
    this.clock += dt;
    this.setSurface(s.config.surface);
    // Keep the stand closest to the camera from hiding the playable court.
    this.stadium.ends[0].visible = this.seat === 0;
    this.stadium.ends[1].visible = this.seat === 1;
    for (let i = 0; i < 2; i++) {
      const a = this.actors[i],
        p = s.players[i];
      if (!a) continue;
      const speed =
        Math.hypot(p.x - a.lastX, p.z - a.lastZ) / Math.max(0.001, dt);
      a.lastX = p.x;
      a.lastZ = p.z;
      if (smooth && s.phase === 'rally')
        a.root.position.lerp(
          new THREE.Vector3(p.x, 0, p.z),
          1 - Math.exp(-dt * 22)
        );
      else a.root.position.set(p.x, 0, p.z);
      const distance = Math.min(0.2, speed * dt);
      a.stride += distance * 8;
      if (a.rig)
        poseAthlete(a.rig, a.root, a.racket, s, i as Seat, a.stride, speed);
      if (a.marker.material instanceof THREE.MeshBasicMaterial) {
        a.marker.material.opacity =
          s.phase === 'serve' && s.score.server === i ? 0.9 : 0.55;
        a.marker.material.color.setHex(i === this.seat ? 0xddff47 : 0xff8772);
      }
    }
    if (smooth && s.phase === 'rally')
      this.ball.position.lerp(
        new THREE.Vector3(s.ball.x, s.ball.y, s.ball.z),
        1 - Math.exp(-dt * 22)
      );
    else this.ball.position.set(s.ball.x, s.ball.y, s.ball.z);
    this.ball.rotation.z += s.ball.vx * dt;
    this.ball.rotation.x += s.ball.vz * dt;
    this.ballShadow.position.set(s.ball.x, 0.045, s.ball.z);
    this.ballShadow.scale.setScalar(0.7 + s.ball.y * 0.17);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity =
      0.48 / (1 + s.ball.y * 0.18);
    this.trail.forEach((t, i) => {
      const lag = (i + 1) * 0.012;
      t.position.set(
        s.ball.x - s.ball.vx * lag,
        s.ball.y - s.ball.vy * lag,
        s.ball.z - s.ball.vz * lag
      );
      t.visible = s.phase === 'rally';
    });
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.disposed = true;
    this.resize.disconnect();
    this.surfaceMaps.forEach((maps) => maps.forEach((map) => map?.dispose()));
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry?.dispose();
        if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          m.dispose();
        });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
