import * as T from 'three';
import { LANA_CHANNEL_WIDTH, lanaChannelDistance } from './lanaCourse.mjs';
import { waterHeight, type Racer, type Track } from './simulation.mjs';
import { waveShader } from './water';

type Plume = {
  x: number;
  z: number;
  heading: number;
  spray: number;
  wake: number;
  landings: number;
  crashes: number;
  riderHeight: number;
};
type Foam = {
  x: number;
  z: number;
  heading: number;
  width: number;
  length: number;
  drift: number;
  life: number;
  duration: number;
  opacity: number;
};

function foamMaterial(amplitude: number) {
  return new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([
      T.UniformsLib.fog,
      {
        time: { value: 0 },
        waveAmplitude: { value: amplitude },
        foamColor: { value: new T.Color(0xd9f6f2) }
      }
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float foamOpacity;
      uniform float time;
      uniform float waveAmplitude;
      varying vec2 foamUv;
      varying vec2 worldXZ;
      varying float opacity;
      ${waveShader}
      #include <fog_pars_vertex>
      void main() {
        vec4 p = modelMatrix * instanceMatrix * vec4(position, 1.0);
        p.y += raceWaveHeight(p.xz, time, waveAmplitude);
        vec4 mvPosition = viewMatrix * p;
        gl_Position = projectionMatrix * mvPosition;
        foamUv = uv * 2.0 - 1.0;
        worldXZ = p.xz;
        opacity = foamOpacity;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 foamColor;
      varying vec2 foamUv;
      varying vec2 worldXZ;
      varying float opacity;
      #include <fog_pars_fragment>
      void main() {
        float edge = 1.0 - smoothstep(.12, 1.0, dot(foamUv, foamUv));
        float breakup = sin(worldXZ.x * 24.3 + worldXZ.y * 17.5)
          * sin(worldXZ.y * 31.8 - worldXZ.x * 15.2);
        float threads = sin(foamUv.x * 17.0 + foamUv.y * 3.2);
        float alpha = edge * opacity * (.64 + breakup * .24 + threads * .12);
        if (alpha < .015) discard;
        gl_FragColor = vec4(foamColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `
  });
}

function sprayMaterial() {
  const material = new T.PointsMaterial({
    color: 0xe7fbff,
    size: 0.16,
    transparent: true,
    depthWrite: false
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float dropletSize;
        attribute float dropletOpacity;
        varying float sprayOpacity;`
      )
      .replace(
        'gl_PointSize = size;',
        `gl_PointSize = size * dropletSize;
        sprayOpacity = dropletOpacity;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float sprayOpacity;'
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 local = gl_PointCoord * 2.0 - 1.0;
        float radius = dot(local, local);
        diffuseColor.a *= sprayOpacity * (1.0 - smoothstep(.05, 1.0, radius));
        if (diffuseColor.a < .02) discard;`
      );
  };
  return material;
}

export class WaterEffects {
  private readonly spray: T.Points;
  private readonly wake: T.InstancedMesh<T.BufferGeometry, T.ShaderMaterial>;
  private readonly position: Float32Array;
  private readonly velocity: Float32Array;
  private readonly duration: Float32Array;
  private readonly age: Float32Array;
  private readonly sizes: Float32Array;
  private readonly sprayOpacity: Float32Array;
  private readonly foamOpacity: Float32Array;
  private readonly foam: Foam[];
  private readonly plumes = new Map<string, Plume>();
  private readonly matrix = new T.Object3D();
  private sprayHead = 0;
  private wakeHead = 0;
  private lastTime = 0;

  constructor(
    scene: T.Scene,
    private track: Track,
    private battery: boolean
  ) {
    const drops = battery ? 320 : 900;
    const stamps = battery ? 260 : 560;
    this.position = new Float32Array(drops * 3);
    this.velocity = new Float32Array(drops * 3);
    this.duration = new Float32Array(drops);
    this.age = new Float32Array(drops);
    this.sizes = new Float32Array(drops);
    this.sprayOpacity = new Float32Array(drops);
    this.foamOpacity = new Float32Array(stamps);
    const dropsGeometry = new T.BufferGeometry();
    dropsGeometry.setAttribute(
      'position',
      new T.BufferAttribute(this.position, 3).setUsage(T.DynamicDrawUsage)
    );
    dropsGeometry.setAttribute(
      'dropletSize',
      new T.BufferAttribute(this.sizes, 1).setUsage(T.DynamicDrawUsage)
    );
    dropsGeometry.setAttribute(
      'dropletOpacity',
      new T.BufferAttribute(this.sprayOpacity, 1).setUsage(T.DynamicDrawUsage)
    );
    dropsGeometry.setDrawRange(0, 0);
    this.spray = new T.Points(dropsGeometry, sprayMaterial());
    this.spray.frustumCulled = false;
    this.spray.renderOrder = 3;

    const foamGeometry = new T.PlaneGeometry(1, 1, 2, 2).rotateX(-Math.PI / 2);
    foamGeometry.setAttribute(
      'foamOpacity',
      new T.InstancedBufferAttribute(this.foamOpacity, 1).setUsage(
        T.DynamicDrawUsage
      )
    );
    this.wake = new T.InstancedMesh(
      foamGeometry,
      foamMaterial(track.wave),
      stamps
    );
    this.wake.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.wake.frustumCulled = false;
    this.wake.renderOrder = 2;
    this.wake.count = 0;
    this.foam = Array.from({ length: stamps }, () => ({
      x: 0,
      z: 0,
      heading: 0,
      width: 0,
      length: 0,
      drift: 0,
      life: 0,
      duration: 0,
      opacity: 0
    }));
    scene.add(this.wake, this.spray);
  }

  private droplet(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number
  ) {
    const i = this.sprayHead++ % this.age.length;
    const p = i * 3;
    this.position[p] = x;
    this.position[p + 1] = y;
    this.position[p + 2] = z;
    this.velocity[p] = vx;
    this.velocity[p + 1] = vy;
    this.velocity[p + 2] = vz;
    this.age[i] = 0;
    this.duration[i] = 0.38 + Math.random() * 0.65;
    this.sizes[i] = size;
    this.sprayOpacity[i] = 0.88;
  }

  private stamp(
    x: number,
    z: number,
    heading: number,
    width: number,
    length: number,
    drift: number,
    opacity: number
  ) {
    if (this.track.id === 'lana') {
      const clearance = LANA_CHANNEL_WIDTH / 2 - lanaChannelDistance(x, z);
      opacity *= T.MathUtils.clamp(clearance / Math.max(0.8, width), 0, 1);
      drift *= T.MathUtils.clamp(clearance / 3, 0, 1);
      if (opacity < 0.02) return;
    }
    const foam = this.foam[this.wakeHead++ % this.foam.length];
    foam.x = x;
    foam.z = z;
    foam.heading = heading;
    foam.width = width;
    foam.length = length;
    foam.drift = drift;
    foam.duration = this.battery ? 1.15 : 1.65;
    foam.life = foam.duration;
    foam.opacity = opacity;
  }

  private splash(
    x: number,
    z: number,
    vx: number,
    vz: number,
    time: number,
    strength: number
  ) {
    const y = waterHeight(x, z, time, this.track.wave) + 0.09;
    const count = this.battery ? 13 : 28;
    for (let i = 0; i < count; i++) {
      const heading = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const radial = (1.2 + Math.random() * 4.6) * strength;
      const sin = Math.sin(heading);
      const cos = Math.cos(heading);
      this.droplet(
        x + sin * 0.35,
        y,
        z + cos * 0.35,
        vx * 0.26 + sin * radial,
        (1.7 + Math.random() * 5.6) * strength,
        vz * 0.26 + cos * radial,
        0.55 + Math.random() * 1.65
      );
    }
    this.stamp(
      x,
      z,
      Math.atan2(vx, vz),
      strength * 3.6,
      strength * 4.4,
      0,
      0.85
    );
  }

  private emit(racer: Racer, previous: Plume, time: number, dt: number) {
    const { x, z, heading, speed, steer, boosting } = racer;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const energy = Math.min(1, speed / 32);
    const wash = boosting ? 1.28 : 1;
    const sprayPerSecond =
      (this.battery ? 24 : 65) * (0.36 + energy * 0.64) * wash;
    const wakePerSecond = this.battery ? 12 : 19;
    previous.spray += dt * sprayPerSecond;
    previous.wake += dt * wakePerSecond;

    const drops = Math.floor(previous.spray);
    previous.spray -= drops;
    for (let i = 0; i < drops; i++) {
      const along = (i + 0.5) / drops;
      const bow = Math.random() < 0.29;
      const side = Math.random() < 0.5 + steer * 0.22 ? 1 : -1;
      const across = side * (bow ? 0.58 : 0.23 + Math.random() * 0.28);
      const longitudinal = bow ? 0.95 : -1.55;
      const px =
        T.MathUtils.lerp(previous.x, x, along) +
        sin * longitudinal +
        cos * across;
      const pz =
        T.MathUtils.lerp(previous.z, z, along) +
        cos * longitudinal -
        sin * across;
      const back = speed * (bow ? 0.12 : 0.18 + Math.random() * 0.2) * wash;
      const sideways = side * (1.5 + Math.random() * 4.5) * energy;
      const rise = (1.1 + Math.random() * (bow ? 2.2 : 4.6) * energy) * wash;
      this.droplet(
        px,
        waterHeight(px, pz, time, this.track.wave) + 0.12,
        pz,
        -sin * back + cos * sideways,
        rise,
        -cos * back - sin * sideways,
        0.42 + Math.random() * (bow ? 1 : 1.9)
      );
    }

    const stamps = Math.floor(previous.wake);
    previous.wake -= stamps;
    for (let i = 0; i < stamps; i++) {
      const along = (i + 0.5) / stamps;
      const px = T.MathUtils.lerp(previous.x, x, along) - sin * 1.68;
      const pz = T.MathUtils.lerp(previous.z, z, along) - cos * 1.68;
      const angle =
        previous.heading +
        Math.atan2(
          Math.sin(heading - previous.heading),
          Math.cos(heading - previous.heading)
        ) *
          along;
      this.stamp(
        px,
        pz,
        angle,
        0.6 + energy * 0.8,
        2.3 + energy * 2,
        0,
        (0.32 + energy * 0.38) * wash
      );
      for (const side of [-1, 1]) {
        const across = side * 0.84;
        this.stamp(
          px + cos * across,
          pz - sin * across,
          angle - side * 0.28,
          0.32 + energy * 0.28,
          2.6 + energy * 1.6,
          side * (1.05 + energy * 0.55),
          (0.22 + energy * 0.24) * (1 + steer * side * 0.35)
        );
      }
    }
  }

  update(racers: Racer[], time: number) {
    const dt = T.MathUtils.clamp(time - this.lastTime, 0, 0.12);
    this.lastTime = time;
    this.wake.material.uniforms.time.value = time;
    if (!dt) return;

    for (const racer of racers) {
      let previous = this.plumes.get(racer.id);
      if (!previous) {
        previous = {
          x: racer.x,
          z: racer.z,
          heading: racer.heading,
          spray: 0,
          wake: 0,
          landings: racer.landings,
          crashes: racer.crashes,
          riderHeight: 0
        };
        this.plumes.set(racer.id, previous);
      }
      if (racer.crash && racer.crashes > previous.crashes) {
        this.splash(
          racer.x,
          racer.z,
          racer.crash.vx,
          racer.crash.vz,
          time,
          1.18
        );
      }
      if (racer.crash && previous.riderHeight > 0 && racer.crash.height <= 0) {
        this.splash(
          racer.crash.x,
          racer.crash.z,
          racer.crash.vx,
          racer.crash.vz,
          time,
          0.75
        );
      }
      if (racer.landings > previous.landings) {
        this.splash(racer.x, racer.z, racer.vx, racer.vz, time, 1);
      }
      const distance = Math.hypot(racer.x - previous.x, racer.z - previous.z);
      if (
        !racer.airborne &&
        !racer.finished &&
        racer.speed > 2.8 &&
        distance < 12
      ) {
        this.emit(racer, previous, time, dt);
      } else {
        previous.spray = 0;
        previous.wake = 0;
      }
      previous.x = racer.x;
      previous.z = racer.z;
      previous.heading = racer.heading;
      previous.landings = racer.landings;
      previous.crashes = racer.crashes;
      previous.riderHeight = racer.crash?.height ?? 0;
    }

    const drag = Math.exp(-dt * 1.55);
    const dropCount = Math.min(this.sprayHead, this.age.length);
    this.spray.geometry.setDrawRange(0, dropCount);
    for (let i = 0; i < dropCount; i++) {
      if (this.age[i] >= this.duration[i]) continue;
      const p = i * 3;
      this.age[i] += dt;
      this.velocity[p] *= drag;
      this.velocity[p + 1] -= 9.81 * dt;
      this.velocity[p + 2] *= drag;
      this.position[p] += this.velocity[p] * dt;
      this.position[p + 1] += this.velocity[p + 1] * dt;
      this.position[p + 2] += this.velocity[p + 2] * dt;
      const water = waterHeight(
        this.position[p],
        this.position[p + 2],
        time,
        this.track.wave
      );
      if (this.position[p + 1] < water - 0.04) this.age[i] = this.duration[i];
      this.sprayOpacity[i] =
        0.85 * Math.max(0, 1 - this.age[i] / this.duration[i]) ** 0.65;
    }
    this.spray.geometry.attributes.position.needsUpdate = true;
    this.spray.geometry.attributes.dropletSize.needsUpdate = true;
    this.spray.geometry.attributes.dropletOpacity.needsUpdate = true;

    const stampCount = Math.min(this.wakeHead, this.foam.length);
    this.wake.count = stampCount;
    for (let i = 0; i < stampCount; i++) {
      const foam = this.foam[i];
      if (!foam.life) continue;
      foam.life = Math.max(0, foam.life - dt);
      const age = foam.duration - foam.life;
      const spread = age * foam.drift;
      this.matrix.position.set(
        foam.x + Math.cos(foam.heading) * spread,
        0.075,
        foam.z - Math.sin(foam.heading) * spread
      );
      this.matrix.rotation.y = foam.heading;
      this.matrix.scale.set(
        foam.width + age * 0.7,
        1,
        foam.length + age * 0.43
      );
      this.matrix.updateMatrix();
      this.wake.setMatrixAt(i, this.matrix.matrix);
      this.foamOpacity[i] = foam.opacity * (foam.life / foam.duration) ** 1.35;
    }
    this.wake.instanceMatrix.needsUpdate = true;
    this.wake.geometry.attributes.foamOpacity.needsUpdate = true;
  }
}
