export type VisibilityCandidate<T> = {item:T;distanceSq:number};
export class VisibilityIndex<T extends {x:number;z:number}> {
  constructor(items:readonly T[],cellSize?:number);
  query(target:{x:number;z:number},radius:number,accepts?:(item:T)=>boolean):VisibilityCandidate<T>[];
}
export function selectVisibilityBands<T>(candidates:VisibilityCandidate<T>[],bands:readonly {radius:number;count:number}[]):VisibilityCandidate<T>[];
