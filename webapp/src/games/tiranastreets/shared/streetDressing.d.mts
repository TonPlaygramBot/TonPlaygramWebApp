export type StreetProp = {
  name: string;
  x: number;
  z: number;
  yaw: number;
  scale: number;
};
export const STREET_PROPS: StreetProp[];
export const STREET_SOLIDS: (StreetProp & { box: number[] })[];
export function collideStreetProps(
  p: { x: number; z: number },
  radius: number
): boolean;
