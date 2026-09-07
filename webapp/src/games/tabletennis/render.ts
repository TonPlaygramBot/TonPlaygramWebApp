import * as THREE from 'three';
import { SoftwareRenderer } from './software';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadCharacter, loadEnvironment } from './assetLoader';
import { CHARACTERS, arenaPlacement } from './options';
import { MatchState, Seat, side, clamp } from './engine';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { SCENE_SCALE, tableCamera, tableFingerDirection } from './camera';

type Actor = {
  root: THREE.Group;
  model: THREE.Object3D | null;
  bones: Map<string, THREE.Bone>;
  rest: Map<string, THREE.Quaternion>;
  paddle: THREE.Group;
  id: string;
};
const V = () => new THREE.Vector3();
export class TableTennisRenderer {
  renderer: THREE.WebGLRenderer | SoftwareRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(46, 1, 0.1, 70);
  stage = new THREE.Group();
  actors: Actor[] = [];
  ball: THREE.Mesh;
  shadow: THREE.Mesh;
  target: THREE.Mesh;
  resize: ResizeObserver;
  dead = false;
  seat: Seat = 0;
  environment: THREE.Texture | null = null;
  skybox: GroundedSkybox | null = null;
  envId = '';
  envRequest = 0;
  constructor(
    private host: HTMLElement,
    private report: (m: string) => void
  ) {
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch {
      this.renderer = new SoftwareRenderer();
      this.report('Compatibility graphics active');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D table tennis table, human players and ball'
    );
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#16272d');
    this.scene.add(
      this.stage,
      new THREE.HemisphereLight(0xdbefff, 0x444d34, 0.9)
    );
    const light = new THREE.DirectionalLight(0xfff1df, 1.4);
    light.position.set(2, 6, 3);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4
    });
    light.shadow.bias = -0.001;
    this.scene.add(light);
    const fill = new THREE.DirectionalLight(0x82d5ff, 0.45);
    fill.position.set(-3, 3, -3);
    this.scene.add(fill);
    this.table();
    const bmat = new THREE.MeshStandardMaterial({
      color: '#fff7dc',
      roughness: 0.9,
      emissive: '#7b642b',
      emissiveIntensity: 0.25
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), bmat);
    this.ball.castShadow = true;
    this.stage.add(this.ball);
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 20),
      new THREE.MeshBasicMaterial({
        color: '#071826',
        transparent: true,
        opacity: 0.5,
        depthWrite: false
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.stage.add(this.shadow);
    this.target = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.105, 32),
      new THREE.MeshBasicMaterial({
        color: '#c9ff74',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.target.rotation.x = -Math.PI / 2;
    this.stage.add(this.target);
    for (let i = 0; i < 2; i++) {
      const root = new THREE.Group(),
        paddle = this.paddle();
      this.stage.add(root, paddle);
      this.actors.push({
        root,
        paddle,
        model: null,
        bones: new Map(),
        rest: new Map(),
        id: ''
      });
    }
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(host);
    this.size();
  }
  private size() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    tableCamera(this.camera, w, h);
  }
  private box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
    metal = 0
  ) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: metal ? 0.35 : 0.72,
        metalness: metal
      })
    );
    m.position.set(x, y, z);
    m.renderOrder = y > 0.755 ? -1 : y > 0.72 ? -2 : y > 0.6 ? -4 : -5;
    m.castShadow = m.receiveShadow = true;
    this.stage.add(m);
    return m;
  }
  private table() {
    this.box(5, 0.04, 7, 0, -0.035, 0, '#34434a').renderOrder = -10;
    // Competition dimensions: 2.74 × 1.525 m, 76 cm playing surface.
    this.box(1.525, 0.045, 2.74, 0, 0.7375, 0, '#167ca3');
    this.box(1.59, 0.065, 2.8, 0, 0.693, 0, '#101b24');
    for (const x of [-0.7525, 0.7525])
      this.box(0.02, 0.002, 2.74, x, 0.761, 0, '#f5f5e8');
    for (const z of [-1.36, 1.36])
      this.box(1.525, 0.002, 0.02, 0, 0.761, z, '#f5f5e8');
    this.box(0.003, 0.002, 2.74, 0, 0.761, 0, '#e3eee4');
    for (const z of [-0.93, 0.93]) {
      for (const x of [-0.57, 0.57]) {
        this.box(0.055, 0.67, 0.06, x, 0.335, z, '#a3b1b4', 0.65);
        this.box(0.18, 0.045, 0.13, x, 0.03, z, '#111e27');
      }
      this.box(1.15, 0.055, 0.05, 0, 0.23, z, '#a3b1b4', 0.65);
    }
    for (const x of [-0.915, 0.915])
      this.box(0.025, 0.22, 0.035, x, 0.82, 0, '#e7e4cf', 0.4);
    const pts: number[] = [];
    for (let x = -0.915; x <= 0.915; x += 0.025)
      pts.push(x, 0.76, 0, x, 0.9125, 0);
    for (let y = 0.76; y <= 0.915; y += 0.018)
      pts.push(-0.915, y, 0, 0.915, y, 0);
    const net = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(pts, 3)
      ),
      new THREE.LineBasicMaterial({
        color: '#17242b',
        transparent: true,
        opacity: 0.8
      })
    );
    net.renderOrder = 0;
    this.stage.add(net);
    this.box(1.83, 0.009, 0.012, 0, 0.908, 0, '#fffae7');
    for (const z of [-2.8, 2.8]) {
      this.box(4, 0.48, 0.035, 0, 0.24, z, '#123d46').renderOrder = -8;
      this.box(4, 0.022, 0.05, 0, 0.49, z, '#56c6b1');
    }
    for (const x of [-2, 2])
      this.box(0.035, 0.48, 5.6, x, 0.24, 0, '#123d46').renderOrder = -8;
  }
  private paddle() {
    const g = new THREE.Group();
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.012, 32),
      new THREE.MeshStandardMaterial({ color: '#dc4f42', roughness: 0.9 })
    );
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const black = new THREE.Mesh(
      new THREE.CircleGeometry(0.087, 32),
      new THREE.MeshStandardMaterial({
        color: '#17232b',
        roughness: 0.9,
        side: THREE.DoubleSide
      })
    );
    black.position.z = -0.007;
    g.add(black);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.033, 0.105, 0.023),
      new THREE.MeshStandardMaterial({ color: '#c29b65', roughness: 0.85 })
    );
    grip.position.y = -0.115;
    g.add(grip);
    return g;
  }
  async appearance(arena: string, characters: string[]) {
    const environmentTask = (async () => {
      if (this.envId !== arena) {
        this.envId = arena;
        const request = ++this.envRequest;
        try {
          const t = await loadEnvironment(arena);
          if (this.dead || request !== this.envRequest) {
            t.dispose();
            return;
          }
          t.mapping = THREE.EquirectangularReflectionMapping;
          this.environment?.dispose();
          this.environment = t;
          this.scene.environment = t;
          this.scene.background = t;
          this.scene.backgroundBlurriness = 0;
          this.scene.backgroundIntensity = 0.85;
          if (this.skybox) {
            this.scene.remove(this.skybox);
            this.skybox.geometry.dispose();
            this.skybox.material.dispose();
          }
          if (this.renderer instanceof THREE.WebGLRenderer) {
            const placement = arenaPlacement(arena);
            this.skybox = new GroundedSkybox(
              t,
              placement.height,
              SCENE_SCALE.roomRadius,
              96
            );
            this.skybox.position.y = placement.height;
            this.skybox.rotation.y = placement.rotation;
            this.scene.environmentRotation.y = placement.rotation;
            this.scene.backgroundRotation.y = placement.rotation;
            this.skybox.renderOrder = -100;
            this.scene.add(this.skybox);
          }
        } catch {
          if (!this.dead)
            this.report('Environment unavailable · studio lights active');
        }
      }
    })();
    await Promise.all([
      environmentTask,
      ...characters.map(async (id, n) => {
        const a = this.actors[n];
        if (a.id === id) return;
        a.id = id;
        try {
          const template = await loadCharacter(id);
          if (this.dead || a.id !== id) {
            this.disposeObject(template);
            return;
          }
          if (a.model) {
            a.root.remove(a.model);
            this.disposeObject(a.model);
          }
          const model = clone(template);
          a.model = model;
          a.bones.clear();
          a.rest.clear();
          const box = new THREE.Box3().setFromObject(model),
            height = box.max.y - box.min.y;
          model.scale.multiplyScalar(SCENE_SCALE.playerHeight / height);
          model.position.y = (-box.min.y * SCENE_SCALE.playerHeight) / height;
          model.updateMatrixWorld(true);
          const option = CHARACTERS.find((c) => c.id === id) || CHARACTERS[1];
          model.traverse((o) => {
            if ((o as THREE.Bone).isBone) {
              a.bones.set(o.name, o as THREE.Bone);
              a.rest.set(o.name, o.quaternion.clone());
            }
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = true;
              m.receiveShadow = true;
              m.renderOrder = n === 1 ? -3 : 1;
              const mats = Array.isArray(m.material)
                ? m.material
                : [m.material];
              m.material = mats.map((original) => {
                const mat = (original as THREE.MeshStandardMaterial).clone();
                mat.roughness = 0.82;
                return mat;
              });
              if (
                !Array.isArray((o as THREE.Mesh).material) ||
                m.material.length === 1
              )
                m.material = m.material[0];
              // Vertex regions turn the CC0 base mesh into an opaque sports kit.
              if (
                id !== 'chess-human' &&
                mats.some((mat) => mat.name.includes('Superhero')) &&
                m.geometry.attributes.position
              ) {
                m.geometry = m.geometry.clone();
                if ((m as THREE.SkinnedMesh).isSkinnedMesh)
                  (m as THREE.SkinnedMesh).skeleton.update();
                const pos = m.geometry.attributes.position,
                  col = new Float32Array(pos.count * 3),
                  skin = new THREE.Color(
                    id.includes('gold')
                      ? '#b98059'
                      : id.includes('violet')
                        ? '#a56846'
                        : '#d7a17c'
                  ),
                  kit = new THREE.Color(option.color),
                  shorts = new THREE.Color('#182b3a'),
                  shoes = new THREE.Color('#ececd9');
                for (let i = 0; i < pos.count; i++) {
                  const point = new THREE.Vector3().fromBufferAttribute(pos, i);
                  if ((m as THREE.SkinnedMesh).isSkinnedMesh)
                    (m as THREE.SkinnedMesh).applyBoneTransform(i, point);
                  point.applyMatrix4(m.matrixWorld);
                  const x = point.x,
                    y = point.y;
                  const c =
                    y < 0.1
                      ? shoes
                      : y > 0.69 && y < 1.0
                        ? shorts
                        : y >= 1 && y < 1.48 && Math.abs(x) < 0.41
                          ? kit
                          : skin;
                  c.toArray(col, i * 3);
                }
                m.geometry.setAttribute(
                  'color',
                  new THREE.BufferAttribute(col, 3)
                );
                const material = new THREE.MeshStandardMaterial({
                  vertexColors: true,
                  roughness: 0.78
                });
                m.material = material;
              }
            }
          });
          a.root.add(model);
        } catch {
          if (!this.dead)
            this.report('Character could not load. Choose another player.');
        }
      })
    ]);
  }
  private aim(
    a: Actor,
    names: string[],
    childNames: string[],
    target: THREE.Vector3
  ) {
    const b = names.map((n) => a.bones.get(n)).find(Boolean),
      child = childNames.map((n) => a.bones.get(n)).find(Boolean);
    if (!b || !child || !b.parent) return;
    b.updateWorldMatrix(true, true);
    const origin = b.getWorldPosition(V()),
      from = child.getWorldPosition(V()).sub(origin).normalize(),
      to = target.clone().sub(origin).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(from, to),
      world = b.getWorldQuaternion(new THREE.Quaternion());
    const parent = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    b.quaternion.copy(parent.multiply(delta.multiply(world)));
    b.updateWorldMatrix(false, true);
  }
  private arm(a: Actor, target: THREE.Vector3, pole: THREE.Vector3) {
    const upper = a.bones.get('RightArm') || a.bones.get('upperarm_r'),
      lower = a.bones.get('RightForeArm') || a.bones.get('lowerarm_r'),
      hand = a.bones.get('RightHand') || a.bones.get('hand_r');
    if (!upper || !lower || !hand) return;
    const origin = upper.getWorldPosition(V()),
      elbow = lower.getWorldPosition(V()),
      wrist = hand.getWorldPosition(V()),
      l1 = origin.distanceTo(elbow),
      l2 = elbow.distanceTo(wrist),
      dir = target.clone().sub(origin),
      distance = clamp(dir.length(), 0.05, l1 + l2 - 0.005);
    dir.normalize();
    const cos = clamp(
      (l1 * l1 + distance * distance - l2 * l2) / (2 * l1 * distance),
      -1,
      1
    );
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    elbow
      .copy(origin)
      .addScaledVector(dir, cos * l1)
      .addScaledVector(pole, Math.sqrt(1 - cos * cos) * l1);
    this.aim(
      a,
      ['RightArm', 'upperarm_r'],
      ['RightForeArm', 'lowerarm_r'],
      elbow
    );
    this.aim(
      a,
      ['RightForeArm', 'lowerarm_r'],
      ['RightHand', 'hand_r'],
      target
    );
  }
  draw(s: MatchState, seat: Seat, playing: boolean) {
    if (this.dead) return;
    this.seat = seat;
    this.stage.rotation.y = side(seat, s) < 0 ? Math.PI : 0;
    this.stage.updateWorldMatrix(true, false);
    this.ball.position.set(s.ball.x, s.ball.y, s.ball.z);
    this.shadow.position.set(s.ball.x, 0.766, s.ball.z);
    this.shadow.visible =
      Math.abs(s.ball.x) < 0.76 && Math.abs(s.ball.z) < 1.37;
    this.shadow.scale.setScalar(clamp(1 + (s.ball.y - 0.78), 1, 2));
    this.target.position.set(
      s.inputs[seat].aim * 0.53,
      0.765,
      -side(seat, s) * 1.03
    );
    this.target.visible = false;
    this.actors.forEach((a, n) => {
      const p = s.players[n],
        sign = -side(n as Seat, s);
      a.root.position.set(p.x, 0, p.z);
      a.root.rotation.y = sign < 0 ? Math.PI : 0;
      for (const [name, q] of a.rest) a.bones.get(name)?.quaternion.copy(q);
      a.root.updateWorldMatrix(true, true);
      const swing = Math.max(0, 1 - (s.time - p.swingAt) / 0.28),
        idle = Math.sin(s.time * 3) * 0.012;
      const toWorld = (x: number, y: number, z: number) =>
        this.stage.localToWorld(new THREE.Vector3(x, y, z));
      const contact = swing > 0.25;
      const handX = contact ? p.hitX : p.x + sign * 0.27,
        handY = contact ? p.hitY - 0.08 : 1.08 + idle,
        handZ = contact ? p.hitZ : p.z + sign * 0.37;
      this.arm(
        a,
        toWorld(handX, handY, handZ),
        new THREE.Vector3(sign, -0.4, 0).transformDirection(
          this.stage.matrixWorld
        )
      );
      this.aim(
        a,
        ['LeftArm', 'upperarm_l'],
        ['LeftForeArm', 'lowerarm_l'],
        toWorld(p.x - sign * 0.29, 1.12, p.z + sign * 0.08)
      );
      this.aim(
        a,
        ['LeftForeArm', 'lowerarm_l'],
        ['LeftHand', 'hand_l'],
        s.score.server === n && s.phase === 'serve'
          ? toWorld(s.ball.x, s.ball.y - 0.045, s.ball.z)
          : toWorld(p.x - sign * 0.35, 1.1, p.z)
      );
      const right = a.bones.get('RightHand') || a.bones.get('hand_r');
      if (right) {
        const world = right.getWorldPosition(V());
        a.paddle.position.copy(this.stage.worldToLocal(world));
        a.paddle.position.y += 0.1;
      } else a.paddle.position.set(handX, handY, handZ);
      a.paddle.rotation.set(-0.22, sign * 0.25 + swing * 1.1, 0.15 * sign);
    });
    this.renderer.render(this.scene, this.camera);
  }
  shotDirection(dx: number, dy: number, s: MatchState) {
    return tableFingerDirection(this.camera, this.stage, s.ball, dx, dy);
  }
  private disposeObject(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        for (const v of Object.values(mat))
          if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
  }
  dispose() {
    this.dead = true;
    this.resize.disconnect();
    this.disposeObject(this.scene);
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
