import {CITY_RADIUS, CITY_CACHE, runCityWork} from '../tiranastreets/renderSettings';
import {appendGroundTriangle,drapeGeometry} from '../tirana-east/drapeGeometry';
import {urbanDistance} from '../tirana-east/terrainCore.mjs';
import * as T from 'three';
import {corridorRoadMaterialId} from './streetCorridorMaterial.mjs';
import {CellWorkQueue} from './cellWorkQueue.mjs';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {cutChannels,surfaceGeometry} from '../tirana-environment/riverGeometry';
import {roadRing,splitRoadCells,clipRingToBounds,type Road} from '../tirana-environment/roadSurfaceCore.mjs';
import {cutRoads,prepareRoadSurfaceIndex} from '../tirana-environment/roadSurfaceRegistry';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
type Cell={key:string;x:number;z:number;roads:Road[];bounds:number[];root?:T.Group;paving?:T.Mesh;used?:number};
type District={key:string;roads:Road[];bounds:number[];root?:T.Group;used:number};
const ASPHALT_REPEAT_METRES=5, PAVEMENT_REPEAT_METRES=3;
const SURFACE_RADIUS=2200, RETAIN_RADIUS=2700, DISTRICT_CACHE=64;
const SURFACE_FLOATS=3072*3, TRIANGLE_CHUNK_FLOATS=64*9;
const distanceToBounds=(viewer:{x:number;z:number},b:number[])=>Math.hypot(Math.max(b[0]-viewer.x,0,viewer.x-b[2]),Math.max(b[1]-viewer.z,0,viewer.z-b[3]));

/** Break up repeated micro textures at street/block scale. Coordinates come
 * from the existing surface geometry (metres), not UVs or camera position, so
 * adjacent cells and district reloads produce exactly the same surface tone.
 * No added texture, draw call, geometry or CPU-side render updates. */
