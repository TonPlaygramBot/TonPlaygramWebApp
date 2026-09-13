export type DriverCar={x:number;z:number;heading:number;collectionVehicle?:string;racingAsset?:string;forceVehicle?:string;model?:string;service?:string};
export function driverSocket(car:DriverCar):{x:number;y:number;z:number;width:number;length:number;open:boolean};
export function driverEye(car:DriverCar,sample?:(x:number,z:number)=>number):{x:number;y:number;z:number};
export function driverDirection(car:DriverCar,yaw?:number,pitch?:number,sample?:(x:number,z:number)=>number):{x:number;y:number;z:number};
export function driverUp(car:DriverCar,sample?:(x:number,z:number)=>number):{x:number;y:number;z:number};
export function driverFov(aspect:number):number;
