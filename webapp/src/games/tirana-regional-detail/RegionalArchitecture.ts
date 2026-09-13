import * as T from 'three';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { NEIGHBOURHOOD } from '../tirana-neighbourhood/data.mjs';
import { HERO_IDS } from '../tirana-neighbourhood/assets.mjs';
import { COMPLETED_BUILDING_IDS } from '../tirana-city-completion/buildingRegistry.mjs';
import { AGED_HOUSING } from '../tirana-city-source/housingRegistry.mjs';
import { nearbyIndex } from '../tirana-street-life/streetModels.mjs';
import { facadeEdges } from '../tirana-city-source/sourceCore.mjs';
import { groundHeight } from '../tirana-east/terrainCore.mjs';
import { buildingDetails, regionAt, type Detail } from './layout';
type Kit = typeof import('./kitData').KIT;
const CAPS:Record<string,number>={window:320,balcony:80,ac:96,plinth:96,gutter:96,downpipe:96,tank:24,porch:24,coping:64};
/** Lazy Blender detail, nine draw calls, strict extra triangle/instance budgets. */
export class RegionalArchitecture {
  readonly group=new T.Group();
  private reservoirEdges=NEIGHBOURHOOD.polygonFeatures.filter(p=>p.tags.man_made==='reservoir_covered').flatMap(p=>facadeEdges(p.p));
  private meshes=new Map<string,{mesh:T.InstancedMesh;triangles:number}>();
  private material=new T.MeshStandardMaterial({vertexColors:true,roughness:.78});
  private dummy=new T.Object3D();
  private near:(p:{x:number;z:number},radius:number,count:number)=>{x:number;z:number;b:any}[];
  private pending=false;private dead=false;private last=-Infinity;private retryAt=0;
  private loadKit:()=>Promise<{KIT:Kit}>;
  constructor(buildings:any[]=WORLD.buildings,loadKit=()=>import('./kitData')){
    this.loadKit=loadKit;this.group.name='Tirana:regional-Blender-details';this.group.userData.assetErrors=[];
    const skip=new Set([...HERO_IDS,...COMPLETED_BUILDING_IDS,...AGED_HOUSING.map(b=>b.id)]);
    const sites=buildings.filter(b=>!skip.has(b.id)&&!b.part&&b.h>2&&b.p?.length>=3).map(b=>{
      const x=b.p.reduce((s:number,p:number[])=>s+p[0]/b.p.length,0),z=b.p.reduce((s:number,p:number[])=>s+p[1]/b.p.length,0);
      return {x,z,b,region:regionAt(x,z)};
    }).filter(s=>s.region);
    this.near=nearbyIndex(sites) as typeof this.near;this.group.userData.coverage=Object.fromEntries([...new Set(sites.map(s=>s.region))].map(r=>[r,sites.filter(s=>s.region===r).length]));
  }
  private async load(seconds:number){
    if(this.pending||this.meshes.size||this.dead||seconds<this.retryAt)return;this.pending=true;
    try{
      const {KIT}=await this.loadKit();if(this.dead)return;
      for(const [name,data]of Object.entries(KIT)){
        const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));
        const mesh=new T.InstancedMesh(geometry,this.material,CAPS[name]||24);mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        this.meshes.set(name,{mesh,triangles:data.triangles});this.group.add(mesh);
      }
      this.last=-Infinity;
    }catch(error){this.retryAt=seconds+10;this.group.userData.assetErrors=[String(error)];}finally{this.pending=false;}
  }
  update(seconds:number,viewer?:{x:number;z:number},battery=false){
    if(this.dead||!viewer)return;
    if(seconds<this.last)this.retryAt=0;
    if(seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;
    const radius=battery?105:180,sites=this.near(viewer,radius,battery?12:24);
    const reservoirEdges=this.reservoirEdges.filter(e=>Math.hypot(e.x-viewer.x,e.z-viewer.z)<=radius);
    if(sites.length||reservoirEdges.length)void this.load(seconds);
    if(!this.meshes.size)return;
    this.meshes.forEach(p=>p.mesh.count=0);
    let triangles=0;const budget=battery?24000:48000;
    const place=(d:Detail)=>{
      const p=this.meshes.get(d.model);if(!p||p.mesh.count>=CAPS[d.model]||triangles+p.triangles>budget)return;
      this.dummy.position.set(d.x,d.y,d.z);this.dummy.rotation.set(0,d.yaw,0);this.dummy.scale.set(d.sx,d.sy,1);this.dummy.updateMatrix();p.mesh.setMatrixAt(p.mesh.count++,this.dummy.matrix);triangles+=p.triangles;
    };
    for(const s of sites)for(const d of buildingDetails(s.b))place(d);
    for(const e of reservoirEdges){
      place({model:'coping',x:e.x,y:groundHeight(e.x,e.z),z:e.z,yaw:e.yaw,sx:e.length,sy:1});
    }
    this.meshes.forEach(p=>p.mesh.instanceMatrix.needsUpdate=true);this.group.userData.triangles=triangles;
  }
  retire(){this.dead=true;this.group.visible=false;}
  dispose(){this.retire();this.meshes.forEach(p=>p.mesh.geometry.dispose());this.meshes.clear();this.material.dispose();this.group.clear();this.group.removeFromParent();}
}
