import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {NEIGHBOURHOOD} from '../tirana-neighbourhood/data.mjs';
import {facadeEdges} from '../tirana-city-source/sourceCore.mjs';
import {buildingGround,groundHeight} from '../tirana-east/terrainCore.mjs';
import {ribbonExclusion} from '../tirana-street-detail/roadDetailCore.mjs';
import {GARDEN_BUILDING,ZOGU_I_ZI} from './junctionLandmarks.mjs';

const circle=(radius:number,y:number)=>new T.CircleGeometry(radius,64).rotateX(-Math.PI/2).translate(0,y,0);
const ring=(inside:number,outside:number,y:number)=>new T.RingGeometry(inside,outside,64).rotateX(-Math.PI/2).translate(0,y,0);
const material=(color:number,roughness:number,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
type Track=Parameters<typeof ribbonExclusion>[0];

export class UrbanJunctionDetails {
  readonly group=new T.Group();
  private sites:{object:T.Group;x:number;z:number;reach:number;build:()=>void}[]=[];
  private disposed=false;
  constructor(track?:Track){
    this.group.name='Tirana:source-backed-west-junctions';
    const fountain=new T.Group(), garden=new T.Group();
    fountain.name='Zogu i Zi · landscaped fountain';
    garden.name='21 Dhjetori · Tirana Garden Building';
    fountain.position.set(ZOGU_I_ZI.x,groundHeight(ZOGU_I_ZI.x,ZOGU_I_ZI.z),ZOGU_I_ZI.z);
    const excludes=track?ribbonExclusion(track):null;
    if(!excludes?.(ZOGU_I_ZI.x,ZOGU_I_ZI.z,ZOGU_I_ZI.radius)){
      this.sites.push({object:fountain,x:ZOGU_I_ZI.x,z:ZOGU_I_ZI.z,reach:470,build:()=>this.buildFountain(fountain)});
      this.group.add(fountain);
    }
    this.sites.push({object:garden,x:GARDEN_BUILDING.x,z:GARDEN_BUILDING.z,reach:770,build:()=>this.buildGarden(garden)});
    this.group.add(garden);
  }
  private add(root:T.Group,parts:T.BufferGeometry[],finish:T.MeshStandardMaterial){
    if(!parts.length){finish.dispose();return;}
    const geometry=mergeGeometries(parts);
    parts.forEach(part=>part.dispose());
    if(!geometry){finish.dispose();return;}
    geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,finish);mesh.receiveShadow=true;root.add(mesh);
  }
  private buildFountain(root:T.Group){
    const {radius,poolRadius}=ZOGU_I_ZI;
    // Distinct reflective-cyan basin, grass apron and low pale coping. Keep
    // the artist's central sculpture unmodeled; no downloaded sculpture/photos.
    this.add(root,[ring(poolRadius+.45,radius-.3,.077)],material(0x455d31,.98));
    this.add(root,[ring(radius-.3,radius,.101),ring(poolRadius,poolRadius+.45,.24)],material(0xbfc0af,.91));
    this.add(root,[circle(poolRadius,.19)],material(0x408789,.28,.08));
    const spray:T.BufferGeometry[]=[];
    for(let i=0;i<16;i++){
      const theta=i*(2*Math.PI/16),height=i%2?.95:1.42,inner=poolRadius*.71;
      const tip=new T.CylinderGeometry(.022,.072,height,5,1).translate(inner*Math.cos(theta),.19+height/2,inner*Math.sin(theta));
      spray.push(tip,ring(.12,.19,.20).translate(inner*Math.cos(theta),0,inner*Math.sin(theta)));
    }
    this.add(root,spray,material(0xb1dcd8,.47));
  }
  private buildGarden(root:T.Group){
    type Stamp=[x:number,y:number,z:number,w:number,h:number,d:number,ry:number,tone?:number];
    const depth=.58, matte:Stamp[]=[],glass:Stamp[]=[],plants:Stamp[]=[];
    const placed=new Set<string>();
    for(const building of NEIGHBOURHOOD.buildings){
      const levels=GARDEN_BUILDING.levels[building.id];if(!levels)continue;
      const first=buildingGround(building),roof=building.h+first;
      const floor=(roof-first)/levels;
      for(const edge of facadeEdges(building.p)){
        if(edge.length<3.1)continue;
        const {a,ux,uz,nx,nz,x,z,length}=edge;
        // The two flat podium source parts share edges. Paint each one once.
        const key=[edge.a.join(':'),edge.b.join(':')].sort().join('|')+':'+roof;
        if(placed.has(key))continue;placed.add(key);
        const rot=-Math.atan2(uz,ux);
        // Orange-red ledges and uprights sit proud of the original glazing.
        // Measured footprint and heights remain owned by existing OSM shells.
        const bays=Math.max(1,Math.round(length/3.7)), span=length/bays;
        glass.push([x+nx*.086,(roof+first)/2+.012,z+nz*.086,length-.10,roof-first-.09,1,Math.atan2(nx,nz)]);
        for(let row=0;row<=levels;row++){
          const y=first+row*floor+.07,beam=row===levels?.15:.21;
          matte.push([x+nx*depth/2,y,z+nz*depth/2,length,beam,depth,rot]);
        }
        for(let column=0;column<=bays;column++){
          const u=column*span,px=a[0]+ux*u,pz=a[1]+uz*u;
          matte.push([px+nx*depth/2,(roof+first)/2,pz+nz*depth/2,.14,roof-first,depth,rot]);
        }
        for(let row=levels===4?1:4;row<levels;row++){
          for(let column=0;column<bays;column++){
            if((column*7+row*3+Math.round(length))%8>=2)continue;
            const u=(column+.63)*span,px=a[0]+ux*u,pz=a[1]+uz*u,y=first+row*floor;
            matte.push([px+nx*.31,y+.22,pz+nz*.31,span*.53,.35,.31,rot]);
            for(let j=-1;j<=1;j++){
              const size=.36+((row+column+j+1)%3)*.045;
              plants.push([px+nx*.32+ux*j*.36,y+.55,pz+nz*.32+uz*j*.36,size,.79*size,size,j,.8+((row+j+1)%3)*.1]);
            }
          }
        }
      }
    }
    const stamp=new T.Object3D(),shade=new T.Color();
    const add=(geometry:T.BufferGeometry,finish:T.MeshStandardMaterial,stamps:Stamp[])=>{
      if(!stamps.length){geometry.dispose();finish.dispose();return;}
      geometry.computeBoundingSphere();
      const mesh=new T.InstancedMesh(geometry,finish,stamps.length);
      stamps.forEach(([x,y,z,w,h,d,ry,tone],i)=>{
        stamp.position.set(x,y,z);stamp.rotation.y=ry;stamp.scale.set(w,h,d);stamp.updateMatrix();
        mesh.setMatrixAt(i,stamp.matrix);
        if(tone!==undefined)mesh.setColorAt(i,shade.setRGB(tone,tone,tone));
      });
      mesh.computeBoundingSphere();mesh.receiveShadow=true;root.add(mesh);
    };
    add(new T.BoxGeometry(),material(0xab4328,.73,.14),matte);
    add(new T.PlaneGeometry(),material(0x3e4d4b,.4,.2),glass);
    add(new T.IcosahedronGeometry(1,0),material(0x4e6538,.92),plants);
  }
  update(viewer?:{x:number;z:number},battery=false){
    if(!viewer||this.disposed)return;
    for(const site of this.sites){
      site.object.visible=Math.hypot(site.x-viewer.x,site.z-viewer.z)<site.reach*(battery?.76:1);
      if(site.object.visible&&!site.object.children.length)site.build();
    }
  }
  dispose(){
    this.disposed=true;
    this.group.traverse(o=>{if(o instanceof T.Mesh){if(o instanceof T.InstancedMesh)o.dispose();o.geometry.dispose();(o.material as T.Material).dispose();}});
    this.group.clear();this.group.removeFromParent();this.sites=[];
  }
}