function applyStreetWeathering(material:T.MeshStandardMaterial,amount:number,pavement=false){
 material.onBeforeCompile=shader=>{
  shader.uniforms.urbanWear={value:amount};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec2 vUrbanSurface;\nattribute vec2 corridorMaterial;\nvarying vec2 vCorridorMaterial;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvUrbanSurface=position.xz;vCorridorMaterial=corridorMaterial;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',`#include <common>
    varying vec2 vUrbanSurface;
    uniform float urbanWear;
    varying vec2 vCorridorMaterial;
    ${pavement?`
    vec2 stoneBond(vec2 metres,vec2 metresAA,vec2 tile,float stagger){
     vec2 uv=metres/tile;
     vec2 aa=clamp(metresAA/tile,.001,.45);
     uv.x+=stagger*mod(floor(uv.y),2.0);
     vec2 line=1.0-smoothstep(vec2(.012),vec2(.012)+aa,abs(fract(uv+.5)-.5));
     float variation=fract(dot(floor(uv),vec2(.2187,.3413)));
     float fade=1.0-smoothstep(.09,.3,max(aa.x,aa.y));
     return vec2(max(line.x,line.y),variation-.5)*fade;
    }`:''}
    float urbanMottle(vec2 p);
    vec3 urbanCorridorTone(vec2 metres){
     ${pavement?`
     // Contrast and bonding are authored art; the existing pavement normal
     // and roughness maps still set the fine relief.
     vec2 metresAA=fwidth(metres);
     vec3 palette; vec2 tile; float stagger;
     if(vCorridorMaterial.x<.5)return vec3(1.0);
     if(vCorridorMaterial.x<1.5){palette=vec3(1.72,1.49,1.20);tile=vec2(.94,.65);stagger=.5;}
     else if(vCorridorMaterial.x<2.5){palette=vec3(.70,.93,1.28);tile=vec2(.72,.48);stagger=.0;}
     else if(vCorridorMaterial.x<3.5){palette=vec3(1.33,1.26,1.09);tile=vec2(.48,.28);stagger=.5;}
     else if(vCorridorMaterial.x<4.5){palette=vec3(1.34,1.30,1.25);tile=vec2(.36,.36);stagger=.0;}
     else if(vCorridorMaterial.x<5.5){palette=vec3(1.32,1.05,.76);tile=vec2(.57,.46);stagger=.0;}
     else if(vCorridorMaterial.x<6.5){palette=vec3(1.59,1.27,1.02);tile=vec2(.76,.44);stagger=.5;}
     else if(vCorridorMaterial.x<7.5){palette=vec3(1.24,1.43,1.62);tile=vec2(1.09,.76);stagger=.0;}
     else if(vCorridorMaterial.x<8.5){palette=vec3(1.20,1.09,.99);tile=vec2(.29,.19);stagger=.5;}
     else if(vCorridorMaterial.x<9.5){palette=vec3(1.19,1.15,1.10);tile=vec2(.27,.19);stagger=.5;}
     else if(vCorridorMaterial.x<10.5){palette=vec3(1.28,1.26,1.18);tile=vec2(.43,.23);stagger=.5;}
     else if(vCorridorMaterial.x<13.5){palette=vec3(1.46,1.41,1.32);tile=vec2(.52,.32);stagger=.0;}
     else if(vCorridorMaterial.x<14.5){palette=vec3(1.39,1.29,1.14);tile=vec2(.31,.31);stagger=.0;}
     else if(vCorridorMaterial.x<15.5){palette=vec3(1.36,1.30,1.23);tile=vec2(.46,.30);stagger=.5;}
     else if(vCorridorMaterial.x<16.5){palette=vec3(1.25,1.19,1.09);tile=vec2(.39,.27);stagger=.5;}
     else return vec3(1.26,1.12,.93);
     vec2 bond=stoneBond(metres,metresAA,tile,stagger);
     // Durrësit's light/dark paver pattern is visible at a glance; fade it
     // before a single block falls below pixel size to avoid shimmer in Racing.
     float alternating=0.0;
     if(vCorridorMaterial.x>3.5&&vCorridorMaterial.x<4.5){
      vec2 block=floor(metres/(tile*2.0));
      alternating=(mod(block.x+block.y,2.0)-.5)*.30*
       (1.0-smoothstep(.14,.46,max(metresAA.x,metresAA.y)/tile.x));
     }
     // Original concentric paver motif inspired by the photographed retail
     // sidewalk. Never project it onto asphalt, buildings or grass.
     float medallion=0.0;
     if(vCorridorMaterial.x>13.5&&vCorridorMaterial.x<14.5){
      float radius=length(fract(metres*.59)-.5);
      float aa=clamp(max(metresAA.x,metresAA.y)*.59,.005,.4);
      float outer=1.0-smoothstep(.034,.034+aa,abs(radius-.31));
      float inner=1.0-smoothstep(.020,.020+aa,abs(radius-.225));
      medallion=(outer*.21+inner*.14)*(1.0-smoothstep(.08,.23,aa));
     }
     return palette*(1.0-.34*bond.x+.30*bond.y+alternating-medallion);`:`
     // Signed across-road coordinate is interpolated from the source ring.
     // Soft darker shoulders are surface weathering, not paint or lanes.
     if(vCorridorMaterial.x<.5)return vec3(1.0);
     float shoulder=smoothstep(.73,1.0,abs((vCorridorMaterial.y-127.0)/127.0));
     vec3 tone;
     if(vCorridorMaterial.x<1.5)tone=vec3(1.065,1.05,1.025);
     else if(vCorridorMaterial.x<2.5)tone=vec3(.950,.975,1.01);
     else if(vCorridorMaterial.x<3.5)tone=vec3(.96,.975,.99);
     else if(vCorridorMaterial.x<4.5)tone=vec3(1.025,1.035,1.07);
     else if(vCorridorMaterial.x<5.5)tone=vec3(1.065,1.024,.985);
     else if(vCorridorMaterial.x<6.5)tone=vec3(1.02,1.016,1.004);
     else if(vCorridorMaterial.x<7.5)tone=vec3(.965,.997,1.04);
     else if(vCorridorMaterial.x<8.5)tone=vec3(.975,.962,.941);
     else if(vCorridorMaterial.x<9.5)tone=vec3(.935,.948,.967);
     else if(vCorridorMaterial.x<10.5)tone=vec3(.985,1.002,1.022);
     else if(vCorridorMaterial.x<11.5)tone=vec3(1.024,1.019,1.009);
     else if(vCorridorMaterial.x<12.5)tone=vec3(1.40,1.34,1.23);
     else if(vCorridorMaterial.x<13.5)tone=vec3(1.07,1.059,1.040);
     else if(vCorridorMaterial.x<14.5)tone=vec3(.91,.94,.95);
     else if(vCorridorMaterial.x<15.5)tone=vec3(.969,.975,.98);
     else if(vCorridorMaterial.x<16.5)tone=vec3(.932,.962,.977);
     else {
      // Compacted Disha approach: pale mineral aggregate and softer dusty
      // edges, without lane paint or a new strip of elevated geometry.
      float fine=urbanMottle(metres*2.7);
      return vec3(1.58,1.37,1.105)*(1.0+.065*shoulder+.18*(fine-.5));
     }
     return tone*(1.0-.18*shoulder);`}
    }
    // Three staggered triangular waves. No extra texture taps or trig.
    float urbanMottle(vec2 p) {
     vec3 v=abs(fract(vec3(dot(p,vec2(.034,.011)),
                          dot(p,vec2(-.014,.083)),
                          dot(p,vec2(.132,-.061)))+vec3(.31,.47,.73))*2.0-1.0);
     v=v*v*(3.0-2.0*v);
     return dot(v,vec3(.54,.30,.16));
    }`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    float weathering=urbanMottle(vUrbanSurface);
    diffuseColor.rgb*=(1.0+urbanWear*(weathering-.60))*urbanCorridorTone(vUrbanSurface);`);
 };
 material.customProgramCacheKey=()=> `tirana-shared-street-weathering-v7-${pavement?'pavement':'asphalt'}`;
}

