type Vec=[number,number,number];
export const DRIVER_REST:Record<string,{shoulder:Vec;elbow:Vec;hand:Vec}>;
export function elbowFor(shoulder:Vec,hand:Vec,upper:number,lower:number,side:number):Vec;
export function driverPose(steer?:number,acceleration?:number,yawRate?:number,speed?:number,time?:number,reduced?:boolean):{arms:Record<string,{shoulder:Vec;elbow:Vec;hand:Vec}>;lean:number;breath:number;headYaw:number};
