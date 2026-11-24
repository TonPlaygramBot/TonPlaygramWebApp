import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {normalizePlayableHuman} from '../tiranastreets/street-career/humanoidRig.mjs';

// Exact historic 332eda1d50 Turi; the separate attachment repair is not applied here.
const TURI_URL='/assets/tirana-streets/players/turi.glb';

export class TuriWalker {
  async load(signal,dispose){
    const response=await fetch(TURI_URL,{signal});
    if(!response.ok)throw Error('Turi nuk u ngarkua.');
    const bytes=await response.arrayBuffer();if(signal.aborted)return false;
    let model;
    try{
      const gltf=await new GLTFLoader().parseAsync(bytes,new globalThis.URL('.',new globalThis.URL(TURI_URL,window.location.href)).href);
      model=gltf.scene;if(signal.aborted){dispose(model);return false;}
      const actors=[];
      model.traverse(o=>{if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;actors.push(o);}});
      const root=normalizePlayableHuman(model);
      const mixer=new T.AnimationMixer(model), actions={};
      for(const label of ['Idle','Walk','Run']){
        const clip=T.AnimationClip.findByName(gltf.animations,label);
        if(!clip)throw Error('Mungon animacioni origjinal: '+label);
        actions[label]=mixer.clipAction(clip);
      }
      actions.Idle.play();
      this.root=root;this.actors=actors;this.mixer=mixer;this.actions=actions;this.active='Idle';this.root.visible=false;
      return true;
    }catch(e){if(model)dispose(model);throw e;}
  }
  update(state,visible,dt){
    if(!this.root)return;
    this.root.visible=visible;
    if(!visible){this.smoothedYaw=undefined;return;}
    this.root.position.set(state.x,(state.walkY||0)+.065,state.z);
    const heading=Number.isFinite(state.walkYaw)?state.walkYaw:state.yaw;
    this.smoothedYaw=this.smoothedYaw===undefined?heading:
      this.smoothedYaw+Math.atan2(Math.sin(heading-this.smoothedYaw),Math.cos(heading-this.smoothedYaw))*(1-Math.exp(-dt*20));
    this.root.rotation.y=this.smoothedYaw;
    const label=state.walkSpeed>3.2?'Run':state.walkSpeed>.22?'Walk':'Idle';
    if(this.active!==label){
      this.actions[this.active].fadeOut(.18);
      this.actions[label].reset().fadeIn(.18).play();
      this.active=label;
    }
    if(label!=='Idle')this.actions[label].setEffectiveTimeScale(T.MathUtils.clamp(state.walkSpeed/(label==='Run'?4.25:2.55),.65,1.35));
    this.mixer.update(dt);
  }
  dispose(){this.mixer?.stopAllAction();if(this.mixer)this.mixer.uncacheRoot(this.mixer.getRoot());}
}
