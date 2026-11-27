export const PALETTES: readonly [string, number, number, number, number[]][];
export function canStyleBuilding(b: { special?: unknown; tags?: Record<string,string> }): boolean;
export function districtFinish(points: readonly (readonly number[])[] | undefined, id: unknown):
 {zone:string; color:number; strength:number};
