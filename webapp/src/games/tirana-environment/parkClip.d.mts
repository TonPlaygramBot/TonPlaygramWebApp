export function clipParkSurfaces(parkRings: number[][][], cutRings: number[][][]): {
  polygons: number[][][][];
  failures: Array<{index: number; message: string}>;
  retries: number;
};
