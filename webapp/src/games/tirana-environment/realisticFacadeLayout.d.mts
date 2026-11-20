export interface FacadePlacement {x:number;y:number;z:number;yaw:number;width:number;height:number;variant:'window'|'alternate'|'large'|'door';edge:number;floor:number;column:number}
export interface FacadeBuilding {id:string;x:number;z:number;placements:FacadePlacement[]}
export function realisticFacadeLayout(world:any,excluded?:ReadonlySet<string>,clearance?:(x:number,z:number,pad:number)=>boolean):FacadeBuilding[];
export function selectRealisticFacades(buildings:FacadeBuilding[],viewer:{x:number;z:number},battery?:boolean):FacadeBuilding[];
