import * as T from 'three';
import { disposeTree } from '../tirana-expansion/BaseWorldEnhancements';

/** Small, mobile-budget park landmarks in the shared Tirana metre frame.
 * Rinia's anchor comes from the checked-in OSM-derived world. The attraction
 * layout is an artistic gameplay treatment, not a surveyed inventory. */
export class ParkAttractions {
  readonly group = new T.Group();
  private wheel = new T.Group();
  private carousel = new T.Group();
  private water: T.Points;
  private readonly jets: { radius: number; phase: number }[] = [];
  constructor(world: any) {
    this.group.name = 'Tirana:animated-park-attractions';
    this.group.userData = {
      accuracy:
        'Rinia anchor and park polygons are mapped; ride and fountain details are artistic'
    };
    const rinia = world.landmarks?.find((p: any) => p.id === 'rinia');
    const centre = new T.Vector3(rinia?.x ?? -37.14, 0.08, rinia?.z ?? 277.45);
    const stone = new T.MeshStandardMaterial({
      color: 0x9b9589,
      roughness: 0.82,
      metalness: 0.04
    });
    const waterMaterial = new T.PointsMaterial({
      color: 0xbbeeff,
      size: 0.18,
      transparent: true,
      opacity: 0.78,
      depthWrite: false
    });
    const basin = new T.Mesh(new T.CylinderGeometry(5.2, 5.4, 0.55, 40), stone);
    basin.position.copy(centre);
    basin.position.y = 0.28;
    basin.name = 'Parku Rinia fountain basin';
    basin.receiveShadow = true;
    this.group.add(basin);
    const pool = new T.Mesh(
      new T.CircleGeometry(4.75, 40),
      new T.MeshPhysicalMaterial({
        color: 0x4593a7,
        roughness: 0.18,
        metalness: 0.08,
        transparent: true,
        opacity: 0.78
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.copy(centre);
    pool.position.y = 0.58;
    pool.name = 'Parku Rinia fountain water';
    this.group.add(pool);
    const positions = new Float32Array(25 * 3);
    for (let i = 0; i < 25; i++)
      this.jets.push({ radius: i ? 1.3 + (i % 8) * 0.34 : 0, phase: i * 0.57 });
    this.water = new T.Points(
      new T.BufferGeometry().setAttribute(
        'position',
        new T.BufferAttribute(positions, 3)
      ),
      waterMaterial
    );
    this.water.name = 'Parku Rinia animated fountain jets';
    this.group.add(this.water);
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
    const p = this.water.geometry.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < this.jets.length; i++) {
      const j = this.jets[i],
        a = j.phase + seconds * 0.35,
        t = (seconds * 0.62 + j.phase) % 1;
      p.setXYZ(
        i,
        -37.14 + Math.cos(a) * j.radius,
        0.6 + Math.sin(t * Math.PI) * (i ? 2.6 : 4.8),
        277.45 + Math.sin(a) * j.radius
      );
    }
    p.needsUpdate = true;
  }
  retire() {}
  dispose() {
    disposeTree(this.group);
  }
}
