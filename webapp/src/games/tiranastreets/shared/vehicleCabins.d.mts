import type {DriverCar} from './driverView.mjs';
export function cabinAssetId(car:DriverCar):string|undefined;
export function hasAuthoredCabin(car:DriverCar):boolean;
export function cabinSurface(car:DriverCar,nodeName:string,materialName:string):boolean;
export function cabinSteeringSurface(nodeName:string,materialName:string):boolean;
