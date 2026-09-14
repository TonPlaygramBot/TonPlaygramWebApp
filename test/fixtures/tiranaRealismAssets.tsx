import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {AlbanianForcesVisuals} from '../../webapp/src/games/tiranastreets/AlbanianForcesVisuals';
import {SharedHumans} from '../../webapp/src/games/tiranastreets/street-career/SharedHumans';
import {SHARED_GAME_CAST} from '../../webapp/src/games/tiranastreets/street-career/SharedGameCast';
import {humanoidBoneGroups} from '../../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
import {BikeVisuals} from '../../webapp/src/games/tiranastreets/BikeVisuals';
import {BusVisuals} from '../../webapp/src/games/tiranastreets/population/BusVisuals';
import {CollectionVehicleVisuals} from '../../webapp/src/games/tiranastreets/CollectionVehicleVisuals';
import {BIKE_TYPES} from '../../webapp/src/games/tiranastreets/shared/bikeCatalog.mjs';
import {VEHICLE_COLLECTION} from '../../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
import {FORCE_ASSET_BY_ID} from '../../webapp/src/games/tiranastreets/shared/albanianForces.mjs';
import {LivingVisuals} from '../../webapp/src/games/tiranastreets/livingVisuals';

type Kind='force'|'human'|'bike'|'bus'|'collection';
type Model={id:string;asset:string;kind:Kind;label:string};
const models:Model[]=[
 ...['renea_officer','fnsh_officer','shqiponja_officer'].map(asset=>({id:asset,asset,kind:'force' as const,label:FORCE_ASSET_BY_ID.get(asset)!.label})),
 ...['tirana-citizen-0','tirana-citizen-1','athlete-female','mixamo-soldier'].map(asset=>({id:asset,asset,kind:'human' as const,label:SHARED_GAME_CAST.find(a=>a.id===asset)!.label})),
 ...BIKE_TYPES.map(a=>({id:a.id,asset:a.id,kind:'bike' as const,label:a.name})),
 {id:'articulated-bus',asset:'tirana-bus',kind:'bus',label:'Tirana articulated bus'},
 ...VEHICLE_COLLECTION.map(a=>({id:a.id,asset:a.id,kind:'collection' as const,label:a.name}))
];

