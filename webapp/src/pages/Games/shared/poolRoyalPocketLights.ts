import * as THREE from 'three';

/** Fixed light count avoids recompiling every ball material after each pot. */
export class PoolRoyalPocketLights {
  readonly group = new THREE.Group();
  readonly lights: THREE.PointLight[];
  readonly halos: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[];
  private pulses: { started: number; until: number; color: THREE.Color }[];
  private radius: number;
  private duration: number;
  private worldScale = new THREE.Vector3();

  constructor(parent: THREE.Object3D, options: { radius: number; clothY: number; popupY: number; duration?: number; count?: number }) {
    this.radius = options.radius;
    this.duration = options.duration ?? 2500;
    this.group.name = 'PoolRoyalPocketLights';
    const geometry = new THREE.PlaneGeometry(options.radius * 4.6, options.radius * 4.6);
    this.pulses = Array.from({ length: options.count ?? 6 }, () => ({ started: 0, until: 0, color: new THREE.Color(0xffd67a) }));
    this.halos = this.pulses.map(() => {
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { glowColor: { value: new THREE.Color(0xffd67a) }, strength: { value: 0 } },
        vertexShader: 'varying vec2 glowUv; void main(){glowUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'varying vec2 glowUv; uniform vec3 glowColor; uniform float strength; void main(){float r=length(glowUv-0.5)*2.0;float core=pow(max(0.0,1.0-r),2.0);float ring=exp(-pow((r-0.42)*9.0,2.0))*0.28;gl_FragColor=vec4(glowColor,(core+ring)*strength);}'
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = options.clothY + options.radius * 0.025;
      mesh.visible = false;
      this.group.add(mesh);
      return mesh;
    });
    // Two simultaneous uplights are sufficient for multi-pot effects; each
    // pocket retains its own halo. Lights never cast expensive extra shadows.
    this.lights = Array.from({ length: 2 }, () => {
      const light = new THREE.PointLight(0xffd67a, 0, options.radius * 9, 2);
      light.position.y = options.popupY - options.radius * 1.65;
      light.castShadow = false;
      this.group.add(light);
      return light;
    });
    parent.add(this.group);
  }

  pulse(index: number, position: { x: number; y: number }, now: number, foul = false) {
    const pulse = this.pulses[index];
    if (!pulse || !Number.isFinite(now)) return;
    pulse.started = now; pulse.until = now + this.duration;
    pulse.color.set(foul ? 0xff695c : 0xffd67a);
    const halo = this.halos[index];
    halo.position.x = position.x; halo.position.z = position.y;
    halo.material.uniforms.glowColor.value.copy(pulse.color);
    this.update(now);
  }

  update(now: number) {
    this.group.getWorldScale(this.worldScale);
    const worldRadius = this.radius * Math.max(this.worldScale.x, this.worldScale.y, this.worldScale.z);
    const active: { index: number; strength: number; started: number }[] = [];
    this.pulses.forEach((pulse, index) => {
      const strength = pulse.until > now
        ? Math.min(1, Math.max(0, (now - pulse.started) / 90)) * Math.min(1, (pulse.until - now) / 700) : 0;
      this.halos[index].visible = strength > 0;
      this.halos[index].material.uniforms.strength.value = strength * 0.85;
      if (strength > 0) active.push({ index, strength, started: pulse.started });
    });
    active.sort((a, b) => b.started - a.started);
    this.lights.forEach((light, index) => {
      const entry = active[index];
      light.intensity = entry ? entry.strength * worldRadius * worldRadius * 14 : 0;
      light.distance = worldRadius * 9;
      if (!entry) return;
      const halo = this.halos[entry.index];
      light.position.x = halo.position.x; light.position.z = halo.position.z;
      light.color.copy(this.pulses[entry.index].color);
    });
  }

  clear() {
    this.pulses.forEach(pulse => { pulse.until = 0; });
    this.update(0);
  }

  dispose() {
    this.clear();
    this.group.removeFromParent();
    this.halos[0]?.geometry.dispose();
    this.halos.forEach(halo => halo.material.dispose());
    this.lights.forEach(light => light.dispose());
  }
}
