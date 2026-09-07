import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type { ArrowResult } from './shared/rules';

const HDRI: Record<string, string> = {
  'royal-grounds': '/assets/table-tennis/dancing_hall.hdr',
  'alpine-range': '/assets/table-tennis/colorful_studio.hdr',
  'neon-arena': '/assets/table-tennis/neon_photostudio.hdr'
};

function targetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const context = canvas.getContext('2d')!;
  const colors = ['#f4f3e8', '#171d24', '#58a8d9', '#d94246', '#f4c83c'];
  context.fillStyle = '#f4f3e8';
  context.fillRect(0, 0, 2048, 2048);
  for (let ring = 10; ring >= 1; ring -= 1) {
    const pair = Math.ceil(ring / 2) - 1;
    context.beginPath();
    context.arc(1024, 1024, ring * 98, 0, Math.PI * 2);
    context.fillStyle = colors[pair];
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = pair === 0 ? '#28303a' : 'rgba(255,255,255,.5)';
    context.stroke();
  }
  context.beginPath();
  context.arc(1024, 1024, 38, 0, Math.PI * 2);
  context.strokeStyle = '#20252b';
  context.lineWidth = 5;
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function grassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#253f2d';
  context.fillRect(0, 0, 1024, 1024);
  let seed = 137;
  for (let index = 0; index < 22_000; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed & 1023;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed & 1023;
    const shade = 48 + (seed % 45);
    context.fillStyle = `rgb(${Math.round(shade * .55)},${shade},${Math.round(shade * .65)})`;
    context.fillRect(x, y, 1, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 34);
  texture.anisotropy = 8;
  return texture;
}

function makeArrow(color = 0xf4c84a) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(.014, .014, 1.25, 10),
    new THREE.MeshStandardMaterial({ color: 0x33271c, roughness: .45, metalness: .08 })
  );
  shaft.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(.055, .16, 12),
    new THREE.MeshStandardMaterial({ color: 0xaeb7bd, roughness: .28, metalness: .85 })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -.71;
  group.add(shaft, tip);
  const featherMaterial = new THREE.MeshStandardMaterial({ color, roughness: .7, side: THREE.DoubleSide });
  for (const angle of [0, Math.PI / 2]) {
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(.18, .11), featherMaterial);
    feather.rotation.z = angle;
    feather.position.z = .48;
    group.add(feather);
  }
  group.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
  return group;
}

function makeBow() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x9b552e, roughness: .33, metalness: .18 });
  for (const sign of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sign * .32, .48, 0),
      new THREE.Vector3(0, .95, 0)
    );
    const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, .028, 8, false), material);
    limb.scale.y = sign;
    group.add(limb);
  }
  const stringGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -.95, 0), new THREE.Vector3(0, 0, .18), new THREE.Vector3(0, .95, 0)
  ]);
  group.add(new THREE.Line(stringGeometry, new THREE.LineBasicMaterial({ color: 0xf7eee0 })));
  return group;
}