/** One surface owner for the complete city. Cheap asphalt reaches the horizon;
 * clipped pavements stream nearby within a CPU time budget. */
export class UrbanRoadCells {
 readonly group=new T.Group();
 private materials:EnvironmentMaterials;
 private cells:Map<string,Cell>;
 private visible=new Set<Cell>();private cache=new Set<Cell>();
 private districts:District[]=[];private districtJobs=new CellWorkQueue();
 private districtCache=new Set<District>();private selectedDistricts=new Set<District>();
 private tick=0;private last=-Infinity;private dead=false;
 private viewer={x:Infinity,z:Infinity};private battery?:boolean;
 private jobs=new CellWorkQueue();
 private asphalt=new T.MeshStandardMaterial({color:0x777b78,roughness:.94});
 private pavement=new T.MeshStandardMaterial({color:0xb5afa3,roughness:.92});
 private textures=new Set<T.Texture>();
 constructor(loadTextures=true){
  this.materials=new EnvironmentMaterials(loadTextures);this.materials.apply(this.pavement,'concrete_pavement');this.asphalt.userData.environmentSurface=true;
  applyStreetWeathering(this.asphalt,.31);applyStreetWeathering(this.pavement,.22,true);
  this.cells=splitRoadCells(WORLD.roads);this.group.name='Tirana:streamed-road-cells';
  // Index source records only. Tessellating every road in the region here used
  // hundreds of MB before the loading UI could paint on a phone.
  const districts=new Map<string,District>();
  for(const r of WORLD.roads){
   if(r.tunnel||!Number.isFinite(r.w)||r.w<=0)continue;
   const key=`${Math.floor((r.a[0]+r.b[0])/1920)}:${Math.floor((r.a[1]+r.b[1])/1920)}`;
   if(!districts.has(key))districts.set(key,{key,roads:[],used:0,bounds:[Infinity,Infinity,-Infinity,-Infinity]});
   const d=districts.get(key)!;
   const margin=r.w/2+.06;d.roads.push(r);
   d.bounds[0]=Math.min(d.bounds[0],r.a[0]-margin,r.b[0]-margin);d.bounds[1]=Math.min(d.bounds[1],r.a[1]-margin,r.b[1]-margin);
   d.bounds[2]=Math.max(d.bounds[2],r.a[0]+margin,r.b[0]+margin);d.bounds[3]=Math.max(d.bounds[3],r.a[1]+margin,r.b[1]+margin);
  }
  this.districts=[...districts.values()];
  this.group.userData={ready:false,pendingDistricts:0,loadedDistricts:0,radius:SURFACE_RADIUS};
  if(loadTextures)for(const [file,key] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']] as const){
   new T.TextureLoader().load('/assets/tirana-streets/asphalt-'+file+'.jpg',t=>{
    if(this.dead){t.dispose();return;}t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(key==='map')t.colorSpace=T.SRGBColorSpace;
    this.textures.add(t);this.asphalt[key]=t;this.asphalt.normalScale.set(.25,.25);this.asphalt.needsUpdate=true;
  });
  }
 }
 private surfaceMesh(positions:number[],walk:boolean,styles:number[]){
  const g=new T.BufferGeometry(),uv=new Float32Array(positions.length/3*2);
  const metres=walk?PAVEMENT_REPEAT_METRES:ASPHALT_REPEAT_METRES;
  for(let i=0;i<positions.length/3;i++){uv[i*2]=positions[i*3]/metres;uv[i*2+1]=positions[i*3+2]/metres;}
  g.setAttribute('corridorMaterial',new T.Uint8BufferAttribute(styles,2));
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();
  const mesh=new T.Mesh(g,walk?this.pavement:this.asphalt);mesh.receiveShadow=true;return mesh;
 }
 private *appendSurface(root:T.Group,positions:number[],walk:boolean,a:number[],b:number[],c:number[],offset:number,styles:number[],style:number,lateral?:{x:number;z:number;bias:number}):Generator<void,void>{
  const pending=[{a,b,c,depth:0}];
  while(pending.length){
   const triangle=pending.pop()!,{a,b,c,depth}=triangle;
   // Traverse the first three subdivision levels ourselves, in the same
   // depth-first order as appendGroundTriangle. Its remaining depth is at most
   // three, so even one long hillside road releases the main thread regularly.
   if(depth<3&&[a,b,c].some(p=>urbanDistance(p[0],p[1])>0)&&Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]))>12){
    const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];
    pending.push({a:ab,b:bc,c:ca,depth:depth+1},{a:ca,b:bc,c,depth:depth+1},{a:ab,b,c:bc,depth:depth+1},{a,b:ab,c:ca,depth:depth+1});
    continue;
   }
   if(positions.length>SURFACE_FLOATS-TRIANGLE_CHUNK_FLOATS){root.add(this.surfaceMesh(positions,walk,styles));positions.length=0;styles.length=0;yield;}
   const before=positions.length/3;appendGroundTriangle(positions,a,b,c,offset,depth);
   for(let j=before;j<positions.length/3;j++){
    const edge=lateral?Math.max(-1,Math.min(1,positions[j*3]*lateral.x+positions[j*3+2]*lateral.z+lateral.bias)):0;
    styles.push(style,Math.round(127+edge*127));
   }
   if(depth>0)yield;
  }
 }
 private *buildDistrict(d:District):Generator<void,void>{
  const root=new T.Group();root.name=`Complete road surfaces ${d.key}`;
  try{
   for(let start=0;start<d.roads.length;start+=256){
    const drive:number[]=[],walk:number[]=[],driveStyles:number[]=[],walkStyles:number[]=[];
    for(let index=start;index<Math.min(start+256,d.roads.length);index++){
     const r=d.roads[index],ring=roadRing(r),style=corridorRoadMaterialId(r);
     if(ring){const positions=r.walk?walk:drive,y=r.bridge?.16:r.walk?.071:.09;
      let lateral:{x:number;z:number;bias:number}|undefined;
      if(style&&!r.walk&&!r.bridge){
       const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],scale=2/(r.w*Math.hypot(dx,dz));
       const x=-dz*scale,z=dx*scale;lateral={x,z,bias:-x*r.a[0]-z*r.a[1]};
      }
      for(let i=1;i<ring.length-1;i++){
       const [a,b,c]=[ring[0],ring[i],ring[i+1]],face=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0?[a,c,b]:[a,b,c];
       yield* this.appendSurface(root,positions,!!r.walk,face[0],face[1],face[2],y,r.walk?walkStyles:driveStyles,style,lateral);
      }
     }
     if((index-start)%8===7)yield;
    }
    if(drive.length){root.add(this.surfaceMesh(drive,false,driveStyles));yield;}if(walk.length){root.add(this.surfaceMesh(walk,true,walkStyles));yield;}
   }
   d.root=root;root.visible=this.selectedDistricts.has(d);this.group.add(root);this.districtCache.add(d);this.trimDistrictCache();
  }finally{if(d.root!==root)this.releaseDistrictRoot(root);}
 }
 private selectDistricts(viewer:{x:number;z:number}){
  const selected=this.districts.filter(d=>distanceToBounds(viewer,d.bounds)<=SURFACE_RADIUS)
   .sort((a,b)=>distanceToBounds(viewer,a.bounds)-distanceToBounds(viewer,b.bounds));
  this.selectedDistricts=new Set(selected);for(const d of selected)d.used=this.tick;
  this.districtJobs.sync(selected.filter(d=>!d.root).map(d=>({key:d.key,create:()=>this.buildDistrict(d)})));
  for(const d of this.districtCache){d.root!.visible=this.selectedDistricts.has(d);if(!d.root!.visible&&distanceToBounds(viewer,d.bounds)>RETAIN_RADIUS)this.releaseDistrict(d);}
  this.trimDistrictCache();
 }
 private trimDistrictCache(){
  const stale=[...this.districtCache].filter(d=>!this.selectedDistricts.has(d)).sort((a,b)=>a.used-b.used);
  while(this.districtCache.size>DISTRICT_CACHE&&stale.length)this.releaseDistrict(stale.shift()!);
 }
 private releaseDistrictRoot(root:T.Group){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});root.clear();root.removeFromParent();}
 private releaseDistrict(d:District){if(d.root)this.releaseDistrictRoot(d.root);d.root=undefined;this.districtCache.delete(d);}
 private *buildRoad(cell:Cell):Generator<void,void>{
  const root=new T.Group();root.name=`Pavement detail ${cell.key}`;
  cell.root=root;this.group.add(root);this.cache.add(cell);root.visible=this.visible.has(cell);
 }
 private clip(ring:number[][],cell:Cell){
  const clipped=clipRingToBounds(ring,cell.bounds);return clipped.length>=3?[[clipped]]:[];
 }
 private *buildPaving(cell:Cell):Generator<void,void>{
  const parts:T.BufferGeometry[]=[];
  try{
   prepareRoadSurfaceIndex();
   for(const r of cell.roads){
    // InfrastructureLayer owns elevated bridge sidewalks and pedestrian decks.
    if(!r.bridge){const ring=roadRing(r,r.w+(r.walk?0:3.8));if(ring)
     for(const polygon of this.clip(ring,cell))for(const dry of cutChannels(polygon[0],polygon.slice(1)))
      for(const cleared of cutRoads(dry)){
       const geometry=drapeGeometry(surfaceGeometry(cleared,.075,PAVEMENT_REPEAT_METRES),PAVEMENT_REPEAT_METRES);
       const styles=new Uint8Array(geometry.getAttribute('position').count*2),style=corridorRoadMaterialId(r,true);
       for(let v=0;v<styles.length;v+=2){styles[v]=style;styles[v+1]=127;}
       geometry.setAttribute('corridorMaterial',new T.BufferAttribute(styles,2));parts.push(geometry);
      }
    }
    yield;
   }
   if(cell.root){
    const geo=parts.length?mergeGeometries(parts,false):new T.BufferGeometry();
    if(geo){cell.paving=new T.Mesh(geo,this.pavement);cell.paving.name='Pavement outside carriageways';cell.paving.receiveShadow=true;cell.root.add(cell.paving);}
   }
  }finally{parts.forEach(g=>g.dispose());}
 }
 update(seconds:number,viewer:{x:number;z:number},battery=false){
  if(this.dead)return;
  if(this.battery!==battery||seconds<this.last||Math.hypot(viewer.x-this.viewer.x,viewer.z-this.viewer.z)>45||this.last===-Infinity){
   this.last=seconds;this.viewer={x:viewer.x,z:viewer.z};this.battery=battery;this.tick++;
   this.selectDistricts(viewer);
   const tasks:{key:string;create:()=>Generator<void,void>}[]=[];
   const radius=battery?CITY_RADIUS.battery:CITY_RADIUS.high,selected:Cell[]=[];
   for(let x=Math.floor((viewer.x-radius)/240);x<=Math.floor((viewer.x+radius)/240);x++)for(let z=Math.floor((viewer.z-radius)/240);z<=Math.floor((viewer.z+radius)/240);z++){
    const c=this.cells.get(`${x}:${z}`);if(c&&Math.hypot(c.x-viewer.x,c.z-viewer.z)<radius+170)selected.push(c);
   }
   const distance=(c:Cell)=>(c.x-viewer.x)**2+(c.z-viewer.z)**2;
   selected.sort((a,b)=>distance(a)-distance(b));this.visible=new Set(selected);
   // All roads first; costly close detail never delays the wider road network.
   for(const c of selected){c.used=this.tick;if(!c.root&&distance(c)<(battery?300:520)**2)this.buildRoad(c).next();}
   for(const c of selected)if(c.root&&!c.paving&&distance(c)<(battery?300:520)**2)tasks.push({key:c.key+":paving",create:()=>this.buildPaving(c)});
   this.jobs.sync(tasks);
   for(const c of this.cache){c.root!.visible=this.visible.has(c);if(c.paving)c.paving.visible=distance(c)<(battery?380:650)**2;}
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length)this.release(stale.shift()!);
  }
  runCityWork(this.districtJobs.length?this.districtJobs:this.jobs, battery);
  if(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)){
   const stale=[...this.cache].filter(c=>!this.visible.has(c)).sort((a,b)=>(a.used||0)-(b.used||0));
   while(this.cache.size>(battery?CITY_CACHE.battery:CITY_CACHE.high)&&stale.length)this.release(stale.shift()!);
  }
  const loadedDistricts=[...this.selectedDistricts].filter(d=>d.root).length;
  this.group.userData={cachedCells:this.cache.size,pendingJobs:this.jobs.length,
   cachedDistricts:this.districtCache.size,loadedDistricts,pendingDistricts:this.selectedDistricts.size-loadedDistricts,
   ready:loadedDistricts===this.selectedDistricts.size,radius:SURFACE_RADIUS};
 }
 private release(c:Cell){c.root?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});c.root?.removeFromParent();c.root=undefined;c.paving=undefined;this.cache.delete(c);}
 dispose(){if(this.dead)return;this.dead=true;this.districtJobs.dispose();this.jobs.dispose();this.materials.dispose();for(const d of this.districtCache)this.releaseDistrict(d);this.districts=[];this.selectedDistricts.clear();for(const c of this.cache)this.release(c);this.textures.forEach(t=>t.dispose());this.asphalt.dispose();this.pavement.dispose();this.group.clear();this.group.removeFromParent();}
}
