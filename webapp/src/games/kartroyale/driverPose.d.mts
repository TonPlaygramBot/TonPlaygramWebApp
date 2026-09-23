type Vec=[number,number,number];
export const STEERING_WHEEL_ANGLE:number;
export const DRIVER_REST:Record<string,{shoulder:Vec;elbow:Vec;hand:Vec}>;
export const DRIVER_LEGS:Record<string,{hip:Vec;knee:Vec;ankle:Vec}>;
export function elbowFor(shoulder:Vec,hand:Vec,upper:number,lower:number,side:number,pole?:Vec):Vec;
export function driverPose(steer?:number,acceleration?:number,yawRate?:number,speed?:number,time?:number,reduced?:boolean,feedback?:{side?:number;forward?:number;throttle?:number;brake?:number}):{arms:Record<string,{shoulder:Vec;elbow:Vec;hand:Vec}>;legs:Record<string,{hip:Vec;knee:Vec;ankle:Vec;pedal:number}>;lean:number;recoil:number;breath:number;wheelAngle:number;headYaw:number};
