import type {Object3D} from 'three';
export function poseHumanoidHandGrip<J extends {bone:Object3D}>(root:Object3D,get:(name:string)=>J|undefined,remember:(joint:J)=>void,side:'R'|'L',pitch:number,amount:number):void;

import type {Bone,Vector3} from 'three';
export function humanoidPalmPoint(bones:Map<string,Bone>,side:'left'|'right',out?:Vector3):Vector3;
export function solveHumanoidGrip(root:Object3D,bones:Map<string,Bone>,side:'left'|'right',target:Vector3,along:Vector3,normal:Vector3,curl?:number):boolean;

export function poseHumanoidFist(root:Object3D,bones:Map<string,Bone>,side:'left'|'right',amount?:number):void;
export function curlHumanoidFingers(root:Object3D,bones:Map<string,Bone>,side:'left'|'right',normal:Vector3,curl?:number):void;
