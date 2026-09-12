export type DriverCar={x:number;z:number;heading:number;collectionVehicle?:string;racingAsset?:string;forceVehicle?:string;model?:string;service?:string};
export function driverSocket(car:DriverCar):{x:number;y:number;z:number;width:number;length:number;open:boolean};
export function driverEye(car:DriverCar):{x:number;y:number;z:number};
export function driverFov(aspect:number):number;
