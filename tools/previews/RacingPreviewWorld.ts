import {ribbonExclusion} from '../../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createRaceSurfaceGeometry} from '../../webapp/src/games/kartroyale/RaceSurface';
import {createBoostPadLayer} from '../../webapp/src/games/kartroyale/BoostPadLayer';
import {createRoadBumpLayer} from '../../webapp/src/games/kartroyale/RoadBumpLayer';
import {createJumpRampLayer} from '../../webapp/src/games/kartroyale/JumpRampLayer';
import {createTyreBarrierMeshes} from '../../webapp/src/games/kartroyale/TyreBarrierLayer';
import {createKerbLayer} from '../../webapp/src/games/kartroyale/KerbLayer';
import {surfaceHeight,surfaceColor} from '../../webapp/src/games/kartroyale/racingSurface.mjs';

/** Small, source-backed neighbourhood assembly for the portable preview.
 * Production uses the complete shared TiranaCityScene and full collision map. */
export function createRacingPreviewWorld(data:any,freeRoam=false){
  const {track,buildings,roads,waterAreas,bounds,tyres}=data;
  const blocked=ribbonExclusion(track);
  const trees=data.trees.filter((t:any)=>freeRoam||!blocked(t.x,t.z,Math.max(.8,t.c*.75)));
  const obstacles=(data.obstacles||[]).filter((o:any)=>freeRoam||!(o.outer?o.outer.some((p:number[])=>blocked(p[0],p[1],.2)):o.a?[o.a,o.b].some((p:number[])=>blocked(p[0],p[1],.2)):blocked(o.x,o.z,o.radius||.2)));
  const world=new T.Group(),groundTrack={...track,terrainMode:'regional'};
  const height=(x:number,z:number)=>surfaceHeight(groundTrack,x,z);
  const [x0,z0,x1,z1]=bounds.map((n:number,i:number)=>(i<2?Math.floor(n/60):Math.ceil(n/60))*60);
  const nx=(x1-x0)/60,nz=(z1-z0)/60,positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=x0+i*60,z=z0+j*60;positions.push(x,height(x,z)-.045,z);}
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const ground=new T.BufferGeometry();ground.setAttribute('position',new T.Float32BufferAttribute(positions,3));ground.setIndex(indices);ground.computeVertexNormals();world.add(new T.Mesh(ground,new T.MeshStandardMaterial({color:'#8d9e78',roughness:1})));
  const roadPositions:number[]=[],roadColors:number[]=[],roadIndices:number[]=[];
  const asphalt=new T.Color('#616b6b'),path=new T.Color('#a79574');
  for(const r of roads){
    const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);if(length<.01)continue;
    const base=roadPositions.length/3,w=r.w/2,color=r.walk?path:asphalt;
    for(const p of [r.a,r.b])for(const side of [-1,1]){const x=p[0]+dz/length*w*side,z=p[1]-dx/length*w*side;roadPositions.push(x,height(x,z)+.075,z);roadColors.push(color.r,color.g,color.b);}
    roadIndices.push(base,base+2,base+1,base+1,base+2,base+3);
  }
  const streetGeometry=new T.BufferGeometry();streetGeometry.setAttribute('position',new T.Float32BufferAttribute(roadPositions,3));streetGeometry.setAttribute('color',new T.Float32BufferAttribute(roadColors,3));streetGeometry.setIndex(roadIndices);streetGeometry.computeVertexNormals();world.add(new T.Mesh(streetGeometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.95,side:T.DoubleSide})));
  const waterMaterial=new T.MeshStandardMaterial({color:'#558b97',roughness:.3,metalness:.12});
  for(const polygon of [...waterAreas.flatMap((w:any)=>w.polygons),...(data.waterPolygons||[])]){
    const shape=new T.Shape(polygon.outer.map((p:number[])=>new T.Vector2(p[0],-p[1])));
    for(const hole of polygon.holes||[])shape.holes.push(new T.Path(hole.map((p:number[])=>new T.Vector2(p[0],-p[1]))));
    const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);geometry.translate(0,Math.min(...polygon.outer.map((p:number[])=>height(p[0],p[1])))+.025,0);world.add(new T.Mesh(geometry,waterMaterial));
  }
  if(!freeRoam){
    world.add(new T.Mesh(createRaceSurfaceGeometry(track),new T.MeshStandardMaterial({color:surfaceColor(track),roughness:.97})),createKerbLayer(track),createTyreBarrierMeshes(tyres.map(([x,z,index]:number[])=>({x,z,index})),height));
    const start=track.points[0],geometry=new T.PlaneGeometry((start.width??track.width)/12,.6),materials=[new T.MeshBasicMaterial({color:'#172b31'}),new T.MeshBasicMaterial({color:'#f4f3e4'})];
    for(let i=0;i<12;i++)for(let j=0;j<2;j++){
      const tile=new T.Mesh(geometry,materials[(i+j)%2]),x=(i-5.5)*(start.width??track.width)/12,z=(j-.5)*.6;
      const wx=start.x+Math.cos(start.yaw)*x+Math.sin(start.yaw)*z,wz=start.z-Math.sin(start.yaw)*x+Math.cos(start.yaw)*z;
      tile.rotation.set(-Math.PI/2,0,-start.yaw);tile.position.set(wx,height(wx,wz)+.14,wz);world.add(tile);
    }
  }
  const batches=new Map<string,{color:string;geometries:T.BufferGeometry[]}>();
  for(const b of buildings){const shape=new T.Shape(b.p.map((p:number[])=>new T.Vector2(p[0],-p[1]))),g=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,Math.max(...b.p.map((p:number[])=>height(p[0],p[1]))),0);const key=`${b.color}/${Math.floor(b.p[0][0]/64)}/${Math.floor(b.p[0][1]/64)}`;if(!batches.has(key))batches.set(key,{color:b.color,geometries:[]});batches.get(key)!.geometries.push(g);}
  for(const {color,geometries} of batches.values()){const g=mergeGeometries(geometries,false);world.add(new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.9})));geometries.forEach(g=>g.dispose());}
  const dummy=new T.Object3D(),trunks=new T.InstancedMesh(new T.CylinderGeometry(.18,.26,1,5),new T.MeshStandardMaterial({color:'#75634d'}),trees.length),leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#507a56',flatShading:true}),trees.length);
  trees.forEach((p:any,i:number)=>{dummy.position.set(p.x,height(p.x,p.z)+p.h*.4,p.z);dummy.scale.set(p.radius/.26,p.h*.8,p.radius/.26);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=height(p.x,p.z)+p.h*.76;dummy.scale.set(p.c*.42,p.h*.3,p.c*.42);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);});trunks.computeBoundingSphere();leaves.computeBoundingSphere();world.add(trunks,leaves);
  const metal=new T.MeshStandardMaterial({color:'#67767b',metalness:.65,roughness:.4});
  const stone=new T.MeshStandardMaterial({color:'#a5a69d',roughness:.95});
  const fixtureParts:T.BufferGeometry[]=[];
  for(const o of obstacles){
    if(o.a){
      const dx=o.b[0]-o.a[0],dz=o.b[1]-o.a[1],length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz),x=(o.a[0]+o.b[0])/2,z=(o.a[1]+o.b[1])/2;
      for(const y of [.45,1.06])fixtureParts.push(new T.BoxGeometry(.075,.07,length).rotateY(yaw).translate(x,height(x,z)+y,z));
      for(const p of [o.a,o.b])fixtureParts.push(new T.BoxGeometry(.09,1.1,.09).translate(p[0],height(...p)+.55,p[1]));
    }else if(o.outer){
      const shape=new T.Shape(o.outer.map((p:number[])=>new T.Vector2(p[0],-p[1]))),g=new T.ExtrudeGeometry(shape,{depth:o.height||1,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,height(...o.outer[0]),0);world.add(new T.Mesh(g,o.material==='concrete'?stone:metal));
    }else{
      const h=o.height||1;fixtureParts.push(new T.CylinderGeometry(o.radius||.1,o.radius||.1,h,5).translate(o.x,height(o.x,o.z)+h/2,o.z));
    }
  }
  if(fixtureParts.length){const g=mergeGeometries(fixtureParts.map(g=>g.toNonIndexed()),false);if(g)world.add(new T.Mesh(g,metal));fixtureParts.forEach(g=>g.dispose());}
  world.add(createBoostPadLayer(track),createRoadBumpLayer(track),createJumpRampLayer(track));return world;
}