function App(){
 const host=useRef<HTMLDivElement>(null),api=useRef<any>();
 const [id,setId]=useState(models[0].id),[action,setAction]=useState('idle'),[report,setReport]=useState<any>({ready:false});
 useEffect(()=>{
  const height=innerHeight-250,renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.setSize(innerWidth,height);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.current!.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#c9d4dc');scene.add(new T.HemisphereLight(0xffffff,0x657681,2.5));
  const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(-5,8,-6);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#7c9094',roughness:.92}));floor.rotation.x=-Math.PI/2;scene.add(floor);
  const grid=new T.GridHelper(60,60,0x5f747c,0x8ea0a4);grid.position.y=.006;scene.add(grid);
  const camera=new T.PerspectiveCamera(35,innerWidth/height,.02,200);
  let model=models[0],layer:any,held:LivingVisuals|undefined,entity:any,root:T.Object3D|undefined,time=0,revision=0,loading=true,disposed=false,side=false;
  let currentAction='idle',sourceURL='',selection=0;
  const isHuman=()=>model.kind==='force'||model.kind==='human';
  const errors=()=>layer?.errors instanceof Map?Object.fromEntries(layer.errors):layer?.errors||[];
  const weaponReady=()=>!entity.weapon||!!held&&!!root&&held.pose('probe',root as T.Group,entity,time)||!!layer?.held?.holders.get('shared-probe')?.group.visible;
  const rootNow=()=>model.kind==='force'?layer.getRoot('npc-probe'):model.kind==='human'?layer.group.getObjectByName('shared-npc:probe'):
   model.kind==='bus'?layer.group.getObjectByName('probe'):layer.getRoot('probe');
  function update(dt:number){
   const viewer={x:entity.x,z:entity.z};
   if(model.kind==='force')layer.update({cars:[],traffic:[],units:[],npcs:[entity]},viewer,time,dt,false);
   else if(model.kind==='human')layer.update([entity],viewer,time,dt,false);
   else if(model.kind==='bus')layer.update({cars:[entity],traffic:[]},viewer,dt,false);
   else layer.update([entity],viewer,dt,false);
   root=rootNow();
   if(root&&held)held.pose('probe',root as T.Group,entity,time);
  }
  function stats(){
   if(!root)return {id:model.id,ready:false,errors:errors(),revision};
   root.updateMatrixWorld(true);
   let triangles=0,meshes=0,skinned=0,bones=0,finite=true;const textures=new Set<T.Texture>(),warnings:string[]=[];
   root.traverse(o=>{
    finite&&=o.matrixWorld.elements.every(Number.isFinite);
    if(o instanceof T.Bone)bones++;
    if(o.userData.wheelRigWarning)warnings.push(o.userData.wheelRigWarning);
    if(o instanceof T.Mesh){meshes++;if(o instanceof T.SkinnedMesh)skinned++;triangles+=(o.geometry.index?.count||o.geometry.getAttribute('position').count)/3;
     for(const m of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);
    }
   });
   const wheels:any[]=[];
   root.traverse(pivot=>{const rig=pivot.userData.rollingWheel;if(!rig)return;
    const axis=new T.Vector3().fromArray(rig.axis),worldAxis=axis.clone().applyQuaternion(pivot.parent!.getWorldQuaternion(new T.Quaternion()));
    const contact=worldAxis.clone().cross(new T.Vector3(0,-rig.radius,0));
    wheels.push({name:pivot.name,axis:axis.toArray(),quaternion:pivot.quaternion.toArray(),radius:rig.radius,center:pivot.getWorldPosition(new T.Vector3()).toArray(),contactForwardDot:contact.dot(new T.Vector3(0,0,-1)),parts:pivot.children.length});
   });
   const rigs=isHuman()?humanoidBoneGroups(root).map((rig:Map<string,T.Bone>)=>{
    const pelvis=rig.get('hips')||rig.get('root')||rig.get('spine'),head=rig.get('head');
    if(!pelvis||!head)return {names:[...rig.keys()],upright:null};
    const hips=pelvis.getWorldPosition(new T.Vector3()),top=head.getWorldPosition(new T.Vector3()),torso=top.sub(hips).normalize();
    return {upright:torso.y,signature:[...rig.values()].slice(0,100).flatMap(b=>b.quaternion.toArray()),feet:['leftfoot','rightfoot'].map(name=>rig.get(name)?.getWorldPosition(new T.Vector3()).toArray())};
   }):[];
   const bounds=new T.Box3().setFromObject(root,true);
   return {id:model.id,kind:model.kind,action:currentAction,ready:!loading,weaponReady:weaponReady(),revision,sourceURL,triangles,meshes,skinned,bones,textures:textures.size,finite,warnings,size:bounds.getSize(new T.Vector3()).toArray(),boundsMin:bounds.min.toArray(),wheels,rigs,errors:errors(),drawCalls:renderer.info.render.calls,renderTriangles:renderer.info.render.triangles,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
  }
  function render(){
   if(!root)return;
   root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
   const radius=isHuman()?Math.max(size.y*.52,.95):Math.max(size.x,size.z)*.65;
   const distance=radius/Math.sin(T.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect);
   const direction=isHuman()?(side?new T.Vector3(1,.05,-.1):new T.Vector3(-.3,.05,-1)):(side?new T.Vector3(-1,.18,-.04):new T.Vector3(-1,.44,-1));
   camera.position.copy(center).addScaledVector(direction.normalize(),distance);camera.lookAt(center);camera.updateMatrixWorld();
   renderer.render(scene,camera);setReport(stats());
  }
  async function choose(id:string){
   const token=++selection;loading=true;root=undefined;layer?.dispose();held?.dispose();held=undefined;layer=undefined;renderer.renderLists.dispose();
   model=models.find(m=>m.id===id)!;currentAction='idle';time=0;revision++;side=false;setId(id);setAction('idle');setReport({id,ready:false,revision});
   entity={id:'probe',x:0,z:0,y:.06,heading:0,speed:0,steering:0,health:100,kind:'civilian',motion:'walk',anim:'idle',weapon:null,npcDriver:false};
   if(model.kind==='force'){
    layer=new AlbanianForcesVisuals();held=new LivingVisuals(false);scene.add(held.group);entity.kind='police';entity.forceCharacter=model.asset;entity.weapon='ak47VolleyAttack';sourceURL=FORCE_ASSET_BY_ID.get(model.asset)!.url;
   }else if(model.kind==='human'){
    const asset=SHARED_GAME_CAST.find(a=>a.id===model.asset)!;layer=new SharedHumans([asset]);entity.characterId=asset.id;entity.kind=model.asset==='mixamo-soldier'?'soldier':'civilian';sourceURL=asset.url;
   }else if(model.kind==='bike'){
    layer=new BikeVisuals();entity.bikeType=model.asset;sourceURL=BIKE_TYPES.find(a=>a.id===model.asset)!.url;
   }else if(model.kind==='bus'){
    layer=new BusVisuals();entity.model='tirana-bus';entity.passengers=[];sourceURL='/assets/tirana-streets/population/tirana-articulated-bus.glb';
   }else{
    layer=new CollectionVehicleVisuals({maxVisible:1});entity.collectionVehicle=model.asset;sourceURL=VEHICLE_COLLECTION.find(a=>a.id===model.asset)!.url;
   }
   scene.add(layer.group);
   // Yield during actual asynchronous downloads. Continuous software drawing
   // here would measure rasterizer contention, not model-loading correctness.
   const started=performance.now();
   while(!disposed&&token===selection){
    update(0);
    if(root&&weaponReady()){await layer.whenIdle?.();update(0);loading=false;render();return;}
    if(performance.now()-started>90000||Object.keys(errors()).length){setReport({id,ready:false,errors:errors(),timeout:performance.now()-started>90000,revision});return;}
    await new Promise(resolve=>setTimeout(resolve,30));
   }
  }
  async function step(direction:number,action=currentAction){
   if(loading||!root)return;
   currentAction=action;setAction(action);entity.anim=action;entity.weapon=action==='aim'||model.kind==='force'?'ak47VolleyAttack':null;entity.aimPitch=action==='aim'?.12:0;
   const duration=isHuman()?.4:.12,steps=isHuman()?24:12,dt=duration/steps;
   entity.speed=isHuman()?(action==='run'?4.5:action==='walk'?1.4:0):direction;
   for(let i=0;i<steps;i++){time+=dt;entity.z-=entity.speed*dt;update(dt);}
   const started=performance.now();while(!disposed&&!weaponReady()&&performance.now()-started<30000){await new Promise(resolve=>setTimeout(resolve,30));update(0);}
   revision++;render();
  }
  api.current={choose,step,pose:(value:string)=>step(0,value),side:()=>{side=!side;revision++;render();},stats};
  void choose(model.id);
  return()=>{disposed=true;selection++;layer?.dispose();held?.dispose();floor.geometry.dispose();floor.material.dispose();grid.geometry.dispose();(grid.material as T.Material).dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <><header><strong>TIRANA STREETS · ORIGINAL ASSET REVIEW</strong><div className="controls"><select aria-label="Model" value={id} onChange={e=>void api.current.choose(e.target.value)}>{models.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select><select aria-label="Action" value={action} onChange={e=>api.current.pose(e.target.value)}>{['idle','walk','run','aim','fight'].map(a=><option key={a}>{a}</option>)}</select><button onClick={()=>api.current.step(1)}>Forward step</button><button onClick={()=>api.current.step(-1)}>Reverse step</button><button onClick={()=>api.current.side()}>Change view</button></div><p role="status">{report.ready?`${report.triangles?.toLocaleString()} triangles · ${report.textures} textures · ${report.action}`:'Loading original asset…'}</p></header><div ref={host}/><pre data-testid="probe-json" hidden>{JSON.stringify(report)}</pre><footer>390 × 844 · original models · deterministic animation steps</footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
