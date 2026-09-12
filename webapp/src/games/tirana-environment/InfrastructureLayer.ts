import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {RAILINGS} from '../tiranastreets/shared/landscape.mjs';
import {EnvironmentMaterials} from './EnvironmentMaterials';
import {WATER_PATHS, BED_LEVEL} from './riverGeometry';
import {segmentDistance} from '../tiranastreets/shared/streetLayout.mjs';

type Road = typeof WORLD.roads[number];
type Cell = {x:number;z:number;roads:Road[];object?:T.Group;used:number};
/** All mapped bridge segments are represented. Street simulation still uses its
 * flat datum: no unverified flyover elevation is applied to a driveable lane. */
export class InfrastructureLayer {
  readonly group=new T.Group();
  private surfaces:EnvironmentMaterials;
  private concrete:T.MeshStandardMaterial;
  private paving:T.MeshStandardMaterial;
  private wood:T.MeshStandardMaterial;
  private steel=new T.MeshStandardMaterial({color:0x465352,metalness:.72,roughness:.42});
  private reflectors=new T.MeshStandardMaterial({color:0xd5cbb5,roughness:.35});
  private unit=new T.BoxGeometry(1,1,1);
  private dummy=new T.Object3D();
  private cells:Cell[]=[];
  private rails:T.InstancedMesh;
  private railGeometry:T.BufferGeometry;
  private dead=false;private last=-Infinity;private tick=0;
  private railBins=new Map<string,typeof RAILINGS>();
  constructor(loadAssets=true){
    this.group.name='Tirana:mapped-bridges-and-roadside-ironwork';
    this.surfaces=new EnvironmentMaterials(loadAssets);
    this.concrete=this.surfaces.create('rough_concrete',0xb7b9b0);
    this.paving=this.surfaces.create('concrete_pavement');
    this.wood=this.surfaces.create('weathered_brown_planks');
    const bins=new Map<string,Cell>();
    const roads=WORLD.roads.filter(r=>r.bridge&&!r.tunnel&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>.2);
    for(const road of roads){
      const x=Math.floor((road.a[0]+road.b[0])/480)*240+120,z=Math.floor((road.a[1]+road.b[1])/480)*240+120,key=`${x}:${z}`;
      if(!bins.has(key))bins.set(key,{x,z,roads:[],used:0});bins.get(key)!.roads.push(road);
    }
    this.cells=[...bins.values()];
    this.group.userData={bridgeSegments:roads.length,verticalDatum:'existing road datum; grade separation requires shared physics support'};
    // The same authored rail profile is also shipped as a local glTF asset.
    // Its synchronous fallback keeps every collision railing visible on load errors.
    const positions:number[]=[];
    for(const [x,y,z,w,h,d] of [[0,1.06,0,2.6,.07,.07],[0,.45,0,2.6,.05,.05],[-1.28,.55,0,.075,1.1,.075],[1.28,.55,0,.075,1.1,.075],...Array.from({length:11},(_,i)=>[-1.1+i*.22,.7,0,.025,.68,.025])]){
      const g=this.unit.clone().scale(w,h,d).translate(x,y,z).toNonIndexed();positions.push(...g.getAttribute('position').array);g.dispose();
    }
    this.railGeometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));this.railGeometry.computeVertexNormals();
    this.rails=new T.InstancedMesh(this.railGeometry,this.steel,900);this.rails.count=0;this.rails.frustumCulled=false;this.rails.receiveShadow=true;this.rails.name='Roadside iron railings';this.group.add(this.rails);
    for(const r of RAILINGS){const key=`${Math.floor(r.x/64)}:${Math.floor(r.z/64)}`;if(!this.railBins.has(key))this.railBins.set(key,[]);this.railBins.get(key)!.push(r);}
    if(loadAssets)new GLTFLoader().load('/assets/tirana-streets/environment/roadside-rail.glb',g=>{
      const mesh=g.scene.getObjectByName('roadside-rail') as T.Mesh|undefined;
      if(!this.dead&&mesh?.isMesh){this.railGeometry.dispose();this.railGeometry=mesh.geometry;this.rails.geometry=mesh.geometry;}
      g.scene.traverse(o=>{if(o instanceof T.Mesh){if(o.geometry!==this.railGeometry)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    },undefined,()=>{if(!this.dead)this.group.userData.railAssetError=true;});
  }
  private build(cell:Cell){
    const root=new T.Group(),batches=new Map<T.Material,T.Matrix4[]>();
    const box=(material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,yaw:number)=>{
      this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,yaw,0);this.dummy.scale.set(w,h,d);this.dummy.updateMatrix();
      if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(this.dummy.matrix.clone());
    };
    for(const r of cell.roads){
      const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),nx=dz/length,nz=-dx/length;
      const x=(r.a[0]+r.b[0])/2,z=(r.a[1]+r.b[1])/2,sidewalk=r.walk?.12:1.25,half=r.w/2+sidewalk;
      box(this.concrete,x,-.16,z,half*2,.6,length+.06,yaw);
      if(r.walk)box((r as any).tags?.surface==='wood'?this.wood:this.paving,x,.155,z,r.w,.03,length,yaw);
      for(const side of [-1,1]){
        const offset=side*half;
        if(!r.walk)box(this.paving,x+nx*side*(r.w/2+.64),.19,z+nz*side*(r.w/2+.64),1.24,.1,length,yaw);
        for(const height of [.67,1.32])box(this.steel,x+nx*offset,height,z+nz*offset,.065,.065,length,yaw);
        const count=Math.max(1,Math.ceil(length/1.6));
        for(let i=0;i<=count;i++){
          const px=r.a[0]+dx*i/count+nx*offset,pz=r.a[1]+dz*i/count+nz*offset;
          box(this.steel,px,.79,pz,.075,1.08,.075,yaw);
          if(i%3===0)box(this.reflectors,px,1.05,pz,.085,.15,.045,yaw);
        }
      }
      const river=WATER_PATHS.find(p=>p.line.slice(1).some((b,i)=>segmentDistance(x,z,p.line[i],b)<p.width/2+8));
      if(river){
        const base=river.lana?BED_LEVEL:-1.55,height=-.46-base;
        for(const t of [.035,.965])box(this.concrete,r.a[0]+dx*t,base+height/2,r.a[1]+dz*t,half*2,height,.7,yaw);
        for(const side of [-1,1])box(this.concrete,x+nx*side*half*.65,-.59,z+nz*side*half*.65,.42,.3,length,yaw);
      }
    }
    for(const [material,matrices] of batches){const mesh=new T.InstancedMesh(this.unit,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.castShadow=true;root.add(mesh);}
    return root;
  }
  update(viewer:{x:number;z:number},seconds:number,battery=false){
    if(this.dead||seconds>=this.last&&seconds-this.last<.25)return;this.last=seconds;this.tick++;
    const distance=(c:Cell)=>Math.hypot(c.x-viewer.x,c.z-viewer.z);
    const selected=this.cells.filter(c=>distance(c)<(battery?650:1100)).sort((a,b)=>distance(a)-distance(b)).slice(0,battery?18:36),keep=new Set(selected);let budget=3;
    for(const c of selected){if(!c.object&&budget-->0){c.object=this.build(c);this.group.add(c.object);}c.used=this.tick;}
    for(const c of this.cells)if(c.object){c.object.visible=keep.has(c);c.object.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=!battery&&distance(c)<200;});}
    const cached=this.cells.filter(c=>c.object).sort((a,b)=>a.used-b.used);while(cached.length>48){const c=cached.shift()!;this.release(c);}
    const near:typeof RAILINGS=[];const radius=battery?80:160;
    for(let x=Math.floor((viewer.x-radius)/64);x<=Math.floor((viewer.x+radius)/64);x++)for(let z=Math.floor((viewer.z-radius)/64);z<=Math.floor((viewer.z+radius)/64);z++)for(const r of this.railBins.get(`${x}:${z}`)||[])if(Math.hypot(r.x-viewer.x,r.z-viewer.z)<radius)near.push(r);
    near.sort((a,b)=>Math.hypot(a.x-viewer.x,a.z-viewer.z)-Math.hypot(b.x-viewer.x,b.z-viewer.z));
    this.rails.count=0;for(const r of near.slice(0,battery?320:900)){
      this.dummy.position.set(r.x,.03,r.z);this.dummy.rotation.set(0,r.yaw-Math.PI/2,0);this.dummy.scale.set(r.length/2.6,1,1);this.dummy.updateMatrix();this.rails.setMatrixAt(this.rails.count++,this.dummy.matrix);
    }
    this.rails.instanceMatrix.needsUpdate=true;this.rails.castShadow=!battery;
  }
  private release(cell:Cell){cell.object?.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});cell.object?.removeFromParent();cell.object?.clear();cell.object=undefined;}
  dispose(){if(this.dead)return;this.dead=true;this.cells.forEach(c=>this.release(c));this.rails.dispose();this.group.clear();this.group.removeFromParent();this.railGeometry.dispose();this.unit.dispose();this.steel.dispose();this.reflectors.dispose();this.surfaces.dispose();this.cells=[];this.railBins.clear();}
}
