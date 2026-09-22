import * as T from 'three';
import {humanoidBoneGroups,solveHumanoidLimb} from './humanoidRig.mjs';
import {npcWeaponPose} from '../shared/npcWeaponPose.mjs';
import {sampleHumanoidMotion} from './humanoidMotions.mjs';
import {poseHumanoidHandGrip} from './humanoidHands.mjs';

const clamp=T.MathUtils.clamp;
const alreadyReset=()=>{};
const clipNames={idle:/^(idle|standingidle|breathingidle)$/,walk:/^(walk|walking|walkforward)$/,run:/^(run|running|jog|jogging|runforward)$/};
export function locomotionClips(clips){
  const result={};
  for(const kind of ['idle','walk','run'])result[kind]=clips.find(c=>clipNames[kind].test(c.name.toLowerCase().split('|').at(-1).replace(/[^a-z]/g,'')));
  return result;
}

/** Keep authored clips on their own skeleton. Unanimated avatars use measured
 * limb lengths and world-space IK, never guessed local bone rotation axes. */
export class HumanoidAnimation {
  constructor(root,model,clips=[]) {
    this.root=root;this.model=model;this.clips=clips;this.mixer=new T.AnimationMixer(model);
    this.motion='';this.action=undefined;this.gait=0;this.locomotion=locomotionClips(clips);this.running=false;
    this.rests=new Map();
    model.traverse(bone=>{if(bone.isBone)this.rests.set(bone,{q:bone.quaternion.clone(),p:bone.position.clone(),s:bone.scale.clone()});});
    root.updateMatrixWorld(true);
    this.rigs=humanoidBoneGroups(model).map(bones=>{
      const point=name=>{const bone=bones.get(name);return bone?root.worldToLocal(bone.getWorldPosition(new T.Vector3())):undefined;};
      const hips=point('hips'),feet=new Map(),hands=new Map();
      for(const side of ['left','right']){
        const foot=point(side+'foot');if(foot)feet.set(side,foot);
        const shoulder=point(side+'arm'),elbow=point(side+'forearm'),hand=point(side+'hand');
        if(shoulder&&elbow&&hand)hands.set(side,{shoulder,length:shoulder.distanceTo(elbow)+elbow.distanceTo(hand)});
      }
      const gripJoints=new Map();
      for(const [side,letter] of [['left','L'],['right','R']]){
        const wrist=bones.get(side+'hand');if(wrist)gripJoints.set(`wrist.${letter}`,{bone:wrist});
        for(const [i,finger] of ['thumb','index','middle','ring','pinky'].entries())for(let segment=1;segment<=3;segment++){
          const bone=bones.get(`${side}hand${finger}${segment}`);if(bone)gripJoints.set(`finger${i+1}-${segment}.${letter}`,{bone});
        }
      }
      return {bones,hips,feet,hands,handTargets:new Map(),gripJoint:name=>gripJoints.get(name)};
    });
  }

  reset(){for(const [bone,rest] of this.rests){bone.quaternion.copy(rest.q);bone.position.copy(rest.p);bone.scale.copy(rest.s);}}

