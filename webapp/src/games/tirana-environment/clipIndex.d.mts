export function createClipIndex<T extends number[][][]>(polygons:readonly T[],cellSize?:number):(bounds:number[])=>T[];
