/** World metres. Shared by rendering, browser simulation and the server. */
export const KART_LENGTH = 1.82;
export const KART_WIDTH = 1.42;
// Full-detail GLB widths after the shared 1.82 m length fit, rounded up.
const NARROW_KART_WIDTH = 1.35;
const NARROW_KARTS = new Set(['apex', 'oobi', 'oodi', 'oopi']);
export const kartBodyWidth = id => NARROW_KARTS.has(id) ? NARROW_KART_WIDTH : KART_WIDTH;
export const MIN_PASSING_WIDTH = 4.8;
export const RACING_CLEARANCE_VERSION = 'racing-two-lane-v2';
/** Leave bumper and steering clearance without reserving a car-sized lane. */
export function kartPassingRoom(roadWidth, bodyWidth = KART_WIDTH) {
  if (![roadWidth,bodyWidth].every(Number.isFinite) || roadWidth <= 0 || bodyWidth <= 0) return 0;
  return Math.max(0, Math.min(2.2, roadWidth / 2 - bodyWidth / 2 - .45));
}
