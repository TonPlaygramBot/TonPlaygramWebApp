import * as T from 'three';
import type {NPC} from '../shared/engine.mjs';
export class HumanoidAnimation {
  constructor(root:T.Object3D,model:T.Object3D,clips?:T.AnimationClip[]);
  readonly mixer:T.AnimationMixer;
  update(n:Partial<NPC>,time:number,dt:number,speed?:number):void;
  reset():void;
  dispose():void;
}
