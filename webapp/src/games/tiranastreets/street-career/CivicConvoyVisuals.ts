import * as T from 'three';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {HumanModelLoader} from '../HumanModelLoader';
import {AlbanianForcesVisuals} from '../AlbanianForcesVisuals';
import {disposeWeaponResources} from '../weaponModelResources';
import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import {HumanoidAnimation} from './humanoidAnimation.mjs';
import {humanoidBones,normalizePlayableHuman,solveHumanoidLimb} from './humanoidRig.mjs';
import {prepareHumanMaterials} from './humanMaterials.mjs';
import type {CivicConvoySimulation} from './CivicConvoySimulation.mjs';

/** The existing fleet owns all ten vehicles. This layer owns only the civic
 * passenger, four original Shqiponja riders and private SUV paint materials. */
export class CivicConvoyVisuals {
  readonly group=new T.Group();
  readonly escorts=new AlbanianForcesVisuals();
  error='';
  private loader=new HumanModelLoader();
  private source?:GLTF;
  private character?:T.Group;
  private animation?:HumanoidAnimation;
  private bones?:ReturnType<typeof humanoidBones>;
  private releaseMaterials?:()=>void;
  private abort?:AbortController;
  private dead=false;
  private retryAt=0;
  private normalY=0;
  private pelvisHeight=1;
  private maxAnisotropy=4;
  private paint=new Map<T.Object3D,Array<{mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]}>>();
  private target=new T.Vector3();
  private label?:T.Sprite;
  constructor(scene:T.Scene,renderer:T.WebGLRenderer){
    this.group.name='Tirana:civic-convoy-occupants';scene.add(this.group);
    this.group.add(this.escorts.group);this.loader.configure(renderer);this.escorts.configure(renderer);
    this.maxAnisotropy=renderer.capabilities.getMaxAnisotropy();
  }
  private async load(){
    if(this.abort||this.source||this.dead)return;
    const abort=new AbortController();this.abort=abort;
    const timer=setTimeout(()=>abort.abort(),25000);
    try{
      const response=await fetch('/assets/tirana-streets/civic/edi-rama-stylized.glb',{signal:abort.signal});
      if(!response.ok)throw Error(`Civic NPC HTTP ${response.status}`);
      const source=await this.loader.parseAsync(await response.arrayBuffer(),'/assets/tirana-streets/civic/');
      if(this.dead){disposeWeaponResources([source.scene]);return;}
      this.source=source;this.releaseMaterials=prepareHumanMaterials(source.scene,{maxAnisotropy:this.maxAnisotropy});
      const character=normalizePlayableHuman(source.scene,1.98);
      character.name='Edi Rama · stylized game character';
      character.userData={character:'edi-rama',likeness:'stylized approximation',source:'Quaternius CC0',fictionalItinerary:true};
      this.group.add(character);this.character=character;
      this.bones=humanoidBones(source.scene);
      character.updateMatrixWorld(true);
      const hips=this.bones.get('hips');
      this.pelvisHeight=hips?character.worldToLocal(hips.getWorldPosition(this.target)).y:1.05;
      this.normalY=character.children[0].position.y;
      this.animation=new HumanoidAnimation(character,source.scene,source.animations);
      source.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
      const context=canvas.getContext('2d');
      if(context){
        context.fillStyle='#142830';context.fillRect(0,0,512,96);context.textAlign='center';
        context.fillStyle='#f3e8c7';context.font='bold 33px sans-serif';context.fillText('EDI RAMA',256,39);
        context.font='22px sans-serif';context.fillText('Personazh i lojës',256,73);
        const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
        this.label=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthTest:true}));
        this.label.position.y=2.19;this.label.scale.set(1.35,.253,1);character.add(this.label);
      }
      this.error='';
    }catch(error){if(!this.dead){this.error=String(error);this.retryAt=performance.now()+30000;}}
    finally{clearTimeout(timer);this.abort=undefined;}
  }
  private blackPaint(root:T.Object3D){
    if(this.paint.has(root))return;
    const entries:Array<{mesh:T.Mesh;original:T.Material|T.Material[];copies:T.Material[]}>=[];
    root.traverse(mesh=>{
      if(!(mesh instanceof T.Mesh))return;
      const original=mesh.material,copies:T.Material[]=[];
      const adapt=(material:T.Material)=>{
        if(!(material instanceof T.MeshStandardMaterial)||material.name!=='Car_Paint')return material;
        const copy=material.clone();copy.color.setRGB(.007,.009,.012);copy.roughness=.24;copy.metalness=.65;copies.push(copy);return copy;
      };
      const material=Array.isArray(original)?original.map(adapt):adapt(original);
      if(copies.length){mesh.material=material;entries.push({mesh,original,copies});}
    });
    this.paint.set(root,entries);
  }
  update(convoy:CivicConvoySimulation,viewer:{x:number;z:number},time:number,dt:number,vehicleRoot:(id:string)=>T.Object3D|undefined,battery=false){
    if(this.dead)return;
    const live=new Set<T.Object3D>();
    for(const car of convoy.vehicles)if(car.collectionVehicle==='range'){
      const root=vehicleRoot(car.id);if(root){live.add(root);this.blackPaint(root);}
    }
    for(const [root,entries] of this.paint)if(!live.has(root)){
      entries.forEach(({mesh,original,copies})=>{mesh.material=original;copies.forEach(m=>m.dispose());});this.paint.delete(root);
    }
    this.escorts.update({cars:[],traffic:[],units:[],npcs:convoy.status==='unavailable'?[]:convoy.riders},viewer,time,dt,battery);
    const npc=convoy.npc,distance=npc?Math.hypot(npc.x-viewer.x,npc.z-viewer.z):Infinity;
    if(npc&&distance<220&&!this.source&&!this.abort&&performance.now()>=this.retryAt)void this.load();
    const root=this.character;if(!root)return;
    root.visible=!!npc&&distance<(battery?100:180);
    if(!npc||!root.visible)return;
    root.position.set(npc.x,groundHeight(npc.x,npc.z)+.03,npc.z);root.rotation.set(0,npc.heading+Math.PI,0);
    root.children[0].position.y=this.normalY+(npc.seated?.58-this.pelvisHeight:0);
    if(npc.seated){
      this.animation?.reset();root.updateMatrixWorld(true);
      if(this.bones)for(const [side,x] of [['left',.13],['right',-.13]] as const){
        solveHumanoidLimb(root,this.bones,side,root.localToWorld(this.target.set(x,.16,.47)),true);
        solveHumanoidLimb(root,this.bones,side,root.localToWorld(this.target.set(x*1.35,.84,.22)));
      }
    }else this.animation?.update(npc,time,dt,0);
    if(this.label)this.label.visible=!npc.seated&&distance<28;
  }
  dispose(){
    if(this.dead)return;this.dead=true;this.abort?.abort();this.animation?.dispose();this.escorts.dispose();
    for(const entries of this.paint.values())entries.forEach(({mesh,original,copies})=>{mesh.material=original;copies.forEach(m=>m.dispose());});this.paint.clear();
    this.releaseMaterials?.();
    if(this.label){this.label.material.map?.dispose();this.label.material.dispose();}
    if(this.source)disposeWeaponResources([this.source.scene]);
    this.loader.dispose();this.group.removeFromParent();
  }
}
