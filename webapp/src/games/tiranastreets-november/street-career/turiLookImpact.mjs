import {MathUtils,Quaternion,Vector3} from 'three';
import {sampleHumanoidMotion} from './humanoidMotions.mjs';

const Y=new Vector3(0,1,0);
const X=new Vector3(1,0,0);
const REACTION_SECONDS=.36;
const LOOK_LIMIT=.92;
const HEAD_MATERIAL='Turi multi-view head';

export function usesTuriLookImpact(root) {
  let turi=false;
  root.traverse(mesh=>{
    if (mesh.isSkinnedMesh && [mesh.material].flat().some(material=>material?.name===HEAD_MATERIAL)) turi=true;
  });
  return turi;
}

/** Add a view-facing glance and a received-impact beat after the authored
 * locomotion mixer. Never use animation to change camera, movement or hits. */
export class TuriLookImpact {
  constructor(root,bones) {
    this.root=root;
    this.neck=bones.get('neck');
    this.head=bones.get('head');
    this.chest=bones.get('spine2')||bones.get('spine1');
    this.look=0;
    this.rootBasis=new Quaternion();
    this.inverseParent=new Quaternion();
    this.offset=new Quaternion();
    this.axis=new Vector3();
    this.hitSample=new Vector3();
    this.hitStart=new Vector3();
    sampleHumanoidMotion('hit',0,'righthand',this.hitStart);
  }

  add(bone,axis,angle) {
    if(!bone?.parent||Math.abs(angle)<1e-5)return;
    // The clip may have twisted the limb. Express avatar-space axes in the
    // bone parent's current space instead of assuming glTF local Euler axes.
    bone.parent.getWorldQuaternion(this.inverseParent).invert();
    this.axis.copy(axis).applyQuaternion(this.rootBasis).applyQuaternion(this.inverseParent);
    bone.quaternion.premultiply(this.offset.setFromAxisAngle(this.axis,angle));
  }

  update({enabled,glanceOnly=false,bodyYaw,lookYaw,time,lastDamage,dt,gesture}) {
    if(!enabled || !this.head) { this.look=0; return; }
    const delta=lookYaw-bodyYaw;
    const requested=Number.isFinite(delta)?Math.atan2(Math.sin(delta),Math.cos(delta)):0;
    const elapsed=MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.1);
    const age=time-lastDamage;
    let impact=0;
    if(!glanceOnly && age>0 && age<REACTION_SECONDS) {
      // Retain the authored motion's early accent; taper its tail to avoid
      // replacing the locomotion pose at the end of the short reaction.
      const phase=age/REACTION_SECONDS;
      sampleHumanoidMotion('hit',phase,'righthand',this.hitSample);
      const authored=MathUtils.clamp(this.hitSample.distanceTo(this.hitStart)/.085,0,1);
      impact=authored*(1-MathUtils.smoothstep(phase,.28,1));
    }
    const phase=gesture?.phase;
    // The game already animates the hand. Let its upper body follow the same
    // visual timeline without altering the action, camera, or contact.
    const accent=!glanceOnly && Number.isFinite(phase)
      ? MathUtils.smoothstep(phase,.1,.56)*(1-MathUtils.smoothstep(phase,.67,1)) : 0;
    const follow=(gesture?.right?1:-1)*accent;
    const target=MathUtils.clamp(requested,-LOOK_LIMIT,LOOK_LIMIT)*(1-.38*impact-.24*accent);
    this.look=MathUtils.damp(this.look,target,17,elapsed);
    if(Math.max(Math.abs(this.look),impact,accent)<1e-5) return;
    this.root.getWorldQuaternion(this.rootBasis);
    const chestWeight=this.chest && !glanceOnly ? .16 : 0, neckWeight=this.neck ? .28 : 0;
    this.add(this.chest,Y,this.look*chestWeight+.22*follow);
    this.add(this.chest,X,-.19*impact);
    this.add(this.neck,Y,this.look*neckWeight-.04*follow);
    this.add(this.neck,X,-.062*impact);
    this.add(this.head,Y,this.look*(1-chestWeight-neckWeight)-.06*follow);
    this.add(this.head,X,.115*impact);
  }
}
