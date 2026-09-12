import * as T from 'three';
import {EnvironmentMaterials} from '../tirana-environment/EnvironmentMaterials';
import {WORLD} from '../tiranastreets/shared/world.mjs';
type Bucket={x:number;z:number;roads:any[];mesh?:T.Group;used:number};
/** Source road surfaces stream alongside buildings. Direct buffer construction
 * avoids allocating a PlaneGeometry per segment for the entire city at startup.
 */
export class UrbanRoadCells {
 readonly group=new T.Group();
 private materials:EnvironmentMaterials;
 private cells:Bucket[]=[];private tick=0;private last=-Infinity;private dead=false;
 private asphalt=new T.MeshStandardMaterial({color:0x777b78,roughness:.94});
 private pavement=new T.MeshStandardMaterial({color:0xb5afa3,roughness:.92});
 private textures=new Set<T.Texture>();
 constructor(loadTextures=true){
  this.materials=new EnvironmentMaterials(loadTextures);this.materials.apply(this.pavement,'concrete_pavement');this.asphalt.userData.environmentSurface=true;
  const cells=new Map<string,Bucket>();this.group.name='Tirana:streamed-road-cells';
  for(const r of WORLD.roads){
   if(!r.neighbourhood||r.tunnel)continue;
   const count=Math.max(1,Math.ceil(Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])/160));
   for(let i=0;i<count;i++){
    const a=r.a.map((n:number,j:number)=>n+(r.b[j]-n)*i/count),b=r.a.map((n:number,j:number)=>n+(r.b[j]-n)*(i+1)/count);
    const x=Math.floor((a[0]+b[0])/480)*240+120,z=Math.floor((a[1]+b[1])/480)*240+120,key=`${x}:${z}`;
    if(!cells.has(key))cells.set(key,{x,z,roads:[],used:0});cells.get(key)!.roads.push({a,b,w:r.w,walk:r.walk,bridge:r.bridge});
   }
  }
  this.cells=[...cells.values()];
  if(loadTextures)for(const [file,key] of [['diff','map'],['nor_gl','normalMap'],['rough','roughnessMap']] as const){
   new T.TextureLoader().load('/assets/tirana-streets/asphalt-'+file+'.jpg',t=>{
    if(this.dead){t.dispose();return;}t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;if(key==='map')t.colorSpace=T.SRGBColorSpace;
    this.textures.add(t);this.asphalt[key]=t;this.asphalt.normalScale.set(.25,.25);this.asphalt.needsUpdate=true;
   });
  }
 }
 private build(cell:Bucket){
  const root=new T.Group(),road:number[]=[],walk:number[]=[];
  const strip=(out:number[],a:number[],b:number[],w:number,y:number)=>{
   const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(l<.01)return;
   const nx=-dz/l*w/2,nz=dx/l*w/2;
   const corners=[[a[0]+nx,y,a[1]+nz],[b[0]+nx,y,b[1]+nz],[b[0]-nx,y,b[1]-nz],[a[0]-nx,y,a[1]-nz]];
   for(const i of [0,1,2,0,2,3])out.push(...corners[i]);
  };
  for(const r of cell.roads){
   if(!r.walk&&!r.bridge)strip(walk,r.a,r.b,r.w+3.8,.06);
   strip(r.walk?walk:road,r.a,r.b,r.w,r.bridge?.16:.09);
  }
  for(const [positions,material] of [[road,this.asphalt],[walk,this.pavement]] as const){
   if(!positions.length)continue;const geo=new T.BufferGeometry(),normals=new Float32Array(positions.length),uv=new Float32Array(positions.length/3*2);
   for(let i=0;i<positions.length/3;i++){normals[i*3+1]=1;uv[i*2]=positions[i*3]/5;uv[i*2+1]=positions[i*3+2]/5;}
   geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.BufferAttribute(normals,3));geo.setAttribute('uv',new T.BufferAttribute(uv,2));
   const mesh=new T.Mesh(geo,material);mesh.receiveShadow=true;root.add(mesh);
  }
  return root;
 }
 update(seconds:number,viewer:{x:number;z:number},battery=false){
  if(this.dead||seconds-this.last<.2)return;this.last=seconds;this.tick++;
  const distance=(c:Bucket)=>Math.hypot(c.x-viewer.x,c.z-viewer.z);
  const selected=this.cells.filter(c=>distance(c)<(battery?850:1200)).sort((a,b)=>distance(a)-distance(b)).slice(0,battery?32:64),keep=new Set(selected);
  let budget=4;
  for(const c of selected){if(!c.mesh&&budget-->0){c.mesh=this.build(c);this.group.add(c.mesh);}c.used=this.tick;}
  for(const c of this.cells)if(c.mesh)c.mesh.visible=keep.has(c);
  const cached=this.cells.filter(c=>c.mesh).sort((a,b)=>a.used-b.used);
  while(cached.length>(battery?40:72)){const c=cached.shift()!;this.release(c);}
 }
 private release(c:Bucket){c.mesh?.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});c.mesh?.removeFromParent();c.mesh=undefined;}
 dispose(){this.dead=true;this.materials.dispose();this.cells.forEach(c=>this.release(c));this.textures.forEach(t=>t.dispose());this.asphalt.dispose();this.pavement.dispose();this.group.removeFromParent();}
}
