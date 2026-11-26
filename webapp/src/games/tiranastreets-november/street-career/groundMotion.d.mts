export type GroundMotion = {speed:number;moving:boolean;running:boolean};
export function groundMotion(previous:GroundMotion|undefined, sample:{
  speed:number;travelX:number;travelZ:number;free:boolean;dt:number;
}):GroundMotion;
export function groundCadence(speed:number,runningClip:boolean):number;
export function stridePhase(time:number,duration:number):number;
