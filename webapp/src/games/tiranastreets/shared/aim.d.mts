export const DEFAULT_PITCH: number;
export function dragLook(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  width?: number,
  height?: number
): { yaw: number; pitch: number };
export function inAimHeight(pitch: number, forward: number): boolean;
