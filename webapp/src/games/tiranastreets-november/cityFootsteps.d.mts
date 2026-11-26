export function createCityFootsteps(): {
  reset(): void;
  advance(point: {x:number;z:number}, dt: number, gait: string): {foot:number;strength:number} | null;
};
