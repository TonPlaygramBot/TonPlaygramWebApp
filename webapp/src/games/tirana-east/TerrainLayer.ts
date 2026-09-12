import * as T from 'three';
import {EAST} from './data.mjs';
import {groundHeight,urbanDistance,elevation,CITY_ELEVATION,TERRAIN_STEP} from './terrainCore.mjs';
const contains=(x:number,z:number,p:number[][])=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const forests=EAST.forests.flatMap((f:any)=>f.outer.map((p:number[][])=>({p,holes:f.holes,leaf:f.leaf,minX:Math.min(...p.map(v=>v[0])),maxX:Math.max(...p.map(v=>v[0])),minZ:Math.min(...p.map(v=>v[1])),maxZ:Math.max(...p.map(v=>v[1]))})));
export function forestAt(x:number,z:number){return forests.find((f:any)=>x>=f.minX&&x<=f.maxX&&z>=f.minZ&&z<=f.maxZ&&contains(x,z,f.p)&&!f.holes.some((h:number[][])=>contains(x,z,h)));}
// Grid road clearances once; canopy placement does not scan 31k segments per tree.
const roadCells=new Map<string,any[]>();
for(const r of EAST.roads)for(let x=Math.floor((Math.min(r.a[0],r.b[0])-10)/80);x<=Math.floor((Math.max(r.a[0],r.b[0])+10)/80);x++)for(let z=Math.floor((Math.min(r.a[1],r.b[1])-10)/80);z<=Math.floor((Math.max(r.a[1],r.b[1])+10)/80);z++){const key=x+':'+z;if(!roadCells.has(key))roadCells.set(key,[]);roadCells.get(key)!.push(r);}
export function clearForestRoad(x:number,z:number){return !(roadCells.get(Math.floor(x/80)+':'+Math.floor(z/80))||[]).some(r=>{const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],t=Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-r.a[0]-dx*t,z-r.a[1]-dz*t)<r.w/2+5;});}
// Cover every playable coordinate, including the north-west and south-west
// extensions. Both borders align with the 60 m collision grid and 300 m horizon.
const FINE=[-5700,-8700,12900,7200];
export function terrainGeometry(bounds:number[],step:number,skipFine=false){
 const [x0,z0,x1,z1]=bounds,nx=Math.round((x1-x0)/step),nz=Math.round((z1-z0)/step),p:number[]=[],col:number[]=[],index:number[]=[];
 const green=new T.Color(0x597340),wood=new T.Color(0x304a2d),rock=new T.Color(0x989383),dry=new T.Color(0x92916a);
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=x0+i*step,z=z0+j*step,y=groundHeight(x,z),slope=Math.hypot(groundHeight(x+30,z)-groundHeight(x-30,z),groundHeight(x,z+30)-groundHeight(x,z-30))/60;
  const f=forestAt(x,z),c=(f?wood:green).clone();c.lerp(dry,Math.min(.6,Math.max(0,elevation(x,z)-1000)/700));c.lerp(rock,Math.min(.9,Math.max(0,slope-.45)));const shade=.94+.06*Math.sin(x*.007+z*.013);c.multiplyScalar(shade);
  p.push(x,y-.045,z);col.push(c.r,c.g,c.b);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=x0+(i+.5)*step,z=z0+(j+.5)*step;
  if(urbanDistance(x,z)===0)continue;
  if(skipFine&&x>=FINE[0]&&x<FINE[2]&&z>=FINE[1]&&z<FINE[3])continue;
  const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;index.push(a,c,b,b,c,d);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(index);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
/** Two terrain draws. 60 m playable mesh samples archived 30 m DEM; 300 m
 * skyline spans Krujë and Krrabë. Dense canopy instances only within 700 m. */
export class TerrainLayer{
 readonly group=new T.Group();private material=new T.MeshStandardMaterial({vertexColors:true,roughness:1});private trees:T.InstancedMesh;private trunks:T.InstancedMesh;private stamp={x:Infinity,z:Infinity};private dead=false;
 constructor(){
  this.group.name='Tirana:DEM-Dajti-Kruje-Krrabe';
  for(const [bounds,step,skip] of [[FINE,TERRAIN_STEP,false],[[-16200,-26100,18600,19500],300,true]] as const){const m=new T.Mesh(terrainGeometry([...bounds],step,skip),this.material);m.receiveShadow=true;this.group.add(m);}
  this.trees=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0x385829,roughness:1}),3200);
  this.trunks=new T.InstancedMesh(new T.CylinderGeometry(.12,.24,1,5),new T.MeshStandardMaterial({color:0x67513a,roughness:1}),3200);
  this.trees.count=this.trunks.count=0;this.trees.frustumCulled=this.trunks.frustumCulled=false;this.group.add(this.trees,this.trunks);
 }
 update(viewer?:{x:number;z:number},battery=false){if(!viewer||this.dead||Math.hypot(viewer.x-this.stamp.x,viewer.z-this.stamp.z)<80)return;this.stamp={...viewer};
  const d=new T.Object3D(),radius=battery?420:700,spacing=24;let count=0;
  for(let x=Math.floor((viewer.x-radius)/spacing)*spacing;x<viewer.x+radius;x+=spacing)for(let z=Math.floor((viewer.z-radius)/spacing)*spacing;z<viewer.z+radius;z+=spacing){
   const px=x+Math.sin(x*.071+z*.092)*7,pz=z+Math.cos(x*.034-z*.083)*7;if(Math.hypot(px-viewer.x,pz-viewer.z)>radius||urbanDistance(px,pz)<10||!forestAt(px,pz)||!clearForestRoad(px,pz))continue;
   if(count>=3200)break;
   const y=groundHeight(px,pz),h=7+3*Math.abs(Math.sin(px*.053+pz*.072));
   // Forest boundaries are sourced; individual tree positions/heights are art.
   d.position.set(px,y+h*.62,pz);d.scale.set(h*.4,h*.55,h*.4);d.rotation.set(0,px*.03,0);d.updateMatrix();this.trees.setMatrixAt(count,d.matrix);
   d.position.y=y+h*.3;d.scale.set(1,h*.6,1);d.updateMatrix();this.trunks.setMatrixAt(count++,d.matrix);
  }
  this.trees.count=this.trunks.count=count;this.trees.instanceMatrix.needsUpdate=this.trunks.instanceMatrix.needsUpdate=true;
 }
 dispose(){this.dead=true;this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(o.material as T.Material).dispose();}});this.group.clear();this.group.removeFromParent();}
}
