import * as C from 'cannon-es';
export const PIN_HEIGHT = 0.381;
export const PIN_COM = 0.145;
export const BALL_RADIUS = 0.1085;
export const HEAD_Z = -18.288;
export const FIXED_STEP = 1 / 180;
export function pinSpots() {
  const spots = [];
  let id = 0;
  for (let row = 0; row < 4; row++)
    for (let col = 0; col <= row; col++)
      spots.push({
        id: id++,
        x: (col - row / 2) * 0.3048,
        z: HEAD_Z - row * 0.263965
      });
  return spots;
}
export class BowlingPhysics {
  world = new C.World({ gravity: new C.Vec3(0, -9.81, 0), allowSleep: true });
  pins = [];
  ball;
  active = false;
  gutter = false;
  elapsed = 0;
  firstImpact = false;
  shot = { aim: 0.055, hook: 0, power: 75 };
  onImpact;
  pinMaterial = new C.Material('pin');
  ballMaterial = new C.Material('ball');
  laneMaterial = new C.Material('lane');
  constructor() {
    this.world.solver.iterations = 18;
    this.world.solver.tolerance = 0.00001;
    this.world.broadphase = new C.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.12;
    this.world.addContactMaterial(
      new C.ContactMaterial(this.pinMaterial, this.laneMaterial, {
        friction: 0.23,
        restitution: 0.12
      })
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.pinMaterial, this.pinMaterial, {
        friction: 0.12,
        restitution: 0.62
      })
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMaterial, this.pinMaterial, {
        friction: 0.08,
        restitution: 0.42
      })
    );
    this.world.addContactMaterial(
      new C.ContactMaterial(this.ballMaterial, this.laneMaterial, {
        friction: 0.012,
        restitution: 0.06
      })
    );
    const box = (x, y, z, w, h, d) => {
      const body = new C.Body({
        mass: 0,
        material: this.laneMaterial,
        shape: new C.Box(new C.Vec3(w / 2, h / 2, d / 2)),
        position: new C.Vec3(x, y, z),
        collisionFilterGroup: 1
      });
      this.world.addBody(body);
    };
    box(0, -0.1, -9, 1.054, 0.2, 22);
    for (const side of [-1, 1]) {
      box(side * 0.671, -0.19, -9, 0.288, 0.12, 22);
      box(side * 0.838, 0.02, -9, 0.047, 0.22, 22);
      box(side * 0.8, 0.29, -19.35, 0.12, 0.58, 1.2);
    }
    box(0, -0.4, -21.3, 2.1, 0.2, 2.6);
    box(0, 0.28, -22.55, 2, 1, 0.15);
    this.ball = new C.Body({
      mass: 6.8,
      material: this.ballMaterial,
      shape: new C.Sphere(BALL_RADIUS),
      collisionFilterGroup: 4,
      collisionFilterMask: 3,
      linearDamping: 0.001,
      angularDamping: 0.002,
      allowSleep: false
    });
    this.world.addBody(this.ball);
    this.resetRack();
  }
  resetRack(ids = pinSpots().map((p) => p.id)) {
    for (const pin of this.pins) this.world.removeBody(pin.body);
    this.pins = [];
    for (const spot of pinSpots().filter((p) => ids.includes(p.id))) {
      const body = new C.Body({
        mass: 1.58,
        material: this.pinMaterial,
        position: new C.Vec3(spot.x, PIN_COM + 0.002, spot.z),
        linearDamping: 0.12,
        angularDamping: 0.14,
        sleepSpeedLimit: 0.06,
        sleepTimeLimit: 0.5,
        collisionFilterGroup: 2,
        collisionFilterMask: 7
      });
      const sections = [
        [0.0, 0.04, 0.027, 0.04],
        [0.04, 0.1, 0.04, 0.059],
        [0.1, 0.17, 0.059, 0.052],
        [0.17, 0.23, 0.052, 0.026],
        [0.23, 0.285, 0.026, 0.021],
        [0.285, 0.345, 0.021, 0.031],
        [0.345, 0.375, 0.031, 0.018]
      ];
      for (const [bottom, top, r0, r1] of sections)
        body.addShape(
          new C.Cylinder(r1, r0, top - bottom, 12),
          new C.Vec3(0, (bottom + top) / 2 - PIN_COM, 0)
        );
      this.world.addBody(body);
      this.pins.push({ id: spot.id, body, home: body.position.clone() });
    }
    this.active = false;
    this.gutter = false;
    this.elapsed = 0;
    this.firstImpact = false;
    this.ball.type = C.Body.KINEMATIC;
    this.ball.position.set(0, BALL_RADIUS + 0.002, 0.25);
    this.ball.velocity.setZero();
    this.ball.angularVelocity.setZero();
    this.ball.quaternion.set(0, 0, 0, 1);
    this.ball.collisionFilterMask = 3;
    for (let i = 0; i < 80; i++) this.world.step(FIXED_STEP);
  }
  launch(shot) {
    if (this.active) return false;
    this.shot = {
      ...shot,
      aim: Math.max(-1.25, Math.min(1.25, shot.aim)),
      hook: Math.max(-1, Math.min(1, shot.hook)),
      power: Math.max(35, Math.min(100, shot.power))
    };
    this.active = true;
    this.gutter = false;
    this.elapsed = 0;
    this.firstImpact = false;
    this.ball.type = C.Body.DYNAMIC;
    this.ball.updateMassProperties();
    this.ball.wakeUp();
    this.ball.position.set(0, BALL_RADIUS + 0.002, -0.04);
    const speed = 5.8 + this.shot.power * 0.036;
    this.ball.velocity.set((this.shot.aim / 18.288) * speed, 0, -speed);
    this.ball.angularVelocity.set(
      -speed / BALL_RADIUS,
      0,
      -this.ball.velocity.x / BALL_RADIUS - this.shot.hook * 12
    );
    for (const pin of this.pins) pin.body.wakeUp();
    return true;
  }
  step(dt = FIXED_STEP) {
    if (this.active) {
      this.elapsed += dt;
      if (
        Math.abs(this.ball.position.x) > 0.615 &&
        this.ball.position.z > HEAD_Z + 0.4
      ) {
        this.gutter = true;
        this.ball.collisionFilterMask = 1;
      }
      if (!this.gutter && this.ball.position.z > HEAD_Z + 0.3) {
        // A modest, late hook as the ball reaches the dry back end of the lane.
        const dry = Math.max(0, Math.min(1, (-this.ball.position.z - 10) / 6));
        this.ball.force.x += this.shot.hook * dry * 3.0;
      }
    }
    this.world.step(dt);
    if (
      this.active &&
      !this.firstImpact &&
      this.pins.some((p) => p.body.velocity.lengthSquared() > 0.2)
    ) {
      this.firstImpact = true;
      this.onImpact?.(1);
    }
  }
  standingIds() {
    const up = new C.Vec3();
    return this.pins
      .filter((p) => {
        p.body.quaternion.vmult(C.Vec3.UNIT_Y, up);
        return (
          up.y > 0.78 &&
          p.body.position.y > 0.09 &&
          Math.abs(p.body.position.x) < 0.65 &&
          p.body.position.z > -20.1
        );
      })
      .map((p) => p.id);
  }
  isSettled() {
    return (
      this.active &&
      this.elapsed > 3.2 &&
      ((this.ball.position.z < -20.5 &&
        this.pins.every(
          (p) =>
            p.body.sleepState === C.Body.SLEEPING ||
            p.body.velocity.lengthSquared() +
              p.body.angularVelocity.lengthSquared() <
              0.055
        )) ||
        this.elapsed > 8)
    );
  }
  dispose() {
    for (const b of [...this.world.bodies]) this.world.removeBody(b);
  }
}
