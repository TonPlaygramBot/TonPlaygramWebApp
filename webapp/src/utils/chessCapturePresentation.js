// Board-game presentation only: dimensionless art timing, not flight simulation.
const clamp = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const ease = (value) => { const u = clamp(value); return u * u * (3 - 2 * u) }
export const DRONE_RELEASE_RATIO = 0.68
export const DRONE_PAYLOAD_OFFSET = 0.06

export function sampleDroneDelivery ({ from, target, progress, clearance }) {
  const u = clamp(progress)
  const height = Math.max(from.y, target.y) + Math.max(0.12, clearance)
  // Arrive over the selected square before release, hold briefly, then leave.
  const approach = ease(u / (DRONE_RELEASE_RATIO - 0.04))
  const departure = ease((u - DRONE_RELEASE_RATIO - 0.035) / (1 - DRONE_RELEASE_RATIO - 0.035))
  const dx = target.x - from.x
  const dz = target.z - from.z
  const length = Math.hypot(dx, dz)
  const direction = length > 0.001 ? { x: dx / length, z: dz / length } : { x: 1, z: 0 }
  const exitDistance = Math.max(length * 0.65, clearance)
  return {
    x: from.x + dx * approach + direction.x * exitDistance * departure,
    y: from.y + (height - from.y) * ease(u / 0.2) + clearance * 0.12 * departure,
    z: from.z + dz * approach + direction.z * exitDistance * departure,
    direction,
    released: u >= DRONE_RELEASE_RATIO
  }
}

export function samplePayloadDrop (launch, target, progress) {
  const u = clamp(progress)
  // Accelerating descent rather than an eased stop just before impact.
  return { x: launch.x, y: u === 1 ? target.y : launch.y + (target.y - launch.y) * u * u, z: launch.z }
}

export function sampleCaptureBlast (elapsed, duration = 2.6) {
  const t = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0)
  return {
    flash: Math.max(0, 1 - t / 0.12) ** 2,
    fire: Math.max(0, 1 - t / 0.65) ** 1.7,
    smoke: ease(t / 0.22) * Math.max(0, 1 - t / duration),
    spread: 1 - Math.exp(-t * 5),
    rise: t * 0.24,
    cooling: clamp(t / 0.65)
  }
}
