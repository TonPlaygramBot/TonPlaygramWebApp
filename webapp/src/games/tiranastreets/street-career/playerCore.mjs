export const MOTOR = Object.freeze({
  walk: 2.1,
  run: 4.2,
  sprint: 7.2,
  crouch: 1.6,
  accel: 18,
  brake: 24,
  gravity: 21,
  jumpSpeed: 6.2,
  standing: 1.78,
  crouched: 1.08,
  eye: 1.62,
  crouchEye: 0.94,
  radius: 0.34,
  step: 0.28,
  coyote: 0.09,
  buffer: 0.12,
  fallSafe: 8,
  fallDamage: 5,
  sprintDrain: 18,
  recovery: 22,
  kickCost: 20
});
const approach = (a, b, d) => (a < b ? Math.min(b, a + d) : Math.max(b, a - d));
export function createBody(yaw = 0) {
  return {
    y: 0.08,
    vy: 0,
    vx: 0,
    vz: 0,
    yaw,
    pitch: 0,
    height: MOTOR.standing,
    eye: MOTOR.eye,
    grounded: true,
    groundAt: 0,
    jumpUntil: -1,
    landUntil: 0,
    crouched: false,
    crouchWanted: false,
    stamina: 100,
    gait: 0,
    locomotion: 'idle',
    combat: 'unarmed',
    interaction: 'free',
    action: null,
    combo: 0,
    aim: false,
    guard: false,
    sprint: false,
    recoil: 0,
    wall: 1,
    notice: '',
    focus: null,
    seen: {},
    tutorial: [],
    lastHealth: 100
  };
}
export function cancelActions(p, b) {
  b.action = null;
  b.aim = false;
  b.guard = false;
  b.sprint = false;
  b.jumpUntil = -1;
  b.vx = 0;
  b.vz = 0;
  p.reloadAt = 0;
  p.speed = 0;
  b.combat = p.weapon ? 'ready' : 'unarmed';
  b.interaction = p.health <= 0 ? 'dead' : p.carId ? 'driving' : 'free';
}
export function stepMotor(state, p, b, intent, dt, world, emit, damage) {
  b.yaw = intent.yaw;
  b.pitch = intent.pitch;
  p.heading = b.yaw;
  if (b.interaction !== 'free') {
    b.vx = b.vz = 0;
    return;
  }
  const now = state.elapsed;
  if (b.crouchWanted !== b.crouched) {
    if (b.crouchWanted) {
      b.crouched = true;
      emit('crouch');
    } else if (world.clearance({ ...p, y: b.y }, MOTOR.standing)) {
      b.crouched = false;
      b.notice = '';
    } else b.notice = 'Not enough room to stand.';
  }
  b.height = b.crouched ? MOTOR.crouched : MOTOR.standing;
  b.eye = Math.min(
    b.height - 0.1,
    approach(b.eye, b.crouched ? MOTOR.crouchEye : MOTOR.eye, dt * 4)
  );
  const l = Math.max(1, Math.hypot(intent.x, intent.y)),
    m = Math.min(1, Math.hypot(intent.x, intent.y));
  const sprint =
    (intent.fast || b.sprint) &&
    m > 0.2 &&
    !b.crouched &&
    !b.aim &&
    !b.guard &&
    b.stamina > 1;
  const speed = b.crouched ? MOTOR.crouch : sprint ? MOTOR.sprint : MOTOR.run;
  const vx =
      ((Math.cos(b.yaw) * intent.x - Math.sin(b.yaw) * intent.y) * speed) / l,
    vz =
      ((-Math.sin(b.yaw) * intent.x - Math.cos(b.yaw) * intent.y) * speed) / l;
  b.vx = approach(b.vx, vx, (m ? MOTOR.accel : MOTOR.brake) * dt);
  b.vz = approach(b.vz, vz, (m ? MOTOR.accel : MOTOR.brake) * dt);
  const oldX = p.x,
    oldZ = p.z,
    q = { x: p.x, y: b.y, z: p.z };
  world.move(q, b.vx * dt, b.vz * dt, b.height, b.grounded ? MOTOR.step : 0);
  p.x = q.x;
  p.z = q.z;
  b.y = q.y;
  p.speed = Math.hypot(p.x - oldX, p.z - oldZ) / dt;
  b.gait += p.speed * dt * 2.6;
  if (sprint && p.speed > 1) {
    b.stamina = Math.max(0, b.stamina - MOTOR.sprintDrain * dt);
    emit('sprint');
  } else if (b.combat !== 'melee' && !b.guard)
    b.stamina = Math.min(100, b.stamina + MOTOR.recovery * dt);
  if (b.stamina < 1) b.sprint = false;
  const floor = world.surface(p.x, p.z, b.y + 0.015);
  if (b.y <= floor + 0.015 && b.vy <= 0) {
    b.grounded = true;
    b.groundAt = now;
  } else b.grounded = false;
  if (b.jumpUntil >= now && now - b.groundAt <= MOTOR.coyote && !b.crouched) {
    b.vy = MOTOR.jumpSpeed;
    b.grounded = false;
    b.jumpUntil = -1;
    b.groundAt = -100;
    emit('jump');
  }
  if (!b.grounded) {
    const previous = b.y,
      fallSpeed = b.vy;
    b.vy -= MOTOR.gravity * dt;
    b.y += b.vy * dt;
    if (b.vy > 0 && !world.clearance({ ...p, y: b.y }, b.height)) {
      b.y = previous;
      b.vy = 0;
    }
    const landing = world.surface(p.x, p.z, previous + 0.02);
    if (b.y <= landing && b.vy <= 0) {
      b.y = landing;
      b.vy = 0;
      b.grounded = true;
      b.groundAt = now;
      b.landUntil = now + 0.16;
      emit('land');
      if (fallSpeed < -MOTOR.fallSafe)
        damage((-fallSpeed - MOTOR.fallSafe) * MOTOR.fallDamage);
    }
  }
  b.locomotion = !b.grounded
    ? b.vy > 0
      ? 'jump'
      : 'fall'
    : now < b.landUntil
      ? 'land'
      : b.crouched
        ? p.speed > 0.15
          ? 'crouch-walk'
          : 'crouch'
        : p.speed < 0.15
          ? 'idle'
          : sprint
            ? 'sprint'
            : p.speed < 2.3
              ? 'walk'
              : 'run';
  if (p.speed > 0.3) emit('move');
  b.recoil = approach(b.recoil, 0, dt * 2.8);
}
