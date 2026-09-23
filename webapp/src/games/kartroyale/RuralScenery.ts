import * as T from 'three';
import {RURAL_WORLD} from './ruralWorldData.mjs';
import {groundHeight} from '../tirana-east/terrainCore.mjs';
import {pointInUrbanBounds} from '../tiranastreets/shared/urbanBounds.mjs';
import {MappedBuildingCells} from '../tirana-neighbourhood/MappedBuildingCells';

const geometry=(positions:number[])=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 g.computeVertexNormals();g.computeBoundingSphere();return g;
};
const quad=(out:number[],corners:number[][],height:number)=>{
 for(const i of [0,2,1,2,3,1]){const [x,z]=corners[i];out.push(x,groundHeight(x,z)+height,z);}
};
/** The same archived roads, buildings and lake polygons used by Racing physics.
 * Instantiated near a rural circuit only; no full regional archive at runtime. */
export class RuralScenery {
 readonly group=new T.Group();
 private wall=new T.MeshStandardMaterial({vertexColors:true,roughness:.9});
 private glass=new T.MeshStandardMaterial({color:0x567079,roughness:.4,metalness:.2});
 private buildings:MappedBuildingCells;
 constructor(){
  this.group.name='Racing:retained-rural-corridors';
  const add=(positions:number[],color:number)=>{
   if(!positions.length)return;
   const mesh=new T.Mesh(geometry(positions),new T.MeshStandardMaterial({color,roughness:.94}));
   mesh.receiveShadow=true;this.group.add(mesh);
  };
  for(const region of RURAL_WORLD.regions){
   const b=region.bounds.map((n,i)=>(i<2?Math.floor:Math.ceil)(n/60)*60),positions:number[]=[];
   for(let x=b[0];x<b[2];x+=60)for(let z=b[1];z<b[3];z+=60){
    if(pointInUrbanBounds([x+30,z+30]))continue;
    quad(positions,[[x,z],[x+60,z],[x,z+60],[x+60,z+60]],-.045);
   }
   add(positions,0x597340);
  }
  const asphalt:number[]=[],paths:number[]=[];
  for(const road of RURAL_WORLD.roads){
   if(road.tunnel||road.highway==='steps')continue;
   const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);
   if(length<.001)continue;
   const nx=-dz/length*road.w/2,nz=dx/length*road.w/2,steps=Math.max(1,Math.ceil(length/6));
   for(let i=0;i<steps;i++){
    const ax=road.a[0]+dx*i/steps,az=road.a[1]+dz*i/steps,bx=road.a[0]+dx*(i+1)/steps,bz=road.a[1]+dz*(i+1)/steps;
    quad(road.walk||road.highway==='track'?paths:asphalt,[[ax+nx,az+nz],[ax-nx,az-nz],[bx+nx,bz+nz],[bx-nx,bz-nz]],.045);
   }
  }
  add(asphalt,0x69737a);add(paths,0x9a8260);
  const waterMaterial=new T.MeshStandardMaterial({color:0x467a80,roughness:.25,metalness:.2});
  for(const area of RURAL_WORLD.waterAreas)for(const polygon of area.polygons){
   const shape=new T.Shape(polygon.outer.map((p:number[])=>new T.Vector2(p[0],-p[1])));
   for(const ring of polygon.holes||[])shape.holes.push(new T.Path(ring.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
   const level=Math.min(...polygon.outer.map((p:number[])=>groundHeight(p[0],p[1])))+.018;
   this.group.add(new T.Mesh(new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,level,0),waterMaterial));
  }
  if(!RURAL_WORLD.waterAreas.length)waterMaterial.dispose();
  this.buildings=new MappedBuildingCells(RURAL_WORLD.buildings,this.wall,this.glass,false,false);
  this.group.add(this.buildings.group);
 }
 update(viewer:T.Vector3,battery:boolean){this.buildings.update(viewer,battery);}
 dispose(){
  this.buildings.dispose();const materials=new Set<T.Material>([this.wall,this.glass]);
  this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  materials.forEach(m=>m.dispose());this.group.clear();this.group.removeFromParent();
 }
}
