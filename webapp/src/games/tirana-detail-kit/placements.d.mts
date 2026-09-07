export type Placement={id:string;asset:string;x:number;y:number;z:number;yaw:number;buildingId:string};
export function inside(x:number,z:number,poly:number[][]):boolean;
export function createDetailPlacements(world:any,excluded?:ReadonlySet<string>):Placement[];
export function selectNearby(placements:Placement[],target:{x:number;z:number},battery?:boolean):Placement[];
