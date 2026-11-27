import type {Bone,Object3D} from 'three';
export function usesTuriLookImpact(root:Object3D):boolean;
export class TuriLookImpact {
  constructor(root:Object3D,bones:ReadonlyMap<string,Bone>);
  update(input:{enabled:boolean;glanceOnly?:boolean;bodyYaw:number;lookYaw:number;time:number;lastDamage:number;dt:number;gesture?:{right:boolean;phase:number}}):void;
}
