/** World metres. Shared by rendering, browser simulation and the server. */
export const KART_LENGTH = 2;
export const KART_SCALE = KART_LENGTH / 2.7;
export const KART_WIDTH = 1.72 * KART_SCALE;
export const MIN_PASSING_WIDTH = 4.8;
export const RACING_CLEARANCE_VERSION = 'racing-two-lane-v1';
/** Leave bumper and steering clearance without reserving a car-sized lane. */
export function kartPassingRoom(roadWidth, bodyWidth = KART_WIDTH) {
  if (![roadWidth,bodyWidth].every(Number.isFinite) || roadWidth <= 0 || bodyWidth <= 0) return 0;
  return Math.max(0, Math.min(2.2, roadWidth / 2 - bodyWidth / 2 - .45));
}
