import * as T from 'three';
import type { Racer } from './simulation.mjs';
import {
  launchFood,
  stepFood,
  foodHit,
  randomUnit,
  FOOD_LIFETIME,
  type Food,
  type FoodKind,
  type Point3
} from './foodFlight.mjs';

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  color: T.Color;
  shard: boolean;
  spin: number;
};
type Splat = {
  mesh: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
  age: number;
  life: number;
  lens: boolean;
  x: number;
  y: number;
  size: number;
};
const MAX_PARTICLES = 320;
const colors = {
  yolk: new T.Color('#ffc21f'),
  white: new T.Color('#fff5d6'),
  shell: new T.Color('#efe2cc'),
  tomato: new T.Color('#d9270f'),
  pulp: new T.Color('#f56b21'),
  dust: new T.Color('#a6a192'),
  spark: new T.Color('#ffcb72')
};
const splatMaterial = (kind: FoodKind, seed: number) =>
  new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: {
      age: { value: 0 },
      kind: { value: kind === 'egg' ? 0 : 1 },
      seed: { value: seed },
      opacity: { value: 1 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
    varying vec2 vUv; uniform float age, kind, seed, opacity;
    float blob(vec2 p, vec2 c, vec2 r) { return 1.-smoothstep(.80,1.,length((p-c)/r)); }
    void main(){
      vec2 p=vUv*2.-1.; float growth=mix(.16,1.,smoothstep(0.,.16,age));
      p/=growth; float a=atan(p.y,p.x); float r=length(p);
      float lobes=.50+.075*sin(a*7.+seed)+.052*sin(a*11.-seed);
      float body=1.-smoothstep(lobes-.045,lobes+.015,r);
      float dots=0.;
      for(int i=0;i<9;i++){
        float f=float(i), angle=f*2.399+seed;
        vec2 c=vec2(cos(angle),sin(angle))*(.62+.1*sin(f*4.+seed));
        c.y-=min(.36,age*.11)*(.5+.5*sin(f+seed));
        dots=max(dots,blob(p,c,vec2(.03+.04*fract(f*.37),.055+age*.018)));
      }
      float drips=0.;
      for(int i=0;i<4;i++){
        float f=float(i), x=-.32+f*.21;
        float fall=min(.64,max(0.,age-.18)*(.21+f*.033));
        drips=max(drips,blob(p,vec2(x,-.26-fall*.5),vec2(.028,.12+fall*.5)));
      }
      float mask=max(body,max(dots,drips));
      float yolk=blob(p,vec2(.025,-.02-age*.015),vec2(.255,.225));
      vec3 egg=mix(vec3(.96,.91,.70),vec3(1.,.59,.018),yolk);
      vec3 tomato=mix(vec3(.68,.026,.008),vec3(1.,.17,.025),body*.5+.15*sin(a*9.));
      vec3 color=mix(egg,tomato,kind);
      float shine=blob(p,vec2(-.1,.14),vec2(.14,.045))*.45;
      color+=shine; float alpha=mask*opacity*mix(.70,.88,kind);
      if(alpha<.015) discard;
      gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
/** Bounded projectile/particle pools; animation is separate from authoritative physics. */
export class RaceEffects {
  group = new T.Group();
  foodHitId = 0;
  lastFoodKind: FoodKind = 'egg';
  private food: Food[] = [];
  private particles: Particle[] = [];
  private splats: Splat[] = [];
  private previous = new Map<string, { x: number; z: number }>();
  private transform = new T.Object3D();
  private eggs: T.InstancedMesh;
  private tomatoes: T.InstancedMesh;
  private leaves: T.InstancedMesh;
  private droplets: T.InstancedMesh;
  private shards: T.InstancedMesh;
  constructor(private camera: T.PerspectiveCamera) {
    const mesh = (g: T.BufferGeometry, m: T.Material, count: number) => {
      const instance = new T.InstancedMesh(g, m, count);
      instance.count = 0;
      instance.frustumCulled = false;
      instance.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.group.add(instance);
      return instance;
    };
    this.eggs = mesh(
      new T.SphereGeometry(0.115, 16, 12),
      new T.MeshStandardMaterial({ color: '#f2e5ca', roughness: 0.32 }),
      16
    );
    this.tomatoes = mesh(
      new T.SphereGeometry(0.16, 18, 12),
      new T.MeshStandardMaterial({
        color: '#da210b',
        roughness: 0.2,
        metalness: 0.03
      }),
      16
    );
    this.leaves = mesh(
      new T.ConeGeometry(0.1, 0.085, 5),
      new T.MeshStandardMaterial({ color: '#28742b', roughness: 0.8 }),
      16
    );
    this.droplets = mesh(
      new T.SphereGeometry(1, 8, 6),
      new T.MeshStandardMaterial({ roughness: 0.26, metalness: 0.04 }),
      MAX_PARTICLES
    );
    this.shards = mesh(
      new T.TetrahedronGeometry(1),
      new T.MeshStandardMaterial({ roughness: 0.68, side: T.DoubleSide }),
      MAX_PARTICLES
    );
  }
  launch(origin: Point3, target: Racer, kind: FoodKind, seed: number) {
    if (this.food.length >= 16) return;
    this.food.push(launchFood(origin, target, kind, seed));
  }
  crash(racer: Racer) {
    const strength = racer.impact || 0;
    const nx = racer.impactNx || 0,
      nz = racer.impactNz || 0;
    this.burst(
      { x: racer.x + nx * 0.9, y: 0.22, z: racer.z + nz * 0.9 },
      Math.floor(12 + strength * 22),
      racer.impactId + racer.slot * 93,
      'crash',
      strength
    );
  }
  private burst(
    origin: Point3,
    count: number,
    seed: number,
    kind: FoodKind | 'crash',
    strength = 1
  ) {
    for (let i = 0; i < count; i++) {
      const r = randomUnit(seed + i * 13),
        angle = randomUnit(seed + i * 7 + 4) * Math.PI * 2;
      const speed = kind === 'crash' ? 1 + r * (2 + strength * 3) : 1.2 + r * 3;
      const shell = kind === 'egg' && i % 3 === 0;
      const color =
        kind === 'crash'
          ? i % 5 === 0
            ? colors.spark
            : colors.dust
          : kind === 'egg'
            ? shell
              ? colors.shell
              : i % 2
                ? colors.yolk
                : colors.white
            : i % 3
              ? colors.tomato
              : colors.pulp;
      this.particles.push({
        ...origin,
        vx: Math.cos(angle) * speed,
        vy: 0.8 + randomUnit(seed + i + 9) * 3,
        vz: Math.sin(angle) * speed,
        age: 0,
        life: 0.45 + r * 0.7,
        size:
          kind === 'crash'
            ? 0.018 + r * 0.045
            : shell
              ? 0.04 + r * 0.04
              : 0.025 + r * 0.045,
        color,
        shard: shell || (kind === 'crash' && i % 5 === 0),
        spin: angle
      });
    }
    if (this.particles.length > MAX_PARTICLES)
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }
  private impact(
    p: Food,
    hit: Point3,
    racer: Racer | null,
    visual?: T.Group,
    isMe = false
  ) {
    this.burst(hit, p.kind === 'egg' ? 34 : 30, p.seed, p.kind);
    const material = splatMaterial(p.kind, p.seed);
    const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 5;
    if (visual && racer) {
      visual.updateWorldMatrix(true, false);
      mesh.position.copy(
        visual.worldToLocal(new T.Vector3(hit.x, hit.y, hit.z))
      );
      mesh.position.x = T.MathUtils.clamp(mesh.position.x, -0.8, 0.8);
      mesh.position.z = T.MathUtils.clamp(mesh.position.z, -1.15, 1.15);
      mesh.position.y = 0.68;
      mesh.rotation.x = -Math.PI / 2;
      visual.add(mesh);
    } else {
      mesh.position.set(hit.x, 0.075, hit.z);
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
    }
    mesh.scale.setScalar(p.kind === 'egg' ? 0.65 : 0.8);
    this.splats.push({
      mesh,
      age: 0,
      life: 5,
      lens: false,
      x: 0,
      y: 0,
      size: 1
    });
    if (isMe) {
      this.foodHitId++;
      this.lastFoodKind = p.kind;
      // Visor splashes stay to the side of the racing line and clear automatically.
      const mat = splatMaterial(p.kind, p.seed);
      mat.depthTest = false;
      const lens = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
      lens.renderOrder = 100;
      lens.frustumCulled = false;
      this.camera.add(lens);
      const side = randomUnit(p.seed + 4) > 0.5 ? 1 : -1;
      this.splats.push({
        mesh: lens,
        age: 0,
        life: 2.65,
        lens: true,
        x: side * (0.31 + randomUnit(p.seed) * 0.15),
        y: 0.12 + randomUnit(p.seed + 8) * 0.16,
        size: 0.58
      });
    }
    while (this.splats.length > 16) this.removeSplat(this.splats.shift()!);
    const lenses = this.splats.filter((s) => s.lens);
    if (lenses.length > 2) {
      const old = lenses[0];
      this.splats.splice(this.splats.indexOf(old), 1);
      this.removeSplat(old);
    }
  }
  private removeSplat(s: Splat) {
    s.mesh.removeFromParent();
    s.mesh.geometry.dispose();
    s.mesh.material.dispose();
  }
  update(
    dt: number,
    racers: Racer[],
    visuals: Map<string, T.Group>,
    playerId: string,
    driver: boolean
  ) {
    dt = Math.min(0.1, Math.max(0, dt));
    const survivors: Food[] = [];
    for (const p of this.food) {
      const from = { x: p.x, y: p.y, z: p.z };
      stepFood(p, dt);
      let struck = false;
      if (dt > 0)
        for (const r of racers) {
          if (r.disconnected || r.finished || r.retired) continue;
          const hit = foodHit(from, p, this.previous.get(r.id) || r, r);
          if (!hit) continue;
          this.impact(p, hit, r, visuals.get(r.id), r.id === playerId);
          struck = true;
          break;
        }
      if (!struck && p.y <= 0.07) {
        this.impact(p, { x: p.x, y: 0.075, z: p.z }, null);
        struck = true;
      }
      if (!struck && p.age < FOOD_LIFETIME) survivors.push(p);
    }
    this.food = survivors;
    for (const r of racers) this.previous.set(r.id, { x: r.x, z: r.z });
    let eggs = 0,
      tomatoes = 0;
    const m = this.transform;
    for (const p of this.food) {
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.age * 8, p.seed, p.age * 6);
      m.scale.set(1, p.kind === 'egg' ? 1.35 : 0.9, 1);
      m.updateMatrix();
      if (p.kind === 'egg') this.eggs.setMatrixAt(eggs++, m.matrix);
      else {
        this.tomatoes.setMatrixAt(tomatoes, m.matrix);
        m.translateY(0.14);
        m.scale.setScalar(1);
        m.updateMatrix();
        this.leaves.setMatrixAt(tomatoes++, m.matrix);
      }
    }
    for (const [mesh, count] of [
      [this.eggs, eggs],
      [this.tomatoes, tomatoes],
      [this.leaves, tomatoes]
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
    let drops = 0,
      shards = 0;
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 9.81 * dt;
      if (p.y < 0.08) {
        p.y = 0.08;
        p.vy = Math.abs(p.vy) * 0.18;
        p.vx *= 0.85;
        p.vz *= 0.85;
      }
      const size = p.size * Math.min(1, Math.max(0, (p.life - p.age) * 4));
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(p.age * 9 + p.spin, p.spin, p.age * 7);
      m.scale.set(size, p.shard ? size * 0.3 : size * 1.35, size);
      m.updateMatrix();
      const mesh = p.shard ? this.shards : this.droplets,
        index = p.shard ? shards++ : drops++;
      mesh.setMatrixAt(index, m.matrix);
      mesh.setColorAt(index, p.color);
    }
    for (const [mesh, count] of [
      [this.droplets, drops],
      [this.shards, shards]
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const s of [...this.splats]) {
      s.age += dt;
      if (s.age >= s.life) {
        this.removeSplat(s);
        this.splats.splice(this.splats.indexOf(s), 1);
        continue;
      }
      s.mesh.material.uniforms.age.value = s.age;
      s.mesh.material.uniforms.opacity.value =
        Math.min(1, (s.life - s.age) / (s.lens ? 0.85 : 1)) *
        (s.lens ? 0.72 : 1);
      if (s.lens) {
        s.mesh.visible = driver;
        const height =
            Math.tan(T.MathUtils.degToRad(this.camera.fov / 2)) * 0.62,
          width = height * this.camera.aspect;
        s.mesh.position.set(s.x * width, (s.y - s.age * 0.018) * height, -0.31);
        // Round splashes in portrait: size is based on horizontal view, not height.
        s.mesh.scale.setScalar(width * s.size);
      }
    }
  }
  clear() {
    this.food = [];
    this.particles = [];
    this.previous.clear();
    this.splats.forEach((s) => this.removeSplat(s));
    this.splats = [];
    this.foodHitId = 0;
    [this.eggs, this.tomatoes, this.leaves, this.droplets, this.shards].forEach(
      (m) => (m.count = 0)
    );
  }
  dispose() {
    this.clear();
    this.group.removeFromParent();
    [this.eggs, this.tomatoes, this.leaves, this.droplets, this.shards].forEach(
      (m) => {
        m.geometry.dispose();
        (m.material as T.Material).dispose();
        m.dispose();
      }
    );
  }
}
