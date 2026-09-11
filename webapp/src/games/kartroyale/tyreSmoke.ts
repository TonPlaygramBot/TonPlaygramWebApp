import * as T from 'three';
import type { Racer } from './simulation.mjs';
const COUNT = 192;
/** One GPU draw, bounded storage, no meshes or textures allocated per frame. */
export class TyreSmoke {
  private positions = new Float32Array(COUNT * 3);
  private alpha = new Float32Array(COUNT);
  private size = new Float32Array(COUNT);
  private age = new Float32Array(COUNT).fill(10);
  private velocity = new Float32Array(COUNT * 3);
  private cursor = 0;
  private clock = 0;
  private credits = new Map<string, number>();
  private geometry = new T.BufferGeometry();
  private material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { pixelScale: { value: 500 } },
    vertexShader: `attribute float opacity; attribute float size; varying float a;
      uniform float pixelScale;
      void main(){a=opacity;vec4 p=modelViewMatrix*vec4(position,1.);
      gl_PointSize=clamp(size*pixelScale/max(1.,-p.z),1.,90.);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying float a; void main(){vec2 p=gl_PointCoord*2.-1.;
      float d=length(p);float edge=1.-smoothstep(.12,1.,d);
      float wisps=.82+.18*sin(p.x*12.+p.y*7.);
      gl_FragColor=vec4(.63,.65,.67,a*edge*edge*wisps);}`
  });
  readonly mesh: T.Points;
  constructor() {
    this.geometry.setAttribute(
      'position',
      new T.BufferAttribute(this.positions, 3).setUsage(T.DynamicDrawUsage)
    );
    this.geometry.setAttribute(
      'opacity',
      new T.BufferAttribute(this.alpha, 1).setUsage(T.DynamicDrawUsage)
    );
    this.geometry.setAttribute(
      'size',
      new T.BufferAttribute(this.size, 1).setUsage(T.DynamicDrawUsage)
    );
    this.mesh = new T.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }
  update(dt: number, racers: Racer[]) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    const present = new Set(racers.map((r) => r.id));
    for (const id of this.credits.keys())
      if (!present.has(id)) this.credits.delete(id);
    for (const r of racers) {
      const smoking =
        !r.retired &&
        !r.disconnected &&
        !(r.rollTime > 0) &&
        ((r.drifting && Math.abs(r.speed) > 8) ||
          (r.acceleration < -15 && Math.abs(r.speed) > 5) ||
          r.health < 25);
      let credit = smoking ? (this.credits.get(r.id) || 0) + dt * 22 : 0;
      while (credit >= 1) {
        credit--;
        const i = this.cursor++ % COUNT,
          side = i % 2 ? 1 : -1;
        const s = Math.sin(r.yaw),
          c = Math.cos(r.yaw),
          k = i * 3;
        this.positions[k] = r.x + c * side * 0.75 - s * 0.8;
        this.positions[k + 1] = r.health < 25 ? 0.65 : 0.15;
        this.positions[k + 2] = r.z - s * side * 0.75 - c * 0.8;
        this.velocity[k] = -s * r.speed * 0.06 + Math.sin(i * 2.4) * 0.25;
        this.velocity[k + 1] = 0.4 + (i % 5) * 0.06;
        this.velocity[k + 2] = -c * r.speed * 0.06;
        this.age[i] = 0;
      }
      this.credits.set(r.id, credit);
    }
    for (let i = 0; i < COUNT; i++) {
      this.age[i] += dt;
      const age = this.age[i],
        k = i * 3;
      this.alpha[i] =
        age < 1.35 ? Math.min(1, age * 12) * (1 - age / 1.35) * 0.32 : 0;
      this.size[i] = 0.22 + Math.min(age, 1.35) * 0.75;
      if (this.alpha[i] > 0)
        for (let j = 0; j < 3; j++)
          this.positions[k + j] += this.velocity[k + j] * dt;
    }
    for (const key of ['position', 'opacity', 'size'])
      this.geometry.attributes[key].needsUpdate = true;
  }
  clear() {
    this.age.fill(10);
    this.alpha.fill(0);
    this.geometry.attributes.opacity.needsUpdate = true;
    this.credits.clear();
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
