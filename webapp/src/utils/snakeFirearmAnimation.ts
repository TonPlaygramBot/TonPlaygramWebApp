import * as THREE from 'three';
import {
  createCaptureMuzzleFx, createCaptureTargetReticleFx, createCaliberProjectileFx,
  createCaliberShellCasingFx, createBulletAerodynamicRingsFx,
  getLudoFirearmTiming, getLudoFirearmBallistics, sampleLudoFirearmVolley,
  FIREARM_RECOIL_ROTATION_RAD, FIREARM_FINAL_BULLET_SPIN_RATE
} from './ludoFirearmPresentation';

const UP = new THREE.Vector3(0, 1, 0);
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);
const ease = (t: number) => (1 - Math.cos(Math.PI * clamp(t))) / 2;

/** Lightweight fallback used while the selected rack model is loading. */
export function createSnakeFirearmFallback() {
  const root = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#27313d', metalness: 0.7, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.055), bodyMaterial);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 12), bodyMaterial);
  barrel.rotation.z = -Math.PI / 2; barrel.position.x = 0.23;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.04), bodyMaterial);
  grip.position.set(-0.04, -0.075, 0);
  root.add(body, barrel, grip);
  return root;
}

function disposeMeshes(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

export function createSnakeFirearmAnimation({
  scene, weaponId, parkedWeapon, origin, target, victims = [], startedAt,
  reducedMotion = false, onShot, onImpact
}: {
  scene: THREE.Object3D; weaponId: string; parkedWeapon?: THREE.Object3D | null;
  origin: THREE.Vector3; target: THREE.Vector3; victims?: THREE.Object3D[];
  startedAt: number; reducedMotion?: boolean;
  onShot?: (shotIndex: number) => void; onImpact?: () => void;
}) {
  const timing = getLudoFirearmTiming(weaponId);
  const profile = getLudoFirearmBallistics(weaponId);
  const effects = new THREE.Group(); effects.name = 'snake-firearm-effects'; scene.add(effects);
  const weapon = new THREE.Group(); weapon.name = 'snake-held-firearm'; effects.add(weapon);
  const art = parkedWeapon?.clone(true) ?? createSnakeFirearmFallback();
  if (parkedWeapon) {
    parkedWeapon.getWorldScale(art.scale);
    parkedWeapon.getWorldQuaternion(art.quaternion);
  }
  art.position.set(0, 0, 0); art.visible = true; weapon.add(art);
  const box = new THREE.Box3().setFromObject(art);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  art.position.sub(center);
  const forward = size.x >= size.z ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1);
  // Same reversed Gunify muzzle correction used by Ludo's AK47 and KRSV racks.
  let reversedMuzzle = false;
  parkedWeapon?.traverse(object => { if (object.userData.firearmMuzzleReversed) reversedMuzzle = true; });
  if (reversedMuzzle) forward.negate();
  const length = Math.max(size.x, size.z, 0.3);
  const muzzleLocal = forward.clone().multiplyScalar(length * 0.52);
  const recoilAxis = new THREE.Vector3().crossVectors(forward, UP).normalize();
  const ready = origin.clone().add(new THREE.Vector3(0, Math.max(0.1, size.y * 0.7), 0));
  const aim = target.clone().sub(ready).normalize();
  const aimedQuaternion = new THREE.Quaternion().setFromUnitVectors(forward, aim);
  const focus = origin.clone();
  const muzzle = new THREE.Vector3();
  const muzzleFx = createCaptureMuzzleFx();
  const reticle = createCaptureTargetReticleFx(0.09);
  const rings = createBulletAerodynamicRingsFx();
  effects.add(muzzleFx.root, reticle.root, rings);
  reticle.root.position.copy(target);
  const bullets = Array.from({ length: timing.shots * timing.pelletsPerShot }, (_, index) => {
    const mesh = createCaliberProjectileFx(profile); effects.add(mesh);
    const pellet = index % timing.pelletsPerShot;
    const end = target.clone();
    if (timing.pelletsPerShot > 1) end.add(new THREE.Vector3(
      Math.cos(pellet * 2.399) * profile.tracerSpread * 0.72,
      Math.sin(pellet * 2.399) * profile.tracerSpread * 0.36,
      Math.sin(pellet * 1.719) * profile.tracerSpread * 0.72
    ));
    return { mesh, shot: Math.floor(index / timing.pelletsPerShot), from: null as THREE.Vector3 | null, end };
  });
  const shells = Array.from({ length: timing.shots }, () => {
    const mesh = createCaliberShellCasingFx(profile); effects.add(mesh);
    return { mesh, from: null as THREE.Vector3 | null };
  });
  const fragmentMaterial = new THREE.MeshStandardMaterial({ color: '#d5c8a0', roughness: 0.5 });
  const fragments = Array.from({ length: 18 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.014 + (i % 4) * 0.006), fragmentMaterial);
    mesh.visible = false; effects.add(mesh);
    return mesh;
  });
  const victimVisibility = victims.map(v => v.visible);
  let lastShot = -1, impactAt: number | null = null, disposed = false;
  // Retain Ludo's slower final round while letting it arrive within the volley tail.
  const finalFlightMs = 740;
  const normalFlightMs = Math.min(360, Math.max(120, timing.cadenceMs * 0.82 / (profile.bulletSpeed * 0.46)));
  const finalImpactMs = timing.preFireLeadMs + (timing.shots - 1) * timing.cadenceMs + finalFlightMs;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    victims.forEach((v, i) => { v.visible = victimVisibility[i]; });
    // Cloned rack meshes share resources with the live model; only dispose owned effects.
    weapon.remove(art);
    if (!parkedWeapon) disposeMeshes(art);
    effects.removeFromParent(); disposeMeshes(effects);
  };
  return {
    duration: timing.durationMs,
    focus,
    overview: () => [origin, ready, target],
    dispose,
    update(now: number) {
      if (disposed) return true;
      const elapsed = Math.max(0, now - startedAt);
      const state = sampleLudoFirearmVolley(elapsed, timing);
      const draw = ease(elapsed / timing.pickupLeadMs);
      const shoulder = ease((elapsed - timing.pickupLeadMs * 0.52) / (timing.preFireLeadMs - timing.pickupLeadMs * 0.52));
      const recoil = reducedMotion ? 0 : state.recoil;
      weapon.position.copy(origin).lerp(ready, reducedMotion ? 1 : draw).addScaledVector(aim, -0.018 * recoil);
      weapon.quaternion.identity().slerp(aimedQuaternion, reducedMotion ? 1 : shoulder);
      weapon.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(recoilAxis, FIREARM_RECOIL_ROTATION_RAD * recoil));
      muzzle.copy(muzzleLocal); weapon.localToWorld(muzzle);
      focus.copy(elapsed < timing.preFireLeadMs ? weapon.position : target);
      const firedIndex = elapsed < timing.preFireLeadMs ? -1 : Math.min(timing.shots - 1, state.shotIndex);
      if (firedIndex > lastShot) { lastShot = firedIndex; onShot?.(firedIndex); }
      muzzleFx.root.position.copy(muzzle);
      muzzleFx.root.visible = !reducedMotion && state.firing && state.recoil > 0.25;
      muzzleFx.flash.scale.setScalar(0.76 + recoil * 1.08);
      muzzleFx.flash.material.opacity = clamp(0.18 + recoil * 0.92);
      muzzleFx.smoke.scale.setScalar(0.72 + recoil * 0.56);
      reticle.root.visible = elapsed >= timing.pickupLeadMs + timing.reloadLeadMs && elapsed < finalImpactMs;
      reticle.ring.scale.setScalar(reducedMotion ? 1 : 0.86 + Math.sin(elapsed * 0.012) * 0.16);
      rings.visible = false;
      bullets.forEach(({ mesh, shot, end }, index) => {
        const bullet = bullets[index];
        const life = elapsed - timing.preFireLeadMs - shot * timing.cadenceMs;
        if (life < 0) { mesh.visible = false; return; }
        bullet.from ??= muzzle.clone();
        const final = shot === timing.shots - 1;
        const raw = clamp(life / (final ? finalFlightMs : normalFlightMs));
        const progress = final ? ease(raw) : raw;
        mesh.visible = raw < 1;
        mesh.position.lerpVectors(bullet.from, end, progress);
        const dir = end.clone().sub(bullet.from).normalize();
        mesh.quaternion.setFromUnitVectors(UP, dir);
        if (!reducedMotion) mesh.rotateY(life * (final ? FIREARM_FINAL_BULLET_SPIN_RATE : 0.032));
        if (final && raw > 0.08 && raw < 0.998) {
          focus.copy(mesh.position); rings.position.copy(mesh.position);
          rings.quaternion.setFromUnitVectors(UP, dir); rings.visible = !reducedMotion;
        }
      });
      shells.forEach((shell, index) => {
        const life = elapsed - timing.preFireLeadMs - index * timing.cadenceMs;
        if (life < 0) { shell.mesh.visible = false; return; }
        shell.from ??= muzzle.clone();
        shell.mesh.visible = !reducedMotion;
        const age = Math.min(life, 900);
        shell.mesh.position.set(shell.from.x + age * profile.shellDriftX,
          Math.max(origin.y, shell.from.y + 0.018 + Math.sin(age / 760 * Math.PI) * profile.shellArc - age * 0.00012),
          shell.from.z + age * profile.shellDriftZ);
        shell.mesh.rotation.set(age * 0.0204, age * 0.0156, age * 0.0168);
      });
      if (elapsed >= finalImpactMs) {
        if (impactAt === null) { impactAt = finalImpactMs; victims.forEach(v => { v.visible = false; }); onImpact?.(); }
        focus.copy(target);
        const age = (elapsed - impactAt) / 1000;
        fragments.forEach((fragment, index) => {
          fragment.visible = !reducedMotion;
          const angle = index * 2.399;
          fragment.position.copy(target).add(new THREE.Vector3(Math.cos(angle) * age * 0.32, Math.max(-0.06, age * 0.45 - age * age * 1.4), Math.sin(angle) * age * 0.32));
          fragment.rotation.set(age * 3, angle + age * 2, age * 4);
        });
      }
      return elapsed >= timing.durationMs;
    }
  };
}
