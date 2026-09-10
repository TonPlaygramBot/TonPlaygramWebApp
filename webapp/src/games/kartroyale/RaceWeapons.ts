import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPONS } from './suppliedWeaponCatalog.mjs';
import {
  createCombatState,
  projectileStyle,
  MAX_PROJECTILES
} from './raceCombat.mjs';
import type { CombatSnapshot } from './raceCombat.mjs';
import type { Racer, Track } from './simulation.mjs';
import { disposeKartSource } from './SuppliedKartModels';

// Reuse licensed weapon glTFs already shipped with Tirana. The supplied catalog
// and its tuning stay independent of these presentation-only model fallbacks.
const models: Record<string, string> = {
  shotgun: 'shotgun',
  assault: 'q-rifle',
  pistol: 'q-pistol',
  revolver: 'smith',
  sawed: 'q-shotgun',
  silver: 'smith',
  longshot: 'shotgun',
  pump: 'q-shotgun',
  smg: 'q-smg',
  ak47: 'ak47',
  krsv: 'krsv',
  smith: 'smith',
  mosin: 'mosin',
  uzi: 'uzi',
  sig: 'sigsauer',
  awp: 'q-marksman',
  mrtk: 'q-pistol',
  fps: 'shotgun'
};
export class RaceWeapons {
  readonly group = new T.Group();
  private dead = false;
  private bubbles: T.Group[] = [];
  private sources: T.Group[] = [];
  private shields = new Map<string, T.Mesh>();
  private m = new T.Object3D();
  private shots = new T.InstancedMesh(
    new T.SphereGeometry(1, 12, 8),
    new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x554422,
      emissiveIntensity: 0.8
    }),
    MAX_PROJECTILES
  );
  private trails = new T.InstancedMesh(
    new T.CylinderGeometry(0.04, 0.04, 0.7, 6),
    new T.MeshBasicMaterial({ color: 0x30f6ff }),
    MAX_PROJECTILES
  );
  private blasts = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: 0xff9e31,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    }),
    MAX_PROJECTILES
  );
  constructor(track: Track) {
    this.group.name = 'Tirana:weapon-bubbles-projectiles-and-shields';
    for (const mesh of [this.shots, this.trails, this.blasts]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.group.add(mesh);
    }
    const sphere = new T.SphereGeometry(0.68, 18, 12),
      shell = new T.MeshStandardMaterial({
        color: 0x6ee7ff,
        roughness: 0.1,
        metalness: 0.02,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      });
    const ringGeo = new T.TorusGeometry(0.58, 0.045, 6, 24),
      ringMat = new T.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xffaa00,
        emissiveIntensity: 0.8
      });
    const loader = new GLTFLoader(),
      requests = new Map<string, Promise<T.Group>>();
    for (const p of createCombatState(track).pickups) {
      const root = new T.Group();
      root.position.set(p.x, 0.95, p.z);
      root.add(new T.Mesh(sphere, shell));
      const ring = new T.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      root.add(ring);
      root.name = p.special
        ? 'Boost repair pickup'
        : `Weapon pickup: ${WEAPONS[p.id].name}`;
      this.bubbles.push(root);
      this.group.add(root);
      if (p.special) {
        const repair = new T.Mesh(
          new T.OctahedronGeometry(0.32),
          new T.MeshStandardMaterial({
            color: 0x3cff7f,
            emissive: 0x20cc6a,
            emissiveIntensity: 0.75
          })
        );
        root.add(repair);
        continue;
      }
      const id = models[p.weaponId],
        url = `/assets/tirana-streets/living/${id}.glb`;
      if (!requests.has(url))
        requests.set(
          url,
          loader.loadAsync(url).then((g) => {
            if (this.dead) {
              disposeKartSource(g.scene);
              throw Error('Race disposed');
            }
            this.sources.push(g.scene);
            const box = new T.Box3().setFromObject(g.scene),
              size = box.getSize(new T.Vector3()),
              center = box.getCenter(new T.Vector3());
            const wrapper = new T.Group();
            g.scene.position.sub(center);
            wrapper.add(g.scene);
            wrapper.scale.setScalar(
              0.95 / Math.max(size.x, size.y, size.z, 0.1)
            );
            return wrapper;
          })
        );
      void requests
        .get(url)!
        .then((model) => {
          if (!this.dead) root.add(model.clone(true));
        })
        .catch(() => {
          if (this.dead) return;
          // Same bubble remains collectible if an optional model cannot load.
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 64;
          const c = canvas.getContext('2d');
          if (!c) return;
          c.fillStyle = '#101b24';
          c.fillRect(0, 0, 128, 64);
          c.fillStyle = '#ffd166';
          c.font = 'bold 28px system-ui';
          c.textAlign = 'center';
          c.fillText(WEAPONS[p.id].icon, 64, 43);
          const texture = new T.CanvasTexture(canvas);
          texture.colorSpace = T.SRGBColorSpace;
          root.add(
            new T.Mesh(
              new T.PlaneGeometry(0.9, 0.45),
              new T.MeshBasicMaterial({ map: texture, side: T.DoubleSide })
            )
          );
        });
    }
  }
  update(
    state: CombatSnapshot | null,
    racers: Racer[],
    seconds: number,
    viewer: { x: number; z: number },
    battery = false,
    lag = 0
  ) {
    if (this.dead || !state) return;
    state.pickups.forEach((p, i) => {
      const bubble = this.bubbles[i];
      if (!bubble) return;
      bubble.visible =
        p.cooldown <= 0 &&
        Math.hypot(p.x - viewer.x, p.z - viewer.z) < (battery ? 140 : 250);
      if (bubble.visible) {
        bubble.position.y = 0.95 + Math.sin(seconds * 2.4 + i) * 0.08;
        bubble.rotation.y = seconds * 0.8;
      }
    });
    this.shots.count = this.trails.count = Math.min(
      state.shots.length,
      MAX_PROJECTILES
    );
    state.shots.slice(0, MAX_PROJECTILES).forEach((s, i) => {
      const style = projectileStyle(s.weaponId),
        m = this.m;
      m.position.set(s.x + s.vx * lag, s.y + s.vy * lag, s.z + s.vz * lag);
      m.rotation.set(0, 0, 0);
      m.scale.setScalar(style.size * (1 + Math.sin(seconds * 12) * 0.08));
      m.updateMatrix();
      this.shots.setMatrixAt(i, m.matrix);
      this.shots.setColorAt(i, new T.Color(style.color));
      const direction = new T.Vector3(s.vx, s.vy, s.vz).normalize();
      m.position.addScaledVector(direction, -0.4);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
      m.scale.set(1, 1, 1);
      m.updateMatrix();
      this.trails.setMatrixAt(i, m.matrix);
    });
    this.shots.instanceMatrix.needsUpdate =
      this.trails.instanceMatrix.needsUpdate = true;
    if (this.shots.instanceColor) this.shots.instanceColor.needsUpdate = true;
    this.blasts.count = Math.min(state.explosions.length, MAX_PROJECTILES);
    state.explosions.slice(0, MAX_PROJECTILES).forEach((e, i) => {
      this.m.position.set(e.x, e.y, e.z);
      this.m.rotation.set(0, seconds * 3, 0);
      this.m.scale.setScalar(0.5 + (1 - e.life / 0.7) * 2);
      this.m.updateMatrix();
      this.blasts.setMatrixAt(i, this.m.matrix);
    });
    this.blasts.instanceMatrix.needsUpdate = true;
    for (const r of racers) {
      let shield = this.shields.get(r.id);
      if (!shield) {
        shield = new T.Mesh(
          new T.SphereGeometry(1, 18, 12),
          new T.MeshStandardMaterial({
            color: 0x6ee7ff,
            emissive: 0x0edcff,
            emissiveIntensity: 0.7,
            transparent: true,
            opacity: 0.17,
            depthWrite: false
          })
        );
        this.shields.set(r.id, shield);
        this.group.add(shield);
      }
      shield.visible =
        r.shieldActive &&
        r.shield > 0 &&
        !r.retired &&
        !r.disconnected &&
        !(r.respawn > 0);
      shield.position.set(r.x, 0.68, r.z);
      shield.scale.set(1.35, 1.08, 1.65);
      shield.rotation.y = r.yaw;
    }
  }
  clear() {
    this.shots.count = this.trails.count = this.blasts.count = 0;
    this.shields.forEach((s) => (s.visible = false));
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    for (const mesh of [this.shots, this.trails, this.blasts]) mesh.dispose();
    const resources = new T.Group();
    resources.add(this.group, ...this.sources);
    disposeKartSource(resources);
    this.group.removeFromParent();
  }
}
