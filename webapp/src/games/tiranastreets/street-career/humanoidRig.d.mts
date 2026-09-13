import * as T from 'three';
export function canonicalHumanoidBone(name:string):string;
export function humanoidBones(root:T.Object3D):Map<string,T.Bone>;
export function inspectHumanoidRig(root:T.Object3D):{valid:boolean;missing:string[];skinCount:number;bones:Map<string,T.Bone>};
export function headBoneIndices(skeleton:T.Skeleton):Set<number>;
export function hideAuthoredPlayerWeapon(root:T.Object3D):void;
export function normalizePlayableHuman(root:T.Object3D,height?:number):T.Group;
export function solveHumanoidLimb(root:T.Object3D,bones:Map<string,T.Bone>,side:'left'|'right',target:T.Vector3,leg?:boolean):boolean;
export class HumanoidLegPose {
  constructor(root:T.Object3D,bones:Map<string,T.Bone>);
  reset():void;
  update(gait:number,speed:number):void;
}
