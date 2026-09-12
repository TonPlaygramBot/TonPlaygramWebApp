import * as THREE from 'three';
import { SoftwareRenderer } from './software';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadCharacter } from './assetLoader';
import { buildArena } from './arena';
import { CHARACTERS } from './options';
import { MatchState, Seat, side, clamp } from './engine';
import {
  SCENE_SCALE,
  tableCamera,
  tableFingerDirection,
  tableFingerOffset
} from './camera';
import {
  bindHuman,
  humanPose,
  applyHumanPose,
  type HumanSkeleton
} from './animation';

type Actor = {
  root: THREE.Group;
  model: THREE.Object3D | null;
  paddle: THREE.Group;
  id: string;
  rig: HumanSkeleton | null;
  yaw: number;
  lastSide: number;
  lastTime: number;
  lastX: number;
  lastZ: number;
  groundY: number;
  parts: {
    mesh: THREE.Mesh;
    full: THREE.BufferGeometry;
    arms: THREE.BufferGeometry | null;
  }[];
};
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
  envId = '';
  arena = buildArena();

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
    this.stage.add(this.arena.root);
    this.table();
    const bmat = new THREE.MeshStandardMaterial({
      color: '#fff7dc',
      roughness: 0.9,
      emissive: '#7b642b',
      emissiveIntensity: 0.25
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), bmat);
    this.ball.castShadow = true;
    this.ball.renderOrder = 3;
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
        id: '',
        rig: null,
        yaw: 0,
        lastSide: 0,
        lastTime: 0,
        lastX: 0,
        lastZ: 0,
        groundY: 0,
        parts: []
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
    this.envId = arena;
    this.arena.setTheme(arena);
    // Lighting and architecture are local geometry; no panoramic background.
    this.scene.environment = null;
    await Promise.all([
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
          for (const part of a.parts) {
            part.mesh.geometry = part.full;
            part.arms?.dispose();
          }
          a.parts = [];
          if (a.model) {
            a.root.remove(a.model);
            this.disposeObject(a.model);
          }
          const model = clone(template);
          a.model = model;
          const box = new THREE.Box3().setFromObject(model),
            height = box.max.y - box.min.y;
          model.scale.multiplyScalar(SCENE_SCALE.playerHeight / height);
          model.position.y = (-box.min.y * SCENE_SCALE.playerHeight) / height;
          model.updateMatrixWorld(true);
          const option = CHARACTERS.find((c) => c.id === id) || CHARACTERS[1];
          model.traverse((o) => {
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
          a.root.updateWorldMatrix(true, true);
          a.rig = bindHuman(model);
          a.groundY = model.position.y;
          // Reuse the real skinned hands in first person. Crop torso/head triangles,
          // preserving each character's skin, fingers and existing arm deformation.
          model.traverse((o) => {
            const mesh = o as THREE.SkinnedMesh;
            if (!mesh.isMesh) return;
            const full = mesh.geometry,
              indices: number[] = [];
            if (
              mesh.isSkinnedMesh &&
              full.attributes.skinIndex &&
              full.attributes.skinWeight
            ) {
              const skinIndex = full.attributes.skinIndex,
                skinWeight = full.attributes.skinWeight;
              const arm = (vertex: number) => {
                let weight = 0;
                for (let k = 0; k < 4; k++) {
                  const bone =
                    mesh.skeleton.bones[skinIndex.getComponent(vertex, k)];
                  const name =
                    bone?.name.toLowerCase().replace(/[_.\-\s]/g, '') || '';
                  if (
                    /forearm|lowerarm|hand|finger|thumb|index|middle|ring|pinky/.test(
                      name
                    )
                  )
                    weight += skinWeight.getComponent(vertex, k);
                }
                return weight > 0.6;
              };
              const count = full.index?.count ?? full.attributes.position.count;
              for (let i = 0; i < count; i += 3) {
                const tri = [0, 1, 2].map((k) =>
                  full.index ? full.index.getX(i + k) : i + k
                );
                if (tri.every(arm)) indices.push(...tri);
              }
            }
            const arms = indices.length ? full.clone() : null;
            if (arms) {
              arms.setIndex(indices);
              arms.clearGroups();
            }
            a.parts.push({ mesh, full, arms });
          });
        } catch {
          if (!this.dead)
            this.report('Character could not load. Choose another player.');
        }
      })
    ]);
  }
  draw(s: MatchState, seat: Seat, playing: boolean) {
    if (this.dead) return;
    this.seat = seat;
    this.stage.rotation.y = side(seat, s) < 0 ? Math.PI : 0;
    this.stage.updateWorldMatrix(true, false);
    const localPlayer = this.stage.localToWorld(
      new THREE.Vector3(s.players[seat].x, 0, s.players[seat].z)
    );
    tableCamera(
      this.camera,
      this.host.clientWidth || 390,
      this.host.clientHeight || 750,
      { x: localPlayer.x, z: localPlayer.z }
    );
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
      a.root.visible = true;
      for (const part of a.parts) {
        part.mesh.visible = n !== seat || Boolean(part.arms);
        part.mesh.geometry = n === seat && part.arms ? part.arms : part.full;
      }
      const p = s.players[n],
        sign = side(n as Seat, s),
        dt = clamp(s.time - a.lastTime, 0, 0.1);
      const speed = dt > 0 ? Math.hypot(p.x - a.lastX, p.z - a.lastZ) / dt : 0;
      const baseYaw = sign > 0 ? Math.PI : 0;
      if (a.lastSide !== sign || s.time < a.lastTime) {
        a.yaw = baseYaw;
        a.lastSide = sign;
      }
      let target = Math.atan2(s.ball.x - p.x, s.ball.z - p.z);
      let turn =
        THREE.MathUtils.euclideanModulo(
          target - baseYaw + Math.PI,
          Math.PI * 2
        ) - Math.PI;
      target = baseYaw + clamp(turn, -0.65, 0.65);
      turn =
        THREE.MathUtils.euclideanModulo(target - a.yaw + Math.PI, Math.PI * 2) -
        Math.PI;
      a.yaw += turn * (1 - Math.exp(-10 * dt));
      a.root.position.set(p.x, 0, p.z);
      a.root.rotation.y = a.yaw;
      if (a.model) {
        a.model.position.y =
          a.groundY +
          Math.max(0, Math.sin(s.time * 15)) * 0.014 * clamp(speed / 2, 0, 1);
        a.model.rotation.x = 0.025 * clamp(speed / 2, 0, 1);
      }
      if (a.rig)
        applyHumanPose(
          a.rig,
          humanPose(s, n as Seat, a.yaw),
          this.stage,
          a.root,
          a.paddle
        );
      a.lastTime = s.time;
      a.lastX = p.x;
      a.lastZ = p.z;
    });
    this.renderer.render(this.scene, this.camera);
  }
  shotDirection(dx: number, dy: number, s: MatchState) {
    return tableFingerDirection(this.camera, this.stage, s.ball, dx, dy);
  }
  moveOffset(s: MatchState, seat: Seat, dx: number, dy: number) {
    return tableFingerOffset(
      this.camera,
      this.stage,
      { ...s.players[seat], y: 0 },
      dx,
      dy,
      this.host.clientWidth,
      this.host.clientHeight
    );
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
    for (const actor of this.actors)
      for (const part of actor.parts) {
        part.mesh.geometry = part.full;
        part.arms?.dispose();
      }
    this.disposeObject(this.scene);
    this.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
