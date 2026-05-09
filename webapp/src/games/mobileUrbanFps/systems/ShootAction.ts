import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import { rifleStats, useMobileFpsStore } from '../store';

export type ShootTarget = {
  id: string;
  object: Object3D;
  applyDamage: (damage: number) => void;
};

export class ShootAction {
  private raycaster = new Raycaster();
  private lastShotAt = 0;
  private reloadStartedAt = 0;
  private fxId = 1;

  update(now: number, targets: ShootTarget[], camera: Object3D) {
    const store = useMobileFpsStore.getState();

    if (store.reloading && now - this.reloadStartedAt >= rifleStats.reloadMs) {
      store.finishReload();
    }

    if (store.input.reloading && !store.reloading) {
      this.startReload(now);
      useMobileFpsStore.getState().setInput({ reloading: false });
    }

    if (!store.input.firing || store.phase !== 'playing' || store.reloading)
      return;
    if (now - this.lastShotAt < rifleStats.fireRateMs) return;
    if (store.ammo <= 0) {
      this.startReload(now);
      return;
    }

    this.lastShotAt = now;
    store.spendRound();
    store.showMuzzleFlash();
    store.addRecoil(rifleStats.recoilKick);

    const origin = new Vector3();
    const direction = new Vector3();
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    direction.x += (Math.random() - 0.5) * rifleStats.spread;
    direction.y += (Math.random() - 0.5) * rifleStats.spread;
    direction.normalize();

    this.raycaster.set(origin, direction);
    this.raycaster.far = rifleStats.falloffEnd;
    const intersections = this.raycaster.intersectObjects(
      targets.map((target) => target.object),
      true
    );
    const end = origin.clone().add(direction.multiplyScalar(32));

    if (intersections[0]) {
      const hit = intersections[0];
      const rootTarget = targets.find((target) => {
        let current: Object3D | null = hit.object;
        while (current) {
          if (current === target.object) return true;
          current = current.parent;
        }
        return false;
      });
      if (rootTarget) {
        const distance = hit.distance;
        const falloffRange = rifleStats.falloffEnd - rifleStats.falloffStart;
        const falloff =
          distance <= rifleStats.falloffStart
            ? 1
            : Math.max(
                0.35,
                1 - (distance - rifleStats.falloffStart) / falloffRange
              );
        rootTarget.applyDamage(Math.round(rifleStats.damage * falloff));
        store.showHitMarker();
      }
      end.copy(hit.point);
      store.addImpact({
        id: this.fxId++,
        position: [hit.point.x, hit.point.y, hit.point.z],
        normal: [
          hit.face?.normal.x ?? 0,
          hit.face?.normal.y ?? 1,
          hit.face?.normal.z ?? 0
        ],
        life: 0.35
      });
    }

    store.addTracer({
      id: this.fxId++,
      from: [origin.x, origin.y - 0.16, origin.z],
      to: [end.x, end.y, end.z],
      life: 0.08
    });
  }

  startReload(now: number) {
    const store = useMobileFpsStore.getState();
    if (
      store.reloading ||
      store.ammo >= rifleStats.magazineSize ||
      store.reserveAmmo <= 0
    )
      return;
    this.reloadStartedAt = now;
    store.beginReload();
  }
}

export const stableStep = 1 / 60;
export const centerAim = new Vector2(0, 0);
