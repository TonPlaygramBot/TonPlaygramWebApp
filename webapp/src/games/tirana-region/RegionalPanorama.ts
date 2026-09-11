import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {project} from '../tirana-expansion/geography.mjs';
import {panoramaBlend,panoramaVisible,PANORAMA_FAR,DURRES_REFERENCE,PANORAMA_SOURCE} from './panoramaCore.mjs';

/** Distant LOD of the SAME mapped footprints. No fabricated outer-city blocks.
 * Coast is an explicitly authored atmospheric backdrop, never collision data. */
export class RegionalPanorama {
  readonly group=new T.Group();
  private built=false;
  private materials:T.MeshBasicMaterial[]=[];
  private savedFar:number|undefined;
  constructor(){
    this.group.name='Tirana:regional-panorama';this.group.visible=false;
    this.group.userData={source:WORLD.source,panoramaSource:PANORAMA_SOURCE,
      accuracy:'Source city footprints; approximate coastal silhouette. No regional DEM.',runtimeReady:false};
  }
  private material(color:number){
    const m=new T.MeshBasicMaterial({color,fog:false,transparent:true,opacity:0,depthWrite:false});
    this.materials.push(m);return m;
  }
  private build(){
    this.built=true;
    // One merged shell draw, without windows, balconies or landmark asset loads.
    const parts:T.BufferGeometry[]=[];
    for(const b of WORLD.buildings){
      const shape=new T.Shape(b.p.map(p=>new T.Vector2(p[0],-p[1])));
      const g=new T.ExtrudeGeometry(shape,{depth:b.h,bevelEnabled:false,steps:1,curveSegments:1});
      g.rotateX(-Math.PI/2);parts.push(g);
    }
    const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
    if(geometry){const mesh=new T.Mesh(geometry,this.material(0x909e98));mesh.name='Tirana:source-footprint-distant-LOD';this.group.add(mesh);}
    // Use the existing map extent and street centre lines, without making the
    // ground patch larger than the measured coverage or duplicating the city.
    const lines:T.Vector3[]=[];
    for(const r of WORLD.roads)if(!r.walk)lines.push(new T.Vector3(r.a[0],.12,r.a[1]),new T.Vector3(r.b[0],.12,r.b[1]));
    const roads=new T.LineSegments(new T.BufferGeometry().setFromPoints(lines),new T.LineBasicMaterial({color:0xa5aca3,fog:false,transparent:true,opacity:.5}));
    roads.name='Tirana:source-road-distant-LOD';this.group.add(roads);
    // A far western sea patch; NOT a digitized coastline. No downloaded Google
    // imagery, arbitrary shore roads, or foreground water collision are created.
    const a=project(WORLD.origin,41.46,19.24),b=project(WORLD.origin,41.18,19.43);
    const sea=new T.Mesh(new T.PlaneGeometry(b.x-a.x,b.z-a.z),this.material(0x9eb7be));
    sea.rotation.x=-Math.PI/2;sea.position.set((a.x+b.x)/2,-110,(a.z+b.z)/2);sea.name='Adriatic:approximate-distant-haze';this.group.add(sea);
    const coast=project(WORLD.origin,DURRES_REFERENCE.latitude,DURRES_REFERENCE.longitude);
    const silhouette=new T.Mesh(new T.BoxGeometry(300,1,7000),this.material(0x9caeb1));
    silhouette.position.set(coast.x,-65,coast.z);silhouette.name='Durres:approximate-horizon-silhouette';silhouette.userData={...DURRES_REFERENCE};this.group.add(silhouette);
  }
  update(viewer:T.Vector3,camera?:T.PerspectiveCamera){
    const visible=panoramaVisible(viewer,WORLD.bounds),blend=visible?panoramaBlend(viewer.y):0;
    if(visible&&!this.built)this.build();
    this.group.visible=visible;
    for(const m of this.materials)m.opacity=blend*.8;
    const roads=this.group.getObjectByName('Tirana:source-road-distant-LOD') as T.LineSegments|undefined;
    if(roads)(roads.material as T.LineBasicMaterial).opacity=blend*.4;
    if(camera){
      if(visible){if(this.savedFar===undefined)this.savedFar=camera.far;if(camera.far<PANORAMA_FAR){camera.far=PANORAMA_FAR;camera.updateProjectionMatrix();}}
      else if(this.savedFar!==undefined){camera.far=this.savedFar;this.savedFar=undefined;camera.updateProjectionMatrix();}
    }
  }
  dispose(){
    this.group.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
    this.group.removeFromParent();this.group.clear();this.materials=[];
  }
}
