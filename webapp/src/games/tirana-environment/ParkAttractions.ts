import * as T from 'three';
import { disposeTree } from '../tirana-expansion/BaseWorldEnhancements';
import { RiniaFountain } from '../tirana-city-source/RiniaFountain';

/** Mapped Taivani fountain plus retained artistic park rides. */
export class ParkAttractions {
  readonly group = new T.Group();
  private wheel = new T.Group();
  private carousel = new T.Group();
  private readonly fountain = new RiniaFountain();
  constructor(world: any) {
    this.group.name = 'Tirana:animated-park-attractions';
    this.group.userData = { accuracy: 'Mapped Taivani basin and jets; amusement rides are artistic' };
    this.group.add(this.fountain.group);
    this.makeAmusement(new T.Vector3(205, 0.05, 782));
  }
  private makeAmusement(at: T.Vector3) {
    const red = new T.MeshStandardMaterial({
        color: 0xd74b42,
        roughness: 0.48,
        metalness: 0.28
      }),
      gold = new T.MeshStandardMaterial({
        color: 0xf5bf45,
        roughness: 0.4,
        metalness: 0.32
      }),
      steel = new T.MeshStandardMaterial({
        color: 0x53636b,
        roughness: 0.38,
        metalness: 0.72
      });
    const rim = new T.Mesh(new T.TorusGeometry(7, 0.22, 8, 40), red);
    this.wheel.add(rim);
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        spoke = new T.Mesh(new T.BoxGeometry(0.11, 13.6, 0.11), steel);
      spoke.rotation.z = a;
      this.wheel.add(spoke);
      const cabin = new T.Mesh(
        new T.BoxGeometry(1.1, 1.15, 0.9),
        i % 2 ? gold : red
      );
      cabin.position.set(Math.cos(a) * 7, Math.sin(a) * 7, 0);
      this.wheel.add(cabin);
    }
    this.wheel.position.copy(at).add(new T.Vector3(0, 8, 0));
    this.wheel.name = 'Grand Park observation wheel';
    this.group.add(this.wheel);
    for (const x of [-4, 4]) {
      const leg = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, 8, 8), steel);
      leg.position.copy(at).add(new T.Vector3(x / 2, 4, 0));
      leg.rotation.z = x > 0 ? 0.45 : -0.45;
      this.group.add(leg);
    }
    const canopy = new T.Mesh(new T.ConeGeometry(5, 2.5, 18), red);
    canopy.position.y = 3.8;
    this.carousel.add(canopy);
    const deck = new T.Mesh(new T.CylinderGeometry(4.5, 4.5, 0.45, 24), gold);
    deck.position.y = 0.25;
    this.carousel.add(deck);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        pole = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 3, 6), steel);
      pole.position.set(Math.cos(a) * 3, 1.8, Math.sin(a) * 3);
      this.carousel.add(pole);
    }
    this.carousel.position.copy(at).add(new T.Vector3(16, 0, 5));
    this.carousel.name = 'Grand Park carousel';
    this.group.add(this.carousel);
  }
  update(seconds: number, viewer?: { x: number; z: number }, battery = false) {
    const near =
      !viewer ||
      Math.hypot(
        viewer.x - this.wheel.position.x,
        viewer.z - this.wheel.position.z
      ) < 260;
    this.wheel.visible = this.carousel.visible = near;
    if (near && !battery) {
      this.wheel.rotation.z = seconds * 0.08;
      this.carousel.rotation.y = seconds * 0.18;
    }
    this.fountain.update(seconds, viewer, battery);
  }
  retire() {}
  dispose() {
    this.fountain.dispose();
    disposeTree(this.group);
  }
}
