const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const createRaceTelemetry = () => ({
  valid: true, clean: true, sectors: [], lastLap: null, bestLap: 0,
  completed: 0, topSpeed: 0, distance: 0, driftDistance: 0, draftSeconds: 0,
  cleanSeconds: 0, drivingSeconds: 0
});

// Called only by the existing ordered checkpoint gates, on server and client.
export function recordTimingGate(r, gate, time) {
  const timing = r.telemetry ||= createRaceTelemetry();
  if (r.lap > 0) {
    const elapsed = Math.max(0, time - r.lapStartedAt);
    const previous = timing.sectors.reduce((sum, s) => sum + s, 0);
    timing.sectors.push(Math.max(0, elapsed - previous));
    if (gate === 0) {
      const valid = timing.valid && timing.sectors.length === 4 && elapsed > 0;
      timing.lastLap = { time: elapsed, sectors: [...timing.sectors], valid, clean: timing.clean };
      timing.completed++;
      if (valid) timing.bestLap = Math.min(timing.bestLap || Infinity, elapsed);
    }
  }
  if (gate === 0) {
    timing.sectors = [];
    timing.valid = true;
    timing.clean = true;
  }
}

export function stepRaceTelemetry(r, dt) {
  const timing = r.telemetry ||= createRaceTelemetry();
  const speed = Math.abs(r.speed || 0);
  timing.topSpeed = Math.max(timing.topSpeed, speed);
  timing.distance += speed * dt;
  if (r.drifting) timing.driftDistance += speed * dt;
  if (r.slipstream > .1) timing.draftSeconds += dt;
  if (r.wallContact || r.collision > 0) timing.clean = false;
  if (speed > 2) {
    timing.drivingSeconds += dt;
    if (!r.wallContact && !(r.collision > 0)) timing.cleanSeconds += dt;
  }
  stepPowertrain(r, dt);
}

// Cosmetic shifter-kart drivetrain: same fixed-step RPM drives sound and HUD.
// Hysteresis prevents gear chatter when hovering at a shift threshold.
export function stepPowertrain(r, dt) {
  const p = r.powertrain ||= { gear: 1, rpm: 1900, shift: 0, shiftId: 0 };
  const speed = Math.abs(r.speed || 0), bands = [0, 9, 16, 23, 30, 38, 52];
  p.shift = Math.max(0, p.shift - dt);
  let gear = clamp(p.gear || 1, 1, 6);
  if (!p.shift) {
    if (gear < 6 && speed > bands[gear] + .7) gear++;
    else if (gear > 1 && speed < bands[gear - 1] - 1.7) gear--;
  }
  if (gear !== p.gear) { p.gear = gear; p.shift = .14; p.shiftId++; }
  const range = (speed - bands[gear - 1]) / (bands[gear] - bands[gear - 1]);
  const target = clamp(2600 + range * 6600 + (r.throttle || 0) * 1100 + (r.airborne ? 800 : 0), 1900, 10800);
  p.rpm += (target - p.rpm) * (1 - Math.exp(-dt * (p.shift > 0 ? 25 : 12)));
  return p;
}

export function rivalIntervals(racers, playerId, trackLength) {
  const ordered = racers.filter(r => !r.retired && !r.disconnected).sort((a, b) =>
    Number(b.finished) - Number(a.finished) || (a.finished && b.finished ? a.finishTime - b.finishTime : b.progress - a.progress));
  const index = ordered.findIndex(r => r.id === playerId), me = ordered[index];
  if (!me) return [];
  return ordered.slice(Math.max(0, index - 1), index + 2).map(r => ({
    id: r.id, name: r.name, position: ordered.indexOf(r) + 1,
    // A distance gap stays honest at corners and while stationary.
    meters: Math.round(Math.abs(r.progress - me.progress) * trackLength),
    ahead: r.progress > me.progress, player: r.id === playerId, finished: r.finished
  }));
}