export class ArcheryRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, .1, 180);
  private target = new THREE.Group();
  private crosshair: THREE.Mesh;
  private bow = makeBow();
  private arrows = new THREE.Group();
  private flying: { object: THREE.Group; start: THREE.Vector3; end: THREE.Vector3; began: number } | null = null;
  private resize: ResizeObserver;
  private mixers: THREE.AnimationMixer[] = [];
  private disposed = false;
  private lastFrame = 0;

  constructor(private host: HTMLElement, arena = 'royal-grounds', previewOnly = false) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.setAttribute('aria-label', '3D archery arena');
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(arena === 'neon-arena' ? 0x07101e : 0x91b7cc);
    this.scene.fog = new THREE.FogExp2(arena === 'neon-arena' ? 0x09121d : 0xa6bac0, .012);
    this.camera.position.set(2.2, 2.05, 6.5);
    this.camera.lookAt(0, 2.5, -26);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x263726, 2.1);
    const sun = new THREE.DirectionalLight(0xffefd1, 4.2);
    sun.position.set(-9, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
    sun.shadow.camera.right = sun.shadow.camera.top = 24;
    this.scene.add(hemi, sun);

    const groundMap = grassTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 110),
      new THREE.MeshStandardMaterial({ map: groundMap, color: arena === 'neon-arena' ? 0x24364a : 0xffffff, roughness: .94 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -24;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const laneMaterial = new THREE.MeshStandardMaterial({ color: 0x9b815e, roughness: .9 });
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 58), laneMaterial);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(0, .008, -22);
    lane.receiveShadow = true;
    this.scene.add(lane);
    for (const x of [-3.1, 3.1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 58, 8), new THREE.MeshStandardMaterial({ color: 0xf0d47d }));
      rope.rotation.x = Math.PI / 2;
      rope.position.set(x, .22, -22);
      this.scene.add(rope);
    }

    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(2.22, 2.22, .18, 96),
      [
        new THREE.MeshStandardMaterial({ color: 0x806243, roughness: .8 }),
        new THREE.MeshStandardMaterial({ map: targetTexture(), roughness: .78 }),
        new THREE.MeshStandardMaterial({ color: 0x806243, roughness: .8 })
      ]
    );
    face.rotation.x = Math.PI / 2;
    face.castShadow = face.receiveShadow = true;
    this.target.position.set(0, 2.7, -31);
    this.target.add(face);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, .22), new THREE.MeshStandardMaterial({ color: 0x604229, roughness: .82 }));
    stand.position.y = -2.35;
    stand.castShadow = true;
    this.target.add(stand);
    this.scene.add(this.target, this.arrows);

    this.crosshair = new THREE.Mesh(
      new THREE.TorusGeometry(.12, .018, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: .9 })
    );
    this.crosshair.position.set(0, 2.7, -30.86);
    this.crosshair.renderOrder = 8;
    this.scene.add(this.crosshair);

    this.bow.position.set(1.15, 1.75, 2.4);
    this.bow.rotation.set(0, 0, -.05);
    this.scene.add(this.bow);
    this.buildArena(arena);
    if (previewOnly) this.buildPreviewAthletes();
    else {
      this.loadAthletes();
      new RGBELoader().load(HDRI[arena] || HDRI['royal-grounds'], (texture) => {
        if (this.disposed) return texture.dispose();
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
      });
    }
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
  }

  private buildArena(arena: string) {
    const accent = arena === 'neon-arena' ? 0x2de2e6 : arena === 'alpine-range' ? 0xd6a542 : 0x8c1d2c;
    const bannerMaterial = new THREE.MeshStandardMaterial({ color: accent, emissive: arena === 'neon-arena' ? accent : 0, emissiveIntensity: .32, roughness: .35 });
    for (const x of [-10, -6, 6, 10]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, 6, 12), new THREE.MeshStandardMaterial({ color: 0x343b42, metalness: .7, roughness: .3 }));
      pole.position.set(x, 3, -24);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.5), bannerMaterial);
      banner.position.set(x + .9, 4.2, -24);
      this.scene.add(pole, banner);
    }
    for (let index = 0; index < 32; index += 1) {
      const angle = index * 2.399;
      const radius = 13 + (index % 5) * 3.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .22, 2.3, 8), new THREE.MeshStandardMaterial({ color: 0x5a3d27, roughness: 1 }));
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.3 + index % 3 * .18, 4.4, 9), new THREE.MeshStandardMaterial({ color: 0x254f34, roughness: .95 }));
      trunk.position.set(Math.sin(angle) * radius, 1.15, -19 + Math.cos(angle) * radius);
      crown.position.copy(trunk.position).add(new THREE.Vector3(0, 3.05, 0));
      trunk.castShadow = crown.castShadow = true;
      this.scene.add(trunk, crown);
    }
  }

  private loadAthletes() {
    const loader = new GLTFLoader();
    [
      ['/assets/table-tennis/athlete-male.glb', -1.75, 1.05],
      ['/assets/table-tennis/athlete-female.glb', 3.3, -1.6]
    ].forEach(([url, x, z]) => loader.load(String(url), (gltf) => {
      if (this.disposed) return;
      const model = gltf.scene;
      model.position.set(Number(x), 0, Number(z));
      model.rotation.y = Math.PI;
      model.scale.setScalar(1.05);
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      this.scene.add(model);
      if (gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(model);
        mixer.clipAction(gltf.animations[0]).play();
        this.mixers.push(mixer);
      }
    }));
  }

  private buildPreviewAthletes() {
    for (const [x, z, color] of [[-1.75, 1.05, 0x1e9e91], [3.3, -1.6, 0xd55b67]] as const) {
      const body = new THREE.Group();
      const kit = new THREE.MeshStandardMaterial({ color, roughness: .52 });
      const skin = new THREE.MeshStandardMaterial({ color: 0xc68d68, roughness: .72 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.28, .72, 6, 12), kit);
      torso.position.y = 1.28;
      const head = new THREE.Mesh(new THREE.SphereGeometry(.19, 20, 14), skin);
      head.position.y = 2.02;
      body.add(torso, head);
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .65, 5, 9), kit);
        leg.position.set(side * .13, .55, 0);
        body.add(leg);
      }
      body.position.set(x, 0, z);
      body.traverse((object) => { if (object instanceof THREE.Mesh) object.castShadow = true; });
      this.scene.add(body);
    }
  }

  private fit() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  aim(x: number, y: number, power: number) {
    this.crosshair.position.set(x * 1.85, 2.7 + y * 1.85, -30.86);
    this.bow.rotation.y = -x * .09;
    this.bow.rotation.x = y * .08;
    this.bow.scale.z = 1 + power * .12;
  }

  shoot(result: ArrowResult) {
    const arrow = makeArrow(result.bullseye ? 0xffd54a : 0xed5c58);
    const start = new THREE.Vector3(.95, 1.78, 2.2);
    const end = new THREE.Vector3(result.x, 2.7 + result.y, -30.72);
    arrow.position.copy(start);
    this.scene.add(arrow);
    this.flying = { object: arrow, start, end, began: performance.now() };
  }

  draw(now: number) {
    const delta = Math.min(.05, (this.lastFrame ? now - this.lastFrame : 16) / 1000);
    this.lastFrame = now;
    this.mixers.forEach((mixer) => mixer.update(delta));
    if (this.flying) {
      const t = Math.min(1, (now - this.flying.began) / 780);
      const eased = 1 - Math.pow(1 - t, 2.4);
      this.flying.object.position.lerpVectors(this.flying.start, this.flying.end, eased);
      this.flying.object.position.y += Math.sin(t * Math.PI) * 1.15;
      this.flying.object.rotation.x = t * .035;
      if (t >= 1) {
        this.flying.object.position.copy(this.flying.end);
        this.arrows.add(this.flying.object);
        this.flying = null;
      }
    }
    this.camera.position.x = 2.2 + Math.sin(now * .00028) * .05;
    this.renderer.render(this.scene, this.camera);
  }

  clearArrows() {
    for (const child of [...this.arrows.children]) {
      this.arrows.remove(child);
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (object.material as THREE.Material).dispose();
        }
      });
    }
  }

  dispose() {
    this.disposed = true;
    this.resize.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
