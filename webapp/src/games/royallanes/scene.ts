import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PIN_COM, pinSpots } from './shared/physicsCore.mjs';
import { HumanBowler } from './bowlers';
import { BackgroundLanes } from './backgroundLanes';
import type { MatchView, Shot } from './types';
import { BowlingAudio } from './audio';
export class BowlingScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(64, 1, 0.025, 85);
  audio = new BowlingAudio();
  ready = false;
  disposed = false;
  paused = false;
  private ball = new T.Group();
  private pinMeshes = new Map<number, T.Object3D>();
  private aimLine: T.Line;
  private aimTarget = new T.Mesh(
    new T.RingGeometry(0.05, 0.066, 48),
    new T.MeshBasicMaterial({
      color: 0xffe4a8,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide,
      depthWrite: false
    })
  );
  private humanPrototype: T.Object3D | null = null;
  private bowlers = new Map<string, HumanBowler>();
  private view: MatchView | null = null;
  private localId = 'you';
  private clockBase = 0;
  private receivedAt = 0;
  private frame = 0;
  private last = 0;
  private observer: ResizeObserver;
  private aim = 0.055;
  private background: BackgroundLanes | null = null;
  private humanVariants: T.Object3D[] = [];
  private backgroundClock = 0;
  private replayTime = -1;
  private stepIndex = -1;
  private raf = 0;
  private reflection: Reflector | null = null;
  private environmentTarget: T.WebGLRenderTarget | null = null;
  private slowFrames = 0;
  private cameraLook = new T.Vector3(0, 0.1, -16);
  private lastRollSound = -1;

  private temp = new T.Vector3();
  private qa = new T.Quaternion();
  private qb = new T.Quaternion();
  private onLoaded: () => void;
  private onProgress: (n: number) => void;
  private onError: (s: string) => void;
  constructor(
    private container: HTMLElement,
    callbacks: {
      onLoaded: () => void;
      onProgress: (n: number) => void;
      onError: (s: string) => void;
    }
  ) {
    this.onLoaded = callbacks.onLoaded;
    this.onProgress = callbacks.onProgress;
    this.onError = callbacks.onError;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.65));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.setClearColor(0x121713);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color(0x111a14);
    this.scene.fog = new T.FogExp2(0x172319, 0.014);
    const pmrem = new T.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xc7dcdf, 0x4d331e, 0.72));
    for (const z of [-4, -13, -19]) {
      const light = new T.SpotLight(
        0xffebc4,
        z === -19 ? 160 : 110,
        26,
        Math.PI * 0.31,
        0.65,
        1.7
      );
      light.position.set(0, 3.7, z);
      light.target.position.set(0, 0, z - 1.5);
      light.castShadow = z === -19;
      light.shadow.mapSize.set(2048, 2048);
      light.shadow.bias = -0.00015;
      light.shadow.normalBias = 0.008;
      light.shadow.camera.near = 0.15;
      light.shadow.camera.far = 12;
      this.scene.add(light, light.target);
    }
    const fill = new T.PointLight(0xffcf7a, 45, 12, 1.7);
    fill.position.set(1.1, 2, 2);
    this.scene.add(fill);
    this.aimLine = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineDashedMaterial({
        color: 0xffe1a4,
        dashSize: 0.1,
        gapSize: 0.13,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      })
    );
    this.aimLine.renderOrder = 4;
    this.aimTarget.rotation.x = -Math.PI / 2;
    this.scene.add(this.aimLine, this.aimTarget);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.camera.position.set(0, 1.64, 2.05);
    this.camera.lookAt(0, 0.2, -18);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost
    );
    document.addEventListener('visibilitychange', this.visibility);
    this.raf = requestAnimationFrame(this.tick);
  }
  private visibility = () => {
    this.audio.setPaused(document.hidden || this.paused);
    this.last = 0;
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.setPaused(true);
    this.onError(
      'Graphics were interrupted. Tap the lane to reload and reconnect.'
    );
  };
  async load() {
    const manager = new T.LoadingManager();
    manager.onProgress = (_url, n, total) => {
      if (!this.disposed) this.onProgress(Math.round((n / total) * 95));
    };
    const gltf = new GLTFLoader(manager);
    const textures = new T.TextureLoader(manager);
    try {
      const [
        alley,
        pin,
        ball,
        pinLod,
        human,
        wood,
        normal,
        rough,
        male,
        female
      ] = await Promise.all([
        gltf.loadAsync('/assets/royal-lanes/models/royal-alley.glb'),
        gltf.loadAsync('/assets/royal-lanes/models/tournament-pin.glb'),
        gltf.loadAsync('/assets/royal-lanes/models/pearl-ball.glb'),
        gltf.loadAsync('/assets/royal-lanes/models/distant-pin.glb'),
        gltf.loadAsync('/assets/pool-royale/readyplayer.me.glb'),
        textures.loadAsync('/assets/royal-lanes/textures/maple-color.jpg'),
        textures.loadAsync('/assets/royal-lanes/textures/maple-normal.jpg'),
        textures.loadAsync('/assets/royal-lanes/textures/maple-roughness.jpg'),
        gltf
          .loadAsync('/assets/table-tennis/athlete-male.glb')
          .catch(() => null),
        gltf
          .loadAsync('/assets/table-tennis/athlete-female.glb')
          .catch(() => null)
      ]);
      if (this.disposed) {
        for (const g of [alley, pin, ball, pinLod, human, male, female])
          if (g) this.disposeObject(g.scene);
        for (const t of [wood, normal, rough]) t.dispose();
        return;
      }
      wood.colorSpace = T.SRGBColorSpace;
      for (const texture of [wood, normal, rough]) {
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.repeat.set(22, 1.054);
        texture.rotation = Math.PI / 2;
        texture.anisotropy = Math.min(
          8,
          this.renderer.capabilities.getMaxAnisotropy()
        );
      }
      const maple = new T.MeshPhysicalMaterial({
        color: 0xffe2ac,
        map: wood,
        normalMap: normal,
        normalScale: new T.Vector2(0.16, 0.16),
        roughnessMap: rough,
        roughness: 0.45,
        clearcoat: 0.82,
        clearcoatRoughness: 0.19,
        envMapIntensity: 0.5
      });
      alley.scene.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        object.receiveShadow = true;
        if (object.name.startsWith('Lane_surface')) object.material = maple;
        if (object.name.startsWith('Approach')) {
          const m = maple.clone();
          m.map = wood.clone();
          m.map.repeat.set(4, 2.36);
          m.normalMap = null;
          m.roughnessMap = null;
          m.roughness = 0.28;
          object.material = m;
        }
      });
      this.scene.add(alley.scene);
      this.addLaneDetails();
      for (const body of pinSpots()) {
        const mesh = pin.scene.clone(true);
        mesh.traverse((o) => {
          if (o instanceof T.Mesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this.pinMeshes.set(body.id, mesh);
        this.scene.add(mesh);
      }
      pinLod.scene.updateMatrixWorld(true);
      pinLod.scene.traverse((part) => {
        if (!(part instanceof T.Mesh)) return;
        const instances = new T.InstancedMesh(part.geometry, part.material, 20);
        let i = 0;
        const matrix = new T.Matrix4();
        for (const lane of [-2, 2])
          for (const spot of pinSpots()) {
            matrix
              .makeTranslation(spot.x + lane * 2.45, 0, spot.z)
              .multiply(part.matrixWorld);
            instances.setMatrixAt(i++, matrix);
          }
        instances.instanceMatrix.needsUpdate = true;
        this.scene.add(instances);
      });
      this.ball = ball.scene;
      this.ball.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        o.castShadow = true;
        o.receiveShadow = true;
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m instanceof T.MeshPhysicalMaterial && m.name.includes('resin')) {
            m.onBeforeCompile = (shader) => {
              shader.vertexShader = shader.vertexShader
                .replace(
                  '#include <common>',
                  '#include <common>\nvarying vec3 vResinPosition;'
                )
                .replace(
                  '#include <begin_vertex>',
                  '#include <begin_vertex>\nvResinPosition=position;'
                );
              shader.fragmentShader = shader.fragmentShader
                .replace(
                  '#include <common>',
                  '#include <common>\nvarying vec3 vResinPosition;'
                )
                .replace(
                  '#include <color_fragment>',
                  `#include <color_fragment>\nfloat vein = sin(vResinPosition.x*10.0 + sin(vResinPosition.y*8.0 + vResinPosition.z*5.0)*2.0 + sin(vResinPosition.z*16.0)*.4);\nfloat pearl = smoothstep(.70,.99,vein);\ndiffuseColor.rgb = mix(diffuseColor.rgb*0.7,vec3(.66,.31,.36),pearl*.75);`
                );
            };
          }
      });
      this.scene.add(this.ball);
      const reflector = new Reflector(new T.PlaneGeometry(1.05, 21.96), {
        textureWidth: 512,
        textureHeight: 1024,
        color: 0xc0aa89,
        clipBias: 0.003,
        multisample: 0
      });
      reflector.rotation.x = -Math.PI / 2;
      reflector.position.set(0, 0.001, -9);
      const reflectionMaterial = reflector.material as T.ShaderMaterial;
      reflectionMaterial.transparent = true;
      reflectionMaterial.depthWrite = false;
      reflectionMaterial.fragmentShader =
        reflectionMaterial.fragmentShader.replace(
          'vec4( blendOverlay( base.rgb, color ), 1.0 )',
          'vec4( blendOverlay( base.rgb, color ), 0.20 )'
        );
      const reflect = reflector.onBeforeRender.bind(reflector);
      reflector.onBeforeRender = (...args) => {
        if (this.frame % 2 === 0) reflect(...args);
      };
      this.scene.add(reflector);
      this.reflection = reflector;
      this.humanPrototype = human.scene;
      this.humanVariants = [
        human.scene,
        female?.scene || human.scene,
        male?.scene || human.scene
      ];
      this.background = new BackgroundLanes(
        [male?.scene || human.scene, female?.scene || human.scene],
        this.ball,
        pinLod.scene,
        this.audio
      );
      this.scene.add(this.background.group);
      this.ready = true;
      this.onProgress(100);
      this.setAim(this.aim);
      this.onLoaded();
      // HDR is an enhancement: the lane stays playable if it cannot load.
      void new RGBELoader()
        .loadAsync('/assets/royal-lanes/textures/billiard-hall-1k.hdr')
        .then((hdr) => {
          if (this.disposed) {
            hdr.dispose();
            return;
          }
          const pmrem = new T.PMREMGenerator(this.renderer);
          const environment = pmrem.fromEquirectangular(hdr);
          this.environmentTarget?.dispose();
          this.environmentTarget = environment;
          this.scene.environment = environment.texture;
          this.scene.environmentIntensity = 0.48;
          hdr.dispose();
          pmrem.dispose();
        })
        .catch(() => {});
    } catch (error) {
      if (!this.disposed) {
        console.error('Bowling assets could not load', error);
        this.onError(
          'The bowling assets could not load. Tap the lane to retry.'
        );
      }
    }
  }
  private addLaneDetails() {
    const points: T.Vector3[] = [];
    let seed = 17;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let lane = -2; lane <= 2; lane++) {
      const center = lane * 2.45;
      for (let i = 1; i < 39; i++) {
        const x = center - 0.527 + i * (1.054 / 39);
        points.push(new T.Vector3(x, 0.002, 2), new T.Vector3(x, 0.002, -20));
      }
      for (let i = 0; i < 39; i++)
        for (let z = 1 + rand() * 2; z > -20; z -= 1.4 + rand() * 1.7) {
          const x = center - 0.527 + i * (1.054 / 39);
          points.push(
            new T.Vector3(x, 0.002, z),
            new T.Vector3(x + 1.054 / 39, 0.002, z)
          );
        }
      const line = new T.Mesh(
        new T.PlaneGeometry(1.054, 0.019),
        new T.MeshBasicMaterial({ color: 0x2c2922 })
      );
      line.rotation.x = -Math.PI / 2;
      line.position.set(center, 0.004, 0);
      this.scene.add(line);
      for (let i = -3; i <= 3; i++) {
        const shape = new T.Shape();
        shape.moveTo(0, -0.038);
        shape.lineTo(0.018, 0.027);
        shape.lineTo(-0.018, 0.027);
        shape.closePath();
        const arrow = new T.Mesh(
          new T.ShapeGeometry(shape),
          new T.MeshBasicMaterial({ color: 0x44311d })
        );
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(
          center + i * 0.135,
          0.004,
          -4.572 + Math.abs(i) * 0.11
        );
        this.scene.add(arrow);
      }
      const display = this.textDisplay(
        lane === 0
          ? 'ROYAL LANES'
          : `LANE ${String(lane + 3).padStart(2, '0')}`,
        'TEN-PIN BOWLING',
        1024,
        512
      );
      const screen = new T.Mesh(
        new T.PlaneGeometry(1.68, 0.77),
        new T.MeshBasicMaterial({ map: display })
      );
      screen.position.set(center, 2.65, -12.615);
      this.scene.add(screen);
      const number = new T.Mesh(
        new T.PlaneGeometry(0.37, 0.2),
        new T.MeshBasicMaterial({
          map: this.textDisplay(
            String(lane === 0 ? 1 : lane + 4).padStart(2, '0'),
            '',
            256,
            128
          ),
          transparent: true
        })
      );
      number.position.set(center, 1.28, -19.525);
      this.scene.add(number);
    }
    this.scene.add(
      new T.LineSegments(
        new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({
          color: 0x6c4321,
          transparent: true,
          opacity: 0.18
        })
      )
    );
  }
  private textDisplay(title: string, subtitle: string, w: number, h: number) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#12261a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#aa8952';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8ead0';
    ctx.font = `600 ${h * 0.14}px Arial`;
    ctx.fillText(title, w / 2, h * 0.47);
    ctx.fillStyle = '#bfa574';
    ctx.font = `${h * 0.065}px Arial`;
    ctx.fillText(subtitle, w / 2, h * 0.68);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }
  setView(view: MatchView, localId: string) {
    if (this.disposed) return;
    this.view = view;
    this.clockBase = view.serverNow;
    this.receivedAt = performance.now();
    if (this.localId !== localId) {
      for (const b of this.bowlers.values()) {
        this.scene.remove(b.root);
        b.dispose();
      }
      this.bowlers.clear();
    }
    this.localId = localId;
    if (this.humanPrototype && !this.bowlers.size) {
      for (const [index, p] of view.players.entries()) {
        const b = new HumanBowler(
          p.id === localId
            ? this.humanPrototype
            : this.humanVariants[1] || this.humanPrototype,
          index === 0 ? 0xb4d5be : 0xe3bdad,
          p.id === localId
        );
        this.scene.add(b.root);
        this.bowlers.set(p.id, b);
        b.pose({
          active: p.id === view.activeId,
          rolling: false,
          elapsed: 0,
          dt: 10,
          watching: p.id !== view.activeId,
          time: 0
        });
      }
      const own = this.bowlers.get(localId);
      if (own) this.camera.position.copy(own.eye);
    }
    if (!view.roll || !['rolling', 'result', 'finished'].includes(view.phase)) {
      const player = view.players.find((p) => p.id === view.activeId);
      this.resetPins(player?.standing ?? pinSpots().map((p) => p.id));
    }
    this.aimLine.visible = this.aimTarget.visible =
      view.phase === 'aiming' && view.activeId === localId;
  }
  setAim(aim: number) {
    this.aim = aim;
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const z = (-i / 64) * 18.2;
      points.push(new T.Vector3((aim * -z) / 18.288, 0.016, z));
    }
    this.aimLine.geometry.dispose();
    this.aimLine.geometry = new T.BufferGeometry().setFromPoints(points);
    this.aimLine.computeLineDistances();
    this.aimTarget.position.copy(points.at(-1)!);
  }
  setPaused(value: boolean) {
    this.paused = value;
    this.audio.setPaused(value || document.hidden);
    this.last = 0;
  }
  private resetPins(ids: number[]) {
    const spots = pinSpots();
    for (const [id, mesh] of this.pinMeshes) {
      mesh.visible = ids.includes(id);
      const spot = spots[id];
      mesh.position.set(spot.x, 0, spot.z);
      mesh.quaternion.identity();
    }
  }
  private applyBody(
    mesh: T.Object3D,
    a: number[],
    b: number[],
    offset: number,
    blend: number,
    pin = false
  ) {
    mesh.position.set(
      T.MathUtils.lerp(a[offset], b[offset], blend),
      T.MathUtils.lerp(a[offset + 1], b[offset + 1], blend),
      T.MathUtils.lerp(a[offset + 2], b[offset + 2], blend)
    );
    this.qa.set(a[offset + 3], a[offset + 4], a[offset + 5], a[offset + 6]);
    this.qb.set(b[offset + 3], b[offset + 4], b[offset + 5], b[offset + 6]);
    mesh.quaternion.slerpQuaternions(this.qa, this.qb, blend);
    if (pin) {
      this.temp.set(0, -PIN_COM, 0).applyQuaternion(mesh.quaternion);
      mesh.position.add(this.temp);
    }
  }
  private resize() {
    if (this.disposed) return;
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.7 ? 64 : 57;
    this.camera.updateProjectionMatrix();
  }
  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    if (document.hidden || this.paused) {
      this.last = now;
      return;
    }
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    this.frame++;
    const view = this.view;
    const time = this.clockBase + now - this.receivedAt;
    if (this.ready && view) {
      const rolling =
        !!view.roll && ['rolling', 'result', 'finished'].includes(view.phase);
      const approachElapsed = rolling ? (time - view.roll!.startsAt) / 1000 : 0;
      for (const [id, bowler] of this.bowlers)
        bowler.pose({
          active: id === view.activeId,
          rolling: rolling && id === view.roll!.actorId,
          elapsed: Math.max(0, approachElapsed),
          dt,
          watching: id !== view.activeId,
          time,
          releaseSeconds: rolling
            ? (view.roll!.releaseAt - view.roll!.startsAt) / 1000
            : undefined,
          reaction:
            view.lastResult?.actorId === id
              ? view.lastResult.title.startsWith('Strike')
                ? 'strike'
                : view.lastResult.title.startsWith('Spare')
                  ? 'spare'
                  : view.lastResult.gutter
                    ? 'miss'
                    : 'neutral'
              : 'neutral',
          reactionElapsed:
            rolling &&
            view.lastResult?.actorId === id &&
            view.phase !== 'rolling'
              ? (time - view.roll!.endsAt) / 1000
              : -1
        });
      const local = this.bowlers.get(this.localId),
        active = this.bowlers.get(rolling ? view.roll!.actorId : view.activeId);
      if (local) {
        this.camera.position.lerp(local.eye, 1 - Math.exp(-dt * 12));
        this.cameraLook.set(
          this.camera.position.x + this.aim * 0.1,
          this.camera.position.y - 0.1,
          -18.5
        );
        this.camera.lookAt(this.cameraLook);
      }
      this.backgroundClock += dt * 1000;
      this.background?.update(dt, this.backgroundClock, this.camera.position);
      this.ball.visible = !!active;
      if (rolling) {
        const roll = view.roll!,
          replay = roll.replay,
          elapsed = (time - roll.releaseAt) / 1000;
        if (this.lastRollSound !== roll.id) {
          this.lastRollSound = roll.id;
          this.replayTime = -1;
          this.stepIndex = -1;
        }
        if (elapsed < 0 && active) {
          this.ball.position.copy(active.ballSocket);
          this.ball.rotation.set(0.2, -0.2, 0);
          const step = Math.floor(
            (Math.max(0, approachElapsed) /
              ((roll.releaseAt - roll.startsAt) / 1000)) *
              4
          );
          if (step !== this.stepIndex && step < 4) {
            this.audio.step(0, 0.5);
            this.stepIndex = step;
          }
        } else {
          const index = Math.max(
              0,
              Math.min(replay.frames.length - 1, elapsed * replay.hz)
            ),
            i = Math.floor(index),
            a = replay.frames[i],
            b = replay.frames[Math.min(i + 1, replay.frames.length - 1)];
          this.applyBody(this.ball, a, b, 0, index - i);
          for (const [id, mesh] of this.pinMeshes) {
            const idx = replay.ids.indexOf(id);
            mesh.visible = idx >= 0;
            if (idx >= 0)
              this.applyBody(mesh, a, b, (idx + 1) * 7, index - i, true);
          }
          const pan = T.MathUtils.clamp(
            (this.ball.position.x - this.camera.position.x) / 4,
            -1,
            1
          );
          const distance = this.camera.position.distanceTo(this.ball.position);
          if (this.replayTime < 0 && elapsed < 0.2) this.audio.release(pan);
          for (const event of replay.events || []) {
            if (
              event.time > this.replayTime &&
              event.time <= elapsed &&
              elapsed - event.time < 0.15
            )
              this.audio.impact(
                event.strength / (1 + distance * 0.035),
                T.MathUtils.clamp((event.x - this.camera.position.x) / 4, -1, 1)
              );
          }
          const speed = Math.hypot(b[0] - a[0], b[2] - a[2]) * replay.hz;
          this.audio.rolling(
            'main',
            speed,
            distance,
            pan,
            view.phase === 'rolling' && this.ball.position.z > -20.4
          );
          this.replayTime = elapsed;
        }
      } else if (active) {
        this.ball.position.copy(active.ballSocket);
        this.ball.rotation.set(0.2, -0.2, Math.sin(now * 0.0005) * 0.025);
        this.audio.rolling('main', 0, 0, 0, false);
      }
    }
    this.renderer.render(this.scene, this.camera);
    if (dt > 0.039) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.resize();
      this.slowFrames = 0;
    }
  };
  private disposeObject(object: T.Object3D) {
    object.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          for (const v of Object.values(m))
            if (v instanceof T.Texture) v.dispose();
          m.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.contextLost
    );
    document.removeEventListener('visibilitychange', this.visibility);
    this.background?.dispose();
    for (const bowler of this.bowlers.values()) bowler.dispose();
    this.audio.dispose();
    this.reflection?.getRenderTarget().dispose();
    this.environmentTarget?.dispose();
    this.disposeObject(this.scene);
    for (const prototype of new Set(this.humanVariants))
      this.disposeObject(prototype);
    this.aimLine.geometry.dispose();
    (this.aimLine.material as T.Material).dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
