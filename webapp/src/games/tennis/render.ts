import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SoftwareRenderer } from './software';
import { assets } from './assets';
import { BALL_RADIUS, MatchState, Seat, Surface, side } from './engine';

export const decode = (data: string) =>
  Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
const palettes = {
  hard: { court: 0x237cac, surround: 0x155661, back: 0x092c35 },
  clay: { court: 0xc66643, surround: 0x9d4633, back: 0x302629 },
  grass: { court: 0x5a935d, surround: 0x346348, back: 0x162f29 }
};
type Actor = {
  root: THREE.Group;
  model: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  active: string;
  arm: THREE.Object3D | null;
  armRest: THREE.Quaternion;
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
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Tennis court. Drag to move your player.'
    );
    this.renderer.domElement.style.cssText =
      'display:block;width:100%;height:100%;touch-action:none';
    mount.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x0c2833);
    this.scene.fog = new THREE.Fog(0x0c2833, 42, 95);
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xd9f6ff, 0x5a6b59, 2.1));
    const sun = new THREE.DirectionalLight(0xffe3b1, 3.4);
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
    this.surround = box(23, 0.22, 38, 0x155661, 0, -0.15, 0);
    this.court = box(10.97, 0.03, 23.77, 0x237cac, 0, 0, 0);
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
        color: 0xc1d1ca,
        transparent: true,
        opacity: 0.35
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
    // Batched tiered seats, floodlights and court fencing.
    const chairG = new THREE.BoxGeometry(0.54, 0.25, 0.57),
      chairM = new THREE.MeshStandardMaterial({
        color: 0x34515e,
        roughness: 0.7
      });
    const chairs = new THREE.InstancedMesh(chairG, chairM, 240);
    const obj = new THREE.Object3D();
    let index = 0;
    for (const sign of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 40; col++) {
          obj.position.set(
            sign * (8.7 + row * 0.78),
            0.45 + row * 0.52,
            -14.6 + col * 0.75
          );
          obj.updateMatrix();
          chairs.setMatrixAt(index++, obj.matrix);
        }
    this.root.add(chairs);
    for (const sign of [-1, 1]) {
      for (let row = 0; row < 3; row++)
        box(2.7, 0.35, 31, 0x15353f, sign * 9.5, 0.05 + row * 0.45, 0);
      box(0.15, 1.15, 31, 0x0c343c, sign * 7.6, 0.55, 0);
    }
    for (const x of [-7.7, 7.7])
      for (const z of [-14.5, 14.5]) {
        box(0.16, 8, 0.16, 0x527580, x, 4, z);
        const light = box(2, 0.32, 0.4, 0xeaffee, x, 8, z);
        (light.material as THREE.MeshStandardMaterial).emissive.setHex(
          0xc1e7ff
        );
        (light.material as THREE.MeshStandardMaterial).emissiveIntensity = 2;
      }
    for (const z of [-16, 16]) {
      box(16, 1.4, 0.18, 0x10343e, 0, 0.6, z);
      for (const x of [-5, 0, 5])
        box(3.7, 0.58, 0.02, 0x234b54, x, 0.75, z - side(seat) * 0.11);
    }
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
    const portrait = w / h < 0.8;
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
    const p = palettes[surface];
    (this.court.material as THREE.MeshStandardMaterial).color.setHex(p.court);
    (this.surround.material as THREE.MeshStandardMaterial).color.setHex(
      p.surround
    );
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
    racket.add(head);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.033, 0.33, 8),
      new THREE.MeshStandardMaterial({ color: 0xeeeeeb })
    );
    grip.position.y = -0.43;
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
      mixer: null,
      actions: {},
      active: '',
      arm: null,
      armRest: new THREE.Quaternion(),
      lastX: 0,
      lastZ: 0,
      marker,
      racket
    };
    this.actors[seat] = actor;
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(
        decode(seat === 0 ? assets.player : assets.opponent).buffer,
        ''
      );
      if (this.disposed) return;
      const model = gltf.scene;
      const bounds = new THREE.Box3().setFromObject(model);
      const scale = 1.85 / (bounds.max.y - bounds.min.y);
      model.scale.setScalar(scale);
      model.position.y = -bounds.min.y * scale;
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m instanceof THREE.MeshStandardMaterial) {
              m.roughness = 0.88;
              m.metalness = 0;
            }
          }
        }
      });
      group.add(model);
      actor.model = model;
      const mixer = new THREE.AnimationMixer(model);
      actor.mixer = mixer;
      for (const clip of gltf.animations)
        actor.actions[clip.name] = mixer.clipAction(clip);
      actor.arm = model.getObjectByName('arm-right') || null;
      if (actor.arm) {
        actor.armRest.copy(actor.arm.quaternion);
        actor.arm.add(racket);
        racket.scale.setScalar(1 / scale);
        racket.position.set(0, -0.65 / scale, 0.15 / scale);
        racket.rotation.x = Math.PI / 2;
      } else {
        group.add(racket);
        racket.position.set(0.65, 0.85, 0);
      }
      actor.actions.idle?.play();
      actor.active = 'idle';
    } catch (e) {
      this.loadError = 'Player model could not load. Reload to retry.';
      console.error(e);
    }
  }
  draw(s: MatchState, dt: number, smooth = false) {
    this.clock += dt;
    this.setSurface(s.config.surface);
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
      const swing = s.time - p.swingAt;
      const name =
        s.phase === 'over' && s.winner === i
          ? 'emote-yes'
          : s.phase === 'toss' && s.score.server === i
            ? 'jump'
            : swing < 0.4
              ? 'attack-melee-right'
              : speed > 0.4
                ? 'sprint'
                : 'idle';
      if (name !== a.active && a.actions[name]) {
        a.actions[a.active]?.fadeOut(0.13);
        a.actions[name].reset().fadeIn(0.13).play();
        a.active = name;
      }
      a.mixer?.update(dt);
      if (a.marker.material instanceof THREE.MeshBasicMaterial) {
        a.marker.material.opacity =
          s.phase === 'serve' && s.score.server === i ? 0.9 : 0.55;
        a.marker.material.color.setHex(i === this.seat ? 0xddff47 : 0xff8772);
      }
      if (a.arm && swing >= 0 && swing < 0.5) {
        a.arm.rotation.x += Math.sin((swing / 0.5) * Math.PI) * 1.2;
        a.arm.rotation.z += Math.sin((swing / 0.5) * Math.PI) * 0.8;
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
    this.actors.forEach((a) => a.mixer?.stopAllAction());
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry?.dispose();
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
