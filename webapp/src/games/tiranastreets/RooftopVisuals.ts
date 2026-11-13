import * as T from 'three';
import {WORLD} from './shared/world.mjs';
import {ROOFTOP_POOLS} from './shared/rooftops.mjs';
import {buildingGround} from '../tirana-east/terrainCore.mjs';
/** Modest geometry at mapped hotels; no swimming pools assigned to unrelated towers. */
export class RooftopVisuals {
 readonly group=new T.Group();
 private water:T.Mesh[]=[];
 constructor(scene:T.Scene){
  this.group.name='Tirana:rooftop-pools';scene.add(this.group);
  const stone=new T.MeshStandardMaterial({color:0xd4cbbb,roughness:.8}),tile=new T.MeshStandardMaterial({color:0x266b85,roughness:.35});
  for(const pool of ROOFTOP_POOLS){
   const b=WORLD.buildings.find(b=>String(b.id)===pool.buildingId);if(!b)continue;
   const root=new T.Group();root.name=pool.name;root.userData.source=pool.source;
   root.position.set(b.p.reduce((s,p)=>s+p[0],0)/b.p.length,buildingGround(b)+b.h+.1,b.p.reduce((s,p)=>s+p[1],0)/b.p.length);
   // Align the long pool edge to the longest mapped hotel edge.
   let edge=[b.p[0],b.p[1]];for(let i=0;i<b.p.length;i++){const a=b.p[i],c=b.p[(i+1)%b.p.length];if(Math.hypot(c[0]-a[0],c[1]-a[1])>Math.hypot(edge[1][0]-edge[0][0],edge[1][1]-edge[0][1]))edge=[a,c];}
   root.rotation.y=-Math.atan2(edge[1][1]-edge[0][1],edge[1][0]-edge[0][0]);
   const base=new T.Mesh(new T.BoxGeometry(pool.width+.8,.45,pool.depth+.8),stone);base.position.y=.225;root.add(base);
   const bed=new T.Mesh(new T.BoxGeometry(pool.width,.12,pool.depth),tile);bed.position.y=.46;root.add(bed);
   const water=new T.Mesh(new T.PlaneGeometry(pool.width-.16,pool.depth-.16),new T.MeshPhysicalMaterial({color:0x28bfd3,metalness:.15,roughness:.17,transparent:true,opacity:.82,clearcoat:1,side:T.DoubleSide}));
   water.rotation.x=-Math.PI/2;water.position.y=.54;root.add(water);this.water.push(water);
   for(const side of [-1,1])for(let i=0;i<3;i++){
    const chair=new T.Mesh(new T.BoxGeometry(1.7,.22,.65),stone);chair.position.set((i-1)*2.4,.3,side*(pool.depth/2+1.2));root.add(chair);
   }
   this.group.add(root);
  }
 }
 update(time:number){this.water.forEach((water,i)=>{(water.material as T.MeshPhysicalMaterial).roughness=.16+Math.sin(time*1.4+i)*.035;});}
 dispose(){const materials=new Set<T.Material>();this.group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());this.group.removeFromParent();}
}
