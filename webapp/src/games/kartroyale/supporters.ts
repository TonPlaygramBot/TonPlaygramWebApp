import * as T from 'three';
import type { Track } from './simulation.mjs';
import { occupied } from './tiranaScenery';

type Fan = {
  x: number;
  z: number;
  yaw: number;
  seed: number;
  flag: boolean;
  scale: number;
};
/** Batched human supporters. All feet remain beyond the closed-course barrier. */
export class Supporters {
  group = new T.Group();
  private fans: Fan[] = [];
  private parts = new Map<string, T.InstancedMesh>();
  private transform = new T.Object3D();
  private parent = new T.Object3D();
  private matrix = new T.Matrix4();
  private clock = { value: 0 };
  constructor(track: Track, flagTexture: T.Texture) {
    const stride = Math.max(2, Math.round(11 / (track.length / 360)));
    for (let i = 10; i < 345; i += stride)
      for (const side of [-1, 1]) {
        const p = track.points[i],
          offset = track.width / 2 + 2.3 + (i % 3) * 0.28;
        const x = p.x - Math.cos(p.yaw) * offset * side,
          z = p.z + Math.sin(p.yaw) * offset * side;
        if (occupied(x, z)) continue;
        this.fans.push({
          x,
          z,
          yaw: Math.atan2(p.x - x, p.z - z),
          seed: i + side * 12,
          flag: i % 3 !== 0,
          scale: 0.93 + (i % 5) * 0.035
        });
      }
    const part = (
      name: string,
      g: T.BufferGeometry,
      mat: T.Material,
      mult = 1
    ) => {
      const m = new T.InstancedMesh(g, mat, this.fans.length * mult);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.group.add(m);
      this.parts.set(name, m);
    };
    part(
      'shirt',
      new T.BoxGeometry(0.48, 0.57, 0.28),
      new T.MeshStandardMaterial({ roughness: 1 })
    );
    part(
      'legs',
      new T.CylinderGeometry(0.09, 0.07, 0.76, 6),
      new T.MeshStandardMaterial({ color: '#27323b', roughness: 1 }),
      2
    );
    part(
      'shoes',
      new T.BoxGeometry(0.18, 0.11, 0.29),
      new T.MeshStandardMaterial({ color: '#ece6d7', roughness: 1 }),
      2
    );
    part(
      'head',
      new T.SphereGeometry(0.19, 10, 8),
      new T.MeshStandardMaterial({ roughness: 1 })
    );
    part(
      'hair',
      new T.SphereGeometry(0.194, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.MeshStandardMaterial({ color: '#30251f', roughness: 1 })
    );
    part(
      'arms',
      new T.CylinderGeometry(0.07, 0.065, 0.5, 6),
      new T.MeshStandardMaterial({ roughness: 1 }),
      2
    );
    part(
      'eyes',
      new T.SphereGeometry(0.018, 5, 4),
      new T.MeshBasicMaterial({ color: '#282020' }),
      2
    );
    part(
      'pole',
      new T.CylinderGeometry(0.016, 0.016, 1.8, 5),
      new T.MeshStandardMaterial({ color: '#dcd6bf', metalness: 0.2 })
    );
    const mat = new T.MeshStandardMaterial({
      map: flagTexture,
      side: T.DoubleSide,
      roughness: 1
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.fanTime = this.clock;
      shader.vertexShader = 'uniform float fanTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.z += sin(position.x * 8.0 + fanTime * 4.8) * (position.x + 0.55) * 0.10;'
      );
    };
    part('flag', new T.PlaneGeometry(1.1, 0.78, 8, 2), mat);
  }
  update(time: number, x: number, z: number, performance: boolean) {
    this.clock.value = time;
    const counts = new Map<string, number>();
    const draw = (
      name: string,
      px: number,
      py: number,
      pz: number,
      rz = 0,
      color?: string
    ) => {
      const mesh = this.parts.get(name)!,
        i = counts.get(name) || 0;
      this.transform.position.set(px, py, pz);
      this.transform.rotation.set(0, 0, rz);
      this.transform.updateMatrix();
      this.matrix.multiplyMatrices(this.parent.matrix, this.transform.matrix);
      mesh.setMatrixAt(i, this.matrix);
      if (color) mesh.setColorAt(i, new T.Color(color));
      counts.set(name, i + 1);
    };
    for (const f of this.fans) {
      if (Math.hypot(f.x - x, f.z - z) > (performance ? 85 : 145)) continue;
      const wave = Math.sin(time * 3 + f.seed) * 0.14;
      this.parent.position.set(f.x, 0.06, f.z);
      this.parent.rotation.set(0, f.yaw, 0);
      this.parent.scale.setScalar(f.scale);
      this.parent.updateMatrix();
      const skin = ['#dbac84', '#b97f59', '#e0bb98', '#8f5e42'][
        Math.abs(f.seed) % 4
      ];
      draw(
        'shirt',
        0,
        1.13,
        0,
        0,
        ['#d82832', '#edebe0', '#111f2e'][Math.abs(f.seed) % 3]
      );
      for (const s of [-1, 1]) {
        draw('legs', s * 0.12, 0.45, 0, s * 0.04);
        draw('shoes', s * 0.14, 0.08, 0.06);
        draw('eyes', s * 0.065, 1.66, 0.175);
      }
      draw('head', 0, 1.64, 0, 0, skin);
      draw('hair', 0, 1.69, -0.013);
      draw('arms', -0.38, 1.39, 0, -0.7 - wave, skin);
      draw('arms', 0.39, 1.52, 0, -0.62 + wave, skin);
      if (f.flag) {
        draw('pole', 0.51, 2.42, 0.01, wave * 0.15);
        draw('flag', 1.05, 2.95, 0.025, wave * 0.15);
      }
    }
    for (const [name, mesh] of this.parts) {
      mesh.count = counts.get(name) || 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  get count() {
    return this.fans.length;
  }
}
