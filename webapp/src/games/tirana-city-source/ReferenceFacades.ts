import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import { REFERENCE_BUILDINGS, type ReferenceProfile } from './profiles.mjs';
import { facadeEdges, type FacadeEdge } from './sourceCore.mjs';
import { landmarkBuildings } from './landmarkCatalog.mjs';
import { civicBuildingDetails } from './CivicBuildingDetails';
import { landmarkDetails } from './LandmarkDetails';
import {hotelMunicipalEntrances} from './HotelMunicipalEntrances';

/** Recognizable, photo-informed details fitted to existing footprints. Dimensions
 * retain game estimates. No claim of photogrammetry, surveyed height or exact bays. */
export class ReferenceFacades {
  readonly group=new T.Group();
  private entries:{group:T.Group;x:number;z:number}[]=[];
  private materials=new Map<number,T.MeshStandardMaterial>();
  private disposed=false;
  constructor(world=WORLD, onlyIds?:ReadonlySet<string>) {
    this.group.name='Tirana:photo-referenced-institution-facades';
    for(const b of landmarkBuildings(world)){
      // Live game uses the Blender replacement; standalone legacy explorer
      // keeps its selected-site fallback until its own asset finishes loading.
      if(!onlyIds&&'neighbourhood' in b&&b.neighbourhood)continue;
      if(onlyIds&&!onlyIds.has(b.id))continue;
      const profile=REFERENCE_BUILDINGS[b.id];if(!profile)continue;
      const group=new T.Group(),height=profile.height??b.h;
      group.name=profile.name;group.userData={osmWay:b.id,site:b.site,reference:profile.source,referenceDate:profile.date,
        geometryAccuracy:'Original interpretation on retained footprint; dimensions not surveyed'};
      const parts=new Map<number,T.BufferGeometry[]>();
      const add=(color:number,geometry:T.BufferGeometry)=>{if(!parts.has(color))parts.set(color,[]);if(geometry.index){const original=geometry;geometry=original.toNonIndexed();original.dispose();}parts.get(color)!.push(geometry);};
      const box=(color:number,x:number,y:number,z:number,w:number,h:number,d:number,yaw=0)=>{
        if(w<=0||h<=0||d<=0)return;
        add(color,new T.BoxGeometry(w,h,d).rotateY(yaw).translate(x,y,z));
      };
      const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1])));
      for(const hole of b.holes??[])shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));
      const shellHeight=profile.shellHeight??(profile.style==='sky'?height-12:height);
      add(profile.color,new T.ExtrudeGeometry(shape,{depth:shellHeight,bevelEnabled:false,steps:1}).rotateX(-Math.PI/2));
      const edges=facadeEdges(b.p);
      const wall=(e:FacadeEdge,color:number,u:number,y:number,w:number,h:number,d:number,offset=.04)=>{
        // Thin cladding and window fronts need two triangles, not six hidden
        // box faces. Projecting balconies/fins retain their solid geometry.
        if(profile.site&&d<=.2){
          add(color,new T.PlaneGeometry(w,h).rotateY(Math.atan2(e.nx,e.nz)).translate(e.a[0]+e.ux*u+e.nx*(offset+d/2),y,e.a[1]+e.uz*u+e.nz*(offset+d/2)));
          return;
        }
        box(color,e.a[0]+e.ux*u+e.nx*offset,y,e.a[1]+e.uz*u+e.nz*offset,w,h,d,-Math.atan2(e.uz,e.ux));
      };
      const centre={x:b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z:b.p.reduce((s,p)=>s+p[1],0)/b.p.length};
      const detailed=civicBuildingDetails(profile,edges,height,b.p,b.holes??[],add,box,wall)||landmarkDetails(profile,edges,height,add,box,wall,centre);
      hotelMunicipalEntrances(profile,edges,add,wall);
      if(profile.style==='stadium'&&b.holes?.length){
        const hole=b.holes[0],pitch=new T.Shape(hole.map(p=>new T.Vector2(p[0],-p[1])));
        add(0x4f7846,new T.ShapeGeometry(pitch).rotateX(-Math.PI/2).translate(0,.08,0));
        // Source inner roof opening stays open all the way to the field.
        const xs=hole.map(p=>p[0]),zs=hole.map(p=>p[1]);
        const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
        for(const side of [-1,1]){box(0xe8e9d5,x+side*34,.1,z,.12,.025,105);box(0xe8e9d5,x,.1,z+side*52.5,68,.025,.12);}
        box(0xe8e9d5,x,.1,z,68,.025,.12);
        add(0xe8e9d5,new T.TorusGeometry(9.15,.08,4,48).rotateX(-Math.PI/2).translate(x,.12,z));
      }
      for(const e of detailed?[]:edges){
        // Segment-by-segment cornices preserve rounded and irregular corners.
        wall(e,profile.trim,e.length/2,height-.12,e.length+.02,.24,.32,.06);
        wall(e,profile.trim,e.length/2,height-.48,e.length+.02,.12,.24,.07);
        wall(e,profile.trim,e.length/2,.42,e.length,.72,.14);
        if(e.length<3)continue;
        if(profile.style==='swiss'){
          // Ribbed cladding and grilles, rather than apartment balconies.
          for(let u=.12;u<e.length;u+=.18)wall(e,0xb9b8ac,u,height/2,.016,height-.6,.018,.09);
          const count=3,pitch=e.length/4;
          for(const y of [height*.25,height*.72])for(let i=1;i<=count;i++){
            const w=i===3?2.65:1.15,h=height*.29,u=i*pitch;
            wall(e,profile.trim,u,y,w+.2,h+.2,.12,.13);
            wall(e,0x4d5f60,u,y,w,h,.09,.21);
            for(let bar=0;bar<Math.floor(w/.19);bar++){
              const cx=e.a[0]+e.ux*(u-w/2+.1+bar*.19)+e.nx*.3;
              const cz=e.a[1]+e.uz*(u-w/2+.1+bar*.19)+e.nz*.3;
              add(profile.trim,new T.BoxGeometry(.025,h,.025).rotateZ(bar%2?.09:-.09).rotateY(-Math.atan2(e.uz,e.ux)).translate(cx,y,cz));
            }
          }
          continue;
        }
        if(profile.style==='kosova'){
          const count=Math.max(1,Math.round(e.length/3.3)),pitch=e.length/count;
          // Sparse mortar courses keep the brick facade legible at street scale.
          for(let y=.2;y<height-.2;y+=.22)wall(e,0x955e45,e.length/2,y,e.length,.018,.014,.081);
          for(let i=0;i<count;i++){
            const u=(i+.5)*pitch;
            const tall=e.length>20&&i<count*.45;
            const rows=tall?[[2,1.7],[6.5,3.1]]:[[2,1.7],[5.1,1.7],[8,1.7]];
            for(const [y,h] of rows){
              wall(e,profile.trim,u,y,1.48,h+.2,.15,.13);
              wall(e,0x4f6972,u,y,1.25,h,.09,.24);
              wall(e,profile.trim,u,y,.06,h,.08,.3);
              wall(e,profile.trim,u,y,1.25,.075,.08,.3);
            }
          }
          continue;
        }
        if(profile.style==='arts'){
          const count=Math.max(1,Math.round(e.length/4)),pitch=e.length/count;
          for(let i=0;i<count;i++)for(const y of [1.25,4.5,7.65]){
            const u=(i+.5)*pitch,z=e.a[1]+e.uz*u;
            if(e.nx>.8&&Math.abs(z-1081.27)<8)continue;
            const h=y<2?1.25:2.3;
            wall(e,profile.trim,u,y,1.65,h+.24,.17,.13);
            wall(e,0x244333,u,y,1.4,h,.09,.25);
            wall(e,profile.trim,u,y,.06,h,.08,.3);
          }
          if(e.nx>.8&&e.length>25){
            // The entrance spans the two contiguous eastern frontage segments.
            const u=(1081.27-e.a[1])/e.uz;
            for(let offset=-7;offset<=7;offset+=2.8){
              const at=u+offset;if(at<0||at>e.length)continue;
              wall(e,0x536262,at,1.7,2.45,3.3,.09,.15);
              wall(e,profile.trim,at-1.32,1.8,.32,3.6,.65,.5);
            }
          }
          continue;
        }
        if(profile.style==='culture'&&e.nx<-.7&&e.length>30){
          const count=Math.max(2,Math.round(e.length/5));
          wall(e,0x927c70,e.length/2,height*.46,e.length,height*.84,.08,.09);
          for(let i=0;i<=count;i++)wall(e,profile.trim,i*e.length/count,height*.48,.55,height*.9,.6,.8);
          wall(e,profile.trim,e.length/2,height-.7,e.length,1.4,1.7,.7);
          for(const y of [height*.22,height*.68])wall(e,0x57716b,e.length/2,y,e.length-.7,1.6,.12,.15);
          continue;
        }
        const count=Math.max(1,Math.round(e.length/(profile.style==='police'?3.1:3.8)));
        const pitch=e.length/count;
        for(let y=1.9;y<height-1;y+=profile.floor){
          if(profile.style==='hotel'||profile.style==='taivani'){
            wall(e,0x345663,e.length/2,y,e.length-.3,1.55,.13,.12);
            wall(e,profile.trim,e.length/2,y-.99,e.length,.4,.22,.13);
            for(let u=.5;u<e.length;u+=1.75)wall(e,profile.trim,u,y,.065,1.65,.16,.23);
            continue;
          }
          for(let i=0;i<count;i++){
            const u=(i+.5)*pitch,w=Math.min(profile.window,pitch-.9),h=profile.style==='bank'?1.75:1.65;
            wall(e,profile.trim,u,y,w+.22,h+.25,.12,.08);
            wall(e,0x28434a,u,y,w,h,.06,.17);
            wall(e,profile.trim,u,y-h/2-.13,w+.42,.12,.34,.19);
            wall(e,profile.trim,u,y,.06,h,.09,.22);
            if(profile.style==='city-hall'){
              for(const side of [-1,1]){
                const shutter=u+side*(w/2+.27);
                wall(e,0x2d503e,shutter,y,.43,h,.1,.21);
                for(let slat=0;slat<8;slat++)wall(e,0x516552,shutter,y-h/2+.13+slat*h/8,.41,.035,.035,.27);
              }
            }
            if(profile.style==='rogner'&&y<height-4){
              wall(e,0x363c3a,u,y-.55,w+.1,.035,.035,.36);
              for(let rail=0;rail<5;rail++)wall(e,0x363c3a,u-w/2+rail*w/4,y-.74,.025,.4,.035,.36);
            }
          }
        }
        if(profile.style==='city-hall'){
          for(let i=1;i<count;i++){
            wall(e,0xa66046,i*pitch,height/2,.6,height-1,.08,.065);
            for(const side of [-1,1])wall(e,profile.trim,i*pitch+side*.39,height/2,.18,height-1,.13,.13);
          }
          wall(e,profile.trim,e.length/2,height-2.25,e.length,.25,.24,.16);
        }
        if(profile.style==='police'){
          for(const u of [.25,e.length-.25])for(let y=.8;y<height-.5;y+=.42)wall(e,profile.trim,u,y,.48,.32,.18,.15);
          wall(e,profile.trim,e.length/2,3.3,e.length,.22,.3,.17);
        }
      }
      if(profile.style==='bank'){
        // The mapped curved northeast corner is sampled by arc length, so its
        // four portico piers cannot accidentally move to the long rear wall.
        const curved=edges.filter(e=>e.nx>.15&&e.nz<-.15&&e.length<8);
        const length=curved.reduce((sum,e)=>sum+e.length,0);
        for(let i=0;i<4&&length>0;i++){
          let distance=length*(i+.5)/4;
          for(const e of curved){if(distance>e.length){distance-=e.length;continue;}
            wall(e,profile.trim,distance,height*.47,.66,height*.89,.55,.38);break;}
        }
      }
      if(profile.style==='taivani'){
        const x=b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;
        // Faceted glazed cupola with a restrained frame; diameter is authored.
        const dome=new T.SphereGeometry(4.4,12,5,0,Math.PI*2,0,Math.PI/2).translate(x,height,z);
        add(0x749094,dome);
        const wire=new T.WireframeGeometry(dome);const frame=new T.LineSegments(wire,new T.LineBasicMaterial({color:0xced4cd}));group.add(frame);
        for(const e of edges.filter(e=>e.length>4&&e.nx>.5))wall(e,profile.trim,e.length/2,height*.66,e.length,.65,.4,.26);
      }
      for(const [color,geometries] of parts){
        const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)continue;
        if(!this.materials.has(color))this.materials.set(color,new T.MeshStandardMaterial({color,roughness:color===0x28434a||color===0x345663?.33:.88,metalness:color===0x28434a||color===0x345663?.22:0}));
        const material=this.materials.get(color)!;
        if(color===0x28434a||color===0x345663)material.userData.environmentWindow=true;
        const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
      }
      this.group.add(group);this.entries.push({group,x:b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z:b.p.reduce((s,p)=>s+p[1],0)/b.p.length});
    }
  }
  update(viewer?:{x:number;z:number},battery=false){if(!viewer)return;for(const entry of this.entries)entry.group.visible=Math.hypot(entry.x-viewer.x,entry.z-viewer.z)<(battery?600:1100);}
  dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments){o.geometry.dispose();if(o instanceof T.LineSegments)(o.material as T.Material).dispose();}});this.materials.forEach(m=>m.dispose());this.group.clear();}
}
