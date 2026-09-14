import type {Object3D} from 'three';
export function poseHumanoidHandGrip<J extends {bone:Object3D}>(root:Object3D,get:(name:string)=>J|undefined,remember:(joint:J)=>void,side:'R'|'L',pitch:number,amount:number):void;