  update(n,time,dt,speed=Math.abs(n.speed||0)) {
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
    speed=clamp(Number.isFinite(speed)?speed:0,0,10);
    const cycle=n.motion==='cycle',cover=n.anim==='cover'||n.anim==='crouch',moving=speed>.12&&!cycle;
    // Hysteresis avoids rapid walk/run restarts near the transition speed.
    this.running=moving&&(n.anim==='run'||speed>(this.running?2.6:3.2));
    const running=this.running,base=moving?(running?'run':'walk'):'idle';
    // Aim, reload and hit are upper-body layers; locomotion continues underneath.
    const clip=!cycle&&!cover&&(this.locomotion[base]||(running?this.locomotion.walk:undefined));
    const motion=clip?clip.name:'procedural';
    if(this.motion!==motion){
      if(clip){
        const previous=this.action,phase=previous&&moving?previous.time/previous.getClip().duration:0;
        previous?.fadeOut(.2);
        this.action=this.mixer.clipAction(clip).reset();
        // Retain the planted foot through walk/run blends instead of resetting
        // both legs to the first frame every time speed crosses a threshold.
        this.action.time=(phase%1)*clip.duration;
        this.action.fadeIn(.2).play();
      }
      else {this.mixer.stopAllAction();this.action=undefined;}
      this.motion=motion;
    }
    // Clear IK/recoil before evaluating clips. Otherwise unkeyed joints retain
    // last frame's weapon pose and animation transitions gradually twist them.
    this.reset();
    if(this.action){
      this.action.setEffectiveTimeScale(moving?clamp(speed/(clip===this.locomotion.run?4.5:1.4),.4,2.2):1);
      this.mixer.update(dt);
    }
    this.gait+=dt*(cycle?7:clamp(speed*3.6,0,13));
    const amount=clamp(speed/4,0,1),stride=moving?.12+amount*.25:0;
    const authored=cover?(moving?'crouch':'cover'):running?(speed>4.8?'sprint':'jog'):moving?'walk':'idle',phase=this.gait/(Math.PI*2);
    const recoil=clamp(1-(time-(n.firedAt??-10))/.18,0,1),reload=n.anim==='reload';
    const grips=n.weapon?npcWeaponPose(n):undefined;
    for(const rig of this.rigs){
      if(clip&&rig.hips){
        // Root motion belongs to the simulation, not to an imported walk track.
        const hips=rig.bones.get('hips'),at=this.root.worldToLocal(hips.getWorldPosition(new T.Vector3()));
        at.x=rig.hips.x;at.z=rig.hips.z;
        hips.position.copy(hips.parent.worldToLocal(this.root.localToWorld(at)));
      }
      if(!clip)for(const side of ['left','right']){
        const rest=rig.feet.get(side);if(!rest)continue;
        const foot=rest.clone(),offset=new T.Vector3();
        if(cycle){const pedal=this.gait+(side==='left'?0:Math.PI);foot.y+=.42+Math.cos(pedal)*.12;foot.z+=.25+Math.sin(pedal)*.14;}
        else if((moving||cover)&&sampleHumanoidMotion(authored,phase,side+'foot',offset,true)){
          // Scale stride to the target gait, retaining the authored heel lift.
          foot.x+=offset.x*.35;foot.y+=Math.max(0,offset.y)*.8;foot.z+=offset.z*(running?.65:.85);
        }
        if(cover)foot.y+=.3;
        solveHumanoidLimb(this.root,rig.bones,side,this.root.localToWorld(foot),true);
      }
      // Native walk clips retain their authored arm swing unless a deliberate
      // gameplay action owns the hands. Procedural rigs keep relaxed elbows.
      if(clip&&!grips&&!cycle&&!['fight','punch','hit'].includes(n.anim))continue;
      for(const side of ['left','right']){
        const arm=rig.hands.get(side);if(!arm)continue;
        const swing=this.gait+(side==='left'?Math.PI:0),hand=arm.shoulder.clone();
        hand.y-=arm.length*.92;hand.z+=.06+Math.sin(swing)*stride*.7;
        hand.x+=(side==='left'?1:-1)*.025;
        sampleHumanoidMotion(authored,moving?phase:time/2.5,side+'hand',hand);
        // Source jogging shoulders rotate with its torso. Retain that stride
        // without pushing narrower target forearms sideways away from the body.
        if(running&&!grips)hand.x=arm.shoulder.x+(side==='left'?1:-1)*.035;
        if(grips){const g=side==='left'?grips.left:grips.right;hand.set(g.x,g.y,g.z-recoil*.035);if(reload&&side==='left'){hand.y-=.12;hand.z-=Math.sin(time*7)*.06;}}
        else if(cycle)hand.set(side==='left'?.2:-.2,1.08,.48);
        else if(n.anim==='fight'||n.anim==='punch'){
          const attack=Math.max(0,time-(n.defenseStartedAt??0))%1.8;
          sampleHumanoidMotion(attack<.9?'jab':'cross',(attack%.9)/.9,side+'hand',hand);
        }else if(n.anim==='hit')sampleHumanoidMotion('hit',clamp((time-((n.hitUntil??time+.38)-.38))/.38,0,.999),side+'hand',hand);
        const previous=rig.handTargets.get(side);
        if(previous){previous.lerp(hand,dt?1-Math.exp(-dt*22):1);hand.copy(previous);}
        else rig.handTargets.set(side,hand.clone());
        solveHumanoidLimb(this.root,rig.bones,side,this.root.localToWorld(hand));
        if(grips)poseHumanoidHandGrip(this.root,rig.gripJoint,alreadyReset,side==='left'?'L':'R',grips.pitch,1);
      }
    }
  }

  dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);}
}
