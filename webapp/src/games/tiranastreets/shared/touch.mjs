/** One finger owns each channel until that same finger ends or cancels it. */
export class TouchChannels {
  owners = new Map();
  begin(channel, id) {
    if (this.owners.has(channel) || [...this.owners.values()].includes(id))
      return false;
    this.owners.set(channel, id);
    return true;
  }
  owns(channel, id) {
    return this.owners.get(channel) === id;
  }
  end(channel, id) {
    if (!this.owns(channel, id)) return false;
    this.owners.delete(channel);
    return true;
  }
  clear() {
    this.owners.clear();
  }
}

/** Inputs use screen directions. Only the existing engine's screen-up convention is encoded here. */
export function thumbStick(
  dx,
  dy,
  radius,
  driving = false,
  wasRunning = false
) {
  if (![dx, dy, radius].every(Number.isFinite) || radius <= 0)
    return { x: 0, y: 0, knobX: 0, knobY: 0, sprint: false };
  const distance = Math.hypot(dx, dy),
    raw = distance / radius;
  const length = Math.min(1, raw);
  const amount = Math.max(0, (length - 0.12) / 0.88);
  const ux = distance ? dx / distance : 0,
    uy = distance ? dy / distance : 0;
  return {
    x: ux * amount,
    y: -uy * amount,
    knobX: ux * length * radius * 0.72,
    knobY: uy * length * radius * 0.72,
    sprint: !driving && raw >= (wasRunning ? 0.78 : 0.91)
  };
}
