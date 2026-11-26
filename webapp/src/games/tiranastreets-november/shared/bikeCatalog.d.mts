export type Bike={id:string;name:string;length:number;width:number;speed:number;url:string};
export const BIKE_TYPES:readonly Bike[];
export function bikeFor(actor:{id:string;bikeType?:string;motion?:string;model?:string;forceVehicle?:string}):Bike|undefined;
