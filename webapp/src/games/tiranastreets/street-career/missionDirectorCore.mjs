/** Solo mission state. Timers advance with simulation time and never create
 * extra actors, pay currency, or alter the shared/online mission protocol. */
const bounded = (value, fallback, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
export function createMissionDirector(raw) {
  return {
    version: 1,
    hold: bounded(raw?.hold, 0, 12),
    extracting: raw?.extracting === true,
    integrity: bounded(raw?.integrity, 100, 100),
    damageTaken: bounded(raw?.damageTaken, 0, 10000),
    vehicleDamage: bounded(raw?.vehicleDamage, 0, 10000),
    shotsFired: Math.floor(bounded(raw?.shotsFired, 0, 100000)),
    recovery: bounded(raw?.recovery, 0, 20),
    delivered: Math.floor(bounded(raw?.delivered, 0, 30)),
    lastHealth: bounded(raw?.lastHealth, 100, 100),
    lastDamageAt: Number.isFinite(raw?.lastDamageAt) ? Math.max(-100,Math.min(86400,raw.lastDamageAt)) : -100,
    vehicleId: typeof raw?.vehicleId === 'string' ? raw.vehicleId.slice(0, 120) : null,
    wasDriving: raw?.wasDriving === true,
    lastVehicleHealth: Number.isFinite(raw?.lastVehicleHealth) ? bounded(raw.lastVehicleHealth, 100, 10000) : null,
    failure: typeof raw?.failure === 'string' ? raw.failure.slice(0, 160) : ''
  };
}
export function extractionSeconds(mission) { return mission.id === 'boulevard-defense' ? 12 : 3; }
export function updateMissionDirector(director, mission, frame, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || frame.paused || director.failure) return director;
  const dt = Math.min(seconds, .1);
  const loss = Math.max(0, director.lastHealth - frame.health);
  const hurt = loss > 0 || Number.isFinite(frame.damageAt) && frame.damageAt > director.lastDamageAt;
  if (Number.isFinite(frame.damageAt)) director.lastDamageAt = frame.damageAt;
  director.damageTaken += loss;
  director.lastHealth = frame.health;
  let vehicleLoss = 0;
  if (frame.vehicleId && Number.isFinite(frame.vehicleHealth)) {
    if (frame.vehicleId === director.vehicleId && director.lastVehicleHealth !== null)
      vehicleLoss = Math.max(0, director.lastVehicleHealth - frame.vehicleHealth);
    director.vehicleId = frame.vehicleId;
    director.lastVehicleHealth = frame.vehicleHealth;
    director.vehicleDamage += vehicleLoss;
  }
  // First Shift remains a forgiving tutorial. Later courier jobs require
  // protecting the loaded manifest from actual injury and vehicle impacts.
  if (mission.type === 'delivery' && mission.id !== 'first-shift' && frame.parcel) {
    director.integrity = Math.max(0, director.integrity - loss * .6 - vehicleLoss * .35);
    if (director.integrity <= 0) director.failure = 'The delivery was damaged beyond repair. Retry from your checkpoint.';
  }
  if (mission.type === 'combat') {
    const secure = frame.remaining === 0 && frame.distance < 18 && frame.onFoot === true && frame.grounded === true && !frame.driving && Math.abs(frame.speed) < 1.2;
    // Extraction needs continuous control of the area; taking damage, leaving
    // the marker, or a surviving opponent interrupts the channel.
    director.hold = director.extracting && secure && !hurt
      ? Math.min(extractionSeconds(mission), director.hold + dt) : 0;
  } else if (mission.type === 'pursuit' && frame.final) {
    const safe = frame.wanted === 0 && frame.distance < 17 && frame.driving && Math.abs(frame.speed) < 2.5 && !frame.firing && !hurt;
    director.hold = safe ? Math.min(3, director.hold + dt) : 0;
  } else if (mission.type === 'flight' && frame.final) {
    const landed = frame.correctAircraft && !frame.airborne && frame.distance < 17 && Math.abs(frame.speed) < 2 && Math.abs(frame.verticalSpeed) < .5;
    director.hold = landed ? Math.min(2, director.hold + dt) : 0;
  } else director.hold = 0;
  if (mission.type === 'race' || mission.type === 'pursuit') {
    director.recovery = frame.vehicleDestroyed && !frame.driving ? Math.min(20, director.recovery + dt) : 0;
    if (director.recovery >= 20 - 1e-7) director.failure = 'Your vehicle is lost. Find another within 20 seconds or retry the checkpoint.';
  }
  director.wasDriving = frame.driving === true;
  return director;
}
export function missionGrade(director, elapsed, limit) {
  const clean = director.damageTaken <= 20 && director.vehicleDamage <= 40 && director.integrity >= 85;
  if (clean && elapsed <= limit * .7) return 'gold';
  return director.integrity >= 50 && director.damageTaken <= 100 ? 'silver' : 'bronze';
}
